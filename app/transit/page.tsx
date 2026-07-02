"use client"
import Link from 'next/link'

export default function TransitMenuPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 px-4 antialiased">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8 text-center space-y-6">
        
        {/* Header Section */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-600 text-2xl mb-1">
            🚚
          </div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
            Transit Management
          </h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            ဂိတ်တင်/ဂိတ်ချ စာရင်းများနှင့် Transit လှုပ်ရှားမှုများကို လုပ်ဆောင်ရန် အောက်ပါ Menu ထဲမှ သက်ဆိုင်ရာ ကဏ္ဍကို ရွေးချယ်ပေးပါ၊
          </p>
        </div>

        {/* Buttons / Navigation Links */}
        <div className="flex flex-col gap-3.5 pt-2">
          
          {/* Button: Transit IN */}
          <Link 
            href="/transit/in" 
            className="group w-full py-4 px-6 bg-white border border-gray-200 hover:border-orange-500 rounded-xl flex items-center justify-between transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4 text-left">
              <span className="text-xl bg-emerald-50 text-emerald-600 p-2.5 rounded-lg group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                📥
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase group-hover:text-orange-600 transition-colors">
                  Transit IN (ဂိတ်ချ)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">တစ်ဖက်မြို့မှ ပို့လိုက်သည့် ပါဆယ်များ ရုံးသို့ ဆိုက်ရောက်ခြင်း</p>
              </div>
            </div>
            <span className="text-gray-400 group-hover:text-orange-500 font-bold transition-colors">
              →
            </span>
          </Link>

          {/* Button: Transit OUT */}
          <Link 
            href="/transit/out" 
            className="group w-full py-4 px-6 bg-white border border-gray-200 hover:border-orange-500 rounded-xl flex items-center justify-between transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4 text-left">
              <span className="text-xl bg-blue-50 text-blue-600 p-2.5 rounded-lg group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                📤
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase group-hover:text-orange-600 transition-colors">
                  Transit OUT (ဂိတ်တင်)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">တစ်ဖက်မြို့သို့ ပေးပို့ရန် ကားဂိတ်/ကားပေါ်သို့ တင်ဆောင်ခြင်း</p>
              </div>
            </div>
            <span className="text-gray-400 group-hover:text-orange-500 font-bold transition-colors">
              →
            </span>
          </Link>

        </div>

        {/* Footer Info */}
        <div className="text-[10px] text-gray-400 font-medium pt-2 border-t border-gray-100 uppercase tracking-wider">
          All-In-One Delivery System v2.0
        </div>

      </div>
    </div>
  )
}