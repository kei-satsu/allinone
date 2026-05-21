"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [branch, setBranch] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Login ဝင်ပြီးသား ဖြစ်နေရင် Dashboard ကို အလိုအလျောက် ပြန်ပို့ပေးမယ့် အပိုင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (storedBranch && isLoggedIn === 'true') {
      router.push('/')
    }
  }, [router])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // သင့်ရဲ့ မူရင်း Password စစ်ဆေးမှု Logic အတိုင်း ဖြစ်ပါတယ်
    if (password === '123456') {
      // ရွေးလိုက်တဲ့ Branch နဲ့ Login Status ကို သိမ်းဆည်းခြင်း
      localStorage.setItem('user_branch', branch)
      localStorage.setItem('isLoggedIn', 'true')
      
      router.push('/') // Dashboard ကို သွားမယ်
      router.refresh()
    } else {
      setError('Password မှားနေပါတယ်ဗျာ။ ပြန်လည်စစ်ဆေးပေးပါ။')
      setLoading(false)
    }
  }

  return (
    // ခေတ်မီဆန်းသစ်ပြီး သန့်ရှင်းတဲ့ White/Light Background
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden select-none">
      
      {/* နူးညံ့သိမ်မွေ့သော Orange & Amber Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-500/[0.06] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[130px] pointer-events-none" />

      {/* Premium White Glassmorphic Card Box */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-8 rounded-3xl shadow-2xl shadow-slate-200/60 w-full max-w-md relative z-10 transition-all">
        
        {/* Top Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200/60 rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-mono font-black tracking-widest text-orange-600 uppercase">Logistics Engine</span>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-800 bg-clip-text text-transparent tracking-tight uppercase">ALL in one</h1>
          <p className="text-slate-400 font-bold text-xs mt-1">Logistics Management System</p>
        </div>

        {/* Light Theme နှင့် ကိုက်ညီသော Error Banner */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-100 text-red-600 text-xs py-3 px-4 rounded-xl flex items-center gap-2 font-semibold animate-in fade-in duration-200">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Select Your Branch</label>
            <div className="relative">
              <select 
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 font-bold text-slate-800 transition-all appearance-none cursor-pointer text-sm"
              >
                <option value="" className="bg-white text-slate-400">ရုံးခွဲ ရွေးချယ်ပါ</option>
                <option value="MDY" className="bg-white text-slate-800">Mandalay Branch (MDY)</option>
                <option value="YGN" className="bg-white text-slate-800">Yangon Branch (YGN)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 font-bold text-slate-800 placeholder:text-slate-300 text-sm transition-all"
            />
          </div>

          {/* Premium Orange / Amber Gradient Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                LOGGING IN...
              </>
            ) : (
              'LOGIN TO SYSTEM'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}