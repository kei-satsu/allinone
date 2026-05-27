'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States များ
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [userBranch, setUserBranch] = useState('Mandalay'); // Default branch

  // Page စပွင့်ကတည်းက LocalStorage ကနေ ဝန်ထမ်းရဲ့ Branch ကို ဆွဲထုတ်ရန်
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch');
    if (storedBranch) {
      setUserBranch(storedBranch);
    }
  }, []);

  // ဖုန်းကင်မရာကနေ ဓာတ်ပုံရိုက်လိုက်တိုင်း သို့မဟုတ် ပုံရွေးလိုက်တိုင်း အလုပ်လုပ်မည့် Function
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      // အဟောင်းတွေကို မဖျက်ဘဲ နောက်ကနေ Array ထဲ ပေါင်းထည့်မည် (Telegram Style)
      setCapturedImages((prev) => [...prev, ...filesArray]);
      
      // ပုံစံတူပုံ ထပ်ရိုက်ရင်လည်း Trigger ဖြစ်အောင် Input ကို Reset လုပ်ပေးရပါမယ်
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // အပေါင်း (+) ခလုတ်နှိပ်ရင် ဖုန်းကင်မရာကို လှမ်းပွင့်ခိုင်းရန်
  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // လွဲပြီးရိုက်မိတဲ့ ပုံများကို စာရင်းထဲက ပြန်ဖျက်ရန်
  const removeImage = (indexToRemove: number) => {
    setCapturedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // ဓာတ်ပုံအားလုံးကို Cloudinary ပေါ်တင်ပြီး DB ထဲ "Pending" စာရင်းသွင်းမည့် အဓိက Function
  const handleUploadAll = async () => {
    if (capturedImages.length === 0) return;
    
    setUploading(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!cloudName) {
      alert("Cloudinary Cloud Name မရှိသေးပါဗျာ။ Env မှာ အရင်ဖြည့်ပေးပါ။");
      setUploading(false);
      return;
    }

    try {
      // ပုံတစ်ပုံချင်းစီကို Loop ပတ်ပြီး တင်မည်
      for (let i = 0; i < capturedImages.length; i++) {
        setUploadProgress(`ပုံ (${i + 1}/${capturedImages.length}) ကို Upload တင်နေသည်...`);
        
        const file = capturedImages[i];
        const formData = new FormData();
        formData.append('file', file);
        // Cloudinary Unsigned Upload Preset နာမည် (ကိုယ့် Preset နာမည်နဲ့ ပြောင်းပေးပါ)
        formData.append('upload_preset', 'ml_default'); 

        // ၁။ Cloudinary သို့ လှမ်းတင်ခြင်း
        const cloudinaryRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );
        
        const cloudinaryData = await cloudinaryRes.json();
        const imageUrl = cloudinaryData.secure_url;

        if (!imageUrl) throw new Error("Cloudinary ထံမှ URL မရရှိပါ");

        // ၂။ Database (Supabase / API) ထဲသို့ Pending Data သွားသိမ်းခြင်း
        // မှတ်ချက် - ဒီနေရာမှာ သင့်ရဲ့ API Route သို့မဟုတ် direct supabase client ကို သုံးနိုင်ပါတယ်
        setUploadProgress(`ပုံ (${i + 1}/${capturedImages.length}) ကို ဒေတာဘေ့စ်ထဲ သိမ်းနေသည်...`);
        
        const dbRes = await fetch('/api/deliveries/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            branch: userBranch,
            status: 'Pending' // ဒေတာအလွတ်ဖြစ်လို့ Pending ပေးထားမည်
          }),
        });

        if (!dbRes.ok) throw new Error("Database ထဲ သိမ်းဆည်းရန် ပျက်ကွက်ခဲ့သည်");
      }

      // အကုန်လုံး အောင်မြင်သွားရင်
      setUploadProgress('အားလုံး အောင်မြင်စွာ တင်ပြီးပါပြီ။ 🎉');
      setTimeout(() => {
        setCapturedImages([]);
        setUploading(false);
        setUploadProgress('');
        // စာရင်းဖြည့်ရမည့် Pending List Dashboard ဆီသို့ တန်းပို့လိုက်မည်
        router.push('/admin/pending'); 
      }, 1500);

    } catch (error) {
      console.error("Upload Error:", error);
      alert("တစ်နေရာရာမှာ အမှားအယွင်း ရှိသွားပါတယ်ဗျာ။ ဒေတာတွေကို ပြန်စစ်ပေးပါ။");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between pb-8 select-none">
      
      {/* Header အပိုင်း */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-400">All In One Express</h1>
          <p className="text-xs text-slate-400">ပါဆယ်ထုပ်များ တရစပ် ရိုက်ကူးတင်သွင်းရန်</p>
        </div>
        <span className="bg-blue-950 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-800 font-medium">
          📍 {userBranch} Branch
        </span>
      </div>

      {/* ဓာတ်ပုံရိုက်ရန် ဖုန်းကင်မရာ Hidden Input */}
      <input
        type="file"
        accept="image/*"
        capture="environment" // ဖုန်းရဲ့ နောက်ကင်မရာကို တိုက်ရိုက်ပွင့်စေသည်
        ref={fileInputRef}
        onChange={handleCapture}
        className="hidden"
        multiple // ကွန်ပျူတာကနေ စမ်းရင် တစ်ခါတည်း ပုံအများကြီး ရွေးလို့ရအောင်
      />

      {/* အဓိက Body အပိုင်း - Telegram Style Preview Grid */}
      <div className="p-4 flex-1 overflow-y-auto">
        {capturedImages.length === 0 ? (
          // ပုံမရှိသေးရင် ပြမည့် Empty State UI
          <div className="h-[50vh] flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl m-2">
            <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 4h12M6 4v16M6 4g1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 4v16M6 20h12M6 20a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">ရိုက်ထားသော ပါဆယ်ပုံ မရှိသေးပါ</p>
            <p className="text-xs text-slate-600 mt-1">အောက်က အပေါင်းခလုတ်ကို နှိပ်၍ စတင်ရိုက်ပါ</p>
          </div>
        ) : (
          // ပုံတွေရှိလာရင် ပြမည့် Grid UI
          <div className="grid grid-cols-3 gap-3">
            {capturedImages.map((file, index) => (
              <div 
                key={index} 
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group shadow-md"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={`preview ${index}`}
                  className="w-full h-full object-cover"
                />
                
                {/* ပုံဖျက်သည့် (✕) ခလုတ်လေး */}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  disabled={uploading}
                  className="absolute top-1.5 right-1.5 bg-rose-600/90 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center active:scale-90 transition shadow-sm hover:bg-rose-600"
                >
                  ✕
                </button>

                {/* ပုံစဉ်နံပါတ် Tag လေး */}
                <div className="absolute bottom-1 left-1 bg-slate-900/80 backdrop-blur text-[10px] px-1.5 py-0.5 rounded font-mono text-slate-300 border border-slate-700">
                  #{index + 1}
                </div>
              </div>
            ))}

            {/* Telegram ပုံစံ - အမြဲတမ်း နောက်ဆုံးမှာ ကပ်လိုက်နေမယ့် ပုံထပ်တိုးခလုတ် (+) */}
            {!uploading && (
              <button
                type="button"
                onClick={triggerCamera}
                className="aspect-square border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center bg-slate-900/40 hover:bg-slate-900/60 active:scale-95 transition border-blue-500/30"
              >
                <span className="text-3xl text-blue-500 font-light">+</span>
                <span className="text-[10px] text-slate-500 font-medium mt-1">ပုံထပ်ရိုက်ရန်</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* အောက်ခြေ လုပ်ဆောင်ချက် ခလုတ်များ အပိုင်း */}
      <div className="p-4 bg-slate-950 border-t border-slate-900 sticky bottom-0 z-10">
        
        {/* Upload တင်နေစဉ် ပြသမည့် လှပသော Progress Bar Loading Animation */}
        {uploading && (
          <div className="mb-4 bg-slate-900 p-3 rounded-xl border border-slate-800 animate-pulse">
            <p className="text-xs text-blue-400 font-medium text-center mb-1.5">{uploadProgress}</p>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full animate-marquee w-1/2"></div>
            </div>
          </div>
        )}

        {/* ကင်မရာ စတင်ဖွင့်မည့် ခလုတ် (ပုံမရှိသေးခင်ပဲ ပြမည်) */}
        {capturedImages.length === 0 && (
          <button
            type="button"
            onClick={triggerCamera}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ကင်မရာဖြင့် ပုံရိုက်မည်
          </button>
        )}

        {/* ပုံတွေရှိလာရင် အစုလိုက် တင်မည့် ခလုတ်ကြီး */}
        {capturedImages.length > 0 && (
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={uploading}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 ${
              uploading 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <span>ပုံ {capturedImages.length} ပုံလုံး သိမ်းဆည်းမည်</span>
          </button>
        )}
      </div>

      {/* CSS Animation ပေါင်းထည့်ရန် Tailwind Custom Style */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-marquee {
          animation: marquee 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}