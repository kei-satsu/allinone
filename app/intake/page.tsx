'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function IntakePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [userBranch, setUserBranch] = useState('MDY');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showImagePanel, setShowImagePanel] = useState(false);

  // Branch from localStorage
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) setUserBranch(storedBranch);
  }, []);

  // Start camera stream with Portrait (9:16) ideal
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 }
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (cameraActive) {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedImages((prev) => [...prev, file]);
        }
      }, 'image/jpeg', 0.9);
    }
  }, []);

  const toggleCamera = () => {
    if (cameraActive) stopCamera();
    else startCamera();
  };

  const switchFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCapturedImages((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerCameraFallback = () => {
    fileInputRef.current?.click();
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload all images
  const handleUploadAll = async () => {
    if (capturedImages.length === 0) return;
    setUploading(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      alert('Cloudinary Cloud Name not set.');
      setUploading(false);
      return;
    }

    try {
      for (let i = 0; i < capturedImages.length; i++) {
        setUploadProgress(`Uploading (${i + 1}/${capturedImages.length})...`);
        const file = capturedImages[i];
        const formData = new FormData();
        formData.append('file', file);
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

      setUploadProgress('All uploaded successfully!');
      setTimeout(() => {
        setCapturedImages([]);
        setUploading(false);
        setUploadProgress('');
        setShowImagePanel(false);
      }, 1500);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] select-none overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">📸 Parcel Intake</h1>
          <p className="text-xs text-gray-500">Continuous camera capture</p>
        </div>
        <span className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-medium border border-orange-200">
          {userBranch} Branch
        </span>
      </div>

      {/* Camera Area (Portrait 9:16) */}
      <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden" style={{ minHeight: 0 }}>
        <div className="relative h-full" style={{ aspectRatio: '9 / 16', maxWidth: '100%' }}>
          {cameraSupported && (
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
              autoPlay
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera controls */}
          {cameraActive && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-6 z-10">
              <button onClick={switchFacing} className="w-12 h-12 bg-white/30 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/40 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
              <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-orange-500 active:scale-95 transition">
                <span className="w-8 h-8 rounded-full bg-orange-500" />
              </button>
              <button onClick={toggleCamera} className="w-12 h-12 bg-white/30 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/40 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Camera start / fallback */}
          {!cameraActive && (
            cameraSupported ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <button onClick={startCamera} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 py-3 rounded-lg shadow-md">
                  Open Camera
                </button>
                <p className="text-gray-400 text-sm mt-2">or</p>
                <label className="mt-2 inline-block bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 cursor-pointer hover:bg-gray-50">
                  Choose Files
                  <input type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" ref={fileInputRef} />
                </label>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <p className="text-gray-500 mb-3">Camera not available</p>
                <label className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 cursor-pointer hover:bg-gray-50">
                  Select Photos
                  <input type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" ref={fileInputRef} />
                </label>
              </div>
            )
          )}
        </div>
      </div>

      {/* Bottom Control Bar – Upload on LEFT, Photo Count on RIGHT */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        {/* Left side: Upload button (if images exist) */}
        {capturedImages.length > 0 ? (
          <button
            onClick={handleUploadAll}
            disabled={uploading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition ${
              uploading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {uploading ? uploadProgress : 'Upload All'}
          </button>
        ) : (
          <div /> /* invisible placeholder to keep alignment */
        )}

        {/* Right side: Photo count button */}
        <button
          onClick={() => setShowImagePanel(!showImagePanel)}
          className="flex items-center gap-2 text-gray-700 hover:text-orange-600 transition"
        >
          <span className="text-lg">📸</span>
          <span className="font-medium">{capturedImages.length} photos</span>
          <svg className={`w-4 h-4 transition-transform ${showImagePanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Image Panel (Bottom Sheet) */}
      {showImagePanel && (
        <div className="bg-white border-t border-gray-200 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
            {capturedImages.map((file, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-white group">
                <img src={URL.createObjectURL(file)} alt={`capture ${idx}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  disabled={uploading}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{idx + 1}</div>
              </div>
            ))}
            <button
              onClick={cameraActive ? capturePhoto : triggerCameraFallback}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 transition"
            >
              <span className="text-3xl">+</span>
            </button>
          </div>
          {capturedImages.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No photos captured yet.</p>
          )}
        </div>
      )}
    </div>
  );
}