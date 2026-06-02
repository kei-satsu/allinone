"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Column အားလုံးသတ်မှတ်ချက် ──
const COLUMN_DEFS = [
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
  { key: 'received_date', label: 'Received Date', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: true },
  { key: 'sender_name', label: 'Sender', defaultVisible: true },
  { key: 'sender_loc', label: 'S. City', defaultVisible: true },
  { key: 'receiver_name', label: 'Receiver', defaultVisible: true },
  { key: 'receiver_phone', label: 'Phone', defaultVisible: true },
  { key: 'receiver_loc', label: 'R. City', defaultVisible: true },
  { key: 'receiver_address', label: 'Full Address', defaultVisible: false },
  { key: 'fee_type', label: 'Type', defaultVisible: true },
  { key: 'cod_amount', label: 'COD (Ks)', defaultVisible: true },
  { key: 'deli_fee', label: 'Deli Fee (Ks)', defaultVisible: true },
  { key: 'total_amount', label: 'Total (Ks)', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'image_url', label: 'Photo', defaultVisible: true }, 
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: true },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: true },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: false },
  { key: 'cash_added_date', label: 'Cash Add Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
]

export default function DailyReport() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  
  // ── States ဆိုင်ရာ သတ်မှတ်ချက်များ ──
  const [selectedDate, setSelectedDate] = useState(today)
  const [reportData, setReportData] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userBranch, setUserBranch] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [handovers, setHandovers] = useState<any[]>([])

  // Column Toggle & Grid Filters
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })
  const [showColDropdown, setShowColDropdown] = useState(false)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // Edit / Handover/ Image Preview States
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // Handover States
  const [handoverModal, setHandoverModal] = useState<{ open: boolean; riderName: string }>({ open: false, riderName: '' })
  const [handoverForm, setHandoverForm] = useState({
    amount: 0,
    payment_method: 'Cash',       
    transaction_type: 'Cash-in',   
    note: ''
  })

  // UI Styles Tailwind configuration
  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"

  // ── Auth & Data Loading ──
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      fetchData(storedBranch, selectedDate)
      fetchRiders()
    }
  }, [router, selectedDate])

  const fetchData = async (branchCode?: string, targetDate?: string) => {
    const activeBranch = branchCode || userBranch;
    const activeDate = targetDate || selectedDate;
    if (!activeBranch) return;

    setLoading(true)

    // ၁။ Orders များအားဆွဲထုတ်ခြင်း
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_rider:riders!orders_pickup_rider_id_fkey(name),
        deliver_rider:riders!orders_deliver_rider_id_fkey(name)
      `)
      .eq('is_deleted', false)
      .eq('branch', activeBranch)
      .or(`received_date.eq.${activeDate},deliver_date.eq.${activeDate}`)
      .order('created_at', { ascending: false })

    if (ordersError) console.error("Orders Error:", ordersError)
    else setReportData(ordersData || [])

    // ၂။ Handovers စာရင်းဆွဲထုတ်ခြင်း
    const { data: handoversData, error: handoversError } = await supabase
      .from('cash_handovers')
      .select('*')
      .eq('branch', activeBranch)
      .eq('date', activeDate)

    if (handoversError) console.error("Handovers Error:", handoversError)
    else setHandovers(handoversData || [])

    setLoading(false)
  }

  const fetchRiders = async () => {
    const { data, error } = await supabase.from('riders').select('*')
    if (data) setRiders(data)
  }

  // ── History Log System ──
  const appendLog = (currentHistory: any[], action: string, note: string) => {
    const operator = userBranch || 'Unknown Office';
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: action,      
      operator: operator,  
      note: note           
    };
    return [...(currentHistory || []), newLogEntry];
  };

  // ── Filter Logics ──
  const filteredOrders = reportData.filter(o => {
    if (colFilters['global_search']) {
      const query = colFilters['global_search'].toLowerCase()
      const isMatch = 
        String(o.item_id || '').toLowerCase().includes(query) ||
        String(o.receiver_phone || '').toLowerCase().includes(query) ||
        String(o.receiver_name || '').toLowerCase().includes(query) ||
        String(o.sender_name || '').toLowerCase().includes(query)
      if (!isMatch) return false
    }

    return Object.keys(colFilters).every(key => {
      if (key === 'global_search') return true
      const filterValue = colFilters[key]?.toLowerCase()
      if (!filterValue) return true
      let cellValue = ""
      if (key === 'pickup_rider') cellValue = o.pickup_rider?.name || ""
      else if (key === 'deliver_rider') cellValue = o.deliver_rider?.name || ""
      else cellValue = String(o[key] || "")
      return cellValue.toLowerCase().includes(filterValue)
    })
  })

  // ── Edit & Update Handler ──
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { pickup_rider, deliver_rider, ...updateData } = editingOrder;

    if (updateData.pickup_rider_id === "") updateData.pickup_rider_id = null;
    if (updateData.deliver_rider_id === "") updateData.deliver_rider_id = null;

    let changes: string[] = [];
    const originalOrder = reportData.find(o => o.id === editingOrder.id);
    
    if (originalOrder?.status !== editingOrder.status) {
      changes.push(`Status ကို "${originalOrder?.status || 'At Office'}" မှ "${editingOrder.status}" Thို့ ပြောင်းလဲခဲ့သည်`);
    }

    if (changes.length === 0) {
      changes.push("ပါဆယ်အချက်အလက်များကို Report စာမျက်နှာမှ အသေးစိတ် ပြင်ဆင်ခဲ့သည်");
    }

    const logNote = changes.join("၊ ");
    const updatedHistory = appendLog(editingOrder.history, "Order Updated (Report)", logNote);

    const { error } = await supabase
      .from('orders')
      .update({
        ...updateData,
        history: updatedHistory 
      })
      .eq('id', editingOrder.id);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("အချက်အလက်များကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ!");
      setEditingOrder(null);
      fetchData();
    }
  }

  // Handover Submission 
  const submitHandover = async () => {
    if (!handoverModal.riderName) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('cash_handovers')
        .insert([{
          rider_name: handoverModal.riderName,
          branch: userBranch,
          date: selectedDate,
          amount: handoverForm.amount,
          payment_method: handoverForm.payment_method,
          transaction_type: handoverForm.transaction_type,
          note: handoverForm.note,
          created_at: new Date().toISOString()
        }])

      if (error) throw error
      alert(`${handoverModal.riderName} ၏ ငွေအပ်နှံမှုမှတ်တမ်း (${handoverForm.transaction_type}) ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ।`)
      setHandoverModal({ open: false, riderName: '' })
      setHandoverForm({ amount: 0, payment_method: 'Cash', transaction_type: 'Cash-in', note: '' })
      fetchData()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Cell Rendering Styles
  const renderCell = (o: any, key: string) => {
    if (key === 'branch') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
        o.branch === 'MDY' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'
      }`}>
        {o.branch === 'MDY' ? 'MANDALAY' : 'YANGON'}
      </span>
    )
    if (key === 'status') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
        o.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
        o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}>{o.status}</span>
    )
    if (key === 'image_url') return o.image_url ? (
      <div className="flex items-center justify-center">
        <img 
          src={o.image_url} 
          alt="Attachment" 
          onClick={(e) => { e.stopPropagation(); setPreviewImage(o.image_url); }}
          className="w-8 h-8 object-cover rounded border border-gray-200 cursor-pointer hover:scale-110 hover:shadow transition-all"
        />
      </div>
    ) : <span className="text-gray-400 font-mono text-[10px]">-</span>
    
    if (['cod_amount', 'deli_fee', 'total_amount'].includes(key)) return (
      <span className={key === 'total_amount' ? 'font-bold text-gray-900' : ''}>
        {o[key]?.toLocaleString() || '0'} Ks
      </span>
    )
    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 border border-gray-200">{o[key] || '-'}</span>
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>
    return o[key] || '-'
  }

  // Delivered ဖြစ်ပြီးသား ပါဆယ်များအတွက် Senders နှင့် မြို့အလိုက် COD စာရင်းတွက်ချက်ခြင်း
  const senderCodByLoc = reportData
    .filter(o => o.status === 'Delivered' && o.sender_name)
    .reduce((acc: Record<string, Record<string, number>>, o) => {
      const loc = o.sender_loc || 'Unknown City';
      const sender = o.sender_name;
      const cod = Number(o.cod_amount || 0);
      
      if (!acc[loc]) acc[loc] = {};
      if (!acc[loc][sender]) acc[loc][sender] = 0;
      acc[loc][sender] += cod;
      return acc;
    }, {});

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] font-[system-ui] overflow-hidden select-none">
      
      {/* ── Title Bar / Header ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase flex items-center gap-2">
              📊 Daily Report · {userBranch === 'MDY' ? 'Mandalay' : 'Yangon'} Office
            </h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <input 
            type="date" 
            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-md text-xs font-medium text-gray-700" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
          />

          <div className="relative">
            <button 
              onClick={() => setShowColDropdown(!showColDropdown)}
              className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
            >
              👁️ Columns
            </button>
            
            {showColDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1.5">Show/Hide Columns</div>
                  {COLUMN_DEFS.map(col => (
                    <label key={col.key} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700 font-medium rounded-md">
                      <input 
                        type="checkbox" 
                        className="mr-2 w-4 h-4 text-orange-500 rounded border-gray-300 accent-orange-500"
                        checked={visibleCols[col.key]} 
                        onChange={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        disabled={col.key === 'item_id'} 
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={() => fetchData()} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ── Mobile Search Bar ── */}
      <div className="sm:hidden px-3 py-2 bg-white border-b border-gray-200">
        <input 
          type="text" 
          placeholder="🔍 Global Search (ID၊ ဖုန်း၊ အမည်)..." 
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
          value={colFilters['global_search'] || ''} 
          onChange={e => setColFilters(prev => ({ ...prev, global_search: e.target.value }))}
        />
      </div>

      {/* ── 💡 Rider ငွေရှင်းမှုမှတ်တမ်း Card များ ── */}
      <div className="mx-4 mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            🏍️ Rider Ngwe ရှင်းမှုမှတ်တမ်း (Delivered စာရင်းအနှစ်ချုပ်)
          </h2>
          <button 
            onClick={() => setHandoverModal({ open: true, riderName: riders[0]?.name || '' })}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-md text-xs shadow-sm transition-all flex items-center gap-1"
          >
            💵 Add Cash
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {riders.map(rider => {
            const riderOrders = reportData.filter(o => o.deliver_rider_id === rider.id && o.status === 'Delivered');
            const totalToPay = riderOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            const riderHandovers = handovers.filter(h => h.rider_name === rider.name);
            const cashIn = riderHandovers.filter(h => h.transaction_type === 'Cash-in').reduce((sum, h) => sum + (h.amount || 0), 0);
            const oop = riderHandovers.filter(h => h.transaction_type === 'OOP').reduce((sum, h) => sum + (h.amount || 0), 0);
            const gap = totalToPay - (cashIn + oop);

            if (totalToPay === 0 && cashIn === 0 && oop === 0) return null;

            let statusStyle = "bg-green-50 text-green-700 border-green-200"; 
            if (gap > 0) {
              statusStyle = "bg-red-50 text-red-700 border-red-200"; 
            } else if (gap < 0) {
              statusStyle = "bg-yellow-50 text-yellow-700 border-yellow-200"; 
            }

            return (
              <div key={rider.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 flex flex-col gap-2 shadow-sm">
                <div className="font-bold text-gray-800 text-xs border-b border-gray-200/60 pb-1 flex items-center justify-between">
                  <span>👤 Name: {rider.name}</span>
                </div>
                <div className="text-[11px] space-y-1 text-gray-600">
                  <div className="flex justify-between">
                    <span>Total (ရှင်းရမည့်ငွေ):</span>
                    <span className="font-semibold text-gray-900">{totalToPay.toLocaleString()} Ks</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash-in (အပ်ငွေ):</span>
                    <span className="font-semibold text-blue-600">{cashIn.toLocaleString()} Ks</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OOP (စိုက်ငွေ):</span>
                    <span className="font-semibold text-purple-600">{oop.toLocaleString()} Ks</span>
                  </div>
                  <div className={`flex justify-between p-1.5 rounded font-bold border mt-1.5 ${statusStyle}`}>
                    <span>Gap:</span>
                    <span>
                      {gap > 0 ? `+${gap.toLocaleString()}` : gap.toLocaleString()} Ks
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 💡နေရာဟောင်းမှ အပေါ်သို့ပြောင်းရွှေ့ထားသော နေရာသစ်: Sender အလိုက် ပြန်ပေးရမယ့် COD စာရင်း Cards ── */}
      <div className="mx-4 mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3 shrink-0 max-h-64 overflow-y-auto">
        <div className="border-b border-gray-100 pb-2">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            📦 Sender အလိုက် ပြန်ပေးရမယ့် COD စုစုပေါင်း (Delivered ပါဆယ်များ - LOC အလိုက်ခွဲထားပါသည်)
          </h2>
        </div>

        {Object.keys(senderCodByLoc).length === 0 ? (
          <p className="text-xs text-gray-400 font-medium py-2 text-center">ယနေ့အတွက် Delivered ဖြစ်ပြီးသား COD ပေးရန်ပုံစံမရှိသေးပါ။</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(senderCodByLoc).map(([loc, senders]) => {
              const locTotal = Object.values(senders).reduce((a, b) => a + b, 0);
              return (
                <div key={loc} className="p-3 border border-orange-100 rounded-lg bg-orange-50/20 flex flex-col gap-2 shadow-sm">
                  <div className="font-bold text-orange-800 text-xs border-b border-orange-200/60 pb-1 flex items-center justify-between">
                    <span>📍 City/LOC: {loc}</span>
                    <span className="text-[10px] bg-orange-100 px-1.5 py-0.5 rounded text-orange-700 font-bold">
                      {locTotal.toLocaleString()} Ks
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {Object.entries(senders).map(([senderName, totalCod]) => (
                      <div key={senderName} className="flex justify-between items-center bg-white p-1.5 rounded border border-gray-100 shadow-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[120px]" title={senderName}>👤 {senderName}</span>
                        <span className="font-bold text-gray-900">{totalCod.toLocaleString()} Ks</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Workspace Table Area ── */}
      <div className="flex-1 overflow-auto bg-white sm:mx-4 sm:my-3 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
        
        {/* Desktop View Table */}
        <div className="hidden sm:block">
          <table className="w-full text-left whitespace-nowrap text-[12px]">
            <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(229,231,235,1)]">
              <tr className="text-gray-400 border-b border-gray-200 bg-gray-50/70">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={col.key} className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-center text-[11px] text-gray-500">Actions</th>
              </tr>
              <tr>
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <td key={col.key} className="px-3 py-1.5">
                    <input 
                      type="text" 
                      placeholder={`Filter ${col.label}...`}
                      className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px]"
                      value={colFilters[col.key] || ''}
                      onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                      disabled={col.key === 'image_url'}
                    />
                  </td>
                ))}
                <td className="bg-gray-50/30"></td>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_DEFS.length + 1} className="text-center py-10 font-medium text-gray-400">Loading Report Logs...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_DEFS.length + 1} className="text-center py-10 font-medium text-gray-400">ယနေ့ရက်စွဲအတွက် ပါဆယ်မှတ်တမ်း မရှိသေးပါ။</td>
                </tr>
              ) : filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/80 transition-colors">
                  {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                    <td key={col.key} className="px-4 py-2.5 font-medium">
                      {renderCell(o, col.key)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center">
                    <button 
                      onClick={() => setEditingOrder(o)}
                      className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-[11px] font-semibold transition-all"
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View Responsive Cards */}
        <div className="sm:hidden flex flex-col divide-y divide-gray-100">
          {filteredOrders.map(o => (
            <div key={o.id} className="p-3 bg-white flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-gray-900">{o.item_id}</span>
                <div className="flex gap-1 items-center">
                  {renderCell(o, 'status')}
                  <button 
                    onClick={() => setEditingOrder(o)}
                    className="p-1 px-2 bg-orange-50 border border-orange-200 text-orange-600 rounded text-xs"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Sender:</strong> {o.sender_name} ({o.sender_loc})</p>
                <p><strong>Receiver:</strong> {o.receiver_name} - {o.receiver_phone}</p>
                <p><strong>Total Amount:</strong> {o.total_amount?.toLocaleString()} Ks</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── Advanced Edit Order Modal ── */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Edit Order Fields (Report Mode)</h3>
                <h2 className="text-base font-mono font-bold text-gray-900 mt-0.5">ID: {editingOrder.item_id}</h2>
              </div>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form id="report-edit-form" onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className={labelStyle}>Received Date</label>
                  <input type="date" className={winInput} value={editingOrder.received_date || ''} onChange={e => setEditingOrder({...editingOrder, received_date: e.target.value})}/>
                </div>
                <div>
                  <label className={labelStyle}>Branch</label>
                  <select className={winSelect} value={editingOrder.branch || ''} onChange={e => setEditingOrder({...editingOrder, branch: e.target.value})}>
                    <option value="MDY">MANDALAY (MDY)</option>
                    <option value="YGN">YANGON (YGN)</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Status</label>
                  <select className={winSelect} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                    <option value="At Office">📦 At Office</option>
                    <option value="On Way">🚵 On Way</option>
                    <option value="Delivered">✅ Delivered</option>
                    <option value="In-Transit">🚚 In-Transit</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Pick Up Rider</label>
                  <select className={winSelect} value={editingOrder.pickup_rider_id || ''} onChange={e => setEditingOrder({...editingOrder, pickup_rider_id: e.target.value})}>
                    <option value="">Select...</option>
                    {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className={labelStyle}>Sender Name</label>
                    <input className={winInput} value={editingOrder.sender_name || ''} onChange={e => setEditingOrder({...editingOrder, sender_name: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Sender Phone</label>
                    <input className={winInput} value={editingOrder.sender_phone || ''} onChange={e => setEditingOrder({...editingOrder, sender_phone: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Sender City</label>
                    <input className={winInput} value={editingOrder.sender_loc || ''} onChange={e => setEditingOrder({...editingOrder, sender_loc: e.target.value})}/>
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className={labelStyle}>Receiver Name</label>
                    <input className={winInput} value={editingOrder.receiver_name || ''} onChange={e => setEditingOrder({...editingOrder, receiver_name: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Receiver Phone</label>
                    <input className={winInput} value={editingOrder.receiver_phone || ''} onChange={e => setEditingOrder({...editingOrder, receiver_phone: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Receiver City</label>
                    <input className={winInput} value={editingOrder.receiver_loc || ''} onChange={e => setEditingOrder({...editingOrder, receiver_loc: e.target.value})}/>
                  </div>
                  <div className="sm:col-span-3 lg:col-span-4">
                    <label className={labelStyle}>Full Address</label>
                    <input className={winInput} value={editingOrder.receiver_address || ''} onChange={e => setEditingOrder({...editingOrder, receiver_address: e.target.value})}/>
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className={labelStyle}>Fee Type</label>
                    <select className={winSelect} value={editingOrder.fee_type || ''} onChange={e => setEditingOrder({...editingOrder, fee_type: e.target.value})}>
                      <option value="Prepaid">Prepaid (Paid Delivery)</option>
                      <option value="COD">COD (Cash on Delivery)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>COD Amount (Ks)</label>
                    <input type="number" className={winInput} value={editingOrder.cod_amount || 0} onChange={e => {
                      const cod = Number(e.target.value);
                      setEditingOrder({...editingOrder, cod_amount: cod, total_amount: cod + (editingOrder.deli_fee || 0)});
                    }}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Deli Fee (Ks)</label>
                    <input type="number" className={winInput} value={editingOrder.deli_fee || 0} onChange={e => {
                      const deli = Number(e.target.value);
                      setEditingOrder({...editingOrder, deli_fee: deli, total_amount: (editingOrder.cod_amount || 0) + deli});
                    }}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Total Amount (Ks)</label>
                    <input type="number" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-500 font-bold text-sm outline-none" value={editingOrder.total_amount || 0} readOnly />
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className={labelStyle}>Deliver Rider</label>
                    <select className={winSelect} value={editingOrder.deliver_rider_id || ''} onChange={e => setEditingOrder({...editingOrder, deliver_rider_id: e.target.value})}>
                      <option value="">Select...</option>
                      {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Deliver Date</label>
                    <input type="date" className={winInput} value={editingOrder.deliver_date || ''} onChange={e => setEditingOrder({...editingOrder, deliver_date: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Cash Added Date</label>
                    <input type="date" className={winInput} value={editingOrder.cash_added_date || ''} onChange={e => setEditingOrder({...editingOrder, cash_added_date: e.target.value})}/>
                  </div>
                  <div>
                    <label className={labelStyle}>Note / Remarks</label>
                    <select className={winSelect} value={editingOrder.note || ''} onChange={e => setEditingOrder({...editingOrder, note: e.target.value})}>
                      <option value="">Normal Delivery</option>
                      <option value="RT">Return Item (RT)</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition shadow-sm">
                Cancel
              </button>
              <button type="submit" form="report-edit-form" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium shadow-sm transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Cash / Handover Modal ── */}
      {handoverModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">💵 Rider Ngwe ရှင်းမှတ်တမ်းအသစ်သွင်းရန်</h3>
              <button onClick={() => setHandoverModal({ open: false, riderName: '' })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            
            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className={labelStyle}>Rider Name</label>
                <select 
                  className={winSelect} 
                  value={handoverModal.riderName} 
                  onChange={e => setHandoverModal({ ...handoverModal, riderName: e.target.value })}
                >
                  {riders.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelStyle}>Amount (Ngwe ပမာဏ)</label>
                <input 
                  type="number" 
                  className={winInput} 
                  value={handoverForm.amount} 
                  onChange={e => setHandoverForm({...handoverForm, amount: Number(e.target.value)})} 
                />
              </div>

              <div>
                <label className={labelStyle}>Payment Method</label>
                <select 
                  className={winSelect} 
                  value={handoverForm.payment_method} 
                  onChange={e => setHandoverForm({...handoverForm, payment_method: e.target.value})}
                >
                  <option value="Cash">Cash (Ngwe သား)</option>
                  <option value="Kpay">Kpay</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Transaction Type (အမျိုးအစား)</label>
                <select 
                  className={winSelect} 
                  value={handoverForm.transaction_type} 
                  onChange={e => setHandoverForm({...handoverForm, transaction_type: e.target.value})}
                >
                  <option value="Cash-in">Cash-in (ရိုးရိုးငွေအပ်)</option>
                  <option value="OOP">OOP (Out-Of-Pocket စိုက်ငွေ)</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Note (မှတ်ချက်)</label>
                <input 
                  type="text" 
                  placeholder="မှတ်ချက်ရှိပါက ဖြည့်သွင်းရန်..."
                  className={winInput} 
                  value={handoverForm.note} 
                  onChange={e => setHandoverForm({...handoverForm, note: e.target.value})} 
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => setHandoverModal({ open: false, riderName: '' })} 
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={submitHandover} 
                disabled={submitting}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Preview Modal ── */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-[60]" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl" />
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white font-bold bg-black/50 px-3 py-1 rounded-full">Close ×</button>
          </div>
        </div>
      )}

    </div>
  )
}