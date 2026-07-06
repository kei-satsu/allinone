'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMobileDockVisibility } from '@/components/AppLayout';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import EasyCrop, { Area } from 'react-easy-crop';
import { Scanner } from '@yudiel/react-qr-scanner'; // 📸 Camera Scanner Package

// TypeScript Interface
interface CapturedFile {
  id: string;
  file: File;
  preview: string;       
  quality: 'SD' | 'HD';
  textAnnotations: { id: string; text: string; x: number; y: number }[];
  croppedAreaPixels?: { x: number; y: number; width: number; height: number };
  barcode?: string; 
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
  const touchStartX = useRef<number | null>(null);

  // State Management
  const [capturedImages, setCapturedImages] = useState<CapturedFile[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0); 
  const [userBranch, setUserBranch] = useState('MDY');
  
  // Barcode စနစ် လုပ်ငန်းစဉ်အတွက် State များ
  const [intakeMethod, setIntakeMethod] = useState<'choose' | 'no-barcode' | 'with-barcode'>('choose');
  const [barcodeStep, setBarcodeStep] = useState<'scanning' | 'capturing'>('scanning');
  const [currentScannedBarcode, setCurrentScannedBarcode] = useState('');
  const [cameraLoading, setCameraLoading] = useState(false); // Scanner Loading State

  // Background Upload Queue States
  const [isBackgroundUploading, setIsBackgroundUploading] = useState(false);
  const [backgroundUploadCount, setBackgroundUploadCount] = useState(0); 
  const [backgroundUploadStatus, setBackgroundUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Camera States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // UI Flow
  const [flowMode, setFlowMode] = useState<'camera' | 'preview'>('camera');
  const { setHideMobileDock } = useMobileDockVisibility();
  
  // Text Annotation States
  const [drawingText, setDrawingText] = useState(false);
  const [newText, setNewText] = useState('');
  const [batchNote, setBatchNote] = useState('');

  // Real Crop States
  const [showCropModal, setShowCropModal] = useState(false);
  const [currentCropOrder, setCurrentCropOrder] = useState<CapturedFile | null>(null);
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 320, height: 400 });

  const currentImgObj = capturedImages[currentIdx];
  const [konvaImage] = useImage(currentImgObj?.preview || '', 'anonymous');
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    if (!konvaImage) return;
    const padding = 32;
    const availableWidth = window.innerWidth - padding;
    const imgRatio = konvaImage.width / konvaImage.height;
    
    let computedWidth = availableWidth;
    let computedHeight = availableWidth / imgRatio;
    
    const maxAvailableHeight = window.innerHeight * 0.55; 
    if (computedHeight > maxAvailableHeight) {
      computedHeight = maxAvailableHeight;
      computedWidth = maxAvailableHeight * imgRatio;
    }
    setStageDimensions({ width: Math.round(computedWidth), height: Math.round(computedHeight) });
  }, [konvaImage]);

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) setUserBranch(storedBranch);
  }, []);

  // 📸 Native Camera ဖွင့်ခြင်း
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return setCameraSupported(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
      }
    } catch (err) {
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

  // 🌟 Camera Resource ခွဲဝေမှု Lifecycle
  useEffect(() => {
    if (flowMode === 'camera' && intakeMethod !== 'choose') {
      if (intakeMethod === 'with-barcode' && barcodeStep === 'scanning') {
        stopCamera(); // Scanner အလုပ်လုပ်ချိန် Native ကင်မရာကို ပိတ်ထားမည်
      } else {
        startCamera(); // ဓာတ်ပုံရိုက်ချိန် Native ကင်မရာကို ပြန်ဖွင့်မည်
      }
    } else {
      stopCamera();
    }
  }, [flowMode, intakeMethod, barcodeStep, startCamera, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    setHideMobileDock(flowMode === 'camera');
  }, [flowMode, setHideMobileDock]);

  // 🔊 Scanner Beep အသံ
  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  // 🔊 Shutter အသံ
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1; 
      
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
    } catch(e) {}
  };

  // 📸 Scanner ဖတ်မိသည့်အခါ အလုပ်လုပ်မည့် စနစ်
  const handleCameraScan = async (detectedCodes: any[]) => {
    if (detectedCodes.length === 0 || cameraLoading) return;
    const value = detectedCodes[0].rawValue;
    if (!value) return;

    setCameraLoading(true);
    playBeepSound(); // ဖတ်မိကြောင်း အသံပေးမည်
    setCurrentScannedBarcode(value); // Barcode ဂဏန်းကို သိမ်းဆည်းမည်
    setBarcodeStep('capturing'); // Scanner ပိတ်ပြီး Native Camera ဖွင့်ရန် Step ပြောင်းမည်
    setCameraLoading(false);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newImages: CapturedFile[] = files.map((file) => {
      const fileId = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id: fileId, file: file, preview: URL.createObjectURL(file), quality: 'HD', textAnnotations: [],
        barcode: intakeMethod === 'with-barcode' ? currentScannedBarcode : undefined,
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

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !shutterFlashRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    shutterFlashRef.current.classList.remove('hidden');
    shutterFlashRef.current.classList.add('animate-flash');
    playShutterSound();

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
          id: fileId, file: file, preview: URL.createObjectURL(file), quality: 'HD', textAnnotations: [],
          barcode: intakeMethod === 'with-barcode' ? currentScannedBarcode : undefined, 
        };

        setCapturedImages((prev) => {
          const updated = [...prev, newImg];
          setCurrentIdx(updated.length - 1);
          return updated;
        });

        // ဓာတ်ပုံရိုက်ပြီးပါက နောက်တစ်ထုပ်အတွက် စကင်နာ ပြန်ဖွင့်ပေးမည်
        if (intakeMethod === 'with-barcode') {
          setBarcodeStep('scanning');
          setCurrentScannedBarcode('');
        }
      }
    }, 'image/jpeg', 0.95);
  }, [intakeMethod, currentScannedBarcode]);

  const switchFacingMode = () => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setCapturedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (currentIdx >= filtered.length) setCurrentIdx(Math.max(0, filtered.length - 1));
      return filtered;
    });
  };

  const addTextToCanvas = () => {
    if (currentImgObj && newText.trim()) {
      const annotationId = `text_${Date.now()}`;
      setCapturedImages(capturedImages.map((img) => img.id === currentImgObj.id ? { ...img, textAnnotations: [...img.textAnnotations, { id: annotationId, text: newText.trim(), x: 50, y: 120 }] } : img));
      setNewText('');
      setDrawingText(false);
    }
  };

  const handleAnnotationDrag = (annId: string, x: number, y: number) => {
    setCapturedImages(capturedImages.map((img) => img.id === currentImgObj.id ? { ...img, textAnnotations: img.textAnnotations.map((ann) => ann.id === annId ? { ...ann, x, y } : ann) } : img));
  };

  const deleteAnnotation = (annId: string) => {
    setCapturedImages(capturedImages.map((img) => img.id === currentImgObj.id ? { ...img, textAnnotations: img.textAnnotations.filter((ann) => ann.id !== annId) } : img));
  };

  const handleCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => setCroppedAreaPixels(croppedAreaPixels), []);

  const handleCropSave = () => {
    if (currentCropOrder && croppedAreaPixels) {
      setCapturedImages(capturedImages.map((img) => img.id === currentCropOrder.id ? { ...img, croppedAreaPixels } : img));
      setShowCropModal(false);
      setCurrentCropOrder(null);
    }
  };

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
        if (!ctx) return resolve(imgObj.file);

        ctx.drawImage(img, 0, 0);
        const scale = img.width / stageDimensions.width;
        
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
        ctx.textBaseline = 'top';

        imgObj.textAnnotations.forEach((ann) => {
          const textX = ann.x * scale;
          const textY = ann.y * scale;
          ctx.fillText(ann.text, textX, textY);
        });

        offscreenCanvas.toBlob((bakedBlob) => {
          if (bakedBlob) {
            resolve(new File([bakedBlob], imgObj.file.name, { type: 'image/jpeg' }));
          } else {
            resolve(imgObj.file);
          }
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => resolve(imgObj.file);
    });
  };

  const startBackgroundUpload = async (finalImages: CapturedFile[]) => {
    setIsBackgroundUploading(true);
    setBackgroundUploadCount(finalImages.length);
    setBackgroundUploadStatus('uploading');

    try {
      for (let i = 0; i < finalImages.length; i++) {
        const imgObj = finalImages[i];
        let fileToUpload = imgObj.file;

        if (imgObj.textAnnotations.length > 0) {
          fileToUpload = (await bakeImageWithText(imgObj)) as File;
        }

        const fileExt = 'jpg';
        const fileName = `${userBranch}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `intake/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('parcel-images')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('parcel-images')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;

        const { error: dbError } = await supabase.from('intake_records').insert({
          branch: userBranch,
          image_url: publicUrl,
          barcode: imgObj.barcode || null,
          note: batchNote.trim() || null,
          quality: imgObj.quality,
          metadata: {
            cropped: !!imgObj.croppedAreaPixels,
            annotations_count: imgObj.textAnnotations.length
          }
        });

        if (dbError) throw dbError;
        setBackgroundUploadCount((prev) => Math.max(0, prev - 1));
      }
      setBackgroundUploadStatus('success');
    } catch (err) {
      setBackgroundUploadStatus('error');
    } finally {
      setIsBackgroundUploading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (capturedImages.length === 0) return alert('ဓာတ်ပုံ အနည်းဆုံး ၁ ပုံ ရိုက်ပေးပါဗျာ');
    const imagesToUpload = [...capturedImages];
    
    setCapturedImages([]);
    setFlowMode('camera');
    setIntakeMethod('choose');
    setBatchNote('');
    
    startBackgroundUpload(imagesToUpload);
    alert('ပါဆယ်မှတ်တမ်းများကို နောက်ကွယ် (Background) မှ စတင်အပ်ဒိတ်လုပ်နေပါပြီဗျာ။');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white select-none overflow-hidden max-w-md mx-auto relative font-sans">
      
      {/* BACKGROUND UPLOADER STATUS NOTIFICATION */}
      {backgroundUploadStatus !== 'idle' && (
        <div className={`absolute top-14 left-2 right-2 z-50 p-3 rounded-xl border flex items-center justify-between text-xs font-medium shadow-2xl backdrop-blur transition-all ${
          backgroundUploadStatus === 'uploading' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          backgroundUploadStatus === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {backgroundUploadStatus === 'uploading' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            <span>
              {backgroundUploadStatus === 'uploading' && `ပါဆယ်ပုံရိပ်များ Upload တင်နေဆဲ... ကျန်ရှိပုံစံ (${backgroundUploadCount})`}
              {backgroundUploadStatus === 'success' && 'ယခင်ပါဆယ်မှတ်တမ်းများ အားလုံး အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။'}
              {backgroundUploadStatus === 'error' && 'အချို့ပုံများ သိမ်းဆည်းရန် အဆင်မပြေဖြစ်ခဲ့ပါ။ အင်တာနက် စစ်ဆေးပါ။'}
            </span>
          </div>
          {backgroundUploadStatus !== 'uploading' && (
            <button onClick={() => setBackgroundUploadStatus('idle')} className="text-[10px] uppercase font-bold opacity-60 hover:opacity-100">ပိတ်မည်</button>
          )}
        </div>
      )}

      {/* CHOOSE METHOD SCREEN */}
      {intakeMethod === 'choose' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 to-black text-center animate-fade-in">
          <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 text-orange-500 rounded-full flex items-center justify-center mb-4 text-2xl shadow-xl animate-pulse">📷</div>
          <h2 className="text-xl font-bold text-orange-500 mb-2 uppercase tracking-wider">ALL IN ONE DELI</h2>
          <p className="text-gray-400 text-xs mb-8 max-w-xs">ဓာတ်ပုံမရိုက်မီ လုပ်ငန်းစဉ် အမျိုးအစားကို ရွေးချယ်ပေးပါဗျာ</p>
          
          <div className="w-full max-w-xs flex flex-col gap-4">
            <button 
              onClick={() => setIntakeMethod('no-barcode')}
              className="w-full py-4 bg-neutral-900 border border-neutral-800 rounded-2xl font-bold text-sm text-white active:scale-95 transition shadow-lg flex items-center justify-center gap-3"
            >
              📷 Barcode မပါဘဲ ပုံရိုက်မည်
            </button>
            <button 
              onClick={() => { setIntakeMethod('with-barcode'); setBarcodeStep('scanning'); }}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 rounded-2xl font-black text-sm active:scale-95 transition shadow-lg flex items-center justify-center gap-3"
            >
              🔍 Barcode ရိုက်ပြီး ပုံဖတ်မည်
            </button>
          </div>
        </div>
      )}

      {/* CAMERA / SCANNER MODE */}
      {intakeMethod !== 'choose' && flowMode === 'camera' && (
        <div className="flex-1 flex flex-col bg-black relative justify-between overflow-hidden">
          
          {/* Header */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-3 flex items-center justify-between z-30 px-4">
            <button 
              onClick={() => {
                if(window.confirm('လုပ်ငန်းစဉ်ရွေးချယ်မှု စာမျက်နှာသို့ ပြန်သွားလိုပါသလား?')) {
                  setIntakeMethod('choose');
                  stopCamera();
                }
              }}
              className="w-9 h-9 flex items-center justify-center bg-neutral-900/60 rounded-full border border-neutral-800 text-gray-300 font-bold active:scale-90 transition-transform text-xs"
            >
              ←
            </button>
            <div className="bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800 text-[11px] font-bold tracking-wider text-orange-400 uppercase">
              {intakeMethod === 'with-barcode' ? (barcodeStep === 'scanning' ? '🔍 Scanner ပွင့်နေသည်' : '📷 ဓာတ်ပုံရိုက်ရန်') : `${userBranch} Camera`}
            </div>
            <button onClick={switchFacingMode} className="w-9 h-9 flex items-center justify-center bg-neutral-900/60 rounded-full border border-neutral-800 text-gray-300 active:scale-90 transition-transform">
              🔄
            </button>
          </div>

          {/* Viewport Render (ဒီနေရာတွင် Scanner သက်သက်၊ Camera သက်သက် ခွဲထုတ်ထားပါသည်) */}
          <div className="flex-1 w-full bg-neutral-950 relative flex items-center justify-center overflow-hidden min-h-[60vh]">
            {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' ? (
              /* 📸 QR / Barcode Scanner သက်သက် Render ဧရိယာ */
              <div className="w-full h-full absolute inset-0 z-10 flex flex-col justify-center bg-black">
                <Scanner 
                  onScan={handleCameraScan}
                  allowMultiple={false}
                  scanDelay={300}
                  styles={{
                    container: { width: '100%', height: '100%' }
                  }}
                />
                <div className="absolute bottom-16 inset-x-0 text-center z-20 px-6">
                  <div className="inline-block bg-neutral-900/90 text-white font-medium text-xs px-4 py-2.5 rounded-xl border border-neutral-800/80 shadow-2xl backdrop-blur-md">
                    ပါဆယ်ပေါ်ရှိ Barcode / QR ကို အလယ်ကွက်ထဲ ပြပေးပါဗျာ
                  </div>
                </div>
              </div>
            ) : (
              /* 📷 ဓာတ်ပုံရိုက်ကူးမည့် Native Camera သက်သက် Render ဧရိယာ */
              <>
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Flash Effect Node */}
                <div ref={shutterFlashRef} className="absolute inset-0 bg-white z-40 hidden" />

                {intakeMethod === 'with-barcode' && currentScannedBarcode && (
                  <div className="absolute top-16 left-4 right-4 z-20">
                    <div className="bg-orange-500 text-neutral-950 text-[11px] font-black uppercase px-3 py-1.5 rounded-lg shadow-lg border border-orange-400/30 tracking-wider flex items-center justify-between animate-fade-in">
                      <span>LINKED BARCODE: {currentScannedBarcode}</span>
                      <span className="bg-neutral-950 text-orange-400 text-[9px] px-1.5 py-0.5 rounded">READY TO SNAP</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls Bottom Section */}
          <div className="flex flex-col gap-3 flex-shrink-0 pb-4 bg-black/40 backdrop-blur z-20 pt-2">
            
            {/* Thumbnails list */}
            {capturedImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-neutral-900/50 backdrop-blur rounded-xl border border-neutral-800/50 max-w-full mx-2">
                {capturedImages.map((img, idx) => (
                  <div 
                    key={img.id} 
                    onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }}
                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-700/80 bg-neutral-800 flex-shrink-0 cursor-pointer group"
                  >
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {img.barcode && (
                      <div className="absolute bottom-0 inset-x-0 bg-orange-500 text-neutral-950 text-[8px] font-black text-center truncate py-0.5 px-0.5">
                        {img.barcode}
                      </div>
                    )}
                    <button 
                      onClick={(e) => deleteImage(img.id, e)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Shutter Main Trigger Buttons */}
            <div className="flex items-center justify-between px-8 pt-1">
              {/* Gallery upload */}
              <label className="w-11 h-11 bg-neutral-900 rounded-full border border-neutral-800 flex items-center justify-center active:scale-90 transition cursor-pointer text-base">
                🖼️
                <input type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
              </label>

              {/* Central Capture / Status Indicator Button */}
              {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' ? (
                <div className="w-18 h-18 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
                  <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center animate-pulse text-xs font-black text-neutral-950">
                    SCAN
                  </div>
                </div>
              ) : (
                <button 
                  onClick={capturePhoto}
                  className="w-18 h-18 bg-white/10 rounded-full flex items-center justify-center border border-white/30 active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 bg-white rounded-full border-4 border-black" />
                </button>
              )}

              {/* Preview Nav Button */}
              {capturedImages.length === 0 ? (
                <div className="w-11 h-11 opacity-0" />
              ) : (
                <button 
                  onClick={() => { setFlowMode('preview'); stopCamera(); }}
                  className="w-11 h-11 bg-neutral-900 rounded-full border border-neutral-800 flex items-center justify-center active:scale-90 transition text-sm font-bold relative text-orange-400"
                >
                  ➡️
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-neutral-950 font-black text-[10px] flex items-center justify-center rounded-full border-2 border-black">{capturedImages.length}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PREVIEW / EDIT MODE */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-black justify-between p-3 relative h-full">
          <style>{`
            @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideInFromLeft { from { transform: translateX(-100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            .animate-slide-in-right { animation: slideInFromRight 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            .animate-slide-in-left { animation: slideInFromLeft 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          `}</style>

          {/* Top Bar Actions */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
            <button 
              onClick={() => { setFlowMode('camera'); }} 
              className="text-xs bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl font-bold text-gray-300 active:scale-95"
            >
              📷 ဓာတ်ပုံထပ်ရိုက်မည်
            </button>
            <div className="text-xs font-bold text-gray-400">ပုံရိပ်စစ်ဆေးခြင်း ({currentIdx + 1}/{capturedImages.length})</div>
            <button 
              onClick={(e) => deleteImage(currentImgObj.id, e)} 
              className="text-xs bg-red-950/40 border border-red-900/40 px-3 py-1.5 rounded-xl font-bold text-red-400 active:scale-95"
            >
              ဖျက်မည်
            </button>
          </div>

          {/* Barcode Tag Indicator */}
          {currentImgObj.barcode && (
            <div className="mt-2 mx-1 bg-neutral-900 border border-orange-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs animate-fade-in">
              <span className="text-gray-400 font-medium">ချိတ်ဆက်ထားသော Barcode ID:</span>
              <span className="font-black text-orange-400 tracking-wider font-mono text-sm">{currentImgObj.barcode}</span>
            </div>
          )}

          {/* Interactive Annotation Stage Component Container */}
          <div 
            className="flex-1 my-3 flex items-center justify-center relative touch-none bg-neutral-950 rounded-2xl border border-neutral-900"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const diffX = touchStartX.current - e.changedTouches[0].clientX;
              touchStartX.current = null;
              if (Math.abs(diffX) > 60) {
                if (diffX > 0 && currentIdx < capturedImages.length - 1) {
                  setSlideDirection('next');
                  setCurrentIdx(prev => prev + 1);
                } else if (diffX < 0 && currentIdx > 0) {
                  setSlideDirection('prev');
                  setCurrentIdx(prev => prev - 1);
                }
              }
            }}
          >
            <div className={`overflow-hidden rounded-lg shadow-2xl relative ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`} key={currentImgObj.id}>
              <Stage width={stageDimensions.width} height={stageDimensions.height} ref={stageRef}>
                <Layer>
                  {konvaImage && (
                    <KonvaImage 
                      image={konvaImage} 
                      width={stageDimensions.width} 
                      height={stageDimensions.height} 
                      crop={currentImgObj.croppedAreaPixels ? {
                        x: (currentImgObj.croppedAreaPixels.x / 100) * konvaImage.width,
                        y: (currentImgObj.croppedAreaPixels.y / 100) * konvaImage.height,
                        width: (currentImgObj.croppedAreaPixels.width / 100) * konvaImage.width,
                        height: (currentImgObj.croppedAreaPixels.height / 100) * konvaImage.height,
                      } : undefined}
                    />
                  )}
                  {currentImgObj.textAnnotations.map((ann) => (
                    <KonvaText
                      key={ann.id} id={ann.id} text={ann.text} x={ann.x} y={ann.y}
                      fontSize={21} fill="#ffffff" fontStyle="bold" draggable
                      onDragEnd={(e) => handleAnnotationDrag(ann.id, e.target.x(), e.target.y())}
                      onDblClick={() => deleteAnnotation(ann.id)}
                      onTouchEnd={(e) => {
                        if (e.target === e.currentTarget) {
                          const now = Date.now();
                          const lastTouch = (e.currentTarget as any).lastTouchTime || 0;
                          if (now - lastTouch < 300) { deleteAnnotation(ann.id); }
                          (e.currentTarget as any).lastTouchTime = now;
                        }
                      }}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>

            {/* Custom Interactive Text Area Overlays */}
            {drawingText && (
              <div className="absolute inset-x-3 bottom-3 p-3 bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-2xl flex flex-col gap-2 z-40 animate-fade-in">
                <input 
                  type="text" autoFocus
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-white text-sm outline-none focus:border-orange-500"
                  value={newText} onChange={e => setNewText(e.target.value)}
                  placeholder="စာသားထည့်ပါ (စာသားကို ပွတ်ဆွဲရွှေ့နိုင်သည်)"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setDrawingText(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">ပယ်ဖျက်</button>
                  <button onClick={addTextToCanvas} className="px-4 py-1.5 text-xs bg-orange-500 text-neutral-950 font-bold rounded-md">ထည့်မည်</button>
                </div>
              </div>
            )}
          </div>

          {/* Meta Configuration Panel Layout */}
          <div className="flex flex-col gap-2.5 bg-neutral-950/60 p-3 rounded-2xl border border-neutral-900/80 mb-2">
            
            {/* Batch Level Form Inputs */}
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1">စုပေါင်းမှတ်ချက် (Batch Note)</label>
              <input 
                type="text" value={batchNote} onChange={e => setBatchNote(e.target.value)}
                placeholder="ဥပမာ - အထုပ်ပျက်စီးမှုစစ်ဆေးပြီး၊ အရေးကြီးပါဆယ်..."
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 placeholder-neutral-600 rounded-xl px-3 py-2 text-xs outline-none focus:border-orange-500/50 transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-1 gap-4">
              {/* Quality Selector Control */}
              <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 w-1/2">
                <button onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'SD' } : img))} className={`flex-1 text-center py-1 text-[10px] font-bold rounded-md transition-all ${currentImgObj.quality === 'SD' ? 'bg-neutral-800 text-orange-400 shadow' : 'text-neutral-500'}`}>SD</button>
                <button onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'HD' } : img))} className={`flex-1 text-center py-1 text-[10px] font-bold rounded-md transition-all ${currentImgObj.quality === 'HD' ? 'bg-neutral-800 text-orange-400 shadow' : 'text-neutral-500'}`}>HD</button>
              </div>

              {/* Annotation Action Buttons Trigger Panels */}
              <div className="flex gap-2 w-1/2 justify-end">
                <button 
                  onClick={() => { setCurrentCropOrder(currentImgObj); setShowCropModal(true); }}
                  className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  ✂️ ဖြတ်မည်
                </button>
                <button 
                  onClick={() => setDrawingText(!drawingText)}
                  className={`px-3 py-1.5 border font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 transition-all ${drawingText ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-neutral-900 border-neutral-800 text-neutral-300'}`}
                >
                  ✍️ စာသားထည့်
                </button>
              </div>
            </div>

          </div>

          {/* Global Final Action Control CTA Buttons */}
          <button 
            onClick={handleFinalSubmit}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-black rounded-xl shadow-xl active:scale-[0.98] transition-transform text-sm tracking-wide uppercase"
          >
            ပါဆယ်မှတ်တမ်းတင်ခြင်း အတည်ပြုမည် ({capturedImages.length} ပုံ)
          </button>
        </div>
      )}

      {/* MODAL LIGHTBOX SYSTEM FOR ADVANCED EASY CROP STYLING */}
      {showCropModal && currentCropOrder && (
        <div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col justify-between animate-fade-in">
          <div className="p-4 border-b border-neutral-900 flex justify-between items-center bg-black">
            <h3 className="text-sm font-bold text-gray-300">ပုံရိပ်ဖြတ်တောက်ပြင်ဆင်ခြင်း</h3>
            <button onClick={() => { setShowCropModal(false); setCurrentCropOrder(null); }} className="text-xs text-neutral-500 hover:text-white">ပိတ်မည်</button>
          </div>
          <div className="flex-1 relative bg-black">
            <EasyCrop
              image={currentCropOrder.preview} crop={cropState} zoom={zoomState} aspect={3 / 4}
              onCropChange={setCropState} onZoomChange={setZoomState} onCropComplete={handleCropComplete}
            />
          </div>
          <div className="p-4 bg-black border-t border-neutral-900 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">ချဲ့ရန်:</span>
              <input type="range" min={1} max={3} step={0.1} value={zoomState} onChange={(e) => setZoomState(Number(e.target.value))} className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
            </div>
            <button onClick={handleCropSave} className="w-full py-3 bg-orange-500 text-neutral-950 font-bold text-xs rounded-xl active:scale-95 transition">
              ဖြတ်တောက်မှု အတည်ပြုသိမ်းဆည်းမည်
            </button>
          </div>
        </div>
      )}

    </div>
  );
}