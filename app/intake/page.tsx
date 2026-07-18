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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result.includes(',') ? reader.result.split(',')[1] : reader.result;
        resolve(base64Data);
      } else {
        reject(new Error('Failed to read file as Base64'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as Base64'));
    reader.readAsDataURL(file);
  });
};

const base64ToFile = (base64String: string, fileName: string): File => {
  const cleanedBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const byteCharacters = atob(cleanedBase64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const mimeTypeMatch = base64String.match(/^data:(.*?);base64,/i);
  const mimeType = mimeTypeMatch?.[1] || 'application/octet-stream';

  return new File([byteArray], fileName, { type: mimeType });
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

type IconProps = {
  className?: string;
};

const IconPackage = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 7.5 12 3l8.5 4.5" />
    <path d="M12 3v18" />
    <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
  </svg>
);

const IconCamera = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 8h2.5a2 2 0 0 0 1.7-.9l.8-1.2a2 2 0 0 1 1.7-.9h3.6a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const IconScan = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </svg>
);

const IconImage = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 15-4.5-4.5L7 19" />
  </svg>
);

const IconArrowLeft = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const IconSwitchCamera = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 8h12" />
    <path d="m8 4 4 4-4 4" />
    <path d="M20 16H8" />
    <path d="m16 20-4-4 4-4" />
  </svg>
);

const IconArrowRight = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const IconTrash = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const IconRefresh = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-3.5-7.2" />
    <path d="M21 3v6h-6" />
  </svg>
);

const IconCheck = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconAlert = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3 2 19h20L12 3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const IconUpload = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </svg>
);

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
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [queueManagerOpen, setQueueManagerOpen] = useState(false);
  const [queueActionItemId, setQueueActionItemId] = useState<string | null>(null);

  const refreshQueue = async () => {
    const items = await getOfflineQueue();
    setQueueItems(items);
    return items;
  };

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
        setBackgroundUploadStatus('error');
      }
    };
    checkUnfinishedUploads();
  }, []);

  useEffect(() => {
    if (!queueManagerOpen) return;
    refreshQueue();
  }, [queueManagerOpen]);

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

 // 🌟 Barcode ဖတ်မိသည့်အခါ အသုံးပြုပြီးသား ဟုတ်/မဟုတ် အရင်စစ်ဆေးသည့် စနစ်သစ်
  const handleCameraScan = async (detectedCodes: any[]) => {
    if (detectedCodes.length === 0 || cameraLoading) return;
    const value = detectedCodes[0].rawValue;
    if (!value) return;

    // ၁။ Scanner ကို ဒုတိယအကြိမ် ထပ်မဖတ်အောင် ခေတ္တပိတ်ထားမည်
    setCameraLoading(true);

    try {
      // ၂။ Supabase Database ရဲ့ orders table ထဲမှာ ဒီ barcode ရှိနှင့်ပြီးသားလား လှမ်းစစ်ခြင်း
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('barcode', value)
        .maybeSingle(); // စာရင်းရှိရင် Object ပြန်လာမည်၊ မရှိရင် null ပြန်လာမည်

      if (error) throw error;

      // ၃။ အကယ်၍ စာရင်းရှိနေလျှင် (အသုံးပြုပြီးသား ဖြစ်နေလျှင်)
      if (data) {
        playBeepSound(); // သတိပေးသံ တီးပေးခြင်း
        
        // ဝန်ထမ်းထံ Alert Message ပြသခြင်း
        alert(`⚠️ အသုံးပြုပြီးသား Barcode [${value}] ဖြစ်နေပါသည်!\nနောက်တစ်ခု ပြောင်းလဲဖတ်ပေးပါဗျာ။`);
        
        // စာရင်းတွေကို Reset လုပ်ပြီး Scanning အဆင့်မှာပဲ ဆက်ထားမည်
        setCurrentScannedBarcode('');
        setBarcodeStep('scanning');
        setCameraLoading(false); // Scanner ပြန်ဖွင့်ပေးခြင်း
        return; // အောက်က ဓာတ်ပုံရိုက်မည့် အဆင့်ကို ဆက်မသွားတော့ဘဲ ဒီမှာတင် ရပ်ပစ်ခြင်း
      }

      // ၄။ အကယ်၍ ဒေတာဘေ့စ်ထဲမှာ မရှိသေးသော Barcode အသစ်ဖြစ်လျှင် (ပုံမှန်အတိုင်း ရှေ့ဆက်သွားမည်)
      playBeepSound(); 
      setCurrentScannedBarcode(value); 
      setBarcodeStep('capturing'); // ဓာတ်ပုံရိုက်ကူးရန် ကင်မရာစာမျက်နှာသို့ သွားမည်
      
    } catch (err) {
      console.error("Barcode Verification Error:", err);
      
      // ⚠️ လိုင်းမကောင်းလို့ သို့မဟုတ် Offline ဖြစ်နေလို့ Error တက်ခဲ့လျှင်-
      // နည်းလမ်း (၁) - ပါဆယ်စာရင်း ကွဲလွဲမှုမရှိစေရန် အွန်လိုင်းမှပဲ စစ်ပြီးမှ ပေးဖြတ်မည်
      alert("⚠️ Barcode စစ်ဆေးရတာ အဆင်မပြေပါ။ အင်တာနက်လိုင်းကို ပြန်လည်စစ်ဆေးပေးပါဗျာ။");
      
      // နည်းလမ်း (၂) - အကယ်၍ Offline Mode မှာ စစ်စရာမလိုဘဲ တန်းပေးဖြတ်ချင်ရင် အပေါ်က Alert ကိုပိတ်ပြီး အောက်ကအတိုင်း ဖွင့်ပေးနိုင်ပါတယ်
      /*
      setCurrentScannedBarcode(value); 
      setBarcodeStep('capturing');
      */
    } finally {
      setCameraLoading(false);
    }
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
  
  // ဖျက်ပြီးနောက် ကျန်ရှိမည့် ပုံအသစ်စာရင်းကို ကြိုတင်တွက်ချက်မည်
  const updatedImages = capturedImages.filter((img) => img.id !== id);
  
  // အကယ်၍ ပုံတစ်ပုံမှ မကျန်တော့ပါက (Length က 0 ဖြစ်သွားပါက)
  if (updatedImages.length === 0) {
    setCapturedImages([]);                 // ပုံစာရင်းကို Empty ဖြစ်အောင်လုပ်မည်
    setIntakeMethod('choose');             // စစဝင်ချင်း 'Barcode ပါ/မပါ' ရွေးချယ်သည့် Screen သို့ ပြန်သွားမည်
    setFlowMode('camera');                 // FlowMode ကို ကင်မရာအခြေအနေသို့ ပြန်ပြောင်းမည်
    setBarcodeStep('scanning');            // Barcode အဆင့်ကိုလည်း scanning အဖြစ် ပြန်ပြင်မည်
    setCurrentScannedBarcode('');          // သိမ်းထားမိသော Barcode အဟောင်းကို ဖျက်မည်
    setCurrentIdx(0);                      // Index ကို 0 သို့ ပြန်ညှိမည်
  } else {
    // ပုံများ ကျန်သေးပါက ပုံမှန်အတိုင်း ရှေ့ဆက်သွားမည်
    setCapturedImages(updatedImages);
    if (currentIdx >= updatedImages.length) {
      setCurrentIdx(Math.max(0, updatedImages.length - 1));
    }
  }
};

  // Text Annotations Operations
  const addTextToCanvas = () => {
    if (!currentImgObj || !newText.trim()) return;

    const annotationId = `text_${Date.now()}`;
    const textValue = newText.trim();

    setCapturedImages((prev) =>
      prev.map((img) =>
        img.id === currentImgObj.id
          ? {
              ...img,
              textAnnotations: [...img.textAnnotations, { id: annotationId, text: textValue, x: 50, y: 120 }],
            }
          : img
      )
    );
    setNewText('');
    setDrawingText(false);
  };

  const handleAnnotationDrag = (annId: string, x: number, y: number) => {
    if (!currentImgObj) return;

    setCapturedImages((prev) =>
      prev.map((img) =>
        img.id === currentImgObj.id
          ? {
              ...img,
              textAnnotations: img.textAnnotations.map((ann) => (ann.id === annId ? { ...ann, x, y } : ann)),
            }
          : img
      )
    );
  };

  const deleteAnnotation = (annId: string) => {
    if (!currentImgObj) return;

    setCapturedImages((prev) =>
      prev.map((img) =>
        img.id === currentImgObj.id
          ? {
              ...img,
              textAnnotations: img.textAnnotations.filter((ann) => ann.id !== annId),
            }
          : img
      )
    );
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

  const processSingleOfflineItem = async (item: any) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME';
    const uploadPreset = 'for_allinone';

    const recoveredFile = item.file instanceof File
      ? item.file
      : item.fileBase64
        ? base64ToFile(item.fileBase64, item.fileName || 'offline-image.jpg')
        : (item.file as File | undefined);

    if (!recoveredFile) {
      throw new Error('Offline queue item is missing its image payload');
    }

    let fileToUpload: File = recoveredFile;

    if (item.textAnnotations && item.textAnnotations.length > 0) {
      const temporaryPreviewUrl = URL.createObjectURL(recoveredFile);
      const adaptedItem = { ...item, preview: temporaryPreviewUrl, file: recoveredFile };
      fileToUpload = (await bakeImageWithText(adaptedItem)) as File;
      URL.revokeObjectURL(temporaryPreviewUrl);
    }

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

    if (dbError) {
      throw dbError;
    }

    await sendToTelegram(secureUrl, item.uploader_note, item.barcode, item.branch);
  };

  const uploadSingleItem = async (itemId: string) => {
    const item = queueItems.find((entry) => entry.id === itemId);
    if (!item) return;

    setQueueActionItemId(itemId);
    try {
      await processSingleOfflineItem(item);
      await deleteFromOfflineQueue(itemId);
      const remainingItems = await refreshQueue();
      setBackgroundUploadCount(remainingItems.length);
      setBackgroundUploadStatus(remainingItems.length > 0 ? 'error' : 'idle');
    } catch (error) {
      console.error('Single Item Upload Error:', error);
      setBackgroundUploadStatus('error');
    } finally {
      setQueueActionItemId(null);
    }
  };

  const deleteSingleItem = async (itemId: string) => {
    if (!window.confirm('ဒီ Pending Item ကို ဖျက်ပစ်မလား?')) return;

    setQueueActionItemId(itemId);
    try {
      await deleteFromOfflineQueue(itemId);
      const remainingItems = await refreshQueue();
      setBackgroundUploadCount(remainingItems.length);
      setBackgroundUploadStatus(remainingItems.length > 0 ? 'error' : 'idle');
      if (remainingItems.length === 0) {
        setQueueManagerOpen(false);
      }
    } catch (error) {
      console.error('Single Item Delete Error:', error);
      setBackgroundUploadStatus('error');
    } finally {
      setQueueActionItemId(null);
    }
  };

  // 🌟 [Core Engine] ဒေတာနှင့် ဓာတ်ပုံ တစ်တွဲတည်း အောင်မြင်မှ Queue ထဲက ဖျက်မည့် စနစ်
  // 🌟 Database အောင်မြင်မှ Telegram ပို့ပြီး Queue ထဲကဖျက်မည့် စနစ်သစ်
  const processOfflineQueue = async () => {
    if (isBackgroundUploading) return;

    const pendingItems = await getOfflineQueue();
    if (pendingItems.length === 0) {
      setBackgroundUploadStatus('idle');
      setQueueItems([]);
      return;
    }

    setIsBackgroundUploading(true);
    setBackgroundUploadCount(pendingItems.length);
    setBackgroundUploadStatus('uploading');

    try {
      for (const item of pendingItems) {
        await processSingleOfflineItem(item);
        await deleteFromOfflineQueue(item.id);
        setBackgroundUploadCount(prev => Math.max(0, prev - 1));
        await refreshQueue();
      }

      setBackgroundUploadStatus('success');
    } catch (error) {
      console.error('Queue Processing Error:', error);
      setBackgroundUploadStatus('error');
    } finally {
      setIsBackgroundUploading(false);
      const remaining = await refreshQueue();
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
      const base64Data = await fileToBase64(img.file);
      
      const offlineItem = {
        id: queueItemId,
        fileBase64: base64Data,
        fileName: img.file.name,
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
            {backgroundUploadStatus === 'uploading' ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                <IconUpload className="h-4 w-4 text-amber-400" />
              </div>
            ) : backgroundUploadStatus === 'success' ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                <IconCheck className="h-4 w-4 text-emerald-400" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                <IconAlert className="h-4 w-4 text-amber-400" />
              </div>
            )}
            <div className="flex flex-col">
              {backgroundUploadStatus === 'uploading' && (
                <span className="text-[11px] font-semibold text-amber-300">ပါဆယ်ပုံရိပ်များ တင်နေဆဲ... ကျန် ({backgroundUploadCount} ပုံ)</span>
              )}
              {backgroundUploadStatus === 'success' && (
                <span className="text-[11px] font-semibold text-emerald-300">ပါဆယ်မှတ်တမ်းများ အားလုံး အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။</span>
              )}
              {backgroundUploadStatus === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">⚠ Pending Review</span>
                  <span className="text-[11px] font-semibold text-amber-300">အချို့ item များကို လေ့လာပြီး တင်ရန်လိုအပ်ပါသည်</span>
                </div>
              )}
            </div>
          </div>
          {backgroundUploadStatus === 'error' && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setQueueManagerOpen(true);
                  refreshQueue();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 px-3 py-1.5 text-[10px] font-black text-neutral-950 shadow-[0_0_24px_rgba(249,115,22,0.25)]"
              >
                <span className="text-sm">🔍</span>
                Review Pending Items ({backgroundUploadCount})
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

      {queueManagerOpen && (
        <div className="absolute inset-0 z-[60] flex flex-col bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),_transparent_45%),linear-gradient(135deg,_#030303,_#111114,_#020202)] px-3 py-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-amber-400">Offline Queue Manager</p>
              <h3 className="mt-1 text-xl font-black text-white">PENDING UPLOADS DESK</h3>
            </div>
            <button
              onClick={() => setQueueManagerOpen(false)}
              className="rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-[11px] font-semibold text-neutral-300"
            >
              Close
            </button>
          </div>

          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
            <span>Review, upload, or discard each pending item with precision from this cinematic desk view.</span>
            <button
              onClick={() => processOfflineQueue()}
              disabled={isBackgroundUploading}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-3 py-2 text-[11px] font-black text-neutral-950 shadow-[0_0_18px_rgba(249,115,22,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBackgroundUploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950" />
                  Reuploading All...
                </span>
              ) : (
                '🚀 Reupload All Queue Items'
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            {queueItems.length === 0 ? (
              <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  <IconCheck className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-white">Queue is clear</p>
                <p className="mt-1 text-[11px] text-neutral-400">There are no pending uploads waiting for review.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {queueItems.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                    <div className="flex items-start gap-3">
                      <div className="h-24 min-w-[88px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                        {item.fileBase64 ? (
                          <img
                            src={`data:image/jpeg;base64,${item.fileBase64}`}
                            alt="pending upload preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                            No Preview
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full border border-neutral-800 bg-neutral-800/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                            {item.received_date || 'No Date'}
                          </span>
                          {item.barcode ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] text-amber-300">
                              {item.barcode}
                            </span>
                          ) : (
                            <span className="rounded-full border border-neutral-800 bg-neutral-800/70 px-2.5 py-1 text-[10px] text-neutral-500">
                              No Barcode
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-[10px] text-neutral-400">
                            Branch: {item.branch || '—'}
                          </span>
                          <span className="rounded-full border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-[10px] text-neutral-400">
                            Date: {item.received_date || '—'}
                          </span>
                        </div>
                        {item.uploader_note ? (
                          <p className="mt-3 text-[11px] leading-5 text-neutral-300">{item.uploader_note}</p>
                        ) : (
                          <p className="mt-3 text-[11px] italic text-neutral-500">No note attached</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => uploadSingleItem(item.id)}
                        disabled={queueActionItemId === item.id}
                        className="flex-1 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-3 py-2 text-[11px] font-black text-neutral-950 shadow-[0_0_18px_rgba(249,115,22,0.2)] transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {queueActionItemId === item.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950" />
                            Uploading...
                          </span>
                        ) : (
                          '🚀 Upload Now'
                        )}
                      </button>
                      <button
                        onClick={() => deleteSingleItem(item.id)}
                        disabled={queueActionItemId === item.id}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {queueActionItemId === item.id ? 'Removing...' : '🗑️ Discard'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* METHOD SELECTION SCREEN (UI/UX UPGRADED) */}
{intakeMethod === 'choose' && (
  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),_transparent_45%),linear-gradient(135deg,_#09090b,_#111114,_#020202)] text-center animate-fade-in relative">
    
    {/* အပေါ် ဘယ်ဘက်ဒေါင့် မျှားပုံစံ ခလုပ်အဝိုင်းလေး */}
    <button 
      onClick={() => {
        // အပြင်ပြန်ထွက်ရန် သို့မဟုတ် Dashboard/Home သို့ ပြန်သွားရန် Logic ကို ဒီမှာထည့်ပါ
        // ဥပမာ - setIntakeMethod('home'); သို့မဟုတ် router.back();
      }}
      className="absolute top-6 left-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 backdrop-blur-md shadow-lg transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
      title="နောက်သို့"
    >
      <IconArrowLeft className="h-5 w-5" />
    </button>

    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_18px_50px_rgba(249,115,22,0.2)] ring-1 ring-white/10">
      <IconPackage className="h-9 w-9 text-neutral-950" />
    </div>
    <h2 className="mb-1 text-2xl font-extrabold uppercase tracking-[0.24em] text-transparent bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text">ALL IN ONE EXPRESS</h2>
    <p className="mb-10 max-w-xs text-xs font-medium text-gray-400">ပါဆယ်မှတ်တမ်း မစတင်မီ အသုံးပြုမည့် စနစ်ကို ရွေးချယ်ပေးပါ</p>
    
    <div className="w-full max-w-xs flex flex-col gap-4">
      {/* ကင်မရာခလုပ် (Pill Shape) */}
      <button 
        onClick={() => setIntakeMethod('no-barcode')}
        className="group w-full rounded-full border border-white/10 bg-white/5 pl-5 pr-6 py-3.5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-orange-400 transition-colors group-hover:bg-orange-500/10">
            <IconCamera className="h-5 w-5" />
          </div>
          <div className="truncate">
            <p className="text-sm font-bold text-white">Barcode မပါဘဲ ပုံရိုက်မည်</p>
            <p className="text-[11px] font-normal text-gray-400 truncate">ပါဆယ်ကို တိုက်ရိုက်ဓာတ်ပုံရိုက်သိမ်းရန်</p>
          </div>
        </div>
      </button>

      {/* စကင်ဖတ်ရန်ခလုပ် (Pill Shape) */}
      <button 
        onClick={() => { setIntakeMethod('with-barcode'); setBarcodeStep('scanning'); }}
        className="group w-full rounded-full bg-gradient-to-br from-orange-500 to-amber-400 pl-5 pr-6 py-3.5 text-left text-neutral-950 shadow-[0_18px_50px_rgba(249,115,22,0.2)] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-neutral-950">
            <IconScan className="h-5 w-5" />
          </div>
          <div className="truncate">
            <p className="text-sm font-black">Barcode စကင်ဖတ်ပြီး ပုံရိုက်မည်</p>
            <p className="text-[11px] font-medium text-neutral-900/75 truncate">Barcode ID တွဲဖက်၍ မှတ်တမ်းတင်ရန်</p>
          </div>
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/80 text-gray-300 shadow-xl backdrop-blur-md transition-transform active:scale-90"
            >
              <IconArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/90 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-orange-400 shadow-xl backdrop-blur-md">
              {intakeMethod === 'with-barcode' ? (
                <>
                  <IconScan className="h-3.5 w-3.5" />
                  <span>{barcodeStep === 'scanning' ? 'SCANNING BARCODE' : 'TAKE PARCEL PHOTO'}</span>
                </>
              ) : (
                <>
                  <IconCamera className="h-3.5 w-3.5" />
                  <span>{userBranch} CAMERA</span>
                </>
              )}
            </div>
            <button 
              onClick={switchFacingMode} 
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/80 text-gray-300 shadow-xl backdrop-blur-md transition-transform active:scale-90"
            >
              <IconSwitchCamera className="h-4 w-4" />
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
                  components={{ finder: false }}
                />
              {/* Visual Target Overlay for Scanner (Square, Larger, Moving Laser) */}
<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
  
  {/* 🌟 ဤနေရာတွင် CSS Animation ကို တစ်ခါတည်း ထည့်သွင်းထားသဖြင့် ဘယ်နေရာမှာမဆို ရာနှုန်းပြည့် အလုပ်လုပ်ပါမည် */}
  <style>{`
    @keyframes scan-animation {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(318px); } /* 320px (box h-80) - 2px (laser h-0.5) */
    }
    .animate-laser-line {
      animation: scan-animation 2.5s linear infinite;
    }
  `}</style>

  {/* စတုရန်းပုံစံ ဘောင်အကြီး (w-80 h-80) */}
  <div className="w-80 h-80 border-2 border-dashed border-orange-500/60 bg-orange-500/5 rounded-2xl relative shadow-2xl">
    
    {/* Corners (ထောင့်လေး ၄ ခု) */}
    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1 rounded-tl-md"></div>
    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1 rounded-tr-md"></div>
    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1 rounded-bl-md"></div>
    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1 rounded-br-md"></div>
    
    {/* လေဆာတန်း - Custom Class အသစ်ဖြစ်သော animate-laser-line ကို ပြောင်းသုံးထားပါသည် */}
    <div className="w-full h-0.5 bg-orange-500 absolute top-0 left-0 animate-laser-line shadow-[0_0_8px_#f97316]"></div>
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
                    <div className="flex animate-fade-in items-center justify-between gap-2 rounded-xl border border-orange-400/20 bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-2xl">
                      <div className="flex min-w-0 items-center gap-2">
                        <IconScan className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">BARCODE: {currentScannedBarcode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="ml-2 flex-shrink-0 rounded-md bg-neutral-950 px-2 py-0.5 text-[9px] text-orange-400">READY</span>
                        <button 
                          onClick={() => {
                            setBarcodeStep('scanning');
                            setCurrentScannedBarcode('');
                          }}
                          className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm transition-colors hover:bg-neutral-900"
                        >
                          <IconRefresh className="h-3 w-3" />
                          ပြန်ဖတ်မည်
                        </button>
                      </div>
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
              <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-neutral-900/90 shadow-xl transition-all hover:bg-neutral-800 active:scale-90">
                <IconImage className="h-5 w-5 text-gray-200" />
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
                  className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-neutral-900/90 text-orange-400 shadow-xl transition-all active:scale-90"
                >
                  <IconArrowRight className="h-5 w-5" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-r from-orange-500 to-amber-500 text-[10px] font-black text-neutral-950 shadow">{capturedImages.length}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PREVIEW & RICH EDITING CONSOLE MODE (UI/UX UPGRADED) */}
      {flowMode === 'preview' && currentImgObj && (
        <div className="flex-1 flex flex-col bg-black justify-between p-3 relative h-full">
          <style>{`
            @keyframes slideInFromRight { from { transform: translateX(100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideInFromLeft { from { transform: translateX(-100%); opacity: 0.5; } to { transform: translateX(0); opacity: 1; } }
            .animate-slide-in-right { animation: slideInFromRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            .animate-slide-in-left { animation: slideInFromLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          `}</style>

          <div className="mb-2 flex items-center justify-between rounded-full border border-white/10 bg-black/45 px-2.5 py-2 backdrop-blur-xl">
            <button
              onClick={() => { setFlowMode('camera'); }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-neutral-900/80 text-gray-200 shadow-lg shadow-black/20 transition-all active:scale-95"
            >
              <IconArrowLeft className="h-4 w-4 text-orange-400" />
            </button>
            <div className="rounded-full border border-neutral-800 bg-neutral-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              {currentIdx + 1} OF {capturedImages.length}
            </div>
            <button
              onClick={(e) => deleteImage(currentImgObj.id, e)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-900/30 bg-red-950/30 text-red-400 shadow-lg shadow-black/20 transition-all active:scale-95"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>

          <div
            className="relative flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/80 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.14),_transparent_45%)]" />
            {currentImgObj.barcode && (
              <div className="absolute left-3 top-3 z-10 rounded-full border border-orange-500/20 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300 backdrop-blur-md">
                {currentImgObj.barcode}
              </div>
            )}
            <div className={`absolute inset-0 flex items-center justify-center ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`} key={currentImgObj.id}>
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

            {drawingText && (
              <div className="absolute inset-x-3 bottom-3 z-40 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-xl">
                <input
                  type="text"
                  autoFocus
                  className="w-full rounded-full border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-orange-500"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTextToCanvas();
                    }
                  }}
                  placeholder="ပုံပေါ်တင်မည့် စာသားရိုက်ထည့်ပါ..."
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDrawingText(false)} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:text-white">Cancel</button>
                  <button onClick={addTextToCanvas} className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-950 shadow-lg shadow-orange-500/20 transition-transform active:scale-95">Add</button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-[28px] border border-white/10 bg-neutral-900/70 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {capturedImages.map((img, idx) => (
                <div
                  key={img.id}
                  onClick={() => { setFlowMode('preview'); setCurrentIdx(idx); stopCamera(); }}
                  className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border ${currentImgObj.id === img.id ? 'border-orange-400/60' : 'border-white/10'} bg-neutral-950/80 shadow-inner transition-all active:scale-95`}
                >
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  {img.barcode && (
                    <div className="absolute inset-x-0 bottom-0 bg-orange-500/90 px-1 py-0.5 text-[8px] font-black text-center text-neutral-950">
                      {img.barcode}
                    </div>
                  )}
                  <button
                    onClick={(e) => deleteImage(img.id, e)}
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm active:scale-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-2.5 w-2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

           <div className="mt-2 flex items-center justify-between gap-1.5 rounded-full border border-white/5 bg-neutral-900/40 p-2 backdrop-blur-md">
  
  {/* Quality Selector Pill (SD/HD) */}
  <div className="flex rounded-full bg-black/40 p-0.5 border border-white/5">
    <button
      onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'SD' } : img))}
      className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider transition-all ${currentImgObj.quality === 'SD' ? 'bg-orange-500 text-neutral-950 shadow' : 'text-neutral-400'}`}
    >
      SD
    </button>
    <button
      onClick={() => setCapturedImages(capturedImages.map((img, i) => i === currentIdx ? { ...img, quality: 'HD' } : img))}
      className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider transition-all ${currentImgObj.quality === 'HD' ? 'bg-orange-500 text-neutral-950 shadow' : 'text-neutral-400'}`}
    >
      HD
    </button>
  </div>

  {/* Editing Tools (Crop & Text) */}
  <div className="flex items-center gap-1.5">
    {/* Crop Button */}
    <button
      onClick={() => { setCurrentCropOrder(currentImgObj); setShowCropModal(true); }}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/5 text-neutral-300 active:scale-90 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v16h16M2 6h16v16" />
      </svg>
    </button>

    {/* Text Button */}
    <button
      onClick={() => setDrawingText(!drawingText)}
      className={`flex h-8 w-8 items-center justify-center rounded-full border active:scale-90 transition-all ${drawingText ? 'border-orange-500/30 bg-orange-500 text-neutral-950 shadow' : 'border-white/5 bg-white/5 text-neutral-300'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    </button>
  </div>

  {/* Date Picker Pill */}
  <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-black/40 px-3 py-1">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-neutral-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
    <input
      type="date"
      value={receivedDate}
      onChange={(e) => setReceivedDate(e.target.value)}
      className="bg-transparent text-[10px] font-black text-neutral-200 outline-none w-[78px] tracking-wide"
    />
  </div>

</div>

            <div className="mt-3 relative flex items-center w-full">
  <input
    type="text"
    value={batchNote}
    onChange={(e) => setBatchNote(e.target.value)}
    placeholder="Add a caption..."
    className="w-full rounded-full border border-white/10 bg-neutral-950/80 pl-4 pr-12 py-3 text-[13px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-orange-500/40"
  />
  <button
    onClick={handleFinalSubmit}
    className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-neutral-950 shadow-[0_0_12px_rgba(249,115,22,0.2)] active:scale-95 transition-all"
  >
    <IconArrowRight className="h-4 w-4" />
  </button>
</div>
          </div>
        </div>
      )}

      {/* LIGHTBOX POPUP SYSTEM FOR CRISP IMAGE EASY CROP */}
      {showCropModal && currentCropOrder && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col justify-between animate-fade-in">
          <div className="p-4 pt-6 border-b border-neutral-900 flex justify-between items-center bg-neutral-950">
            <h3 className="text-sm font-bold text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v16h16M2 6h16v16" />
      </svg></h3>
           <button 
  onClick={() => { setShowCropModal(false); setCurrentCropOrder(null); }} 
  className="flex h-8 w-8 items-center justify-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-neutral-300 active:scale-90 transition-all"
>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
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
              Save Crop
            </button>
          </div>
        </div>
      )}

    </div>
  );
}