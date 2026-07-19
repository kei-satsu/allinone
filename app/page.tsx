"use client"
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState('')
  const [loading, setLoading] = useState(true)

  // Excel Export စနစ်အတွက် သတ်မှတ်ချက်များ
const [exportMode, setExportMode] = useState<'all' | 'range'>('all')
const [startDate, setStartDate] = useState('')
const [endDate, setEndDate] = useState('')
const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (storedBranch) {
      setUserBranch(storedBranch)
    } else {
      setUserBranch('ALL')
    }
  }, [])

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('orders').select('*')
        if (data) {
          setAllOrders(data)
        }
      } catch (err) {
        console.error("Error fetching orders:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const stats = useMemo(() => {
    if (!userBranch || allOrders.length === 0) {
      return {
        total: 0,
        atOffice: 0,
        pending: 0,
        delivered: 0,
        totalCod: 0,
        unpaidCod: 0
      }
    }

    const filteredRows = userBranch === 'ALL'
      ? allOrders
      : allOrders.filter(o => o.branch === userBranch || o.branch_code === userBranch)

    return {
      total: filteredRows.length,
      atOffice: filteredRows.filter(o => o.status === 'At Office').length,
      pending: filteredRows.filter(o => o.status === 'Pending').length,
      delivered: filteredRows.filter(o => o.status === 'Delivered').length,
      totalCod: filteredRows.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      unpaidCod: filteredRows
  .filter(o => o.status !== 'Delivered')
  .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    }
  }, [userBranch, allOrders])

  const handleExportExcel = async () => {
  setIsExporting(true);
  try {
    // ၁။ ဒေတာဘေ့စ်ဆီကနေ Data ကို တိုက်ရိုက်အသစ် လှမ်းတောင်းမယ် (Dashboard ရဲ့ ၁၀၀၀ Limit ကို ကျော်ဖို့)
    let query = supabase.from('orders').select('*');

    // ၂။ ရက်စွဲ (Date Range) စစ်ထုတ်ခြင်း
    if (exportMode === 'range') {
      if (!startDate || !endDate) {
        alert('ကျေးဇူးပြု၍ စတင်မည့်ရက်နှင့် ဆုံးမည့်ရက်ကို ပြည့်စုံစွာ ရွေးချယ်ပေးပါ။');
        setIsExporting(false);
        return;
      }
      query = query.gte('received_date', startDate).lte('received_date', endDate);
    }

    // ၃။ ဒေတာအားလုံး အစုံအလင် ပါလာစေဖို့ အမြင့်ဆုံး Limit တစ်ခု သတ်မှတ်ပေးခြင်း
    query = query.limit(50000); 

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      alert('ထုတ်ယူရန် အော်ဒါမှတ်တမ်းများ မရှိပါ။');
      return;
    }

    // ၄။ ရရှိလာတဲ့ ဒေတာတွေကို လက်ရှိ Login ဝင်ထားတဲ့ Branch အလိုက် Local မှာတင် စိတ်ချရအောင် Filter ထပ်လုပ်ပေးခြင်း
    // 💡 (မှတ်ချက် - တစ်နိုင်ငံလုံးစာ အကုန်ထွက်ချင်ရင် အောက်က line 27 ကနေ 29 အထိ ကုဒ် ၃ ကြောင်းကို ဖြတ်ပစ်လိုက်လို့ ရပါတယ်)
    let finalData = data;
    if (userBranch && userBranch !== 'ALL') {
      finalData = data.filter(o => o.branch === userBranch || o.branch_code === userBranch);
    }

    if (finalData.length === 0) {
      alert('လက်ရှိ Branch အတွက် ထုတ်ယူရန် စာရင်းမရှိပါ။');
      return;
    }

    // ၅။ Excel Column Header များကို သပ်ရပ်အောင် ပုံစံပြောင်းခြင်း
    const formattedData = finalData.map(order => ({
      'Item ID': order.item_id || order.id || '-',
      'Received Date': order.received_date ? order.received_date.split('T')[0] : '-',
      'Sender Name': order.sender_name || '-',
      'Sender Location': order.sender_loc || '-',
      'Receiver Name': order.receiver_name || '-',
      'Receiver Address': order.receiver_address || '-',
      'Receiver Location': order.receiver_loc || '-',
      'COD Amount': Number(order.cod_amount) || 0,
      'Deli Fee': Number(order.deli_fee) || 0,
      'Fee Type': order.fee_type || '-',
      'Total Amount': Number(order.total_amount) || 0,
      'Status': order.status || '-',
      'Branch': order.branch || '-'
    }));

    // ၆။ SheetJS ဖြင့် Excel (.xlsx) ဖိုင် ထုတ်လုပ်ခြင်း
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders_Report');

    const fileName = exportMode === 'range' 
      ? `Orders_${startDate}_to_${endDate}.xlsx` 
      : `Orders_All_Records.xlsx`;

    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    console.error('Export error:', err);
    alert('Excel ထုတ်ယူစဉ် စနစ်ပိုင်းဆိုင်ရာ အမှားအယွင်းတစ်ခု ဖြစ်ပွားခဲ့ပါသည်။');
  } finally {
    setIsExporting(false);
  }
};

  // iOS Custom Smooth Card Style Macro
  const iosCardClass = "bg-white/80 backdrop-blur-md border border-slate-200/40 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(15,23,42,0.03)] transition-all duration-300"

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800 antialiased font-sans select-none pb-24 md:pb-8">
      
      {/* 🧭 iOS Minimal Header Top Bar */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-slate-200/40 px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png" 
            alt="All In One Express Logo"
            className="w-8 h-8 object-contain rounded-xl shadow-sm border border-slate-100"
          />
          <div className="flex flex-col">
            <span className="text-slate-900 text-[16px] font-black tracking-tight uppercase">ALL IN ONE Express</span>
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase -mt-0.5"></span>
          </div>
        </div>
        
        {/* Branch Capsule Badge */}
        <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200/30 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-600 shadow-inner">
          <span className={`w-1.5 h-1.5 rounded-full ${userBranch ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {userBranch ? `BRANCH: ${userBranch}` : 'LOADING...'}
        </div>
      </div>

      {/* ── Main Canvas Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {loading ? (
          /* Premium Shimmer Skeleton Loading */
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-[20px] border border-slate-100" />)}
            </div>
            <div className="h-6 w-32 bg-slate-200 rounded-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-[24px]" />)}
            </div>
            <div className="h-32 bg-white rounded-[24px]" />
          </div>
        ) : (
          <>
            {/* 📱💻 iOS App Shortcuts Layout (Quick Links) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Shortcut: New Entry */}
              <Link href="/entry" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">New Entry</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">အော်ဒါအသစ်သွင်းရန်</p>
                </div>
              </Link>

              {/* Shortcut: Order List */}
              <Link href="/list" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">Order List</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">စာရင်းများစစ်ဆေးရန်</p>
                </div>
              </Link>

              {/* Shortcut: Riders */}
              <Link href="/riders" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">Riders</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Rider များစီမံခန့်ခွဲရန်</p>
                </div>
              </Link>
            </div>

            {/* 📊 Premium Data Export Utility Widget */}
<div className="bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-[24px] p-6 shadow-[0_8px_32px_rgba(15,23,42,0.02)] space-y-4">
  <div className="flex items-center gap-2">
    <div className="w-2 h-4 bg-emerald-500 rounded-full" />
    <h4 className="text-[12px] font-extrabold text-slate-700 uppercase tracking-wider">Excel စာရင်းထုတ်ယူခြင်းစနစ် (Data Export)</h4>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
    {/* Mode Selector */}
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-slate-400 uppercase">Export ပုံစံ</label>
      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setExportMode('all')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${exportMode === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          စာရင်းအားလုံး
        </button>
        <button
          type="button"
          onClick={() => setExportMode('range')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${exportMode === 'range' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          ရက်စွဲအလိုက်
        </button>
      </div>
    </div>

    {/* Date Picker Range inputs */}
    {exportMode === 'range' ? (
      <div className="md:col-span-2 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase">မှ (From Date)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase">ထိ (To Date)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors w-full"
          />
        </div>
      </div>
    ) : (
      <div className="md:col-span-2 text-slate-400 text-xs font-medium pb-2 italic">
        * လက်ရှိ {userBranch === 'ALL' ? 'Branch အားလုံး' : `${userBranch} Branch`} ၏ Database တွင်ရှိသမျှ Orders စာရင်းအားလုံးကို ဖိုင်ထုတ်ပေးမည်ဖြစ်သည်။
      </div>
    )}
  </div>

  {/* Action Submit Button */}
  <div className="pt-2 border-t border-slate-100 flex justify-end">
    <button
      onClick={handleExportExcel}
      disabled={isExporting}
      className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-sm flex items-center justify-center gap-2 ${
        isExporting 
          ? 'bg-slate-400 cursor-not-allowed' 
          : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
      }`}
    >
      {isExporting ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          ဖိုင်ထုတ်နေသည်...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Excel (.xlsx) ထုတ်ယူမည်
        </>
      )}
    </button>
  </div>
</div>

            {/* 📈 iOS Styled Section Title */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-slate-400 font-bold text-[11px] uppercase tracking-widest block">
                STATISTICS {userBranch !== 'ALL' ? `• ${userBranch}` : '• ALL BRANCHES'}
              </span>
              <div className="flex-1 border-t border-slate-200/60" />
            </div>

            {/* 📊 iOS Dashboard Statistics Widgets Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card: Total */}
              <div className={iosCardClass}>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-slate-900">{stats.total}</span>
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Items</span>
                </div>
              </div>

              {/* Card: At Office */}
              <div className={`${iosCardClass} bg-amber-50/50 border-amber-200/40`}>
                <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">At Office</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-amber-700">{stats.atOffice}</span>
                  <span className="text-[11px] text-amber-500 font-bold uppercase">Stored</span>
                </div>
              </div>

              {/* Card: Pending */}
              <div className={`${iosCardClass} bg-sky-50/40 border-sky-200/40`}>
                <span className="text-[11px] font-extrabold text-sky-600 uppercase tracking-wider block">Pending</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-sky-700">{stats.pending}</span>
                  <span className="text-[11px] text-sky-500 font-bold uppercase">Out</span>
                </div>
              </div>

              {/* Card: Delivered */}
              <div className={`${iosCardClass} bg-emerald-50/50 border-emerald-200/40`}>
                <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block">Delivered</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-emerald-700">{stats.delivered}</span>
                  <span className="text-[11px] text-emerald-500 font-bold uppercase">Done</span>
                </div>
              </div>
            </div>

            {/* 💰 Premium Financial Warning Widget (Unpaid COD) */}
            <div className="bg-white/80 backdrop-blur-md border border-rose-100 rounded-[24px] p-6 shadow-[0_12px_40px_rgba(225,29,72,0.04)] relative overflow-hidden group">
              {/* Background abstract decoration for native look */}
              <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-rose-50/50 to-transparent pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <h4 className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">မရသေးသောငွေ (UNPAID COD)</h4>
                  </div>
                  <p className="text-3xl font-black tracking-tight text-rose-600 pt-1">
                    {stats.unpaidCod.toLocaleString()} <span className="text-sm font-bold text-rose-500 font-mono">MMK</span>
                  </p>
                </div>
                
                {/* Minimal iOS Styled Alert Badge */}
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 font-medium mt-3.5 border-t border-slate-100 pt-3">
                * Rider များထံမှ ရုံးခန်းသို့ ငွေလည်ပတ် မပြီးဆောင်းသေးသော စုစုပေါင်းငွေ ဖြစ်ပါသည်။
              </p>
            </div>
          </>
        )}

        {/* 🏷️ iOS Style Footer */}
        <div className="mt-12 text-center text-slate-400 text-[10px] font-bold tracking-widest uppercase pt-6 border-t border-slate-200/50">
          © 2026 ALL IN ONE EXPRESS SYSTEM • POWERED BY NEXT.JS
        </div>
      </div>
    </div>
  )
}