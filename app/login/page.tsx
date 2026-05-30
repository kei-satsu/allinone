"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // ✨ Supabase Client

export default function LoginPage() {
  const [email, setEmail] = useState("") // ✨ Branch အစား Email State သို့ ပြောင်းလဲခြင်း
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [currentTime, setCurrentTime] = useState("")
  const [currentDate, setCurrentDate] = useState("")
  
  const router = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null) // Email field ကို focus ရန်

  // ── Windows 10 Style Clock ──
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, "0")
      const minutes = now.getMinutes().toString().padStart(2, "0")
      setCurrentTime(`${hours}:${minutes}`)

      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
      setCurrentDate(now.toLocaleDateString("en-US", options))
    }
    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── ✨ Auto-redirect if already logged in ──
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          window.location.href = "/"
          return
        }
      } catch (err) {
        console.warn("Auth check error:", err)
      } finally {
        const timer = setTimeout(() => setIsCheckingAuth(false), 300)
        return () => clearTimeout(timer)
      }
    }
    checkAuth()
  }, [])

  // Page တက်လာတာနဲ့ Email Field ကို Auto Focus ပေးခြင်း
  useEffect(() => {
    if (!isCheckingAuth && emailInputRef.current) {
      emailInputRef.current.focus()
    }
  }, [isCheckingAuth])

  // ── ✨ Supabase Auth ဖြင့် Login ဝင်ခြင်း Handler ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("ကျေးဇူးပြု၍ Email နှင့် Password ကို ဖြည့်သွင်းပေးပါ။")
      return
    }

    setLoading(true)

    try {
      // Supabase Auth သို့ User ရိုက်ထည့်လိုက်သော Email/Password တိုက်ရိုက်ပေးပို့ခြင်း
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) {
        setError("Email (သို့) Password မှားယွင်းနေပါတယ်ဗျာ။ ပြန်လည်စစ်ဆေးပေးပါ။")
        setLoading(false)
        return
      }

      if (data.session) {
        // AppLayout UI နဲ့ အဆင်ပြေစေရန် Email ရဲ့ ရှေ့ဆုံးစာလုံးကိုယူပြီး user_branch သတ်မှတ်ပေးခြင်း
        const prefix = email.split("@")[0].toUpperCase()
        const assignedBranch = ["MDY", "YGN", "MAIN"].includes(prefix) ? prefix : "MAIN"
        
        localStorage.setItem("user_branch", assignedBranch)
        window.location.href = "/"
      }
    } catch (err) {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ရှိနေပါတယ်ဗျာ။")
      setLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-gray-500 text-sm font-medium tracking-wide">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden select-none font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] bg-gradient-to-br from-white to-gray-50">
      
      {/* ── Subtle Background Patterns ── */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px]" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0v40M0 40h40' stroke='%23000' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ── Lock Screen Clock ── */}
      <div className="absolute top-12 md:top-16 w-full text-center z-10 pointer-events-none px-4 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="text-6xl md:text-8xl font-extralight tracking-tight text-gray-800 drop-shadow-sm">
          {currentTime}
        </div>
        <div className="text-sm md:text-base font-medium text-gray-500 mt-2 tracking-widest uppercase">
          {currentDate}
        </div>
      </div>

      {/* ── Login Panel ── */}
      <div className="absolute inset-0 flex items-center justify-center z-20 p-4">
        <div className="w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-700 ease-out mt-24">
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-2xl shadow-black/5 overflow-hidden relative">
            
            {/* Top Shine Effect */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

            <div className="p-6 sm:p-8">
              {/* ── Avatar / Logo ── */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4 rotate-3 hover:rotate-0 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                </div>
                <h2 className="text-gray-800 text-xl font-semibold tracking-tight">ALL IN ONE Express</h2>
                <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
              </div>

              {/* ── Error Alert ── */}
              <div className={`transition-all duration-300 ease-out ${error ? "opacity-100 translate-y-0 max-h-20 mb-5" : "opacity-0 -translate-y-2 max-h-0 overflow-hidden mb-0"}`}>
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm py-2.5 px-3 rounded-lg flex items-center gap-2 font-medium">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* ── ✨ Email Input ── */}
                <div>
                  <div className="relative">
                    <input
                      ref={emailInputRef}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 font-medium text-sm outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-100 hover:border-gray-400 placeholder-gray-400 pl-11"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="relative group">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 font-medium text-sm outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-100 hover:border-gray-400 placeholder-gray-400 pl-11 pr-12"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 tracking-wide"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Sign In to Dashboard
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* ── System Tray Footer ── */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
              </div>
              <div className="text-[10px] text-gray-400 font-mono tracking-widest">
                v1.0.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}