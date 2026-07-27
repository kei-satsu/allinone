// app/reset-password/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BACKGROUND_IMAGE = '/loginbackground.png'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  
  // Link ပါမပါ စစ်ဆေးမည့် State
  const [isValidLink, setIsValidLink] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // 1. Supabase Auth Event ကို စောင့်ကြည့်ခြင်း
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidLink(true)
      }
    })

    // 2. URL ပါရာမီတာ စစ်ဆေးခြင်း
    const checkRecoveryStatus = async () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash
        const search = window.location.search

        const isRecovery = 
          hash.includes('type=recovery') || 
          hash.includes('access_token') || 
          search.includes('code=')

        if (isRecovery) {
          setIsValidLink(true)
        } else {
          // ⚠️ Link မပါဘဲ တိုက်ရိုက်ဝင်လာလျှင်
          setIsValidLink(false)
        }
      }
      setCheckingSession(false)
    }

    checkRecoveryStatus()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Password အသစ် ပြောင်းလဲသည့် Function
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

      await supabase.auth.signOut()

      setTimeout(() => {
        router.push('/login')
      }, 1500)
    }
  }

  if (checkingSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-brightness-75" />
        <div className="relative z-10 w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-brightness-75" />

      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          Password အသစ် သတ်မှတ်ရန်
        </h2>

        {message && (
          <div
            className={`p-3.5 rounded-2xl mb-5 text-xs font-semibold ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-300/30'
                : 'bg-rose-500/20 text-rose-200 border border-rose-300/30'
            }`}
          >
            {message.text}
          </div>
        )}

        {isValidLink ? (
          /* 🔑 Link မှတစ်ဆင့် ဝင်ရောက်လာမှသာ Password အသစ် Form ကို ပြမည် */
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/80 mb-1.5">
                Password အသစ်
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password အသစ် ရိုက်ထည့်ပါ"
                className="w-full px-4 py-3 rounded-2xl bg-transparent border border-white/30 text-white placeholder-white/50 focus:border-white focus:ring-0 outline-none text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/80 mb-1.5">
                Password အသစ် ထပ်ရိုက်ပါ
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Password အသစ် ပြန်ရိုက်ထည့်ပါ"
                className="w-full px-4 py-3 rounded-2xl bg-transparent border border-white/30 text-white placeholder-white/50 focus:border-white focus:ring-0 outline-none text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-gray-900 font-bold py-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm mt-2"
            >
              {loading ? 'အတည်ပြုနေသည်...' : 'Password အသစ် ပြောင်းမည်'}
            </button>
          </form>
        ) : (
          /* 🚫 Link မပါဘဲ တိုက်ရိုက် ဝင်လာသူများအား ပြသမည့် အသိပေးစာ */
          <div className="text-center space-y-4 py-4">
            <p className="text-sm text-rose-200 bg-rose-500/20 p-4 rounded-2xl border border-rose-300/30 font-semibold">
              ⚠️ တိုက်ရိုက် ဝင်ရောက်၍ မရပါ။ ကျေးဇူးပြု၍ Admin ပို့ပေးထားသော Reset Link မှတစ်ဆင့် ပြန်လည် ဝင်ရောက်ပေးပါ။
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-full transition-colors text-sm"
            >
              Login စာမျက်နှာသို့ ပြန်သွားမည်
            </button>
          </div>
        )}
      </div>
    </div>
  )
}