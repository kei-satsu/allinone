"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scanner } from '@yudiel/react-qr-scanner' // 📸 Camera Scanner Package

export default function BulkUpdatePage() {
  const router = useRouter()
  const qrInputRef = useRef<HTMLInputElement>(null)
  const isMounted = useRef(false)
  
  // App States
  const [orders, setOrders] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([]) 
  const [userBranch, setUserBranch] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Search & Scan Form States
  const [searchTerm, setSearchTerm] = useState('')
  const [qrInput, setQrInput] = useState('')

  // 📸 Camera Scanner States (အသစ်ထပ်ထည့်ထားသော State များ)
  const [showCamera, setShowCamera] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<any>(null) // Scan ဖတ်မိပြီး Add မလုပ်ရသေးသော အထုပ်
  const [cameraLoading, setCameraLoading] = useState(false)

  // Bulk Action Update States
  const [bulkRiderId, setBulkRiderId] = useState('')
  const [bulkStatus, setBulkStatus] = useState('In-Transit') 
  const [bulkDeliverDate, setBulkDeliverDate] = useState(new Date().toISOString().split('T')[0])

  // ── Windows 10 style classes ──
  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"

  const appendLog = (currentHistory: any[], action: string, note: string) => {
    const operator = userBranch || localStorage.getItem('user_branch') || 'Unknown Office';
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: action,
      operator: operator,
      note: note
    };
    return [...(currentHistory || []), newLogEntry];
  };

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
      return
    }
    setUserBranch(storedBranch)
    fetchRiders()
    fetchRecentOrders(storedBranch)
    
    qrInputRef.current?.focus()
  }, [router])

  async function fetchRiders() {
    const { data } = await supabase.from('riders').select('*')
    if (data) setRiders(data)
  }

  async function fetchRecentOrders(branch: string) {
    setSearchLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`*, pickup_rider:riders!orders_pickup_rider_id_fkey(name), deliver_rider:riders!orders_deliver_rider_id_fkey(name)`)
      .eq('branch', branch)
      .in('status', ['At Office', 'Pending', 'In-Transit'])
      .order('created_at', { ascending: false })
      .limit(40)

    if (!error && data) setOrders(data)
    setSearchLoading(false)
  }

  async function performSearch(query: string) {
    if (!userBranch) return
    if (!query.trim()) {
      fetchRecentOrders(userBranch)
      return
    }
    setSearchLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`*, pickup_rider:riders!orders_pickup_rider_id_fkey(name), deliver_rider:riders!orders_deliver_rider_id_fkey(name)`)
      .eq('branch', userBranch)
      .or(`item_id.ilike.%${query}%,sender_name.ilike.%${query}%,receiver_name.ilike.%${query}%,receiver_phone.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (!error && data) setOrders(data)
    setSearchLoading(false)
  }

  useEffect(() => {
    if (!userBranch) return
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    const delayDebounceFn = setTimeout(() => { performSearch(searchTerm) }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, userBranch])

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(searchTerm)
  }

  // 1. Hardware Scanner Logic
  const handleQrScanSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = qrInput.trim()
      if (!value) return

      setSearchLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select(`*, pickup_rider:riders!orders_pickup_rider_id_fkey(name), deliver_rider:riders!orders_deliver_rider_id_fkey(name)`)
        .eq('branch', userBranch)
        .eq('item_id', value)
        .maybeSingle()

      if (error) {
        alert("QR ရှာဖွေရာတွင် အမှားအယွင်းရှိပါသည်")
      } else if (data) {
        setOrders(prev => {
          if (prev.some(o => o.id === data.id)) return prev
          return [data, ...prev]
        })
        setSelectedIds(prev => prev.includes(data.id) ? prev : [...prev, data.id])
      } else {
        alert(`Item ID: ${value} အား ရှာမတွေ့ပါ။ စာလုံးပေါင်း သေချာပါသလား?`)
      }
      setQrInput('') 
      qrInputRef.current?.focus()
      setSearchLoading(false)
    }
  }

  // 📸 2. Mobile Camera Scanner Logic အသစ်
  const handleCameraScan = async (detectedCodes: any[]) => {
    // Code ဖတ်ပြီးဖြစ်နေချိန် (သို့) Data ဆွဲနေချိန်ဆိုရင် နောက်ထပ် ထပ်မဖတ်အောင် တားထားမည်
    if (detectedCodes.length === 0 || pendingOrder || cameraLoading) return;
    const value = detectedCodes[0].rawValue;
    if (!value) return;

    setCameraLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`*, pickup_rider:riders!orders_pickup_rider_id_fkey(name), deliver_rider:riders!orders_deliver_rider_id_fkey(name)`)
      .eq('branch', userBranch)
      .eq('item_id', value)
      .maybeSingle()

    if (error || !data) {
      alert(`Item ID: ${value} အား ရှာမတွေ့ပါ။`);
    } else {
      setPendingOrder(data); // ဒေတာရပြီဆိုရင် Confirmation UI ကို ပြပေးမည်
    }
    setCameraLoading(false);
  }

  const confirmPendingOrder = () => {
    if (pendingOrder) {
      setOrders(prev => {
        if (prev.some(o => o.id === pendingOrder.id)) return prev;
        return [pendingOrder, ...prev];
      });
      setSelectedIds(prev => prev.includes(pendingOrder.id) ? prev : [...prev, pendingOrder.id]);
      setPendingOrder(null); // အထုပ်ကို List ထဲထည့်ပြီးပါက နောက်တစ်ထုပ် ဆက်ဖတ်ရန်
    }
  }

  const cancelPendingOrder = () => {
    setPendingOrder(null); // မထည့်ဘဲ နောက်တစ်ထုပ် ပြန်ဖတ်ရန်
  }

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleSelectAllVisible = () => {
    if (selectedIds.length === orders.length) setSelectedIds([])
    else setSelectedIds(orders.map(o => o.id))
  }

  const handleBulkUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) return alert("ကျေးဇူးပြု၍ အပ်ဒိတ်လုပ်မည့် ပါဆယ်ထုပ်များကို အရင်ရွေးချယ်ပါ!")

    setLoading(true)
    try {
      const selectedRider = riders.find(r => r.id === bulkRiderId);
      const riderName = selectedRider ? selectedRider.name : 'ဖြုတ်လိုက်သည်';

      const updatePromises = selectedIds.map(async (id) => {
        const currentOrder = orders.find(o => o.id === id);
        if (!currentOrder) return null;

        let changes: string[] = [];
        if (currentOrder.status !== bulkStatus) {
          changes.push(`Bulk စနစ်ဖြင့် Status ကို "${currentOrder.status || 'At Office'}" မှ "${bulkStatus}" သို့ ပြောင်းလဲခဲ့သည်`);
        }
        if (currentOrder.deliver_rider_id !== bulkRiderId) {
          changes.push(`Rider ကို "${riderName}" သို့ တာဝန်ပေးခဲ့သည်`);
        }
        if (changes.length === 0) {
          changes.push("Bulk စနစ်ဖြင့် ပါဆယ်အချက်အလက်များကို ပြင်ဆင်ခဲ့သည်");
        }

        const logNote = changes.join("၊ ");
        const updatedHistory = appendLog(currentOrder.history, "Bulk Updated", logNote);

        return supabase
          .from('orders')
          .update({
            status: bulkStatus,
            deliver_rider_id: bulkRiderId || null,
            deliver_date: bulkDeliverDate || null,
            history: updatedHistory
          })
          .eq('id', id);
      });

      const results = await Promise.all(updatePromises);
      const hasError = results.some(res => res && res.error);

      if (!hasError) {
        alert(`ပါဆယ်ထုပ် (${selectedIds.length}) ထုပ်အား Status နှင့် လှုပ်ရှားမှုမှတ်တမ်း ပြောင်းလဲခြင်း အောင်မြင်ပါသည်! 🎉`);
        setSelectedIds([])
        setSearchTerm('')
        fetchRecentOrders(userBranch)
      } else {
        alert("ဒေတာအချို့ကို အပ်ဒိတ်လုပ်ရာတွင် အမှားအယွင်း ရှိခဲ့ပါသည်။ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။")
      }
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
      qrInputRef.current?.focus()
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] overflow-auto select-none p-4 relative">
      
      {/* 📸 Mobile Camera Modal (ပေါ်လာမည့် အစိတ်အပိုင်း) */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="absolute top-4 right-4 z-50">
            <button onClick={() => setShowCamera(false)} className="bg-white/20 text-white hover:bg-white/30 px-4 py-2 rounded-lg font-bold text-sm backdrop-blur-md transition-all">
              ✕ Close
            </button>
          </div>

          <div className="w-full max-w-md w-full relative h-[60vh] flex items-center justify-center bg-black overflow-hidden rounded-2xl shadow-2xl">
            {cameraLoading ? (
              <div className="text-orange-500 font-bold animate-pulse text-lg">ရှာဖွေနေပါသည်...</div>
            ) : !pendingOrder ? (
              <Scanner onScan={handleCameraScan} formats={['qr_code', 'code_128', 'code_39', 'ean_13']} />
            ) : (
              // 📸 Scan ဖတ်မိပြီးနောက် ပြသမည့် အချက်အလက် (Add / Cancel ရွေးချယ်ရန်)
              <div className="absolute inset-0 bg-white p-6 flex flex-col justify-center text-left">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-bold text-center text-gray-900 mb-6">အထုပ်အား ရှာဖွေတွေ့ရှိပါသည်</h3>
                
                <div className="space-y-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500">Item ID:</span> <span className="font-mono font-bold">{pendingOrder.item_id}</span>
                  </p>
                  <p className="text-sm flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500">Sender:</span> <span className="font-semibold">{pendingOrder.sender_name}</span>
                  </p>
                  <p className="text-sm flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500">Receiver:</span> <span className="font-semibold">{pendingOrder.receiver_name}</span>
                  </p>
                  <p className="text-sm flex justify-between text-orange-600 font-bold text-base">
                    {/* 💡 Database ထဲက COD Column နာမည်ကွဲနေပါက ဒီနေရာတွင် (ဥပမာ- cod_amount) ပြင်ပေးပါ */}
                    <span>COD:</span> <span>{pendingOrder.cod || pendingOrder.cod_amount || '0'} MMK</span>
                  </p>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button onClick={cancelPendingOrder} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">
                    Cancel
                  </button>
                  <button onClick={confirmPendingOrder} className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30">
                    + Add to List
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-gray-400 mt-6 text-sm font-medium">ဘားကုဒ် (သို့) QR ကို ဘောင်အတွင်း ချိန်ရွယ်ပါ</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full space-y-4">
        
        {/* Title Top Bar */}
        <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase">📦 Bulk Status Update Control</h1>
              <p className="text-[11px] text-gray-500 font-medium">ပါဆယ်အများကြီးကို တစ်ပြိုင်တည်း Rider သတ်မှတ်ခြင်းနှင့် On Way / Delivered ပြောင်းလဲခြင်း</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[11px] font-bold tracking-wider">
              BRANCH: {userBranch === 'MDY' ? 'MANDALAY' : userBranch === 'YGN' ? 'YANGON' : userBranch || 'LOADING'}
            </span>
            <Link href="/" className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs shadow-sm">
              Back to List
            </Link>
          </div>
        </div>

        {/* 🔍 SECTION 1: SEARCH & SCANNER INPUTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Hardware & Mobile Scanner Field */}
          <div className="bg-gray-900 text-white p-4 rounded-lg border border-gray-950 shadow flex flex-col justify-center relative">
            <label className="block text-orange-400 font-semibold mb-2 uppercase text-[11px] tracking-wider flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                📷 QR / BARCODE SCANNER
                {searchLoading && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded animate-pulse">SEARCHING...</span>}
              </span>
            </label>
            <div className="flex gap-2">
              <input 
                ref={qrInputRef}
                type="text"
                placeholder="Scanner ဖြင့် ဖတ်ပါ..."
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={handleQrScanSubmit}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-900 text-sm shadow-inner"
              />
              {/* 📸 ဖုန်းကင်မရာ ဖွင့်ရန်ခလုတ် အသစ် */}
              <button 
                onClick={() => setShowCamera(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-xs whitespace-nowrap transition-all shadow-md flex items-center gap-1.5"
              >
                📱 ဖုန်းဖြင့် ဖတ်မည်
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 italic">💡 Computer Scanner ဖတ်လျှင် အလိုအလျောက် ရွေးချယ်ပြီးဖြစ်သွားမည်။</p>
          </div>

          {/* Normal Smart Search */}
          <form onSubmit={handleManualSearchSubmit} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center">
            <label className={labelStyle}>🔍 Multi-Field Auto Filter (Item ID, Name, Phone)</label>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="ရိုက်လိုက်တာနဲ့ အလိုအလျောက် ရှာပေးပါမည်..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={winInput}
              />
              <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white font-medium px-4 rounded-md text-xs uppercase tracking-wide transition-all shadow-sm">
                {searchLoading ? '...' : 'Search'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">💡 စာရိုက်ရပ်လိုက်သည်နှင့် Auto ရှာပေးမည်။</p>
          </form>
        </div>

        {/* 🚀 SECTION 2: BULK ACTION CONTROLLER (မူလအတိုင်း) */}
        <div className="bg-white p-4 rounded-lg border-2 border-orange-400 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
              Bulk Action Processing
            </h2>
            <span className="text-[11px] font-mono font-bold bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded">
              SELECTED: {selectedIds.length} ITEMS CHOSEN
            </span>
          </div>

          <form onSubmit={handleBulkUpdateSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className={labelStyle}>1. Assign Deliver Rider</label>
              <div className="relative">
                <select value={bulkRiderId} onChange={e => setBulkRiderId(e.target.value)} className={winSelect}>
                  <option value="">Rider မရွေးချယ်ရသေးပါ...</option>
                  {riders.map(r => <option key={r.id} value={r.id}>🛵 {r.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">▼</div>
              </div>
            </div>

            <div>
              <label className={labelStyle}>2. Change Status To</label>
              <div className="relative">
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className={winSelect}>
                   <option value="At Office">📦 At Office</option>
                    <option value="On Way">🚵 On Way</option>
                    <option value="Delivered">✅ Delivered</option>
                    <option value="In-Transit">🚚 In-Transit</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">▼</div>
              </div>
            </div>

            <div>
              <label className={labelStyle}>3. Delivery Date</label>
              <input type="date" value={bulkDeliverDate} onChange={e => setBulkDeliverDate(e.target.value)} className={winInput + " font-mono"} />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || selectedIds.length === 0}
                className={`w-full py-2 text-xs font-semibold rounded-md uppercase tracking-wide transition-all shadow-sm ${loading || selectedIds.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-[0.99]'}`}
              >
                {loading ? 'Processing Database...' : `Apply Bulk Update (${selectedIds.length})`}
              </button>
            </div>
          </form>
        </div>

        {/* 📊 SECTION 3: DATA TABLE (မူလအတိုင်း) */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-[12px]">
              <thead>
                <tr className="bg-gray-50 text-gray-400 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-12">
                    <input 
                      type="checkbox" 
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      onChange={handleSelectAllVisible}
                      className="w-3.5 h-3.5 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-mono">Item ID</th>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Receiver Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Full Address</th>
                  <th className="py-2.5 px-3 text-center">Rider (Delivered By)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length > 0 ? (
                  orders.map((o) => {
                    const isChecked = selectedIds.includes(o.id)
                    return (
                      <tr 
                        key={o.id} 
                        onClick={() => handleSelectRow(o.id)}
                        className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${isChecked ? 'bg-orange-50/60 font-medium' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleSelectRow(o.id)}
                            className="w-3.5 h-3.5 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-800">{o.item_id}</td>
                        <td className="py-2.5 px-3 text-gray-600">{o.sender_name}</td>
                        <td className="py-2.5 px-3 text-gray-900 font-semibold">{o.receiver_name}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">{o.receiver_phone}</td>
                        <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={o.receiver_address}>{o.receiver_address || '-'}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600 font-medium">{o.deliver_rider?.name || <span className="text-gray-300">-</span>}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                            o.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                            o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 
                            'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>{o.status}</span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-gray-400 font-medium">
                      {searchLoading ? 'မှတ်တမ်းများကို ရှာဖွေနေပါသည်...' : 'ပြသရန် ပါဆယ်ထုပ် ဒေတာမရှိပါ။'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500 font-mono">
            <span>Showing {orders.length} parcels in view</span>
            <span className="text-orange-600 font-bold">{selectedIds.length} checked for bulk modification</span>
          </div>
        </div>
      </div>
    </div>
  )
}