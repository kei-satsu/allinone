'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import EasyCrop, { Area } from 'react-easy-crop';

// TypeScript Interface
interface CapturedFile {
  id: string;
  file: File;
  preview: string;       
  quality: 'SD' | 'HD';
  textAnnotations: { id: string; text: string; x: number; y: number }[];
  croppedAreaPixels?: { x: number; y: number; width: number; height: number };
}

export default function IntakePage() {
  const router = useRouter();
  
  // useRef များ
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shutterFlashRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  // UI Flow
  const [flowMode, setFlowMode] = useState<'camera' | 'preview'>('camera');
  
  // Text Annotation States
  const [drawingText, setDrawingText] = useState(false);
  const [newText, setNewText] = useState('');

  // Real Crop States
  const [showCropModal, setShowCropModal] = useState(false);
  const [currentCropOrder, setCurrentCropOrder] = useState<CapturedFile | null>(null);
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Dynamic Responsive Dimension (ပုံအချိုးအစားအတိုင်း ကွက်တိဖြစ်စေရန်)
  const [stageDimensions, setStageDimensions] = useState({ width: 320, height: 400 });

  // လက်ရှိ ရွေးချယ်ထားတဲ့ ပုံကို Konva Image အဖြစ် Load လုပ်ခြင်း
  const currentImgObj = capturedImages[currentIdx];
  const [konvaImage] = useImage(currentImgObj?.preview || '', 'anonymous');

  // 🛠️ ✨ FIX: ပုံရဲ့ မူရင်း Aspect Ratio (ကင်မရာပေးတဲ့အတိုင်း) အလိုအလျောက် တွက်ချက်ပြီး ပုံမရှည်အောင် ထိန်းညှိခြင်း
  useEffect(() => {
    if (!konvaImage) return;
    
    const padding = 32;
    const availableWidth = window.innerWidth - padding;
    const imgRatio = konvaImage.width / konvaImage.height;
    
    let computedWidth = availableWidth;
    let computedHeight = availableWidth / imgRatio;
    
    // ဖုန်းမျက်နှာပြင် အမြင့်ထက် ကျော်မသွားအောင် Boundary ထိန်းခြင်း
    const maxAvailableHeight = window.innerHeight * 0.58; 
    if (computedHeight > maxAvailableHeight) {
      computedHeight = maxAvailableHeight;
      computedWidth = maxAvailableHeight * imgRatio;
    }
    
    setStageDimensions({
      width: Math.round(computedWidth),
      height: Math.round(computedHeight)
    });
  }, [konvaImage]);

  // LocalStorage မှ Branch ကုဒ် ရယူခြင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) setUserBranch(storedBranch);
    startCamera();
    return () => stopCamera();
  }, []);

  // Shutter Sound
  const playShutterSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) { 
      output[i] = Math.random() * 2 - 1; 
    }
    
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, audioCtx.currentTime);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    
    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    whiteNoise.start();
    whiteNoise.stop(audioCtx.currentTime + 0.08);
  };

  // Camera စတင်ဖွင့်ခြင်း (🛠️ အချိုးအစား ကန့်သတ်ချက် ဖယ်ရှားပြီး ကင်မရာမူရင်းအတိုင်း ယူခြင်း)
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
          width: { ideal: 1920 },
          height: { ideal: 1080 }
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

  // Gallery မှ ပုံရွေးချယ်မှု ထိန်းချုပ်ခြင်း
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const newImages: CapturedFile[] = files.map((file) => {
      const fileId = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id: fileId,
        file: file,
        preview: URL.createObjectURL(file),
        quality: 'HD',
        textAnnotations: [],
      };
    });

    if (newImages.length > 0) {
      setCapturedImages((prev) => {
        const updated = [...prev, ...newImages];
        setCurrentIdx(updated.length - 1);
        return updated;
      });
      setFlowMode('preview');
      stopCamera();
    }
  };

  // ဓာတ်ပုံရိုက်ကူးခြင်း
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !shutterFlashRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    shutterFlashRef.current.classList.remove('hidden');
    shutterFlashRef.current.classList.add('animate-flash');
    try { playShutterSound(); } catch (e) {}

    // ကင်မရာရဲ့ မူရင်း Resolution အတိုင်း Canvas ကို ဆောက်ပါတယ်
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

  // စာသားထည့်ခြင်း Logic
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

  // Real Crop Feature Functions
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = () => {
    if (currentCropOrder && croppedAreaPixels) {
      const updatedImages = capturedImages.map((img) =>
        img.id === currentCropOrder.id ? { ...img, croppedAreaPixels } : img
      );
      setCapturedImages(updatedImages);
      setShowCropModal(false);
      setCurrentCropOrder(null);
    }
  };

  // စာသားပေါင်းစပ်ခြင်း
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
        const scale = img.width / stageDimensions.width;

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

  // Upload Logic
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

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black font-sans select-none overflow-hidden text-sm text-white relative">
      
      {/* Hidden Gallery Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleGallerySelect} 
        accept="image/*" 
        multiple 
        className="hidden" 
      />

      {/* Visual Shutter Flash */}
      <div ref={shutterFlashRef} className="fixed inset-0 bg-white opacity-0 z-[100] pointer-events-none hidden" />

      {/* Real Crop Feature Modal (🛠️ Aspect Free အလွတ်ဖြတ်စနစ်ပြောင်းလဲထားသည်) */}
      {showCropModal && currentCropOrder && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
          <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex justify-between items-center text-white font-medium">
            <button onClick={() => { setShowCropModal(false); setCurrentCropOrder(null); }} className="text-sm font-semibold text-gray-400">Back</button>
            <h1 className="text-base font-bold uppercase tracking-wider text-orange-500">Free Crop</h1>
            <button onClick={handleCropSave} className="text-sm text-orange-500 font-bold active:scale-95 transition">Save</button>
          </div>
          
          <div className="relative flex-1 bg-black p-2 flex items-center justify-center">
            <div className="relative w-full h-full max-h-[70vh] bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
                <EasyCrop
                    image={currentCropOrder.preview}
                    crop={cropState}
                    zoom={zoomState}
                    aspect={undefined} // 🛠️ ဘယ်အချိုးမှ အတင်းမသတ်မှတ်တော့ဘဲ လွတ်လပ်စွာ ဖြတ်ခွင့်ပြုခြင်း
                    showGrid={true}
                    onCropChange={setCropState}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoomState}
                />
            </div>
          </div>
          
          <div className="bg-neutral-900 px-6 py-5 flex flex-col gap-2 pb-8 border-t border-neutral-800">
             <span className='text-[11px] text-gray-400 text-center mb-1'>Slide to Zoom Image</span>
             <input type="range" value={zoomState} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoomState(Number(e.target.value))} className="w-full accent-orange-500 bg-neutral-800 rounded-lg appearance-none cursor-pointer h-2" />
          </div>
        </div>
      )}

      {/* ၁။ CAMERA MODE VIEW */}
      {flowMode === 'camera' && (
        <div className="flex-1 flex flex-col justify-between p-3 relative h-full">
          
          {/* Top Header Row */}
          <div className="flex justify-between items-center px-2 py-1 z-10 flex-shrink-0">
            <button className="w-9 h-9 flex items-center justify-center bg-neutral-900/40 rounded-full border border-neutral-800/40 opacity-60">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            
            <div className="bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800 text-[11px] font-bold tracking-wider text-orange-400 uppercase">
              {userBranch} Camera
            </div>

            <button onClick={switchFacingMode} className="w-9 h-9 flex items-center justify-center bg-neutral-900/60 rounded-full border border-neutral-800 active:text-orange-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </button>
          </div>

          {/* Viewfinder Area (🛠️ ဖုန်းမှာ ဘေးမည်းလုံးဝမပါဘဲ စမတ်ကျကျ အပြည့်ပေါ်စေရန် ပြင်ဆင်ခြင်း) */}
<div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative">
  <div className="w-full h-full bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl relative border border-neutral-800">
    
    {/* object-cover သုံးပြီး w-full h-full ပေးလိုက်ရင် ဖုန်း screen အပြည့် ကွက်တိ ဖြစ်သွားပါလိမ့်မယ် */}
    <video 
      ref={videoRef} 
      className="w-full h-full object-cover" 
      playsInline 
      muted 
      autoPlay 
    />
    <canvas ref={canvasRef} className="hidden" />
    
  </div>
</div>

          {/* Bottom Controls Panel */}
          <div className="flex flex-col gap-3 flex-shrink-0 pb-2">
            
            {/* Horizontal Captured Thumbnails */}
            {capturedImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-neutral-900/50 backdrop-blur rounded-xl border border-neutral-800/50 max-w-full mx-1">
                {capturedImages.map((img, idx) => (
                  <div key={img.id} onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }} className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                    <img src={img.preview} className="w-full h-full object-cover" alt="" />
                    <button 
                      onClick={(e) => deleteImage(img.id, e)}
                      className="absolute top-0.5 right-0.5 bg-black/80 border border-neutral-700 rounded w-4 h-4 flex items-center justify-center text-red-400 font-bold text-[10px]"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-[8px] px-1 rounded text-gray-300">{idx + 1}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Shutter Layout */}
            <div className="flex justify-between items-center px-6 pt-1">
              <button onClick={() => { setCapturedImages([]); router.push('/'); }} className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-800 flex items-center justify-center active:scale-90 transition-transform">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-neutral-800 active:scale-90 transition-transform">
                <span className="w-14 h-14 rounded-full border-2 border-black bg-white block" />
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-800 flex flex-col items-center justify-center active:scale-90 transition-transform text-orange-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[8px] text-gray-400 font-medium mt-0.5">Gallery</span>
              </button>
            </div>

            {/* Quick Preview Redirect Trigger */}
            {capturedImages.length > 0 && (
              <button onClick={() => { setFlowMode('preview'); stopCamera(); }} className="w-full bg-neutral-900 border border-neutral-800 py-2 rounded-xl text-orange-500 font-bold text-center active:scale-98 transition flex items-center justify-center gap-2">
                <span>Open Preview Editor</span>
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{capturedImages.length}</span>
              </button>
            )}
          </div>

        </div>
      )}

      {/* ၂။ CLEAN PREVIEW / EDIT MODE */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-black justify-between p-3 relative h-full">
          
          {/* Editor Header */}
          <div className="flex justify-between items-center px-1 py-1 flex-shrink-0">
            <button onClick={() => { setFlowMode('camera'); setDrawingText(false); startCamera(); }} className="w-9 h-9 rounded-full bg-neutral-900/80 flex items-center justify-center border border-neutral-800 text-gray-300 active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-gray-400 font-bold text-xs tracking-wider uppercase bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800/80">Editing Mode ({userBranch})</span>
            <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
              +
            </button>
          </div>

          {/* Canvas Preview Container (🛠️ မူရင်းအချိုးအစားအတိုင်း ကွက်တိဖြစ်နေစေမည့် Canvas Box) */}
          <div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative">
            <div 
              className="bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-neutral-800 shadow-2xl relative"
              style={{ width: stageDimensions.width, height: stageDimensions.height }}
            >
              <Stage ref={stageRef} width={stageDimensions.width} height={stageDimensions.height}>
                <Layer>
                  {konvaImage && (
                    <KonvaImage image={konvaImage} width={stageDimensions.width} height={stageDimensions.height} />
                  )}
                  {currentImgObj.textAnnotations.map((ann) => (
                    <KonvaText
                      key={ann.id}
                      id={ann.id}
                      text={ann.text}
                      x={ann.x}
                      y={ann.y}
                      draggable
                      fontSize={22}
                      fontStyle="bold"
                      fill="white"
                      onDragEnd={(e) => handleAnnotationDrag(ann.id, e.target.x(), e.target.y())}
                      onClick={() => {
                        if(window.confirm('ဒီစာသားကို ဖျက်ချင်ပါသလား?')) removeAnnotation(ann.id);
                      }}
                      onTap={() => {
                        if(window.confirm('ဒီစာသားကို ဖျက်ချင်ပါသလား?')) removeAnnotation(ann.id);
                      }}
                    />
                  ))}
                </Layer>
              </Stage>

              {/* Upload Loader overlay */}
              {uploading && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center gap-3 z-50">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
                  <p className="text-sm font-semibold tracking-wide text-orange-400">{uploadProgress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Tools Panel */}
          <div className="flex flex-col gap-2 bg-black flex-shrink-0">
            
            {/* Floating Text Input Bar */}
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

            {/* Pagination Bullet Indicators */}
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

            {/* Bottom Floating Action Utility Row */}
            <div className="flex items-center justify-around px-4 py-2 border-t border-neutral-900/60 bg-neutral-950/40 rounded-xl backdrop-blur-md">
              
              <button 
                onClick={() => { setCurrentCropOrder(currentImgObj); setShowCropModal(true); }}
                className="w-12 h-12 rounded-full flex flex-col items-center justify-center text-neutral-400 hover:text-white active:scale-90 transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h10v10M4 6v14h14M16 20h2M20 16v2" />
                </svg>
                <span className="text-[9px] text-gray-500 mt-0.5">Crop</span>
              </button>

              <button 
                onClick={() => setDrawingText(!drawingText)} 
                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${drawingText ? 'text-orange-500' : 'text-neutral-400 hover:text-white active:scale-90'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-[9px] text-gray-500 mt-0.5">Text</span>
              </button>

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