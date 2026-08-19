"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function CustomerServicePage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const verifyRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login")
        return
      }

      if (session.user.app_metadata?.role !== "customer_service") {
        router.replace("/")
        return
      }

      setIsChecking(false)
    }

    verifyRole()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (isChecking) {
    return <div className="min-h-screen bg-slate-950" />
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.24),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_35%)]" />
      <section className="relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-300/20">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h7.5m-7.5 3h4.5m-9 6.75h13.5A2.25 2.25 0 0019.5 17.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">Customer Service Access</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AIO In-take app တွင်သာ အသုံးပြုပါ</h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-slate-300">
          သင့်အကောင့်သည် Customer Service role ဖြစ်သောကြောင့် AIO In-take app အတွင်းတွင်သာ Login ဝင်ပြီး အသုံးပြုနိုင်ပါသည်။
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-8 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-orange-50"
        >
          Sign Out
        </button>
      </section>
    </main>
  )
}