'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';

// TypeScript Interface
interface CapturedFile {
  id: string;
  file: File;
  preview: string;       
  quality: 'SD' | 'HD';
  textAnnotations: { id: string; text: string; x: number; y: number }[];
}

export default function IntakePage() {
  const router = useRouter();
  
  // useRef များ
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shutterFlashRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // State Management
  const [capturedImages, setCapturedImages] = useState<CapturedFile[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0); 
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [userBranch, setUserBranch] = useState('MDY');
  
  // Camera States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // UI Flow: 'camera' သို့မဟုတ် 'preview'
  const [flowMode, setFlowMode] = useState<'camera' | 'preview'>('camera');
  
  // Text Annotation States
  const [drawingText, setDrawingText] = useState(false);
  const [newText, setNewText] = useState('');

  // မျက်နှာပြင်အကျယ်အဝန်းကို ယူရန်
  const stageWidth = typeof window !== 'undefined' ? window.innerWidth - 24 : 360;

  // လက်ရှိ ရွေးချယ်ထားတဲ့ ပုံကို Konva Image အဖြစ် Load လုပ်ခြင်း
  const currentImgObj = capturedImages[currentIdx];
  const [konvaImage] = useImage(currentImgObj?.preview || '', 'anonymous');

  // LocalStorage မှ Branch ကုဒ် ရယူခြင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) setUserBranch(storedBranch);
    startCamera();
    return () => stopCamera();
  }, []);

  // 🛠️ ✨ FIX: Realistic Shutter Sound Effect (AudioParam type error ကို ဖြေရှင်းပြီး)
  const playShutterSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // White Noise Buffer ဖန်တီးခြင်း
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) { 
      output[i] = Math.random() * 2 - 1; 
    }
    
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    
    // Highpass Filter နဲ့ အသံကို ကင်မရာ Shutter Click စစ်စစ်အသံထွက်အောင် ညှိခြင်း
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, audioCtx.currentTime);
    
    const gainNode = audioCtx.createGain();
    
    // 🛠️ Error တက်စေတဲ့ rampToValueAtTime ကို ဖယ်ရှားပြီး 
    // Standard Audio API ရဲ့ exponentialRampToValueAtTime ကို အစားထိုးလိုက်ပါတယ်
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    
    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    whiteNoise.start();
    whiteNoise.stop(audioCtx.currentTime + 0.08);
  };

  // Camera စတင်ဖွင့်ခြင်း
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1440 },
          aspectRatio: { ideal: 3 / 4 }
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.error('Video play error:', e));
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraSupported(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  // ဓာတ်ပုံရိုက်ကူးခြင်း
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !shutterFlashRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Flash & Sound
    shutterFlashRef.current.classList.remove('hidden');
    shutterFlashRef.current.classList.add('animate-flash');
    try { playShutterSound(); } catch (e) {}

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      setTimeout(() => {
        if (shutterFlashRef.current) {
          shutterFlashRef.current.classList.add('hidden');
          shutterFlashRef.current.classList.remove('animate-flash');
        }
      }, 150);

      if (blob) {
        const fileId = `photo_${Date.now()}`;
        const file = new File([blob], `${fileId}.jpg`, { type: 'image/jpeg' });
        const newImg: CapturedFile = {
          id: fileId,
          file: file,
          preview: URL.createObjectURL(file),
          quality: 'HD',
          textAnnotations: [],
        };

        setCapturedImages((prev) => {
          const updated = [...prev, newImg];
          setCurrentIdx(updated.length - 1);
          return updated;
        });
      }
    }, 'image/jpeg', 0.95);
  }, []);

  const switchFacingMode = () => {
    if (cameraActive) stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setCapturedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (currentIdx >= filtered.length) {
        setCurrentIdx(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  // စာသားထည့်ခြင်း
  const addTextToCanvas = () => {
    if (currentImgObj && newText.trim()) {
      const annotationId = `text_${Date.now()}`;
      const updatedImages = capturedImages.map((img) => {
        if (img.id === currentImgObj.id) {
          return {
            ...img,
            textAnnotations: [...img.textAnnotations, { id: annotationId, text: newText.trim(), x: 50, y: 120 }]
          };
        }
        return img;
      });
      setCapturedImages(updatedImages);
      setNewText('');
      setDrawingText(false);
    }
  };

  const handleAnnotationDrag = (annId: string, x: number, y: number) => {
    const updatedImages = capturedImages.map((img) => {
      if (img.id === currentImgObj.id) {
        return {
          ...img,
          textAnnotations: img.textAnnotations.map((ann) => ann.id === annId ? { ...ann, x, y } : ann)
        };
      }
      return img;
    });
    setCapturedImages(updatedImages);
  };

  const removeAnnotation = (annId: string) => {
    const updatedImages = capturedImages.map((img) => {
      if (img.id === currentImgObj.id) {
        return {
          ...img,
          textAnnotations: img.textAnnotations.filter((ann) => ann.id !== annId)
        };
      }
      return img;
    });
    setCapturedImages(updatedImages);
  };

  // စာသားနှင့် ပုံကို နောက်ကွယ်မှ ပေါင်းစပ်ပေးမည့် Function
  const bakeImageWithText = (imgObj: CapturedFile): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgObj.preview;
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        const ctx = offscreenCanvas.getContext('2d');
        
        if (!ctx) {
          resolve(imgObj.file);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const scale = img.width / stageWidth;

        ctx.fillStyle = 'white';
        const scaledFontSize = Math.round(24 * scale); 
        ctx.font = `bold ${scaledFontSize}px sans-serif`;
        ctx.textBaseline = 'top';

        imgObj.textAnnotations.forEach((ann) => {
          const scaledX = ann.x * scale;
          const scaledY = ann.y * scale;
          ctx.fillText(ann.text, scaledX, scaledY);
        });

        offscreenCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else resolve(imgObj.file);
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => resolve(imgObj.file);
    });
  };

  // Cloudinary + Supabase သို့ တင်ခြင်း
  const handleFinalUploadAll = async () => {
    if (capturedImages.length === 0) return;
    setUploading(true);
    setUploadProgress('Preparing media...');
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      alert('Cloudinary Cloud Name not set.');
      setUploading(false);
      return;
    }

    try {
      for (let i = 0; i < capturedImages.length; i++) {
        const imgObj = capturedImages[i];
        setUploadProgress(`Uploading (${i + 1}/${capturedImages.length})...`);
        
        let fileToUpload: Blob | File = imgObj.file;

        if (imgObj.textAnnotations.length > 0) {
          fileToUpload = await bakeImageWithText(imgObj);
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', 'for_allinone');

        const cloudinaryRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        const cloudinaryData = await cloudinaryRes.json();
        const imageUrl = cloudinaryData.secure_url;
        if (!imageUrl) throw new Error('Cloudinary upload failed');

        const { error } = await supabase.from('orders').insert([
          {
            image_url: imageUrl,
            branch: userBranch,
            status: 'Pending',
            received_date: new Date().toISOString().split('T')[0],
          },
        ]);
        if (error) throw new Error(`DB Error: ${error.message}`);
      }

      setUploadProgress('Success!');
      setTimeout(() => {
        setCapturedImages([]);
        setUploading(false);
        setUploadProgress('');
        setFlowMode('camera');
        startCamera();
      }, 1200);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Upload failed');
      setUploading(false);
    }
  };

  const handleCropClick = () => {
    // Crop Logic ထည့်သွင်းရန် နေရာလွတ်
    alert('Crop Feature: ဒီနေရာမှာ ပုံဖြတ်တဲ့ Crop Modal သို့မဟုတ် Logic ကို ချိတ်ဆက်နိုင်ပါတယ်ဗျာ။');
  };

  return (
    <div className="h-screen mobile-h-fix flex flex-col bg-black font-sans select-none overflow-hidden text-sm text-white">
      
      {/* Visual Shutter Flash */}
      <div ref={shutterFlashRef} className="fixed inset-0 bg-white opacity-0 z-[100] pointer-events-none hidden" />

      {/* ၁။ CAMERA MODE VIEW */}
      {flowMode === 'camera' && (
        <div className="flex-1 flex flex-col justify-between p-2 relative">
          
          <div className="flex justify-between items-center px-2 py-3 z-10">
            <button className="w-8 h-8 flex items-center justify-center opacity-60">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            
            {/* ဖြုတ်လိုက်သည်- TELEGRAM CAMERA BADGE */}
            <div className="w-10" /> 

            <button onClick={switchFacingMode} className="w-8 h-8 flex items-center justify-center active:text-orange-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </button>
          </div>

          <div className="relative w-full aspect-[3/4] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-neutral-800">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[11px] font-bold border border-neutral-700/50">
               <span className='bg-white text-black rounded-full px-2 py-0.5 shadow-sm'>1x</span>
               <span className='text-gray-400 px-2'>2</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            
            {capturedImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 bg-neutral-900/40 backdrop-blur rounded-xl border border-neutral-800/50 max-w-full mx-2">
                {capturedImages.map((img, idx) => (
                  <div key={img.id} onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 cursor-pointer group active:scale-95 transition-transform">
                    <img src={img.preview} className="w-full h-full object-cover" alt="" />
                    
                    <button 
                      onClick={(e) => deleteImage(img.id, e)}
                      className="absolute top-0.5 right-0.5 bg-black/70 border border-neutral-600 rounded-md w-5 h-5 flex items-center justify-center text-red-400 font-bold text-xs hover:bg-red-600 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-0.5 left-0.5 bg-black/50 text-[9px] px-1 rounded text-gray-300">{idx + 1}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center px-8 pt-2">
              <button onClick={() => { setCapturedImages([]); router.push('/'); }} className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-800 flex items-center justify-center active:scale-90 transition-transform">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-neutral-800 active:scale-90 transition-transform">
                <span className="w-14 h-14 rounded-full border-2 border-black bg-white block" />
              </button>

              {capturedImages.length > 0 ? (
                <button onClick={() => { setFlowMode('preview'); stopCamera(); }} className="text-orange-500 font-bold text-base px-3 py-2 active:scale-95 transition-transform flex items-center gap-1">
                  Done <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{capturedImages.length}</span>
                </button>
              ) : (
                <div className="w-12" />
              )}
            </div>
          </div>

        </div>
      )}

      {/* ၂။ CLEAN PREVIEW / EDIT MODE */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-black justify-between p-3 relative">
          
          <div className="flex justify-between items-center px-1 py-2">
            <button onClick={() => { setFlowMode('camera'); setDrawingText(false); startCamera(); }} className="w-9 h-9 rounded-full bg-neutral-900/50 flex items-center justify-center border border-neutral-800 text-gray-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-gray-400 font-semibold text-xs tracking-wider uppercase">↑ {userBranch}</span>
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow">
              {capturedImages.length}
            </div>
          </div>

          <div className="flex-1 relative bg-neutral-950 rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-900 shadow-inner my-2">
            <Stage ref={stageRef} width={stageWidth} height={stageWidth * (4 / 3)}>
              <Layer>
                {konvaImage && (
                  <KonvaImage image={konvaImage} width={stageWidth} height={stageWidth * (4 / 3)} />
                )}
                {currentImgObj.textAnnotations.map((ann) => (
                  <KonvaText
                    key={ann.id}
                    id={ann.id}
                    text={ann.text}
                    x={ann.x}
                    y={ann.y}
                    draggable
                    fontSize={24}
                    fontStyle="bold"
                    fill="white"
                    onDragEnd={(e) => handleAnnotationDrag(ann.id, e.target.x(), e.target.y())}
                    onClick={() => {
                      if(window.confirm('ဒီစာသားကို ဖျက်ချင်ပါသလား?')) {
                        removeAnnotation(ann.id);
                      }
                    }}
                    onTap={() => {
                      if(window.confirm('ဒီစာသားကို ဖျက်ချင်ပါသလား?')) {
                        removeAnnotation(ann.id);
                      }
                    }}
                  />
                ))}
              </Layer>
            </Stage>

            {uploading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center gap-3 z-50">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
                <p className="text-sm font-semibold tracking-wide text-orange-400">{uploadProgress}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 bg-black">
            
            {drawingText && (
              <div className="flex gap-2 items-center p-2 bg-neutral-900 rounded-xl border border-neutral-800 animate-slideUp">
                <input 
                  type="text" 
                  autoFocus
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-white text-sm outline-none focus:border-orange-500" 
                  value={newText} 
                  onChange={e => setNewText(e.target.value)} 
                  placeholder="ပုံပေါ်တွင် တင်မည့်စာသား ရိုက်ထည့်ပါ..." 
                />
                <button onClick={addTextToCanvas} className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg shadow active:scale-95 transition-transform">Add</button>
              </div>
            )}

            {capturedImages.length > 1 && (
              <div className="flex gap-1.5 justify-center py-1">
                {capturedImages.map((f, i) => (
                  <button 
                    key={f.id} 
                    onClick={() => { setCurrentIdx(i); setDrawingText(false); }}
                    className={`h-1.5 rounded-full transition-all duration-200 ${i === currentIdx ? 'w-6 bg-orange-500' : 'w-2 bg-neutral-700'}`}
                  />
                ))}
              </div>
            )}

            {/* ✨ ပြင်ဆင်လိုက်သည့် အောက်ခြေ Clean Toolbar တန်းလေး */}
            <div className="flex items-center justify-around px-4 py-2 border-t border-neutral-900/60">
              
              {/* ✂️ Crop (ပုံဖြတ်) Tool Button */}
              <button 
                onClick={handleCropClick}
                className="w-11 h-11 rounded-full flex items-center justify-center text-neutral-400 hover:text-white active:scale-90 transition-transform"
                title="Crop Image"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h10v10M4 6v14h14M16 20h2M20 16v2" />
                </svg>
              </button>

              {/* 📝 စာသားထည့်သည့် Tool Button */}
              <button 
                onClick={() => setDrawingText(!drawingText)} 
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${drawingText ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:text-white active:scale-90'}`}
                title="Add Text"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* 🔵 Send/Upload Blue Button */}
              <button 
                onClick={handleFinalUploadAll} 
                disabled={uploading} 
                className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 hover:bg-blue-600 transition-all disabled:bg-neutral-800 disabled:text-neutral-600 flex-shrink-0"
              >
                <svg className="w-6 h-6 transform stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}