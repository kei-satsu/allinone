"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

// ── 🖼️ Replace this path with your own background image ──
const BACKGROUND_IMAGE = "/loginbackground.png"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const router = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null)

  // ── Auto-redirect if already logged in ──
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const activeUser = session.user
          const assignedBranch = activeUser?.user_metadata?.branch || "MDY"
          localStorage.setItem("user_branch", assignedBranch)
          window.location.href = activeUser.app_metadata?.role === "customer_service"
            ? "/customer-service"
            : "/"
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

  // Auto-focus email field
  useEffect(() => {
    if (!isCheckingAuth && emailInputRef.current) {
      emailInputRef.current.focus()
    }
  }, [isCheckingAuth])

  // ── Login Handler ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in both email and password.")
      return
    }

    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError("Invalid email or password. Please try again.")
        setLoading(false)
        return
      }

      const loggedInUser = data.user || data.session?.user
      if (loggedInUser) {
        const assignedBranch = loggedInUser.user_metadata?.branch || "MDY"
        localStorage.setItem("user_branch", assignedBranch)
        window.location.href = loggedInUser.app_metadata?.role === "customer_service"
          ? "/customer-service"
          : "/"
      }
    } catch (err) {
      setError("Connection error. Please try again later.")
      setLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-white animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-white/70 text-sm font-medium tracking-wide">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-brightness-75" />

      {/* Glassmorphism Login Container – responsive padding & width */}
      <div className="relative z-10 w-full max-w-md mx-auto p-6 sm:p-8 bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl">
        {/* Title – responsive font size */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-6 sm:mb-8">
          Login to System
        </h1>

        {/* Error message */}
        {error && (
          <div className="mb-5 sm:mb-6 bg-red-500/80 text-white text-sm rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
          {/* Email */}
          <div>
            <input
              ref={emailInputRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-transparent border-b border-white/50 px-1 py-2 outline-none text-white placeholder-white/50 focus:border-white transition-colors text-base"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent border-b border-white/50 px-1 py-2 pr-10 outline-none text-white placeholder-white/50 focus:border-white transition-colors text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
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

          {/* Remember Me & Forgot Password – responsive flex direction */}
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 text-sm">
            ‌
            <Link href="/reset-password" className="text-white/80 hover:text-white underline transition-colors">
              Forget Password?
            </Link>
          </div>

          {/* Login Button – responsive sizing */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-gray-900 font-semibold py-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}