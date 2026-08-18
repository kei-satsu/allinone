"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AddCityForm from "@/components/AddCityForm";

const ImageUploader = dynamic(
  () => import('@/components/ImageUploader'),
  { ssr: false } // Server-Side Rendering ကို ပိတ်ထားတာပါ
)

interface QueueItem {
  local_id: string;
  payload: any; 
}

export default function EntryForm() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  const receiverNameRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [riders, setRiders] = useState<any[]>([])
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [userBranch, setUserBranch] = useState<string>('') 
  const [senders, setSenders] = useState<any[]>([])
  const [selectedSenderId, setSelectedSenderId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showSenderDropdown, setShowSenderDropdown] = useState<boolean>(false)
  const [showAllSuggestions, setShowAllSuggestions] = useState<boolean>(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(0)

  const [cities, setCities] = useState<any[]>([]);       // Table မြို့စာရင်းသိမ်းရန် State
const [isModalOpen, setIsModalOpen] = useState(false); // Pop-up ပွင့်/ပိတ် ထိန်းရန် State

// 💡 Supabase ထဲက မြို့စာရင်းကို ဆွဲထုတ်ပေးမည့် Function
const loadCities = async () => {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .order("name", { ascending: true }); // မြို့နာမည်အလိုက် အက္ခရာစဉ်ပေးထားပါသည်

  if (error) {
    console.error("Error fetching cities:", error);
    return;
  }
  if (data) setCities(data);
};

// 💡 Page စပွင့်ချင်းမှာ အလုပ်လုပ်ခိုင်းရန်
useEffect(() => {
  loadCities();
}, []);
  
  // ImageUploader ကို Form ရှင်းတဲ့အခါ Auto Clear ဖြစ်သွားအောင် သုံးမယ့် State
  const [resetKey, setResetKey] = useState<number>(Date.now())
  
  // Offline Sync States
  const [syncQueue, setSyncQueue] = useState<QueueItem[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    received_date: today,
    sender_id: null as string | null,
    sender_name: '',
    sender_phone: '',
    sender_loc: 'MDY', 
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    receiver_loc: 'MDY',
    cod_amount: 0,
    deli_fee: 0,
    fee_type: 'Deli',
    total_amount: 0,
    pickup_rider_id: '',
    status: 'At Office',
    deliver_rider_id: '',
    deliver_date: '',
    note: '',
    cleared_date: '',
    branch: '',
    image_url: '' // 🔥 ပုံ Link သိမ်းဖို့ နေရာအသစ်
  })

  // 1. Initial Load, Auth, Online Listener & Queue Load
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      setFormData(prev => ({ ...prev, branch: storedBranch, sender_loc: storedBranch }))
    }

    const storedQueue = localStorage.getItem('offline_orders_queue')
    if (storedQueue) {
      try { setSyncQueue(JSON.parse(storedQueue)) } catch(e) {}
    }

    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    senderInputRef.current?.focus()

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [router])

  // Riders ဆွဲထုတ်ခြင်း
  useEffect(() => {
    if (!userBranch) return
    async function fetchRiders() {
      const { data, error } = await supabase.from('riders').select('*').eq('branch', userBranch)
      if (!error && data) setRiders(data)
    }
    fetchRiders()
  }, [userBranch])

  useEffect(() => {
    async function fetchSenders() {
      const { data, error } = await supabase.from('senders').select('*').order('name', { ascending: true })
      if (!error && data) setSenders(data)
    }
    fetchSenders()
  }, [])

  // derive filtered senders for dropdown — use startsWith for Excel-like behavior
  const filteredSenders = (() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (showAllSuggestions && showSenderDropdown) return senders
    if (!q) return []
    return senders.filter(s => String(s.name || '').toLowerCase().startsWith(q))
  })()

  // 2. စုစုပေါင်းငွေ အလိုလိုတွက်ချက်ခြင်း
  useEffect(() => {
    let currentCOD = originalCod;
    const deli = Number(formData.deli_fee) || 0;
    if (formData.fee_type === 'Bill') currentCOD = originalCod - deli;

    let total = 0;
    if (formData.fee_type === 'Kpay' || formData.fee_type === 'Cash') {
      total = currentCOD;
    } else {
      total = currentCOD + deli;
    }

    setFormData(prev => ({ 
      ...prev, 
      cod_amount: currentCOD,
      total_amount: total 
    }))
  }, [originalCod, formData.deli_fee, formData.fee_type])

  // 3. Background Sync Engine
  useEffect(() => {
    if (!isOnline || syncQueue.length === 0 || syncing) return;

    async function processQueue() {
      setSyncing(true)
      const currentQueue = [...syncQueue]
      const itemToSync = currentQueue[0]

      try {
        const payload = itemToSync.payload

        if (payload && payload.type === 'create_sender_and_order') {
          // First create sender
          const { data: senderData, error: senderError } = await supabase.from('senders').insert(payload.sender).select().single()
          if (senderError || !senderData) throw new Error(senderError?.message || 'Sender creation failed')

          // Then create order with new sender id
          const orderPayload = { ...payload.order, sender_id: senderData.id }
          const { error: orderError } = await supabase.from('orders').insert([orderPayload])
          if (orderError) throw new Error(orderError.message)

        } else if (payload && payload.type === 'order') {
          const { error } = await supabase.from('orders').insert([payload.order || payload])
          if (error) throw new Error(error.message)
        } else {
          // fallback: insert payload as order
          const { error } = await supabase.from('orders').insert([itemToSync.payload])
          if (error) throw new Error(error.message)
        }

        const updatedQueue = currentQueue.slice(1)
        setSyncQueue(updatedQueue)
        localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
      } catch (err: any) {
        console.error('Sync error, retrying later:', err?.message || err)
        // if network issue, keep the queue and stop syncing for now
        if (String(err?.message || '').toLowerCase().includes('fetch')) {
          setSyncing(false)
          return
        }

        // remove the problematic item to avoid blocking
        const updatedQueue = currentQueue.slice(1)
        setSyncQueue(updatedQueue)
        localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
      }

      setSyncing(false)
    }

    const timer = setTimeout(() => {
      processQueue()
    }, 1000)

    return () => clearTimeout(timer)
  }, [syncQueue, isOnline, syncing])

  // 4. Phone Formatter
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
  }

  const handleStatusChange = (status: string) => {
    const isDateRelevant = ['On Way', 'Delivered', 'Returned'].includes(status)
    const nextDeliverDate = isDateRelevant
      ? formData.deliver_date || today
      : ''

    setFormData(prev => ({ ...prev, status, deliver_date: nextDeliverDate }))
  }

  const handleSenderPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setSelectedSenderId('')
    setFormData(prev => ({ ...prev, sender_id: null, sender_phone: formatted }))
  }

  const handleSenderSelection = (senderId: string) => {
    // empty selection -> clear
    if (!senderId) {
      setSelectedSenderId('')
      setFormData(prev => ({
        ...prev,
        sender_id: null,
        sender_name: '',
        sender_phone: '',
        sender_loc: userBranch || 'MDY'
      }))
      return
    }

    const selected = senders.find(sender => String(sender.id) === senderId)
    if (!selected) return

    setSelectedSenderId(senderId)
    setSearchQuery(selected.name || '')
    setActiveSuggestionIndex(-1)
    setShowSenderDropdown(false)
    setFormData(prev => ({
      ...prev,
      sender_id: selected.id,
      sender_name: selected.name ?? '',
      sender_phone: selected.phone ?? '',
      sender_loc: selected.LOC ?? (prev.sender_loc || 'MDY')
    }))
    setTimeout(() => receiverNameRef.current?.focus(), 30)
  }

  const handleNewSenderSuccess = (newSender: any) => {
    setSenders(prev => [...prev, newSender])
    setSelectedSenderId(String(newSender.id))
    setFormData(prev => ({
      ...prev,
      sender_id: newSender.id,
      sender_name: newSender.name || '',
      sender_phone: newSender.phone || '',
      sender_loc: newSender.LOC || prev.sender_loc
    }))
    
  }

  // 5. Submit Mechanism
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
      alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
      return
    }

    if ((formData.status === 'On Way' || formData.status === 'Delivered') && !formData.deliver_date) {
      alert("On Way နဲ့ Delivered အခြေအနေများအတွက် delivery date ထည့်ရေးရန်လိုပါသည်။")
      return
    }

    setLoading(true)

    try {
      const baseOrder: any = {
        ...formData,
        pickup_rider_id: formData.pickup_rider_id || null,
        deliver_rider_id: formData.deliver_rider_id || null,
        cleared_date: formData.cleared_date || null,
      }

      if (formData.status === 'On Way' || formData.status === 'Delivered') {
        baseOrder.deliver_date = formData.deliver_date || null
      } else {
        delete baseOrder.deliver_date
      }

      const isOnlineNow = navigator.onLine

      // If we have a selected sender id, just create order or queue it
      if (selectedSenderId) {
        const orderPayload = { ...baseOrder, sender_id: selectedSenderId }
        if (isOnlineNow) {
          const { error } = await supabase.from('orders').insert([orderPayload])
          if (error) {
            alert(`❌ အမှားအယွင်း - Order မဆွဲထုတ်နိုင်ခြင်း:\n${error.message}`)
            setLoading(false)
            return
          }
        } else {
          const newItem: QueueItem = { local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, payload: { type: 'order', order: orderPayload } }
          const updatedQueue = [...syncQueue, newItem]
          setSyncQueue(updatedQueue)
          localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
        }

      } else {
        // New sender typed in
        const newSenderData = { name: formData.sender_name, phone: formData.sender_phone, LOC: formData.sender_loc }

        if (isOnlineNow) {
          const { data: senderCreated, error: senderError } = await supabase.from('senders').insert(newSenderData).select().single()
          if (senderError || !senderCreated) {
            console.error('Sender creation error:', senderError)
            // fallback to queue
            const newItem: QueueItem = { local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, payload: { type: 'create_sender_and_order', sender: newSenderData, order: baseOrder } }
            const updatedQueue = [...syncQueue, newItem]
            setSyncQueue(updatedQueue)
            localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
            alert("ℹ️ စender အသစ်တည်ဆောက်ခြင်းမှ ကွန်ယက်ပြissue ရှိနေသည်။ Offline Queue သို့ သိမ်းဆည်းထားသည်။")
          } else {
            const orderPayload = { ...baseOrder, sender_id: senderCreated.id }
            const { error: orderError } = await supabase.from('orders').insert([orderPayload])
            if (orderError) {
              alert(`❌ Order မဆွဲထုတ်နိုင်ခြင်း:\n${orderError.message}`)
              setLoading(false)
              return
            }
          }
        } else {
          // offline: queue combined task
          const newItem: QueueItem = { local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, payload: { type: 'create_sender_and_order', sender: newSenderData, order: baseOrder } }
          const updatedQueue = [...syncQueue, newItem]
          setSyncQueue(updatedQueue)
          localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
        }
      }

      // Reset form & UI (only after successful submission)
      setOriginalCod(0)
      setSelectedSenderId('')
      setSearchQuery('')
      setShowSenderDropdown(false)
      setFormData(prev => ({
        ...prev,
        sender_id: null,
        sender_name: '', sender_phone: '', sender_loc: userBranch || 'MDY',
        receiver_name: '', receiver_phone: '', receiver_address: '',
        cod_amount: 0, deli_fee: 0, fee_type: 'Deli', total_amount: 0, note: '', cleared_date: '',
        pickup_rider_id: '', deliver_rider_id: '', status: 'At Office', deliver_date: '',
        image_url: '' // Reset Image
      }))

      setResetKey(Date.now())
      alert("✅ အရည်အသွေး သိမ်းဆည်းခြင်းအောင်မြင်သည်")
      setTimeout(() => senderInputRef.current?.focus(), 30)
    } catch (err: any) {
      console.error('Submit error:', err)
      alert(`❌ အမှားအယွင်း:\n${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const winInput = "w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 text-base placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 text-base focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1.5 uppercase text-xs tracking-wide"

  return (
    <div className="w-full min-h-screen bg-[#f3f3f3] text-base text-gray-800 antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-orange-400' : 'bg-red-400'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-orange-500' : 'bg-red-500'}`} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">New Items Entry</h1>
            <p className="hidden sm:block text-xs text-gray-500">All In One Delivery System</p>
          </div>
        </div>
        
        {/* Network & Queue Indicator Status */}
        <div className="flex items-center gap-2">
          {syncQueue.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-black text-amber-700 font-mono">{syncQueue.length} PENDING SYNC</span>
            </div>
          )}

          <div className="bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-bold text-gray-700 font-mono uppercase">{isOnline ? 'Online Mode' : 'Offline Mode'}</span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">
            {/* Meta Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <div>
                <label className={labelStyle}>Item ID</label>
                <input 
                  type="text" 
                  readOnly 
                  placeholder={syncQueue.length > 0 ? "[ Queue Staged ]" : "[ Auto Generated ]"} 
                  className="w-full px-4 py-3 bg-gray-100 border border-dashed border-gray-300 text-gray-400 font-mono font-bold rounded-lg text-center text-base cursor-not-allowed select-none" 
                  tabIndex={-1}
                />
              </div>
              <div>
                <label className={labelStyle}>Arrival Date</label>
                <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={`${winInput} font-mono`} required />
              </div>
              <div>
                <label className={labelStyle}>Pick Up Rider</label>
                <select value={formData.pickup_rider_id} onChange={e => setFormData({...formData, pickup_rider_id: e.target.value})} className={winSelect}>
                  <option value="">Select rider...</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sender Card */}
            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 bg-blue-50 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-sm">Sender Details</h3>
                    <p className="text-xs text-gray-500">Choose an existing sender or type a new one.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <label className={labelStyle}>Sender Name (Search or type new)</label>
                <div className="relative">
                  <input
                    ref={senderInputRef}
                    type="text"
                    value={searchQuery || formData.sender_name}
                    onChange={e => {
                      const v = e.target.value
                      setShowAllSuggestions(false)
                      setSearchQuery(v)
                      // show dropdown only when there's a non-empty query and matches exist
                      const q = v.trim().toLowerCase()
                      const matches = q ? senders.filter(s => String(s.name || '').toLowerCase().startsWith(q)) : []
                      setShowSenderDropdown(Boolean(matches.length && q.length > 0))
                      setSelectedSenderId('')
                      setActiveSuggestionIndex(0)
                      setFormData(prev => ({ ...prev, sender_id: null, sender_name: v }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' && filteredSenders.length > 0) {
                        e.preventDefault()
                        setActiveSuggestionIndex(prev => Math.min(prev + 1, filteredSenders.length - 1))
                        setShowSenderDropdown(true)
                      }
                      if (e.key === 'ArrowUp' && filteredSenders.length > 0) {
                        e.preventDefault()
                        setActiveSuggestionIndex(prev => Math.max(prev - 1, 0))
                        setShowSenderDropdown(true)
                      }
                      if ((e.key === 'Enter' || e.key === 'Tab') && showSenderDropdown && filteredSenders.length > 0) {
                        e.preventDefault()
                        const selected = filteredSenders[activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0]
                        if (selected) {
                          handleSenderSelection(String(selected.id))
                        }
                      }
                      if (e.key === 'Escape') {
                        setShowSenderDropdown(false)
                      }
                    }}
                    className={winInput}
                    placeholder="Search sender or type a new name"
                    required
                  />

                  {/* Toggle button to open/close suggestions */}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      // toggle dropdown; when opening with empty query, show all suggestions
                      if (!showSenderDropdown) {
                        setShowAllSuggestions(true)
                        setShowSenderDropdown(true)
                        setActiveSuggestionIndex(0)
                      } else {
                        setShowAllSuggestions(false)
                        setShowSenderDropdown(false)
                      }
                      senderInputRef.current?.focus()
                    }}
                    aria-label="Toggle sender suggestions"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white border border-gray-200 p-1 text-gray-600 hover:bg-gray-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showSenderDropdown && filteredSenders.length > 0 && (
                    <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredSenders.map((s, index) => (
                        <button
                          type="button"
                          key={s.id}
                          onMouseDown={() => handleSenderSelection(String(s.id))}
                          className={`w-full text-left px-4 py-2 ${index === activeSuggestionIndex ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.phone} — {s.LOC}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className={labelStyle}>Sender Office Location</label>
                    <select value={formData.sender_loc} onChange={e => setFormData({...formData, sender_loc: e.target.value})} className={winSelect}>
                      <option value="MDY">MANDALAY</option>
                      <option value="YGN">YANGON</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Sender Phone</label>
                    <input
                      type="text"
                      value={formData.sender_phone}
                      onChange={handleSenderPhoneChange}
                      className={`${winInput} font-mono`}
                      placeholder="09-xxx-xxx-xxx"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Receiver Card */}
            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
  <div className="flex items-center gap-2 mb-4">
    <span className="text-emerald-600 bg-emerald-50 p-2 rounded-lg">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </span>
    <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-sm">Receiver Details</h3>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
    <div>
      <label className={labelStyle}>Receiver Name <span className="text-red-500">*</span></label>
      <input ref={receiverNameRef} type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} placeholder="Enter name" required />
    </div>
    <div>
      <label className={labelStyle}>Phone Number <span className="text-red-500">*</span></label>
      <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} placeholder="09-xxx-xxx-xxx" className={`${winInput} font-mono`} required />
    </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="sm:col-span-2">
      <label className={labelStyle}>Full Delivery Address</label>
      <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={winInput} placeholder="Enter detailed address..." />
    </div>
    
    {/* 🏙️ Destination City Dropdown (မြို့အသစ်ထည့်ရန် ခလုတ်ပါဝင်သည်) */}
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className={labelStyle}>Destination City</label>
        
        {/* ➕ မြို့အသစ်ထည့်မည့် ခလုတ်ကလေး (White Theme နှင့် ကွက်တိဖြစ်အောင် ပြင်ထားပါသည်) */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)} // 💡 ကလစ်နှိပ်လျှင် Pop-up ပွင့်မည်
          className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition active:scale-95"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add New
        </button>
      </div>

      <select 
        value={formData.receiver_loc} 
        onChange={e => setFormData({...formData, receiver_loc: e.target.value})} 
        className={winSelect}
      >
        <option value="">-- Select City --</option>
        {/* 💡 Table ထဲက မြို့စာရင်းကို Loop ပတ်ပြီး လာပြပေးမည့်နေရာ */}
        {cities.map((city) => (
          <option key={city["C.ID"]} value={city["C.ID"]}>
            {city.name} ({city["C.ID"]})
          </option>
        ))}
      </select>
    </div>
  </div>
</div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-6">
            {/* Financials */}
            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 uppercase tracking-wide text-sm flex items-center gap-2">
                <span>💰</span> Financial Accounts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
               <div>
                  <label className={labelStyle}>COD Amount</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formData.cod_amount || ''} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (formData.fee_type === 'Bill') {
                          setOriginalCod(val + Number(formData.deli_fee));
                        } else {
                          setOriginalCod(val);
                        }
                      }} 
                      className={`${winInput} pl-8 font-mono font-bold text-gray-900`} 
                      placeholder="0" 
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">K</span>
                  </div>
                </div>
                <div>
                  <label className={labelStyle}>Delivery Fee</label>
                  <div className="relative">
                    <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${winInput} pl-8 font-mono text-orange-600 font-bold`} placeholder="0" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">K</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className={labelStyle}>Payment Type</label>
                  <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={winSelect}>
                    <option value="Deli">Deli (+)</option>
                    <option value="Kpay">Kpay (Prepaid)</option>
                    <option value="Cash">Cash (Prepaid)</option>
                    <option value="Bill">Bill (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-orange-600 font-semibold mb-1.5 uppercase text-xs tracking-wide">Total Final</label>
                  <div className="w-full bg-gray-900 py-3 px-4 rounded-lg flex items-center justify-between">
                    <span className="font-mono font-bold text-lg text-orange-400">{formData.total_amount.toLocaleString()}</span>
                    <span className="text-sm font-semibold text-orange-300">Ks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Dispatch Status</label>
                  <select value={formData.status} onChange={e => handleStatusChange(e.target.value)} className={winSelect}>
                     <option value="At Office">📦 At Office</option>
                      <option value="On Way">🚵 On Way</option>
                      <option value="Delivered">✅ Delivered</option>
                      <option value="In-Transit">🚚 In-Transit</option>
                      <option value="Via-Agent">🚐 Via-Agent</option>
                      <option value="Returned">↗️ Returned</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Deliver Date</label>
                  <input
                    type="date"
                    value={formData.deliver_date}
                    onChange={e => setFormData({...formData, deliver_date: e.target.value})}
                    className={`${winInput} font-mono ${!['On Way', 'Delivered', 'Returned'].includes(formData.status) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={!['On Way', 'Delivered', 'Returned'].includes(formData.status)}
                  />
                </div>
              </div>
              <div>
                <label className={labelStyle}>Delivery Rider</label>
                <select value={formData.deliver_rider_id} onChange={e => setFormData({...formData, deliver_rider_id: e.target.value})} className={winSelect}>
                  <option value="">Select delivery rider...</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Return Utility</label>
                  <select value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className={winSelect}>
                    <option value="">Normal Delivery</option>
                    <option value="RT">Return Item (RT)</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Cash Event</label>
                  <select value={formData.cleared_date ? "yes" : "no"} onChange={e => setFormData({...formData, cleared_date: e.target.value === "yes" ? today : ""})} className={winSelect}>
                    <option value="no">Not Cleared</option>
                    <option value="yes">Cleared</option>
                  </select>
                </div>
              </div>
              {formData.cleared_date && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <label className="block text-emerald-700 font-semibold mb-1.5 uppercase text-xs tracking-wide">Cleared Date</label>
                  <input 
                    type="date" 
                    value={formData.cleared_date} 
                    onChange={e => setFormData({...formData, cleared_date: e.target.value})} 
                    className={`${winInput} border-emerald-200 focus:border-emerald-500`}
                    required
                  />
                </div>
              )}
            </div>

            {/* 🔥 Voucher Image Uploader Card 🔥 */}
            <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-purple-600 bg-purple-50 p-2 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </span>
                <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-sm">Voucher Image</h3>
              </div>
              
              <ImageUploader 
                key={resetKey} // Form reset တိုင်း ဒီ Uploader ကို အသစ်ပြန်ဖြစ်သွားအောင် key ထည့်ပေးထားပါတယ်
                onUploadSuccess={(url) => setFormData(prev => ({ ...prev, image_url: url }))} 
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-3.5 text-base font-semibold rounded-lg uppercase tracking-wide transition-all text-white shadow-md active:scale-[0.99] ${loading ? 'bg-gray-400 cursor-not-allowed opacity-75' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {loading ? '⏳ Saving...' : '✅ Queue & Save Item'}
            </button>
          </div>
        </form>
      </div>
      <AddCityForm 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCityAdded={loadCities} 
      />
    </div>
  )
}