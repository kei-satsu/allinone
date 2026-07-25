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
  
  // 🌟 User ဟာ Password အသစ် ရိုက်ထည့်ရမယ့် အဆင့် ရောက်မရောက် မှတ်သည့် State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // 1. Supabase Event မှ Recovery Link ဖြင့် ဝင်လာသည်ကို စောင့်ကြည့်ခြင်း
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
      }
    })

    // 2. Hash/Token URL မှာ ပါလာပါက Recovery Mode သို့ တိုက်ရိုက်ပြောင်းရန်
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      setIsRecoveryMode(true)
    }

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
    }
    setLoading(false)
  }

  // 🔹 အဆင့် (၂) - Password အသစ် ပြောင်းလဲပေးသည့် Function
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

    // Supabase သို့ Password အသစ် update လုပ်ခြင်း
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({
        text: 'Password အသစ် ပြောင်းလဲပြီးပါပြီ! Login စာမျက်နှာသို့ သို့ သွားနေပါသည်...',
        type: 'success',
      })
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
    setLoading(false)
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
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all"
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
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all"
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
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-sm transition-all"
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

      </div>
    </div>
  )
}