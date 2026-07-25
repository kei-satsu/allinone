'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  
  // 🌟 Password အသစ် ရိုက်ထည့်ရမယ့် Mode
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // 1. Supabase Auth State Event ကို စောင့်ကြည့်ခြင်း
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsRecoveryMode(true)
      }
    })

    // 2. URL ပါရာမီတာများနှင့် Active Session များကို စစ်ဆေးခြင်း
    const checkRecoveryStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setIsRecoveryMode(true)
      } else if (typeof window !== 'undefined') {
        const hasHashToken = window.location.hash.includes('access_token') || window.location.hash.includes('type=recovery')
        const hasQueryCode = window.location.search.includes('code=')
        
        if (hasHashToken || hasQueryCode) {
          setIsRecoveryMode(true)
        }
      }
      setCheckingSession(false)
    }

    checkRecoveryStatus()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 🔹 အဆင့် (၁) - Email ဆီ Reset Link ပို့ပေးသည့် Function
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const redirectTo = `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({
        text: 'Password ပြင်ရန် link ကို အီးမေးလ်သို့ ပို့ပေးထားပါသည်။ Email စစ်ဆေးပေးပါ။',
        type: 'success',
      })
      setEmail('')
    }
    setLoading(false)
  }

  // 🔹 အဆင့် (၂) - Password အသစ် ပြောင်းလဲပြီး Login စာမျက်နှာသို့ ပို့ပေးသည့် Function
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Password နှစ်ခု တူညီမှု မရှိပါ။', type: 'error' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ text: 'Password သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။', type: 'error' })
      return
    }

    setLoading(true)
    setMessage(null)

    // ၁။ Supabase သို့ Password အသစ် update လုပ်ခြင်း
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
      setLoading(false)
    } else {
      setMessage({
        text: 'Password အသစ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ! Login စာမျက်နှာသို့ ပြန်လည် ပို့ပေးနေပါသည်...',
        type: 'success',
      })
      
      // ၂။ Password ပြောင်းပြီးပါက Session အသစ်အတွက် Sign Out လုပ်ပေးခြင်း
      await supabase.auth.signOut()
      
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    }
  }

  // Session စစ်ဆေးနေစဉ် Loading Spinner ပြပေးခြင်း
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3f3]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3f3] p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-md border border-slate-200/60 p-8">
        
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">
          {isRecoveryMode ? 'Password အသစ် သတ်မှတ်ရန်' : 'Password မေ့နေပါသလား'}
        </h2>

        {message && (
          <div
            className={`p-3.5 rounded-2xl mb-5 text-xs font-semibold ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}
          >
            {message.text}
          </div>
        )}

        {isRecoveryMode ? (
          /* 🔑 အဆင့် (၂) - Password အသစ် ရိုက်ထည့်ရမယ့် Form */
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Password အသစ်
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password အသစ် ရိုက်ထည့်ပါ"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Password အသစ် ထပ်ရိုက်ပါ
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Password အသစ် ပြန်ရိုက်ထည့်ပါ"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all active:scale-[0.98] text-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'အတည်ပြုနေသည်...' : 'Password အသစ် ပြောင်းမည်'}
            </button>
          </form>
        ) : (
          /* ✉️ အဆင့် (၁) - Email ရိုက်ထည့်ပြီး Reset Link တောင်းရမယ့် Form */
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                သင့် အီးမေးလ် (Email)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all active:scale-[0.98] text-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'ပို့ပေးနေသည်...' : 'Reset Link ပို့မည်'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Login စာမျက်နှာသို့ ပြန်သွားမည်
          </button>
        </div>

      </div>
    </div>
  )
}