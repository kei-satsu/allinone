"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [branch, setBranch] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    // ရိုးရှင်းတဲ့ Password စစ်ဆေးမှု (နောက်မှ စိတ်ကြိုက်ပြင်နိုင်တယ်)
    if (password === '123456') {
      // ရွေးလိုက်တဲ့ Branch ကို Browser မှာ မှတ်ထားလိုက်မယ်
      localStorage.setItem('user_branch', branch)
      localStorage.setItem('isLoggedIn', 'true')
      
      router.push('/') // Dashboard ကို သွားမယ်
      router.refresh()
    } else {
      alert('Password မှားနေပါတယ်!')
    }
  }

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-900">ALL in one</h1>
          <p className="text-gray-400 font-bold text-sm">Logistics Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Select Your Branch</label>
            <select 
              required
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-blue-500 font-bold text-gray-700"
            >
              <option value="">ရုံးခွဲ ရွေးချယ်ပါ</option>
              <option value="MDY">Mandalay Branch (MDY)</option>
              <option value="YGN">Yangon Branch (YGN)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-blue-500 font-bold"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-1"
          >
            LOGIN TO SYSTEM
          </button>
        </form>
      </div>
    </div>
  )
}