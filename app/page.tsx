"use client"
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import BarcodeScannerModal from '@/components/BarcodeScannerModal' 
import { ParcelDetailModal, ParcelOrder } from '@/components/ParcelDetailModal'

export default function Dashboard() {
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState('')
  const [loading, setLoading] = useState(true)

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ParcelOrder | null>(null)

  // 🟢 Barcode Scan ဖတ်ပြီးပါက Voucher ရှာ၍ Print ထုတ်ပေးမည့် Function
  const handleScanCode = (scannedCode: string) => {
    setIsScannerOpen(false)
    if (!scannedCode) return;
    const matchedOrder = allOrders.find(
      (o) =>
        String(o.item_id).trim() === String(scannedCode).trim() ||
        String(o.barcode).trim() === String(scannedCode).trim()
    )
    if (matchedOrder) {
      setSelectedOrder(matchedOrder)
    } else {
      alert(`Barcode "${scannedCode}" ဖြင့် ကိုက်ညီသော Order/Voucher မတွေ့ရှိပါ။`)
    }
  }

  // Excel Export စနစ်အတွက် သတ်မှတ်ချက်များ
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportAllBranches, setExportAllBranches] = useState(true)

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
        let fetchedOrders: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (error) throw error

          if (data && data.length > 0) {
            fetchedOrders = [...fetchedOrders, ...data]
            if (data.length < pageSize) {
              hasMore = false
            } else {
              page++
            }
          } else {
            hasMore = false
          }
        }

        setAllOrders(fetchedOrders)
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
      : allOrders.filter(o => o.branch === userBranch)

    const deliveredCount = filteredRows.filter(o => o.status === 'Delivered').length
    const atOfficeCount = filteredRows.filter(o => o.status === 'At Office').length
    const pendingCount = filteredRows.filter(o => o.status === 'Pending').length
    const totalCount = filteredRows.length

    return {
      total: totalCount,
      atOffice: atOfficeCount,
      pending: pendingCount,
      delivered: deliveredCount,
      deliveryRate: totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0,
      totalCod: filteredRows.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      unpaidCod: filteredRows
        .filter(o => o.status !== 'Delivered')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    }
  }, [userBranch, allOrders])

  const handleExportExcel = async () => {
  setIsExporting(true);
  try {
    let allFetchedData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    let fromDate = "";
    let toDate = "";
    if (exportMode === 'range') {
      if (!startDate || !endDate) {
        alert('ကျေးဇူးပြု၍ စတင်မည့်ရက်နှင့် ဆုံးမည့်ရက်ကို ပြည့်စုံစွာ ရွေးချယ်ပေးပါ။');
        setIsExporting(false);
        return;
      }
      fromDate = `${startDate}T00:00:00`;
      toDate = `${endDate}T23:59:59`;
    }

    while (hasMore) {
      let query = supabase
        .from('orders')
        .select(`
          *,
          pickup_rider:riders!pickup_rider_id(name),
          deliver_rider:riders!deliver_rider_id(name)
        `)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (exportMode === 'range') {
        query = query.gte('received_date', fromDate).lte('received_date', toDate);
      }

      if (!exportAllBranches && userBranch && userBranch !== 'ALL') {
        query = query.eq('branch', userBranch);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Supabase Query Error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allFetchedData = [...allFetchedData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (allFetchedData.length === 0) {
      alert('ရွေးချယ်ထားသော သတ်မှတ်ချက်အတိုင်း ထုတ်ယူရန် စာရင်းမရှိပါ။');
      return;
    }

    let finalData = allFetchedData;
    if (!exportAllBranches && userBranch && userBranch !== 'ALL') {
      finalData = allFetchedData.filter(o => o.branch === userBranch);
    }

    if (finalData.length === 0) {
      alert('ရွေးချယ်ထားသော Branch အတွက် ထုတ်ယူရန် စာရင်းမရှိပါ။');
      return;
    }

    // 💡 Helper Function: ISO String ကို Timezone Safe ဖြစ်သော JS Date Object အဖြစ် ပြောင်းရန်
   const parseExcelDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS Month starts at 0
    const day = parseInt(parts[2], 10);
    
    // Date.UTC သုံးလိုက်ခြင်းဖြင့် ExcelJS က UTC ဖြင့် အတိအကျ ဖတ်သွားပါမည်
    return new Date(Date.UTC(year, month, day));
  }
  return null;
};

    // 💡 Formatted Data ပြင်ဆင်ခြင်း
    const formattedData = finalData.map(order => ({
      'Item ID': order.item_id || order.id || '-',
      'Received Date': parseExcelDate(order.received_date), // ✅ Excel Date Object
      'Sender Name': order.sender_name || '-',
      'Sender Location': order.sender_loc || '-',
      'Receiver Name': order.receiver_name || '-',
      'Receiver Phone': order.receiver_phone || '-',
      'Receiver Address': order.receiver_address || '-',
      'Receiver Location': order.receiver_loc || '-',
      'COD Amount': Number(order.cod_amount) || 0,
      'Deli Fee': Number(order.deli_fee) || 0,
      'Fee Type': order.fee_type || '-',
      'Total Amount': Number(order.total_amount) || 0,
      'Pickup Rider': order.pickup_rider?.name || '-',
      'Status': order.status || '-',
      'Deliver Rider': order.deliver_rider?.name || '-',
      'Deliver Date': parseExcelDate(order.deliver_date),   // ✅ Excel Date Object
      'Note': order.note || '-',
      'Cleared Date': parseExcelDate(order.cleared_date),   // ✅ Excel Date Object
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders_Report');

    const tableColumns = Object.keys(formattedData[0]).map(key => ({
      name: key,
      filterButton: true
    }));

    const tableRows = formattedData.map(item => Object.values(item));

    worksheet.addTable({
      name: 'OrdersTable',
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium2',
        showRowStripes: true,
      },
      columns: tableColumns,
      rows: tableRows,
    });

    // 💡 Date Columns ခေါင်းစဉ်များကို မှတ်သားထားခြင်း
    const dateHeaderNames = ['Received Date', 'Deliver Date', 'Cleared Date'];

    // 💡 Column တိုင်းအတွက် Format များနှင့် Column Width များကို ညှိယူခြင်း
    if (worksheet.columns) {
      worksheet.columns.forEach((column, colIndex) => {
        let maxLen = 0;
        
        // Header နာမည်ကို ယူခြင်း
        const headerName = tableColumns[colIndex]?.name;
        const isDateCol = dateHeaderNames.includes(headerName);

        column.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
          // Row 1 က Header ဖြစ်သောကြောင့် Data Row များကိုသာ Date Format ထည့်မည်
          if (rowNumber > 1 && isDateCol && cell.value instanceof Date) {
            cell.numFmt = 'yyyy-mm-dd'; // ✅ Excel အသိအမှတ်ပြု Date Format
          }

          // Width တွက်ချက်ခြင်း
          let valLen = 0;
          if (cell.value instanceof Date) {
            valLen = 10; // "YYYY-MM-DD" length
          } else if (cell.value !== null && cell.value !== undefined) {
            valLen = cell.value.toString().length;
          }

          if (valLen > maxLen) maxLen = valLen;
        });

        column.width = Math.max(maxLen + 4, 12);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const branchLabel = exportAllBranches ? 'All_Branches' : `Branch_${userBranch}`;
    const fileName = exportMode === 'range'
      ? `Orders_${startDate}_to_${endDate}_(${branchLabel}).xlsx`
      : `Orders_All_Records_(${branchLabel}).xlsx`;

    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (typeof saveAs === 'function') {
      saveAs(blob, fileName);
    } else {
      (saveAs as any)(blob, fileName);
    }

  } catch (err: any) {
    console.error('Export error details:', err);
    alert(`Excel Table ထုတ်ယူရာတွင် အမှားအယွင်းရှိခဲ့သည်:\n${err.message || err}`);
  } finally {
    setIsExporting(false);
  }
};

  // ──────────────────────────────────────────────
  // 🎨 PREMIUM REDESIGNED UI — "Luxe Sapphire"
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 text-slate-800 antialiased font-sans select-none pb-24 md:pb-8">
      
      {/* ── 🧭 Ultra-Premium Header with Glassmorphism ── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-white/60 border-b border-slate-200/40 shadow-[0_1px_0_rgba(0,0,0,0.02),0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-md opacity-40" />
              <img
                src="/logo.png" 
                alt="All In One Express Logo"
                className="relative w-9 h-9 object-contain rounded-2xl shadow-lg border border-white/80 ring-1 ring-slate-900/5"
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-slate-900 text-[15px] font-black tracking-tight leading-tight">ALL IN ONE</span>
              <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase leading-tight">Express System</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Branch Badge */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 px-4 py-2 rounded-2xl text-[11px] font-bold text-slate-600 shadow-inner">
              <span className={`relative flex h-2.5 w-2.5`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${userBranch ? 'bg-emerald-400' : 'bg-slate-300'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${userBranch ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </span>
              <span className="tracking-wider">{userBranch ? `BRANCH: ${userBranch}` : 'LOADING...'}</span>
            </div>
            {/* Mobile Branch */}
            <div className="sm:hidden flex items-center gap-2 bg-slate-100/80 border border-slate-200/50 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full ${userBranch ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {userBranch || '...'}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {loading ? (
          /* ✨ Premium Shimmer Skeleton */
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white/60 rounded-3xl border border-slate-100" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-white/60 rounded-2xl border border-slate-100" />
              ))}
            </div>
            <div className="h-48 bg-white/60 rounded-3xl border border-slate-100" />
          </div>
        ) : (
          <>
            {/* ── 🚀 Quick Actions Grid (Refined iOS-Style) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Scan & Print */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="group relative bg-white border border-slate-200/40 rounded-[28px] p-5 hover:border-emerald-300/60 hover:shadow-[0_16px_40px_rgba(16,185,129,0.1)] transition-all duration-500 flex flex-col items-center text-center gap-3 active:scale-[0.97] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 group-hover:scale-105 transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM14.625 3.75c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5zM14.625 14.625c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5z" />
                  </svg>
                </div>
                <div className="relative">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Scan to Search</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">အချက်အလက်ရှာဖွေရန်</p>
                </div>
              </button>

              {/* New Entry */}
              <Link href="/entry" className="group relative bg-white border border-slate-200/40 rounded-[28px] p-5 hover:border-orange-300/60 hover:shadow-[0_16px_40px_rgba(249,115,22,0.1)] transition-all duration-500 flex flex-col items-center text-center gap-3 active:scale-[0.97] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:shadow-orange-500/40 group-hover:scale-105 transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="relative">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-orange-700 transition-colors">New Entry</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">အော်ဒါအသစ်သွင်းရန်</p>
                </div>
              </Link>

              {/* Order List */}
              <Link href="/list" className="group relative bg-white border border-slate-200/40 rounded-[28px] p-5 hover:border-blue-300/60 hover:shadow-[0_16px_40px_rgba(59,130,246,0.1)] transition-all duration-500 flex flex-col items-center text-center gap-3 active:scale-[0.97] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 group-hover:scale-105 transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="relative">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Order List</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">စာရင်းများစစ်ဆေးရန်</p>
                </div>
              </Link>

              {/* Riders */}
              <Link href="/riders" className="group relative bg-white border border-slate-200/40 rounded-[28px] p-5 hover:border-purple-300/60 hover:shadow-[0_16px_40px_rgba(147,51,234,0.1)] transition-all duration-500 flex flex-col items-center text-center gap-3 active:scale-[0.97] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 group-hover:scale-105 transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="relative">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Riders</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Rider များစီမံခန့်ခွဲရန်</p>
                </div>
              </Link>
            </div>

            {/* ── 📊 Statistics Section ── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-[0.2em]">
                  Overview {userBranch !== 'ALL' ? `• ${userBranch}` : '• All Branches'}
                </h2>
                <div className="flex-1 border-t border-slate-200/60" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total */}
                <div className="group bg-white border border-slate-200/40 rounded-[24px] p-5 hover:shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-slate-100/60 to-transparent rounded-bl-[40px] -mr-2 -mt-2" />
                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                    <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{stats.total.toLocaleString()}</p>
                  </div>
                </div>

                {/* At Office */}
                <div className="group bg-amber-50/60 border border-amber-200/40 rounded-[24px] p-5 hover:shadow-[0_12px_40px_rgba(245,158,11,0.1)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-100/60 to-transparent rounded-bl-[40px] -mr-2 -mt-2" />
                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">At Office</span>
                    <p className="text-3xl font-black text-amber-700 mt-1 tracking-tight">{stats.atOffice.toLocaleString()}</p>
                  </div>
                </div>

                {/* Pending / In Transit */}
                <div className="group bg-sky-50/60 border border-sky-200/40 rounded-[24px] p-5 hover:shadow-[0_12px_40px_rgba(14,165,233,0.1)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-sky-100/60 to-transparent rounded-bl-[40px] -mr-2 -mt-2" />
                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-sky-500 uppercase tracking-wider">Pending</span>
                    <p className="text-3xl font-black text-sky-700 mt-1 tracking-tight">{stats.pending.toLocaleString()}</p>
                  </div>
                </div>

                {/* Delivered */}
                <div className="group bg-emerald-50/60 border border-emerald-200/40 rounded-[24px] p-5 hover:shadow-[0_12px_40px_rgba(16,185,129,0.1)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-100/60 to-transparent rounded-bl-[40px] -mr-2 -mt-2" />
                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Delivered</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-3xl font-black text-emerald-700 tracking-tight">{stats.delivered.toLocaleString()}</p>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-100 px-2 py-0.5 rounded-full">{stats.deliveryRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar for Delivery Rate */}
              <div className="mt-4 bg-white border border-slate-200/40 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery Progress</span>
                  <span className="text-[11px] font-extrabold text-emerald-600">{stats.deliveryRate}% Complete</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${stats.deliveryRate}%` }}
                  />
                </div>
              </div>
            </section>

            {/* ── 💰 Financial Card (Unpaid COD) ── */}
            <div className="relative bg-gradient-to-br from-white via-white to-rose-50/30 border border-rose-200/40 rounded-[28px] p-6 shadow-[0_8px_40px_rgba(225,29,72,0.04)] overflow-hidden group">
              <div className="absolute right-0 top-0 w-40 h-full bg-gradient-to-l from-rose-50/40 to-transparent pointer-events-none rounded-r-[28px]" />
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-100/40 rounded-full blur-2xl" />
              
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <h4 className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">မရသေးသောငွေ • Unpaid COD</h4>
                  </div>
                  <p className="text-4xl font-black tracking-tight text-rose-600">
                    {stats.unpaidCod.toLocaleString()} 
                    <span className="text-lg font-bold text-rose-400 ml-2">MMK</span>
                  </p>
                  <p className="text-xs text-slate-400 font-medium max-w-md">
                    * Rider များထံမှ ရုံးခန်းသို့ ငွေလည်ပတ် မပြီးဆောင်းသေးသော စုစုပေါင်းငွေ ဖြစ်ပါသည်။
                  </p>
                </div>
                
                <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-500 shadow-inner shrink-0">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ── 📥 Excel Export Card ── */}
            <div className="bg-white border border-slate-200/40 rounded-[28px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.02)] space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">Excel Export</h4>
                  <p className="text-[11px] text-slate-400 font-medium">စာရင်းများကို Excel ဖိုင်အဖြစ် ထုတ်ယူရန်</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Mode Toggle */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Export Mode</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setExportMode('all')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                        exportMode === 'all' 
                          ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/50' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      အားလုံး
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportMode('range')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                        exportMode === 'range' 
                          ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/50' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      ရက်စွဲဖြင့်
                    </button>
                  </div>
                </div>

                {/* Date Range */}
                {exportMode === 'range' ? (
                  <div className="md:col-span-2 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">From</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 flex items-center text-xs text-slate-400 font-medium italic">
                    * ဒေတာဘေ့စ်ရှိ Orders အားလုံးကို ထုတ်ယူပါမည်။
                  </div>
                )}
              </div>

              {/* Branch Filter */}
              {userBranch && userBranch !== 'ALL' && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Branch Scope</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {exportAllBranches ? 'Branch အားလုံး၏ ဒေတာ' : `${userBranch} သီးသန့်`}
                    </span>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                    <button
                      type="button"
                      onClick={() => setExportAllBranches(false)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        !exportAllBranches ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {userBranch} သီးသန့်
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportAllBranches(true)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        exportAllBranches ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      အားလုံး
                    </button>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-sm flex items-center justify-center gap-2 ${
                    isExporting 
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 active:scale-[0.98] shadow-emerald-500/25'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export Excel (.xlsx)
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Modals ── */}
        {isScannerOpen && (
          <BarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={handleScanCode}
          />
        )}

        <ParcelDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />

        {/* ── Footer ── */}
        <footer className="pt-8 border-t border-slate-200/50 text-center">
          <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
            © 2026 All In One Express • Powered by Next.js
          </p>
        </footer>
      </main>
    </div>
  )
}