'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMobileDockVisibility } from '@/components/AppLayout';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import EasyCrop, { Area } from 'react-easy-crop';
import { Scanner } from '@yudiel/react-qr-scanner'; 



// ─── INDEXEDDB OFFLINE STORAGE ENGINE ───
const DB_NAME = 'AllInOne_OfflineIntake';
const STORE_NAME = 'pending_uploads';

const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Queue ထဲသို့ ဒေတာ သိမ်းဆည်းခြင်း
const saveToOfflineQueue = async (item: any) => {
  const db = await openOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Queue ထဲရှိ ဒေတာအားလုံးကို ဆွဲထုတ်ခြင်း
const getOfflineQueue = async (): Promise<any[]> => {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// အောင်မြင်စွာ တင်ပြီးသွားသော Record ကို ဖျက်ထုတ်ခြင်း
const deleteFromOfflineQueue = async (id: string) => {
  const db = await openOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Telegram သို့ ပုံပို့ရန် Server Route ခေါ်ယူခြင်း
const sendToTelegram = async (imageUrl: string, note: string, barcode: string | undefined, branch: string) => {
  console.log("Sending to Telegram via Server Route...", { branch });
  try {
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, note, barcode, branch })
    });
    const result = await response.json();
    if (result.ok) {
      console.log("Telegram သို့ ပုံပို့ခြင်း အောင်မြင်ပါသည်။");
    } else {
      console.error("Telegram API Error Response:", result);
    }
  } catch (error: any) {
    console.error("Network/Fetch Error:", error);
  }
};

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
  
  // useRef ချိန်ညှိမှုများ
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shutterFlashRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  // State စီမံခန့်ခွဲမှု
  const [capturedImages, setCapturedImages] = useState<CapturedFile[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0); 
  const [userBranch, setUserBranch] = useState('MDY');
  const [receivedDate, setReceivedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  // Barcode / Scanner လုပ်ငန်းစဉ်အတွက် State များ
  const [intakeMethod, setIntakeMethod] = useState<'choose' | 'no-barcode' | 'with-barcode'>('choose');
  const [barcodeStep, setBarcodeStep] = useState<'scanning' | 'capturing'>('scanning');
  const [currentScannedBarcode, setCurrentScannedBarcode] = useState('');
  const [cameraLoading, setCameraLoading] = useState(false); 

  // Background Upload Queue States
  const [isBackgroundUploading, setIsBackgroundUploading] = useState(false);
  const [backgroundUploadCount, setBackgroundUploadCount] = useState(0); 
  const [backgroundUploadStatus, setBackgroundUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const clearAllOfflineQueue = async () => {
  const db = await openOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear(); // Queue ထဲရှိသမျှ အကုန်ဖျက်ပစ်ခြင်း
    request.onsuccess = () => {
      setBackgroundUploadStatus('idle');
      setBackgroundUploadCount(0);
      resolve();
      alert('မတင်ရသေးသော Offline Queue စာရင်းအားလုံးကို ဖျက်ပစ်လိုက်ပါပြီဗျာ။');
    };
    request.onerror = () => reject(request.error);
  });
};

  // Camera Config
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // Navigation Flow
  const [flowMode, setFlowMode] = useState<'camera' | 'preview'>('camera');
  const { setHideMobileDock } = useMobileDockVisibility();
  
  // Text Annotation Tool States
  const [drawingText, setDrawingText] = useState(false);
  const [newText, setNewText] = useState('');
  const [batchNote, setBatchNote] = useState('');

  // Image Crop Tool States
  const [showCropModal, setShowCropModal] = useState(false);
  const [currentCropOrder, setCurrentCropOrder] = useState<CapturedFile | null>(null);
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 320, height: 400 });

  const currentImgObj = capturedImages[currentIdx];
  const [konvaImage] = useImage(currentImgObj?.preview || '', 'anonymous');
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');

  // Preview Stage Dimension ကို တွက်ချက်ခြင်း
  useEffect(() => {
    if (!konvaImage) return;
    const padding = 32;
    const availableWidth = window.innerWidth - padding;
    const imgRatio = konvaImage.width / konvaImage.height;
    
    let computedWidth = availableWidth;
    let computedHeight = availableWidth / imgRatio;
    
    const maxAvailableHeight = window.innerHeight * 0.52; 
    if (computedHeight > maxAvailableHeight) {
      computedHeight = maxAvailableHeight;
      computedWidth = maxAvailableHeight * imgRatio;
    }
    setStageDimensions({ width: Math.round(computedWidth), height: Math.round(computedHeight) });
  }, [konvaImage]);

  // Branch ကို LocalStorage မှ ရယူခြင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) setUserBranch(storedBranch);
  }, []);

  // Native ကင်မရာကို စတင်ဖွင့်လှစ်ခြင်း
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

  // ကင်မရာကို ပိတ်သိမ်းခြင်း
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  // Camera Resource Lifecycle logic
  useEffect(() => {
    if (flowMode === 'camera' && intakeMethod !== 'choose') {
      if (intakeMethod === 'with-barcode' && barcodeStep === 'scanning') {
        stopCamera(); 
      } else {
        startCamera(); 
      }
    } else {
      stopCamera();
    }
  }, [flowMode, intakeMethod, barcodeStep, startCamera, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    setHideMobileDock(flowMode === 'camera');
  }, [flowMode, setHideMobileDock]);

  // 🌟 Web App ကို စဖွင့်လိုက်တိုင်း တင်ရန်ကျန်နေခဲ့သော Offline Queue စာရင်းဟောင်းများကို စစ်ဆေးခြင်း
  useEffect(() => {
    const checkUnfinishedUploads = async () => {
      const remainingQueue = await getOfflineQueue();
      if (remainingQueue.length > 0) {
        setBackgroundUploadCount(remainingQueue.length);
        setBackgroundUploadStatus('error'); // အနီရောင် Status ပြထားပြီး ဝန်ထမ်းကို Retry နှိပ်ခွင့်ပြုမည်
      }
    };
    checkUnfinishedUploads();
  }, []);

  // Sound System (Beep & Shutter)
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

  // Barcode ဖတ်မိသည့်အခါ လုပ်ဆောင်ချက်
  const handleCameraScan = async (detectedCodes: any[]) => {
    if (detectedCodes.length === 0 || cameraLoading) return;
    const value = detectedCodes[0].rawValue;
    if (!value) return;

    setCameraLoading(true);
    playBeepSound(); 
    setCurrentScannedBarcode(value); 
    setBarcodeStep('capturing'); 
    setCameraLoading(false);
  };

  // ဖုန်းပြခန်း (Gallery) မှ ပုံရွေးချယ်တင်ခြင်း
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

  // ဓာတ်ပုံရိုက်ယူခြင်း စနစ်
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

  // Text Annotations Operations
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

  // စာသားများကို ပုံရိပ်နှင့် ပေါင်းစပ်ထုတ်လုပ်ခြင်း (Baking)
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

  const saveToDevice = (previewUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🌟 [Core Engine] ဒေတာနှင့် ဓာတ်ပုံ တစ်တွဲတည်း အောင်မြင်မှ Queue ထဲက ဖျက်မည့် စနစ်
  // 🌟 Database အောင်မြင်မှ Telegram ပို့ပြီး Queue ထဲကဖျက်မည့် စနစ်သစ်
  const processOfflineQueue = async () => {
    if (isBackgroundUploading) return;

    const pendingItems = await getOfflineQueue();
    if (pendingItems.length === 0) {
      setBackgroundUploadStatus('idle');
      return;
    }

    setIsBackgroundUploading(true);
    setBackgroundUploadCount(pendingItems.length);
    setBackgroundUploadStatus('uploading');

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME'; 
      const uploadPreset = 'for_allinone'; 

      for (const item of pendingItems) {
        let fileToUpload = item.file;

        // Bake Text Logic (ရှိခဲ့လျှင်)
        if (item.textAnnotations && item.textAnnotations.length > 0) {
          const temporaryPreviewUrl = URL.createObjectURL(item.file);
          const adaptedItem = { ...item, preview: temporaryPreviewUrl };
          fileToUpload = (await bakeImageWithText(adaptedItem)) as File;
          URL.revokeObjectURL(temporaryPreviewUrl);
        }

        // ─── အဆင့် (၁) - CLOUDINARY သို့ ဓာတ်ပုံအရင်တင်ခြင်း ───
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );

        if (!response.ok) {
          throw new Error(`Cloudinary Upload Failed: ${response.statusText}`);
        }

        const cloudinaryData = await response.json();
        const secureUrl = cloudinaryData.secure_url; 

        // ─── အဆင့် (၂) - SUPABASE DATABASE ထဲသို့ အရင်ဆုံး စာရင်းသွင်းခြင်း ───
        // (ဒီနေရာကို အပေါ်သို့ ရွှေ့လိုက်ပါသည်)
        const { error: dbError } = await supabase
          .from('orders')
          .insert([
            {
              image_url: secureUrl,                                  
              branch: item.branch,                                    
              status: 'Pending',                                     
              received_date: item.received_date, 
              uploader_note: item.uploader_note || null,                      
              barcode: item.barcode || null,                       
            },
          ]);

        // အကယ်၍ DB ထဲသွင်းတာ Error တက်ရင် အောက်က Telegram အဆင့်ကို ဆက်မသွားဘဲ ဒီမှာတင် ရပ်ပစ်ပါမည်
        if (dbError) {
          console.error("Supabase Database Insert Error:", dbError);
          throw dbError; 
        }

        // ─── အဆင့် (၃) - DATABASE အောင်မြင်မှ TELEGRAM သို့ လှမ်းပို့ခြင်း ───
        // (DB အောင်မြင်ပြီးမှ ဤကုဒ်အလုပ်လုပ်ပါမည်)
        await sendToTelegram(secureUrl, item.uploader_note, item.barcode, item.branch);

        // ─── အဆင့် (၄) - အားလုံး ရာနှုန်းပြည့်အောင်မြင်မှ ဖုန်းထဲက Queue ကို ဖျက်ခြင်း ───
        await deleteFromOfflineQueue(item.id);
        
        setBackgroundUploadCount(prev => Math.max(0, prev - 1));
      }

      setBackgroundUploadStatus('success');
    } catch (error) {
      console.error('Queue Processing Error:', error);
      setBackgroundUploadStatus('error');
    } finally {
      setIsBackgroundUploading(false);
      
      const remaining = await getOfflineQueue();
      if (remaining.length > 0) {
        setBackgroundUploadStatus('error');
      }
    }
  };

  // 🌟 ဒေတာနှင့် ပုံကို ခွဲမထွက်စေဘဲ Local Queue ထဲ အရင်သိမ်းဆည်းမည့် စနစ်
  const handleFinalSubmit = async () => {
    if (capturedImages.length === 0) return alert('ဓာတ်ပုံ အနည်းဆုံး ၁ ပုံ ရိုက်ပေးပါဗျာ');
    
    // တစ်ပုံချင်းစီကို တစ်ခုချင်းစီစီမံနိုင်အောင် ခွဲထုတ်ပြီး Queue Item ပြုလုပ်ခြင်း
    for (const img of capturedImages) {
      const queueItemId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const offlineItem = {
        id: queueItemId,
        file: img.file, // Native File (Binary Object) ကို IndexedDB က တိုက်ရိုက်သိမ်းပေးနိုင်ပါသည်
        barcode: img.barcode || null,
        textAnnotations: img.textAnnotations || [],
        branch: userBranch,
        received_date: receivedDate,
        uploader_note: batchNote || null
      };

      // Browser Storage ထဲသို့ သိမ်းဆည်းခြင်း
      await saveToOfflineQueue(offlineItem);
    }

    // UI & State အားလုံးကို ဒုတိယအကြိမ် ထပ်မံရိုက်ကူးနိုင်ရန် ချက်ချင်း Clear လုပ်ပါသည်
    setCapturedImages([]); 
    setBatchNote('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setFlowMode('camera');
    setIntakeMethod('choose');

    // နောက်ကွယ်မှ စတင်တင်ပေးမည့် စနစ်ကို လှမ်းခေါ်ခြင်း
    processOfflineQueue();
    alert('ပါဆယ်မှတ်တမ်းများကို Queue ထဲသို့ စိတ်ချစွာသိမ်းဆည်းပြီး၊ နောက်ကွယ်မှ စတင်တင်နေပါပြီဗျာ။');
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-white select-none overflow-hidden max-w-md mx-auto relative font-sans antialiased">
      
      {/* BACKGROUND UPLOADER STATUS NOTIFICATION CARD */}
      {backgroundUploadStatus !== 'idle' && (
        <div className={`absolute top-16 left-3 right-3 z-50 p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
          backgroundUploadStatus === 'uploading' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5' :
          backgroundUploadStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5' :
          'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/5'
        }`}>
          <div className="flex items-center gap-3">
            {backgroundUploadStatus === 'uploading' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
            <span>
              {backgroundUploadStatus === 'uploading' && `ပါဆယ်ပုံရိပ်များ တင်နေဆဲ... ကျန် (${backgroundUploadCount} ပုံ)`}
              {backgroundUploadStatus === 'success' && '✨ ပါဆယ်မှတ်တမ်းများ အားလုံး အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။'}
              {backgroundUploadStatus === 'error' && '❌ ပုံတင်ရန် အဆင်မပြေပါ။ လိုင်းစစ်ဆေးပေးပါဗျာ။'}
            </span>
          </div>
          {backgroundUploadStatus === 'error' && (
              <div className="flex gap-2">
    <button
      onClick={processOfflineQueue}
      className="text-[10px] font-black bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 rounded-lg text-white"
    >
      🔄 Retry Upload
    </button>
    
    {/* 🌟 တမင်ဖျက်ပစ်ချင်လျှင် သုံးရန် Discard Button */}
    <button
      onClick={() => {
        if(confirm("တင်ရန်ကျန်နေသော ပါဆယ်စာရင်းများကို တကယ်ပဲ ဖျက်ပစ်မလားဗျာ?")) {
          clearAllOfflineQueue();
        }
      }}
      className="text-[10px] font-bold bg-red-600 px-2 py-1.5 rounded-lg text-white border border-red-700 active:scale-95"
    >
      🗑️ စာရင်းဖျက်ပစ်မည်
    </button>
  </div>
              
            )}
          {backgroundUploadStatus !== 'uploading' && (
            <button 
              onClick={() => setBackgroundUploadStatus('idle')} 
              className="text-[10px] uppercase font-black bg-neutral-900/80 px-2 py-1 rounded-md border border-neutral-800 text-gray-400 hover:text-white"
            >
              ပိတ်မည်
            </button>
          )}
        </div>
      )}

      {/* METHOD SELECTION SCREEN (UI/UX UPGRADED) */}
      {intakeMethod === 'choose' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black text-center animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-orange-500/10 rotate-3 hover:rotate-0 transition-transform duration-300">
            <svg className="w-9 h-9 text-neutral-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-1 tracking-wider uppercase">ALL IN ONE EXPRESS</h2>
          <p className="text-gray-500 text-xs mb-10 max-w-xs font-medium">ပါဆယ်မှတ်တမ်း မစတင်မီ အသုံးပြုမည့် စနစ်ကို ရွေးချယ်ပေးပါ</p>
          
          <div className="w-full max-w-xs flex flex-col gap-4">
            <button 
              onClick={() => setIntakeMethod('no-barcode')}
              className="group w-full p-4 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 rounded-2xl font-bold text-sm text-neutral-200 active:scale-95 transition-all shadow-lg flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-lg group-hover:bg-orange-500/10 group-hover:text-orange-400 transition-colors">📷</div>
              <div>
                <p className="font-bold text-white text-sm">Barcode မပါဘဲ ပုံရိုက်မည်</p>
                <p className="text-[11px] text-gray-500 font-normal">ပါဆယ်ကို တိုက်ရိုက်ဓာတ်ပုံရိုက်သိမ်းရန်</p>
              </div>
            </button>

            <button 
              onClick={() => { setIntakeMethod('with-barcode'); setBarcodeStep('scanning'); }}
              className="group w-full p-4 bg-gradient-to-br from-orange-500 to-amber-500 text-neutral-950 rounded-2xl active:scale-95 transition-all shadow-xl shadow-orange-500/10 flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg text-neutral-950 font-bold">🔍</div>
              <div>
                <p className="font-black text-neutral-950 text-sm">Barcode စကင်ဖတ်ပြီး ပုံရိုက်မည်</p>
                <p className="text-[11px] text-neutral-900/70 font-medium">Barcode ID တွဲဖက်၍ မှတ်တမ်းတင်ရန်</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* PREMIUM CAMERA / SCANNER MODE INTERFACE */}
      {intakeMethod !== 'choose' && flowMode === 'camera' && (
        <div className="flex-1 flex flex-col bg-black relative justify-between overflow-hidden">
          
          {/* Glassmorphic Top Header */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 flex items-center justify-between z-30 px-5 pt-6">
            <button 
              onClick={() => {
                if(window.confirm('လုပ်ငန်းစဉ်ရွေးချယ်မှု စာမျက်နှာသို့ ပြန်သွားလိုပါသလား?')) {
                  setIntakeMethod('choose');
                  stopCamera();
                }
              }}
              className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md rounded-full border border-neutral-800 text-gray-300 font-bold active:scale-90 transition-transform text-sm shadow-xl"
            >
              ←
            </button>
            <div className="bg-neutral-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-neutral-800 text-[11px] font-extrabold tracking-widest text-orange-400 uppercase shadow-xl">
              {intakeMethod === 'with-barcode' ? (barcodeStep === 'scanning' ? '🔍 SCANNING BARCODE' : '📷 TAKE PARCEL PHOTO') : `📸 ${userBranch} CAMERA`}
            </div>
            <button 
              onClick={switchFacingMode} 
              className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md rounded-full border border-neutral-800 text-gray-300 active:scale-90 transition-transform shadow-xl"
            >
              🔄
            </button>
          </div>

          {/* Viewport Render View */}
          <div className="flex-1 w-full bg-neutral-950 relative flex items-center justify-center overflow-hidden min-h-[60vh]">
            {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' ? (
              /* Barcode Scanner Screen */
              <div className="w-full h-full absolute inset-0 z-10 flex flex-col justify-center bg-black">
                <Scanner 
                  onScan={handleCameraScan}
                  allowMultiple={false}
                  scanDelay={300}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
                {/* Visual Target Overlay for Scanner */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-40 border-2 border-dashed border-orange-500/60 bg-orange-500/5 rounded-2xl relative shadow-2xl">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1 rounded-tl-md"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1 rounded-tr-md"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1 rounded-bl-md"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1 rounded-br-md"></div>
                    <div className="w-full h-0.5 bg-orange-500 absolute top-1/2 left-0 animate-pulse"></div>
                  </div>
                </div>
                <div className="absolute bottom-20 inset-x-0 text-center z-20 px-6">
                  <div className="inline-block bg-neutral-900/95 text-white font-semibold text-xs px-5 py-3 rounded-2xl border border-neutral-800 shadow-2xl backdrop-blur-md">
                    ပါဆယ်ပေါ်ရှိ Barcode / QR ကို ဘောင်အလယ်တွင် ထားပေးပါ
                  </div>
                </div>
              </div>
            ) : (
              /* Native Capture Camera Screen */
              <>
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Camera Flash Screen Layer */}
                <div ref={shutterFlashRef} className="absolute inset-0 bg-white z-40 hidden" />

                {intakeMethod === 'with-barcode' && currentScannedBarcode && (
                  <div className="absolute top-24 left-4 right-4 z-20">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 text-xs font-black uppercase px-4 py-2 rounded-xl shadow-2xl border border-orange-400/20 tracking-wider flex items-center justify-between animate-fade-in">
                      <span className="truncate">🔗 BARCODE: {currentScannedBarcode}</span>
                      <span className="bg-neutral-950 text-orange-400 text-[9px] px-2 py-0.5 rounded-md flex-shrink-0 ml-2">READY</span>
                      {/* 💡 ပြန်လည်စကင်ဖတ်ရန် ခလုတ်အသစ် */}
        <button 
          onClick={() => {
            setBarcodeStep('scanning');
            setCurrentScannedBarcode('');
          }}
          className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-white text-[9px] px-2 py-0.5 rounded-md font-bold transition-colors shadow-sm"
        >
          🔄 ပြန်ဖတ်မည်
        </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls Dock Controller Bottom Section */}
          <div className="flex flex-col gap-3 flex-shrink-0 pb-6 bg-gradient-to-t from-black via-black/90 to-black/30 backdrop-blur-sm z-20 pt-4">
            
            {/* Smooth Thumbnail Preview Horizontal List */}
            {capturedImages.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl max-w-[calc(100%-2rem)] mx-auto scrollbar-none animate-fade-in">
                {capturedImages.map((img, idx) => (
                  <div 
                    key={img.id} 
                    onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }}
                    className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-neutral-700/60 bg-neutral-900 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                  >
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {img.barcode && (
                      <div className="absolute bottom-0 inset-x-0 bg-orange-500 text-neutral-950 text-[8px] font-black text-center truncate py-0.5 px-0.5">
                        {img.barcode}
                      </div>
                    )}
                    <button 
                      onClick={(e) => deleteImage(img.id, e)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center text-white shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* iOS Shutter Style Core Action Control Panel */}
            <div className="flex items-center justify-between px-10 pt-2">
              {/* Media Gallery Pick Button */}
              <label className="w-12 h-12 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer text-lg shadow-xl">
                🖼️
                <input type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
              </label>

              {/* Shutter Central Fire Core Control */}
              {intakeMethod === 'with-barcode' && barcodeStep === 'scanning' ? (
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center animate-pulse text-xs font-black text-neutral-950 shadow-lg shadow-orange-500/20">
                    SCAN
                  </div>
                </div>
              ) : (
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-all shadow-2xl"
                >
                  <div className="w-15 h-15 bg-white rounded-full border-[5px] border-black" />
                </button>
              )}

              {/* Final Step Verification Nav Trigger */}
              {capturedImages.length === 0 ? (
                <div className="w-12 h-12 opacity-0" />
              ) : (
                <button 
                  onClick={() => { setFlowMode('preview'); stopCamera(); }}
                  className="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center active:scale-90 transition-all text-sm font-bold relative shadow-xl text-orange-400"
                >
                  ➡️
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-black text-[10px] flex items-center justify-center rounded-full border-2 border-black shadow">{capturedImages.length}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PREVIEW & RICH EDITING CONSOLE MODE (UI/UX UPGRADED) */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-neutral-950 justify-between p-4 relative h-full">
          <style>{`
            @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideInFromLeft { from { transform: translateX(-100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            .animate-slide-in-right { animation: slideInFromRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            .animate-slide-in-left { animation: slideInFromLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          `}</style>

          {/* Sub Top Action Controls Bar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
            <button 
              onClick={() => { setFlowMode('camera'); }} 
              className="text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3.5 py-2 rounded-xl font-bold text-gray-300 active:scale-95 transition-all"
            >
              📷 ဓာတ်ပုံထပ်ရိုက်မည်
            </button>
            <div className="text-xs font-black text-gray-400 bg-neutral-900/50 px-2.5 py-1 rounded-lg border border-neutral-900">ပုံစစ်ဆေးခြင်း ({currentIdx + 1}/{capturedImages.length})</div>
            <button 
              onClick={(e) => deleteImage(currentImgObj.id, e)} 
              className="text-xs bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 px-3.5 py-2 rounded-xl font-bold text-red-400 active:scale-95 transition-all"
            >
              ဖျက်မည်
            </button>
          </div>

          {/* Linked Barcode Indicator Panel Badge */}
{currentImgObj.barcode && (
  <div className="mt-3 bg-neutral-900/80 border border-orange-500/20 rounded-xl p-3 flex items-center justify-between text-xs animate-fade-in shadow-inner">
    <span className="text-gray-400 font-medium">ချိတ်ဆက်ထားသော Barcode ID:</span>
    <div className="flex items-center gap-2">
      <span className="font-black text-orange-400 tracking-widest font-mono text-sm bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800">{currentImgObj.barcode}</span>
      
      {/* 💡 Preview မှာလည်း Barcode မှားနေရင် ဖြုတ်ပြီး ကင်မရာ စကင်နာသို့ ပြန်သွားစေမည့် ခလုတ် */}
      <button
        onClick={() => {
          if(window.confirm('ဒီပုံရဲ့ Barcode ကို ဖျက်ပြီး စကင်နာဖြင့် ပြန်ဖတ်လိုပါသလားဗျာ?')) {
            // လက်ရှိ ပုံထဲက Barcode ကို ဖျက်ထုတ်ခြင်း
            setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, barcode: undefined } : img));
            // Scanner စာမျက်နှာသို့ ပြန်ပို့ခြင်း
            setFlowMode('camera');
            setBarcodeStep('scanning');
            setCurrentScannedBarcode('');
          }
        }}
        className="text-[10px] bg-red-950/40 border border-red-900/40 text-red-400 px-2 py-1 rounded-md font-bold hover:bg-red-950/60 transition-colors"
      >
        🔄 ပြန်ဖတ်မည်
      </button>
    </div>
  </div>
)}

          {/* Canvas Component Stage Studio Area */}
          <div 
            className="flex-1 my-4 flex items-center justify-center relative touch-none bg-neutral-950 rounded-2xl border border-neutral-900/80 shadow-2xl overflow-hidden"
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
            <div className={`overflow-hidden rounded-xl shadow-2xl relative border border-neutral-800/40 bg-neutral-900 ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`} key={currentImgObj.id}>
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
                      fontSize={22} fill="#ffffff" fontStyle="bold" draggable
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

            {/* Interactive Flow Add Text Box Overlay Menu Layout */}
            {drawingText && (
              <div className="absolute inset-x-3 bottom-3 p-4 bg-neutral-900/95 backdrop-blur-xl rounded-2xl border border-neutral-800 shadow-2xl flex flex-col gap-3 z-40 animate-fade-in animate-slide-up">
                <input 
                  type="text" autoFocus
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700/80 rounded-xl text-white text-sm outline-none focus:border-orange-500 transition-colors"
                  value={newText} onChange={e => setNewText(e.target.value)}
                  placeholder="ပုံပေါ်တင်မည့် စာသားရိုက်ထည့်ပါ..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setDrawingText(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors">ပယ်ဖျက်</button>
                  <button onClick={addTextToCanvas} className="px-5 py-2 text-xs bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-black rounded-lg active:scale-95 transition-transform shadow-md">ထည့်မည်</button>
                </div>
              </div>
            )}
          </div>

          {/* Form Parameters Settings Panel Configurations layout */}
          <div className="flex flex-col gap-3 bg-neutral-900/60 backdrop-blur-md p-4 rounded-2xl border border-neutral-900 mb-3 shadow-xl">
            
            {/* Batch Note Form Group */}
            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-1.5">စုပေါင်းမှတ်ချက် (Batch Note)</label>
              <input 
                type="text" value={batchNote} onChange={e => setBatchNote(e.target.value)}
                placeholder="ဥပမာ - အထုပ်ပျက်စီးမှုစစ်ဆေးပြီး၊ အရေးကြီးပါဆယ်..."
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-orange-500/40 transition-all shadow-inner font-medium"
              />
            </div>

            <div className="mt-2">
  <label className="block text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-1.5">ရက်စွဲ သတ်မှတ်ရန် (Received Date)</label>
  <input 
    type="date" 
    value={receivedDate} 
    onChange={e => setReceivedDate(e.target.value)}
    className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-orange-500/40 transition-all shadow-inner font-medium"
  />
</div>

            <div className="flex items-center justify-between pt-0.5 gap-4">
              {/* Image Resolution Quality Config Selector */}
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 w-1/2 shadow-inner">
                <button onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'SD' } : img))} className={`flex-1 text-center py-1.5 text-[10px] font-black rounded-lg transition-all ${currentImgObj.quality === 'SD' ? 'bg-neutral-800 text-orange-400 shadow' : 'text-neutral-500'}`}>SD</button>
                <button onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'HD' } : img))} className={`flex-1 text-center py-1.5 text-[10px] font-black rounded-lg transition-all ${currentImgObj.quality === 'HD' ? 'bg-neutral-800 text-orange-400 shadow' : 'text-neutral-500'}`}>HD</button>
              </div>

              {/* Action Toolkit Controllers Trigger buttons */}
              <div className="flex gap-2.5 w-1/2 justify-end">
                <button 
                  onClick={() => { setCurrentCropOrder(currentImgObj); setShowCropModal(true); }}
                  className="px-3.5 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-xs rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-sm"
                >
                  ✂️ ဖြတ်မည်
                </button>
                <button 
                  onClick={() => setDrawingText(!drawingText)}
                  className={`px-3.5 py-2 border font-bold text-xs rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-sm ${drawingText ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-orange-500/5' : 'bg-neutral-950 border-neutral-800 text-neutral-300'}`}
                >
                  ✍️ စာသား
                </button>
              </div>
            </div>

          </div>

          {/* Global Process Submission Fire CTA Button */}
          <button 
            onClick={handleFinalSubmit}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-black rounded-2xl shadow-xl shadow-orange-500/5 active:scale-[0.98] transition-all text-sm tracking-wider uppercase font-sans"
          >
            ပါဆယ်မှတ်တမ်းတင်ခြင်း အတည်ပြုမည် ({capturedImages.length} ပုံ)
          </button>
        </div>
      )}

      {/* LIGHTBOX POPUP SYSTEM FOR CRISP IMAGE EASY CROP */}
      {showCropModal && currentCropOrder && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col justify-between animate-fade-in">
          <div className="p-4 pt-6 border-b border-neutral-900 flex justify-between items-center bg-neutral-950">
            <h3 className="text-sm font-bold text-gray-300">ပုံရိပ်ဖြတ်တောက်ပြင်ဆင်ခြင်း</h3>
            <button 
              onClick={() => { setShowCropModal(false); setCurrentCropOrder(null); }} 
              className="text-xs bg-neutral-900 px-2.5 py-1.5 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              ပိတ်မည်
            </button>
          </div>
          <div className="flex-1 relative bg-black">
            <EasyCrop
              image={currentCropOrder.preview} crop={cropState} zoom={zoomState} aspect={3 / 4}
              onCropChange={setCropState} onZoomChange={setZoomState} onCropComplete={handleCropComplete}
            />
          </div>
          <div className="p-5 bg-neutral-950 border-t border-neutral-900 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zoom:</span>
              <input 
                type="range" min={1} max={3} step={0.1} value={zoomState} 
                onChange={(e) => setZoomState(Number(e.target.value))} 
                className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500" 
              />
            </div>
            <button 
              onClick={handleCropSave} 
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-black text-xs rounded-xl active:scale-95 transition-all shadow-lg"
            >
              ဖြတ်တောက်မှု အတည်ပြုသိမ်းဆည်းမည်
            </button>
          </div>
        </div>
      )}

    </div>
  );
}