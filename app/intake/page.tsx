'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMobileDockVisibility } from '@/components/AppLayout';
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
  
  // 🌟 ZXing Barcode Reader ကို သိမ်းထားရန်
  const codeReader = useRef<any>(null);

  // State Management
  const [capturedImages, setCapturedImages] = useState<CapturedFile[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0); 
  const [userBranch, setUserBranch] = useState('MDY');
  
  // Barcode စနစ် လုပ်ငန်းစဉ်အသစ်အတွက် State များ
  const [intakeMethod, setIntakeMethod] = useState<'choose' | 'no-barcode' | 'with-barcode'>('choose');
  const [barcodeStep, setBarcodeStep] = useState<'scanning' | 'capturing'>('scanning');
  const [currentScannedBarcode, setCurrentScannedBarcode] = useState('');

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

  // ကင်မရာ Lifecycle ထိန်းချုပ်ခြင်း
  useEffect(() => {
    if (flowMode === 'camera' && intakeMethod !== 'choose') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [flowMode, intakeMethod]);

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

  // 📸 ကင်မရာစဖွင့်ခြင်း
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

  // 🌟 Live Barcode Scanner Logic (အဆင့်မြှင့်တင်ထားသော ပုံစံသစ်)
  useEffect(() => {
    let isScanning = true;
    let timeoutId: NodeJS.Timeout;
    let scanCanvas: HTMLCanvasElement | null = null;

    const startScanner = async () => {
      // ၁။ Library ကို စက္ကန့်ပိုင်းအတွင်း dynamic အလုပ်လုပ်အောင် ခေါ်ယူမည်
      if (!codeReader.current) {
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/library');
          codeReader.current = new BrowserMultiFormatReader();
        } catch (err) {
          console.error("Failed to load ZXing library", err);
          return;
        }
      }

      scanCanvas = document.createElement('canvas');

      // ၂။ Loop ပတ်ပြီး စကန်ဖတ်မည့် အစိတ်အပိုင်း
      const scanLoop = async () => {
        if (!isScanning) return;

        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          const video = videoRef.current;
          
          if (scanCanvas) {
            scanCanvas.width = video.videoWidth;
            scanCanvas.height = video.videoHeight;
            const ctx = scanCanvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
              
              try {
                // 🚀 `await` ကိုသုံးပြီး Barcode ရှာဖွေတွေ့ရှိမှုကို အမှန်တကယ် စောင့်ဆိုင်းခြင်း
                const result = await codeReader.current.decodeFromCanvas(scanCanvas);
                if (result && isScanning) {
                  const text = result.getText();
                  playBeepSound(); 
                  setCurrentScannedBarcode(text);
                  setBarcodeStep('capturing'); // ဓာတ်ပုံရိုက်ရန် အဆင့်သို့ ကူးမည်
                  return; // အောင်မြင်သွားပါက လက်ရှိ loop ကို ရပ်တန့်မည်
                }
              } catch (error) {
                // Barcode ရှာမတွေ့သေးပါက error ပြစ်မည်ဖြစ်၍ မည်သည့်အရာမျှ မလုပ်ဘဲ ကျော်သွားမည်
              }
            }
          }
        }

        // စကန်ဖတ်ခြင်း မပြီးမချင်း 350ms ခြားပြီး နောက်တစ်ကြိမ် ထပ်မံလုပ်ဆောင်မည် (Overlapping လုံးဝမဖြစ်စေရန်)
        if (isScanning) {
          timeoutId = setTimeout(scanLoop, 350);
        }
      };

      scanLoop();
    };

    if (flowMode === 'camera' && intakeMethod === 'with-barcode' && barcodeStep === 'scanning' && cameraActive) {
      startScanner();
    }

    return () => {
      isScanning = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [flowMode, intakeMethod, barcodeStep, cameraActive]);


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

        // 🌟 ပုံရိုက်ပြီးပါက နောက်တစ်ထုပ်အတွက် Scanner ကို ချက်ချင်းပြန်ဖွင့်ပေးမည်
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

  const removeAnnotation = (annId: string) => {
    setCapturedImages(capturedImages.map((img) => img.id === currentImgObj.id ? { ...img, textAnnotations: img.textAnnotations.filter((ann) => ann.id !== annId) } : img));
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => setCroppedAreaPixels(croppedAreaPixels), []);

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
        offscreenCanvas.width = img.width; offscreenCanvas.height = img.height;
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return resolve(imgObj.file);

        ctx.drawImage(img, 0, 0);
        const scale = img.width / stageDimensions.width;
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
        ctx.textBaseline = 'top';

        imgObj.textAnnotations.forEach((ann) => ctx.fillText(ann.text, ann.x * scale, ann.y * scale));
        offscreenCanvas.toBlob((blob) => resolve(blob || imgObj.file), 'image/jpeg', 0.95);
      };
      img.onerror = () => resolve(imgObj.file);
    });
  };

  const handleFinalUploadAll = async () => {
    if (capturedImages.length === 0) return;
    
    const imagesToUpload = [...capturedImages];
    const currentNote = batchNote;

    setCapturedImages([]);
    setBatchNote('');
    setFlowMode('camera');
    setIntakeMethod('choose'); 

    setIsBackgroundUploading(true);
    setBackgroundUploadCount(imagesToUpload.length);
    setBackgroundUploadStatus('uploading');

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      alert('Cloudinary Cloud Name not set.');
      setBackgroundUploadStatus('error');
      setTimeout(() => setIsBackgroundUploading(false), 3000);
      return;
    }

    try {
      for (let i = 0; i < imagesToUpload.length; i++) {
        const imgObj = imagesToUpload[i];
        let fileToUpload: Blob | File = imgObj.file;
        if (imgObj.textAnnotations.length > 0) fileToUpload = await bakeImageWithText(imgObj);

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', 'for_allinone');

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
        const cloudinaryData = await cloudinaryRes.json();
        if (!cloudinaryData.secure_url) throw new Error('Cloudinary upload failed');

        const { error } = await supabase.from('orders').insert([
          {
            image_url: cloudinaryData.secure_url,
            branch: userBranch,
            status: 'Pending',
            received_date: new Date().toISOString().split('T')[0],
            uploader_note: currentNote.trim() || null, 
            barcode: imgObj.barcode || null, 
          },
        ]);
        if (error) throw new Error(`DB Error: ${error.message}`);
        setBackgroundUploadCount(prev => prev - 1);
      }

      setBackgroundUploadStatus('success');
      setTimeout(() => setIsBackgroundUploading(false), 3000);
    } catch (error: any) {
      setBackgroundUploadStatus('error');
      setTimeout(() => setIsBackgroundUploading(false), 5000);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black font-sans select-none overflow-hidden text-sm text-white relative">
      
      {/* Animation CSS for Scanner Laser */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan-laser {
          animation: scanLaser 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* 0. WORKFLOW SELECTION */}
      {intakeMethod === 'choose' && (
        <div className="fixed inset-0 bg-neutral-950 z-[400] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4 text-2xl shadow-xl animate-pulse">📷</div>
          <h2 className="text-xl font-bold text-orange-500 mb-2 uppercase tracking-wider">ALL IN ONE DELI</h2>
          <p className="text-gray-400 text-xs mb-8 max-w-xs">ဓာတ်ပုံမရိုက်မီ လုပ်ငန်းစဉ် အမျိုးအစားကို ရွေးချယ်ပေးပါဗျာ။</p>
          
          <div className="w-full max-w-xs flex flex-col gap-4">
            <button onClick={() => setIntakeMethod('no-barcode')} className="w-full py-4 bg-neutral-900 border border-neutral-800 rounded-2xl font-bold text-sm text-white active:scale-95 transition shadow-lg flex items-center justify-center gap-3">
              📷 Barcode မပါဘဲ ပုံရိုက်မည်
            </button>
            <button onClick={() => { setIntakeMethod('with-barcode'); setBarcodeStep('scanning'); }} className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition shadow-lg flex items-center justify-center gap-3 shadow-orange-500/10">
              📦 Barcode + ပုံတွဲရိုက်မည်
            </button>
          </div>
        </div>
      )}

      {/* Upload Indicator */}
      {isBackgroundUploading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-3 py-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/50 rounded-full shadow-lg transition-all">
          {backgroundUploadStatus === 'uploading' && (<><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-bold text-blue-400 tracking-wider">UPLOADING {backgroundUploadCount} ITEMS</span></>)}
          {backgroundUploadStatus === 'success' && (<><svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-[10px] font-bold text-green-400 tracking-wider">SUCCESS!</span></>)}
          {backgroundUploadStatus === 'error' && (<><svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span className="text-[10px] font-bold text-red-400 tracking-wider">UPLOAD FAILED</span></>)}
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleGallerySelect} accept="image/*" multiple className="hidden" />
      <div ref={shutterFlashRef} className="fixed inset-0 bg-white opacity-0 z-[100] pointer-events-none hidden" />

      {/* Crop Modal */}
      {showCropModal && currentCropOrder && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
          <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex justify-between items-center text-white font-medium">
            <button onClick={() => { setShowCropModal(false); setCurrentCropOrder(null); }} className="text-sm font-semibold text-gray-400">Back</button>
            <h1 className="text-base font-bold uppercase tracking-wider text-orange-500">Free Crop</h1>
            <button onClick={handleCropSave} className="text-sm text-orange-500 font-bold active:scale-95 transition">Save</button>
          </div>
          <div className="relative flex-1 bg-black p-2 flex items-center justify-center">
            <div className="relative w-full h-full max-h-[70vh] bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
                <EasyCrop image={currentCropOrder.preview} crop={cropState} zoom={zoomState} aspect={undefined} showGrid={true} onCropChange={setCropState} onCropComplete={onCropComplete} onZoomChange={setZoomState} />
            </div>
          </div>
          <div className="bg-neutral-900 px-6 py-5 flex flex-col gap-2 pb-8 border-t border-neutral-800">
             <span className='text-[11px] text-gray-400 text-center mb-1'>Slide to Zoom Image</span>
             <input type="range" value={zoomState} min={1} max={3} step={0.1} onChange={(e) => setZoomState(Number(e.target.value))} className="w-full accent-orange-500 bg-neutral-800 rounded-lg appearance-none cursor-pointer h-2" />
          </div>
        </div>
      )}

      {/* ၁။ CAMERA & SCANNER MODE VIEW */}
      {flowMode === 'camera' && intakeMethod !== 'choose' && (
        <div className="flex-1 flex flex-col justify-between p-3 relative h-full">
          
          {/* Top Header Row */}
          <div className="flex justify-between items-center px-2 py-1 z-10 flex-shrink-0">
            <button onClick={() => { if(window.confirm('လုပ်ငန်းစဉ်ရွေးချယ်မှု စာမျက်နှာသို့ ပြန်သွားလိုပါသလား?')) { setIntakeMethod('choose'); stopCamera(); } }} className="w-9 h-9 flex items-center justify-center bg-neutral-900/60 rounded-full border border-neutral-800 text-gray-300 font-bold active:scale-90 transition-transform text-xs">
              ←
            </button>
            <div className="bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800 text-[11px] font-bold tracking-wider text-orange-400 uppercase">
              {intakeMethod === 'with-barcode' ? (barcodeStep === 'scanning' ? 'Scanning...' : 'Barcode Linked Mode') : `${userBranch} Camera`}
            </div>
            <button onClick={switchFacingMode} className="w-9 h-9 flex items-center justify-center bg-neutral-900/60 rounded-full border border-neutral-800 active:text-orange-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </button>
          </div>

          {/* Barcode Captured Badge */}
          {intakeMethod === 'with-barcode' && barcodeStep === 'capturing' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold font-mono text-xs px-4 py-1.5 rounded-full shadow-xl animate-slideDown">
              <span>📦 CODE: {currentScannedBarcode}</span>
              <button onClick={() => { setBarcodeStep('scanning'); setCurrentScannedBarcode(''); }} className="bg-black/20 text-[9px] px-1.5 py-0.5 rounded-md font-sans ml-1.5 hover:bg-black/40 active:scale-90 transition-transform">Re-scan</button>
            </div>
          )}

          {/* Viewfinder Area */}
          <div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative">
            <div className="w-full h-full bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl relative border border-neutral-800 flex items-center justify-center">
              
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />

              {/* 🌟 SCANNING LASER OVERLAY */}
              {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                  {/* Focus Box */}
                  <div className="w-[75%] max-w-[300px] aspect-[2/1] border-2 border-orange-500 rounded-xl relative overflow-hidden bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                    <div className="w-full h-[2px] bg-orange-500 shadow-[0_0_15px_3px_rgba(249,115,22,0.8)] absolute animate-scan-laser"></div>
                  </div>
                  
                  {/* Instructions & Manual Input Button */}
                  <div className="mt-8 bg-black/80 px-5 py-3 rounded-full text-white text-xs font-bold flex gap-4 items-center pointer-events-auto border border-neutral-700 shadow-xl">
                    <span className="animate-pulse">📦 Barcode ဖတ်နေသည်...</span>
                    <div className="w-px h-4 bg-neutral-600"></div>
                    <button 
                      onClick={() => {
                        const code = window.prompt('Barcode နံပါတ်ကို ကိုယ်တိုင်ရိုက်ထည့်ပါ:');
                        if(code?.trim()) { setCurrentScannedBarcode(code.trim()); setBarcodeStep('capturing'); }
                      }} 
                      className="text-orange-400 active:scale-90 transition-transform border border-orange-500/30 px-3 py-1 rounded bg-orange-500/10"
                    >
                      စာရိုက်မည်
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Bottom Controls Panel */}
          <div className="flex flex-col gap-3 flex-shrink-0 pb-2">
            
            {/* Captured Thumbnails */}
            {capturedImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-neutral-900/50 backdrop-blur rounded-xl border border-neutral-800/50 max-w-full mx-1">
                {capturedImages.map((img, idx) => (
                  <div key={img.id} onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }} className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                    <img src={img.preview} className="w-full h-full object-cover" alt="" />
                    <button onClick={(e) => deleteImage(img.id, e)} className="absolute top-0.5 right-0.5 bg-black/80 border border-neutral-700 rounded w-4 h-4 flex items-center justify-center text-red-400 font-bold text-[10px]">✕</button>
                    <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-[8px] px-1 rounded text-gray-300">{idx + 1}</div>
                    {img.barcode && (<div className="absolute bottom-0.5 right-0.5 bg-orange-500 text-[6px] px-0.5 rounded text-white font-mono max-w-[32px] truncate">{img.barcode}</div>)}
                  </div>
                ))}
              </div>
            )}

            {/* Shutter Button Row */}
            <div className="flex justify-between items-center px-6 pt-1">
              <button onClick={() => { if(window.confirm('ထွက်ချင်တာ သေချာပါသလား?')) { setCapturedImages([]); router.push('/'); } }} className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-800 flex items-center justify-center active:scale-90 transition-transform">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' ? (
                <button disabled className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center border-4 border-neutral-900 opacity-60">
                   <span className="w-14 h-14 rounded-full border-2 border-neutral-700 bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-500">SCAN FIRST</span>
                </button>
              ) : (
                <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] border-4 border-neutral-800 active:scale-90 transition-transform">
                  <span className="w-14 h-14 rounded-full border-2 border-black bg-white block" />
                </button>
              )}

              <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-800 flex flex-col items-center justify-center active:scale-90 transition-transform text-orange-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[8px] text-gray-400 font-medium mt-0.5">Gallery</span>
              </button>
            </div>

            {/* Editor Open Trigger */}
            {capturedImages.length > 0 && (
              <button onClick={() => { setFlowMode('preview'); stopCamera(); }} className="w-full bg-neutral-900 border border-neutral-800 py-2 rounded-xl text-orange-500 font-bold text-center active:scale-98 transition flex items-center justify-center gap-2">
                <span>Open Preview Editor</span><span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{capturedImages.length}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ၂။ PREVIEW / EDIT MODE */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-black justify-between p-3 relative h-full">
          <style>{`
            @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideInFromLeft { from { transform: translateX(-100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            .animate-slide-in-right { animation: slideInFromRight 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            .animate-slide-in-left { animation: slideInFromLeft 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          `}</style>
          
          <div className="flex justify-between items-center px-1 py-1 flex-shrink-0">
            <button onClick={() => { setFlowMode('camera'); setDrawingText(false); if (intakeMethod === 'with-barcode') setBarcodeStep('scanning'); }} className="w-9 h-9 rounded-full bg-neutral-900/80 flex items-center justify-center border border-neutral-800 text-gray-300 active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-gray-400 font-bold text-xs tracking-wider uppercase bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800/80">Editing Mode</span>
            <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">+</button>
          </div>

          <div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative touch-none"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const touchEndX = e.changedTouches[0].clientX;
              const diffX = touchStartX.current - touchEndX;
              if (Math.abs(diffX) > 50) {
                if (diffX > 0 && currentIdx < capturedImages.length - 1) { setSlideDirection('next'); setCurrentIdx(prev => prev + 1); setDrawingText(false); } 
                else if (diffX < 0 && currentIdx > 0) { setSlideDirection('prev'); setCurrentIdx(prev => prev - 1); setDrawingText(false); }
              }
              touchStartX.current = null;
            }}
          >
            <div key={currentIdx} className={`bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-neutral-800 shadow-2xl relative ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`} style={{ width: stageDimensions.width, height: stageDimensions.height }}>
              <Stage ref={stageRef} width={stageDimensions.width} height={stageDimensions.height}>
                <Layer>
                  {konvaImage && <KonvaImage image={konvaImage} width={stageDimensions.width} height={stageDimensions.height} />}
                  {currentImgObj.textAnnotations.map((ann) => (
                    <KonvaText key={ann.id} id={ann.id} text={ann.text} x={ann.x} y={ann.y} draggable fontSize={22} fontStyle="bold" fill="white" onDragEnd={(e) => handleAnnotationDrag(ann.id, e.target.x(), e.target.y())} onClick={() => { if(window.confirm('ဖျက်ချင်ပါသလား?')) removeAnnotation(ann.id); }} onTap={() => { if(window.confirm('ဖျက်ချင်ပါသလား?')) removeAnnotation(ann.id); }} />
                  ))}
                </Layer>
              </Stage>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-black flex-shrink-0">
            {currentImgObj.barcode && (
              <div className="text-center py-1 animate-slideUp">
                <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono text-xs px-3 py-1 rounded-full font-bold">📦 Barcode: {currentImgObj.barcode}</span>
              </div>
            )}

            {drawingText && (
              <div className="flex gap-2 items-center p-2 bg-neutral-900 rounded-xl border border-neutral-800">
                <input type="text" autoFocus className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-white text-sm outline-none focus:border-orange-500" value={newText} onChange={e => setNewText(e.target.value)} placeholder="စာသားထည့်ပါ..." />
                <button onClick={addTextToCanvas} className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg shadow active:scale-95 transition-transform">Add</button>
              </div>
            )}

            {capturedImages.length > 1 && (
              <div className="flex gap-1.5 justify-center py-1">
                {capturedImages.map((f, i) => <button key={f.id} onClick={() => { setSlideDirection(i > currentIdx ? 'next' : 'prev'); setCurrentIdx(i); setDrawingText(false); }} className={`h-1.5 rounded-full transition-all duration-200 ${i === currentIdx ? 'w-6 bg-orange-500' : 'w-2 bg-neutral-700'}`} />)}
              </div>
            )}

            <div className="px-1 py-1">
              <label className="text-[10px] text-orange-400 font-bold block mb-1 uppercase tracking-wider">💬 Note to Data Entry</label>
              <input type="text" className="w-full px-3 py-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-white text-xs outline-none focus:border-blue-500 transition-colors shadow-inner placeholder-neutral-500" value={batchNote} onChange={(e) => setBatchNote(e.target.value)} placeholder="ဥပမာ - COD ၅သောင်းပါ..." />
            </div>

            <div className="flex items-center justify-around px-4 py-2 border-t border-neutral-900/60 bg-neutral-950/40 rounded-xl backdrop-blur-md">
              <button onClick={() => { setCurrentCropOrder(currentImgObj); setShowCropModal(true); }} className="w-12 h-12 flex flex-col items-center justify-center text-neutral-400 hover:text-white active:scale-90 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h10v10M4 6v14h14M16 20h2M20 16v2" /></svg>
                <span className="text-[9px] text-gray-500 mt-0.5">Crop</span>
              </button>
              <button onClick={() => setDrawingText(!drawingText)} className={`w-12 h-12 flex flex-col items-center justify-center transition-all ${drawingText ? 'text-orange-500' : 'text-neutral-400 hover:text-white active:scale-90'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <span className="text-[9px] text-gray-500 mt-0.5">Text</span>
              </button>
              <button onClick={handleFinalUploadAll} className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 hover:bg-blue-600 transition-all flex-shrink-0">
                <svg className="w-6 h-6 transform stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}