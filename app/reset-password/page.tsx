"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetFlow, setIsResetFlow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // Supabase မှ Recovery Link ဖြင့် ဝင်ရောက်လာပါက Event ကို စစ်ဆေးခြင်း
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetFlow(true)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // ၁။ Reset Link ပို့ပေးသည့် Function
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

  // ၂။ Password အသစ် သတ်မှတ်ပေးသည့် Function
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage({ text: 'Password နှစ်ခု တူညီမှု မရှိပါ။', type: 'error' })
      return
    }

    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({
        text: 'Password ပြောင်းလဲခြင်း အောင်မြင်ပါသည်။ Login သို့ ပြန်သွားနေသည်...',
        type: 'success',
      })
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
            {isResetFlow ? 'Password အသစ် သတ်မှတ်ရန်' : 'Password မေ့နေပါသလား?'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isResetFlow
              ? 'အောက်တွင် စကားဝှက်အသစ် ရိုက်ထည့်ပါ'
              : 'သင့်အကောင့် Email ရိုက်ထည့်ပါ၊ Reset Link ပို့ပေးပါမည်'}
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium mb-5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {!isResetFlow ? (
          /* Step 1: Request Reset Link Form */
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <label className="block text-gray-600 font-semibold mb-1 uppercase text-xs tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@mail.com"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-bold rounded-xl uppercase tracking-wider transition-all shadow-md bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          /* Step 2: Update Password Form */
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-gray-600 font-semibold mb-1 uppercase text-xs tracking-wide">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1 uppercase text-xs tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-bold rounded-xl uppercase tracking-wider transition-all shadow-md bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Updating Password...' : 'Set New Password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-xs text-gray-500 hover:text-orange-600 font-semibold transition-colors"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}