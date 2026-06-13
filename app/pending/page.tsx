"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface QueueItem {
  local_id: string;
  payload: any;
}

export default function PendingEntry() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  const receiverNameRef = useRef<HTMLInputElement>(null)
  
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [riders, setRiders] = useState<any[]>([])
  const [senders, setSenders] = useState<any[]>([])
  const [selectedSenderId, setSelectedSenderId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showSenderDropdown, setShowSenderDropdown] = useState<boolean>(false)
  const [showAllSuggestions, setShowAllSuggestions] = useState<boolean>(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(0)
  const [userBranch, setUserBranch] = useState<string>('')
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [syncQueue, setSyncQueue] = useState<QueueItem[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // ── Persisted fields across items ──
  const [persistSenderName, setPersistSenderName] = useState('')
  const [persistSenderLoc, setPersistSenderLoc] = useState('MDY')
  const [persistPickupRiderId, setPersistPickupRiderId] = useState('')

  // ── Processed history (undo stack) ──
  const [processedStack, setProcessedStack] = useState<string[]>([])

  // Image controls
  const [zoomScale, setZoomScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Split panel
  const [leftWidth, setLeftWidth] = useState(500)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ✨ Gallery Expand State
  const [isThumbGridOpen, setIsThumbGridOpen] = useState(false)

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
    cash_added_date: '',
    branch: '',
    image_url: ''
  })

  // 🌟 Tab နှိပ်ပြီး Select Box ပေါ်ရောက်တာနဲ့ Dropdown ကို Auto ဖြည်ချပေးမယ့် စနစ်
  const handleSelectFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    try {
      // Modern Browser တွေမှာ Select အကွက်ကို အလိုအလျောက် ပွင့်လာစေမယ့် showPicker စနစ် ဖြစ်ပါတယ်
      if (typeof e.target.showPicker === 'function') {
        e.target.showPicker();
      }
    } catch (error) {
      console.log("Dropdown open error:", error);
    }
  };

  // ── Initialize ──
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
      return
    }
    setUserBranch(storedBranch)
    fetchRiders(storedBranch)
    fetchPendingItems(storedBranch)

    const storedQueue = localStorage.getItem('offline_orders_queue')
    if (storedQueue) {
      try { setSyncQueue(JSON.parse(storedQueue)) } catch (e) {}
    }

    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [router])

  // ✨ Keyboard Arrow Key Navigation Handler (Shift + Arrow Key for Inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pendingItems.length <= 1 || !selectedItem) return

      const currentIndex = pendingItems.findIndex(item => item.id === selectedItem.id)
      if (currentIndex === -1) return

      // လက်ရှိ Input, Textarea သို့မဟုတ် Select box ထဲမှာ Focus ရောက်နေသလား စစ်ဆေးမယ်
      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'

      // အကယ်၍ စာရိုက်တဲ့နေရာထဲ ရောက်နေပြီး Shift Key မပါဘူးဆိုရင် ဘာမှမလုပ်ဘဲ ကျော်သွားမယ်
      if (isInputActive && !e.shiftKey) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const nextIndex = (currentIndex + 1) % pendingItems.length
        // စာရိုက်နေရင်း Shift + Arrow နှိပ်တာဆိုရင် ပုံအသစ်ပြောင်းပြီး Sender Name အကွက်ထဲကို Focus တန်းပြန်ပေးမယ်
        handleSelectItem(pendingItems[nextIndex], isInputActive)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prevIndex = (currentIndex - 1 + pendingItems.length) % pendingItems.length
        handleSelectItem(pendingItems[prevIndex], isInputActive)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingItems, selectedItem])    

  // Divider resize
  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.max(300, Math.min(e.clientX, 900))
      setLeftWidth(newWidth)
    }
    const handleResizeEnd = () => setIsResizing(false)
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [isResizing])

  async function fetchRiders(branch: string) {
    const { data } = await supabase.from('riders').select('*').eq('branch', branch)
    if (data) setRiders(data)
  }

  useEffect(() => {
    if (!userBranch) return
    async function fetchSenders() {
      const { data, error } = await supabase.from('senders').select('*').order('name', { ascending: true })
      if (!error && data) setSenders(data)
    }
    fetchSenders()
  }, [userBranch])

  async function fetchPendingItems(branch: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('branch', branch)
      .eq('status', 'Pending')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setPendingItems(data)
      if (data.length > 0 && !selectedItem) {
        handleSelectItem(data[0])
      }
    }
  }

  // 🌟 ဘယ်နေရာမှာပဲဖြစ်ဖြစ် Enter နှိပ်လိုက်ရင် Update & Next ကို တန်းနှိပ်ပေးမယ့် စနစ်
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // အကယ်၍ Textarea ထဲမှာ စာရိုက်နေလို့ Line Break ဆင်းချင်တာမျိုးဆိုရင်တော့ Enter ကို ခွင့်ပြုမယ်
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

        // Form ထဲက "Update & Next" Submit ခလုတ်ကို လှမ်းရှာမယ်
        const submitButton = document.querySelector('button[type=\"submit\"]') as HTMLButtonElement;
        
        if (submitButton && !submitButton.disabled) {
          e.preventDefault();   // Enter ရဲ့ ပုံမှန်အလုပ်လုပ်ပုံကို ခေတ္တပိတ်မယ်
          submitButton.click();  // "Update & Next" ခလုတ်ကို Programmatically လှမ်းနှိပ်လိုက်မယ်
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedItem, loading]); // Item ပြောင်းလဲမှုနဲ့ Loading စတိတ်တွေကို စောင့်ကြည့်ဖို့ Dependency ထည့်ထားပါတယ်

  const filteredSenders = (() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (showAllSuggestions && showSenderDropdown) return senders
    if (!q) return []
    return senders.filter(s => String(s.name || '').toLowerCase().startsWith(q))
  })()

  useEffect(() => {
    if (!isOnline || syncQueue.length === 0 || syncing) return

    async function processQueue() {
      setSyncing(true)
      const currentQueue = [...syncQueue]
      const itemToSync = currentQueue[0]

      try {
        const payload = itemToSync.payload
        
        // 🌟 ၁။ အော့ဖ်လိုင်းတုန်းက Sender အသစ်ပါ တွဲရိုက်ခဲ့တဲ့ Payload ဖြစ်နေရင်
        if (payload && payload.type === 'update_order_with_new_sender') {
          // (က) Sender အသစ်ကို Database ထဲ အရင် Insert လုပ်ပြီး ID အသစ် ယူမယ်
          const { data: newSender, error: sErr } = await supabase
            .from('senders')
            .insert([{ name: payload.sender.name, phone: payload.sender.phone, LOC: payload.sender.LOC }])
            .select()
            .single()
          
          if (sErr) throw sErr

          // (ခ) ရလာတဲ့ Sender ID အသစ်ကို Order Payload ထဲ တွဲထည့်ပြီးမှ အော်ဒါကို Update လုပ်မယ်
          const finalOrder = { ...payload.order, sender_id: newSender.id }
          const { error: oErr } = await supabase.from('orders').update(finalOrder).eq('id', finalOrder.id)
          if (oErr) throw oErr

          // Dropdown state ထဲကိုပါ အသစ်တိုးပေးထားမယ် (ရွေးစရာထဲ တန်းပေါ်အောင်)
          setSenders(prev => [...prev, newSender])
        } 
        // 🌟 ၂။ ပုံမှန် ရှိပြီးသား Sender မို့ အော်ဒါတစ်ခုတည်း Update လုပ်မည့်အပိုင်း
        else if (payload && payload.type === 'update_order') {
          const { error } = await supabase.from('orders').update(payload.order).eq('id', payload.order.id)
          if (error) throw error
        } else if (payload && payload.type === 'order') {
          const { error } = await supabase.from('orders').insert([payload.order || payload])
          if (error) throw error
        } else {
          const { error } = await supabase.from('orders').insert([itemToSync.payload])
          if (error) throw error
        }

        const updatedQueue = currentQueue.slice(1)
        setSyncQueue(updatedQueue)
        localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
      } catch (err: any) {
        console.error('Sync error, retrying later:', err?.message || err)
        if (String(err?.message || '').toLowerCase().includes('fetch')) {
          setSyncing(false)
          return
        }
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

  const handleSelectItem = (item: any, shouldFocusInput = true) => {
    setSelectedItem(item)
    setOriginalCod(item.cod_amount || 0)
    setZoomScale(1); setRotation(0); setPosition({ x: 0, y: 0 })

    setSelectedSenderId(item.sender_id ? String(item.sender_id) : '')
    setSearchQuery(item.sender_name || '')
    setFormData(prev => ({
      received_date: item.received_date || today,
      sender_name: persistSenderName || item.sender_name || '',
      sender_phone: item.sender_phone || '',
      sender_loc: persistSenderLoc || item.sender_loc || userBranch,
      receiver_name: item.receiver_name || '',
      receiver_phone: item.receiver_phone || '',
      receiver_address: item.receiver_address || '',
      receiver_loc: item.receiver_loc || 'MDY',
      cod_amount: item.cod_amount || 0,
      deli_fee: item.deli_fee || 0,
      fee_type: item.fee_type || 'Deli',
      total_amount: item.total_amount || 0,
      pickup_rider_id: persistPickupRiderId || item.pickup_rider_id || '',
      status: 'At Office',
      deliver_rider_id: item.deliver_rider_id || '',
      deliver_date: item.deliver_date || '',
      note: item.note || '',
      cash_added_date: item.cash_added_date || '',
      sender_id: item.sender_id || null,
      branch: item.branch || userBranch,
      image_url: item.image_url || ''
    }))

    if (shouldFocusInput) {
      setTimeout(() => senderInputRef.current?.focus(), 50)
    } else {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur() // Arrow Key နဲ့ အမြန်ကျော်ရင် focus ဖြုတ်ပေးထားမယ်
      }
    }
  }

  const handleUndo = async () => {
    if (processedStack.length === 0) return
    const lastId = processedStack[processedStack.length - 1]
    setProcessedStack(prev => prev.slice(0, -1))
    const { data, error } = await supabase.from('orders').select('*').eq('id', lastId).single()
    if (!error && data) {
      setPendingItems(prev => [data, ...prev])
      handleSelectItem(data)
    }
  }

  const handlePersistChange = (field: string, value: string) => {
    if (field === 'sender_name') setPersistSenderName(value)
    else if (field === 'sender_loc') setPersistSenderLoc(value)
    else if (field === 'pickup_rider_id') setPersistPickupRiderId(value)
    setFormData(prev => ({ ...prev, [field]: value }))
  }

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
    setFormData(prev => ({ ...prev, cod_amount: currentCOD, total_amount: total }))
  }, [originalCod, formData.deli_fee, formData.fee_type])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
  }

  const handleStatusChange = (status: string) => {
    const nextDeliverDate = (status === 'On Way' || status === 'Delivered')
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
    if (!senderId) {
      setSelectedSenderId('')
      setFormData(prev => ({ ...prev, sender_id: null, sender_name: '', sender_phone: '' }))
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

  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return alert("စာရင်းသွင်းရန် Item ရွေးချယ်ပါ။")
    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
      return alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
    }
    setLoading(true)

    let finalSenderId = formData.sender_id
    const isOnlineNow = navigator.onLine

    // Base Order Payload ပြင်ဆင်ခြင်း
    const baseOrderPayload: any = {
      ...formData,
      pickup_rider_id: formData.pickup_rider_id || null,
      deliver_rider_id: formData.deliver_rider_id || null,
      cash_added_date: formData.cash_added_date || null,
    }

    if (formData.status === 'On Way' || formData.status === 'Delivered') {
      baseOrderPayload.deliver_date = formData.deliver_date || null
    } else {
      delete baseOrderPayload.deliver_date
    }

    try {
      if (isOnlineNow) {
        // 🟢 အွန်လိုင်းဖြစ်နေချိန် လုပ်ဆောင်ချက် Flow
        // အကယ်၍ finalSenderId က null ဖြစ်နေရင် (လူအသစ်ရိုက်ထားတာဆိုရင်) အရင်ဆောက်မယ်
        if (!finalSenderId) {
          const { data: newSender, error: senderError } = await supabase
            .from('senders')
            .insert([{ name: formData.sender_name, phone: formData.sender_phone, LOC: formData.sender_loc }])
            .select()
            .single()

          if (senderError) throw new Error("Sender အသစ်သိမ်းဆည်းမှု မအောင်မြင်ပါ: " + senderError.message)
          
          if (newSender) {
            finalSenderId = newSender.id
            baseOrderPayload.sender_id = newSender.id
            // Local state ထဲပါ တန်းထည့်ပေးထားမယ် နောက်တစ်ခါ Dropdown မှာ တန်းပေါ်အောင်လို့
            setSenders(prev => [...prev, newSender])
          }
        }

        // ပြီးမှ Order ကို Update လုပ်မယ်
        const { error: orderError } = await supabase.from('orders').update(baseOrderPayload).eq('id', selectedItem.id)
        if (orderError) throw orderError

        // UI ကို Next Item သို့ ရွှေ့ပေးခြင်း
        setProcessedStack(prev => [...prev, selectedItem.id])
        const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id)
        setPendingItems(updatedPending)
        if (updatedPending.length > 0) {
          handleSelectItem(updatedPending[0])
        } else {
          setSelectedItem(null)
        }

      } else {
        // 🔴 အော့ဖ်လိုင်းဖြစ်နေချိန် လုပ်ဆောင်ချက် Flow (Queue ထဲ ပစ်ထည့်မည့်စနစ်)
        let newItem: QueueItem;

        if (!finalSenderId) {
          // Sender အသစ်ကော Order ကောကို တွဲရက် Payload နဲ့ Queue ထဲထည့်မယ်
          newItem = {
            local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            payload: {
              type: 'update_order_with_new_sender',
              sender: { name: formData.sender_name, phone: formData.sender_phone, LOC: formData.sender_loc },
              order: { ...baseOrderPayload, id: selectedItem.id }
            }
          }
        } else {
          // ရှိပြီးသား Sender မို့ ပုံမှန်အတိုင်း အော်ဒါပဲ Queue ထဲ ထည့်မယ်
          newItem = {
            local_id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            payload: { type: 'update_order', order: { ...baseOrderPayload, id: selectedItem.id } }
          }
        }

        const updatedQueue = [...syncQueue, newItem]
        setSyncQueue(updatedQueue)
        localStorage.setItem('offline_orders_queue', JSON.stringify(updatedQueue))
        
        // အော့ဖ်လိုင်းဖြစ်နေလည်း UI မှာ ပြီးသွားသလိုမျိုး Next Item ကို တန်းကျော်ပေးမယ်
        setProcessedStack(prev => [...prev, selectedItem.id])
        const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id)
        setPendingItems(updatedPending)
        if (updatedPending.length > 0) {
          handleSelectItem(updatedPending[0])
        } else {
          setSelectedItem(null)
        }
      }
    } catch (err: any) {
      alert("Error ဖြစ်ပွားခဲ့သည်: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.25, 0.5))
  const handleRotateClockwise = () => setRotation(prev => prev + 90)
  const handleRotateCounterClockwise = () => setRotation(prev => prev - 90)
  const handleResetImage = () => { setZoomScale(1); setRotation(0); setPosition({ x: 0, y: 0 }) }
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.15;
    if (e.deltaY < 0) setZoomScale(prev => Math.min(prev + zoomFactor, 4))
    else setZoomScale(prev => Math.max(prev - zoomFactor, 0.4))
  }
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUpOrLeave = () => setIsDragging(false)

  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-xs tracking-wide"

  return (
    <div className="w-full min-h-screen bg-[#f3f3f3] text-sm text-gray-800 antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] flex flex-col h-screen select-none">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-gray-900 uppercase tracking-wide">Pending Data Entry</h1>
          <button
            onClick={handleUndo}
            disabled={processedStack.length === 0}
            className="text-xs font-medium text-gray-500 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
            title="Go back to last processed item"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
            Undo
          </button>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg flex items-center gap-2">
          <span className="text-xs font-bold text-orange-700 font-mono">{pendingItems.length} PENDING</span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
        
        {/* Left panel: Image + thumbnail strip */}
        <div 
          style={{ width: isMobile ? '100%' : `${leftWidth}px` }}
          className="w-full h-[45vh] lg:h-full lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-300 bg-gray-900 flex flex-col relative overflow-hidden"
        >
          {selectedItem ? (
            <>
              {/* ✨ Expandable Grid View Overlay Panel */}
              {isThumbGridOpen && (
                <div className="absolute inset-0 bg-gray-950 z-40 flex flex-col p-4 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 flex-shrink-0">
                    <h4 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>Vouchers Gallery Grid</span>
                      <span className="bg-orange-500 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">{pendingItems.length} items</span>
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setIsThumbGridOpen(false)} 
                      className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition"
                    >
                      Close Grid View
                    </button>
                  </div>
                  
                  {/* Grid Scroll Area */}
                  <div className="flex-1 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2 overflow-y-auto content-start pb-4 pr-1 scrollbar-thin">
                    {pendingItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => {
                          handleSelectItem(item)
                          setIsThumbGridOpen(false) // ပုံရွေးပြီးရင် grid ကိုပိတ်မယ်
                        }}
                        className={`aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 relative group ${selectedItem.id === item.id ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-gray-800 hover:border-gray-500'}`}
                      >
                        <img src={item.image_url} className="w-full h-full object-cover select-none pointer-events-none" alt="thumb" />
                        {item.uploader_note && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black animate-pulse" title="Has Note" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-gray-300 px-1 py-0.5 truncate text-center font-mono group-hover:text-white">
                          No. {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div 
                className="flex-1 flex items-center justify-center p-3 bg-black overflow-hidden relative group select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                {/* Image Control Bar */}
                <div 
                  className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-950/80 backdrop-blur-xl px-3 py-1.5 rounded-2xl flex items-center gap-2 border border-white/10 shadow-2xl z-20 transition-all duration-300"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all duration-200 active:scale-95"
                    title="Zoom In"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all duration-200 active:scale-95"
                    title="Zoom Out"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-0.5" />

                  <button
                    type="button"
                    onClick={handleRotateCounterClockwise}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all duration-200 active:scale-95"
                    title="Rotate Left"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleRotateClockwise}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-white/5 rounded-xl transition-all duration-200 active:scale-95"
                    title="Rotate Right"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                    </svg>
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-0.5" />

                  <button
                    type="button"
                    onClick={handleResetImage}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1"
                  >
                    Reset
                  </button>
                </div>

                <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
                  <img 
                    src={selectedItem.image_url} 
                    alt="Voucher" 
                    draggable={false} 
                    style={{ 
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoomScale}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-75 ease-out pointer-events-auto"
                  />
                </div>
                <div className="absolute bottom-2 right-3 text-[10px] bg-black/60 text-gray-400 px-2 py-0.5 rounded font-mono pointer-events-none z-10">
                  Zoom: {Math.round(zoomScale * 100)}%
                </div>
              </div>
              
              {/* Bottom Strip Zone with Expand Grid Trigger */}
              <div className="h-20 bg-gray-950 border-t border-gray-800 p-1.5 flex gap-2 overflow-x-auto scrollbar-thin flex-shrink-0 items-center">
                
                {/* ✨ Grid Trigger Icon Button */}
                <button
                  type="button"
                  onClick={() => setIsThumbGridOpen(true)}
                  className="w-14 h-full min-w-[56px] rounded-md bg-gray-800 hover:bg-orange-600 text-gray-300 hover:text-white border border-gray-700 flex flex-col items-center justify-center transition-all gap-1 shrink-0 active:scale-95 shadow-lg"
                  title="Expand All Vouchers (Grid View)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Expand</span>
                </button>

                <div className="w-px h-full bg-gray-800 shrink-0" />

                {/* Horizontal list of thumbnails */}
                {pendingItems.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    onClick={() => handleSelectItem(item)}
                    className={`w-14 h-full min-w-[56px] rounded-md overflow-hidden cursor-pointer border-2 transition-all relative ${selectedItem.id === item.id ? 'border-orange-500 scale-95 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={item.image_url} className="w-full h-full object-cover" alt="thumb" draggable={false} />
                    {item.uploader_note && (
                      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black" title="Has Note" />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center">
              <svg className="w-12 h-12 mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <h3 className="text-lg font-bold text-white mb-1">အကုန် ပြီးသွားပါပြီ 🎉</h3>
              <p className="text-xs">Data ဖြည့်ရန် Pending စာရင်း မရှိတော့ပါ။</p>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true) }}
          className={`hidden lg:block w-2 h-full cursor-col-resize transition-colors flex-shrink-0 z-30 ${isResizing ? 'bg-orange-500' : 'bg-gray-800 hover:bg-orange-500'} border-l border-r border-gray-950/40`}
        />

        {/* Right panel: Form */}
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            
            {selectedItem?.uploader_note && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-lg shadow-sm">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block mb-1">💬 Note for this Percel</span>
                <p className="text-gray-900 font-medium text-sm">{selectedItem.uploader_note}</p>
              </div>
            )}

            {/* Top row: Item ID, Arrival Date, Pickup Rider */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div>
                <label className={labelStyle}>Item ID</label>
                <input type="text" readOnly value={selectedItem?.item_id || selectedItem?.id || '[ Select ]'} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500 font-mono font-bold rounded-lg text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className={labelStyle}>Arrival Date</label>
                <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={winInput} required />
              </div>
              <div>
                <label className={labelStyle}>Pickup Rider</label>
                <select 
                  value={formData.pickup_rider_id} 
                  onChange={e => handlePersistChange('pickup_rider_id', e.target.value)} 
                  className={winSelect}
                  disabled={!selectedItem}
                  onFocus={handleSelectFocus}
                >
                  <option value="">Select rider</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sender & Receiver cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Sender */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-600 bg-blue-50 p-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-xs">Sender</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelStyle}>Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        ref={senderInputRef}
                        type="text"
                        value={searchQuery || formData.sender_name}
                        onChange={e => {
                          const v = e.target.value
                          setShowAllSuggestions(false)
                          setSearchQuery(v)
                          const q = v.trim().toLowerCase()
                          const matches = q ? senders.filter(s => String(s.name || '').toLowerCase().startsWith(q)) : []
                          setShowSenderDropdown(Boolean(matches.length && q.length > 0))
                          setSelectedSenderId('')
                          setFormData(prev => ({ ...prev, sender_id: null, sender_name: v }))
                        }}
                        onKeyDown={(e) => {
                          if (filteredSenders.length === 0) return
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setActiveSuggestionIndex(prev => Math.min(prev + 1, filteredSenders.length - 1))
                            setShowSenderDropdown(true)
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setActiveSuggestionIndex(prev => Math.max(prev - 1, 0))
                            setShowSenderDropdown(true)
                          }
                          if ((e.key === 'Enter' || e.key === 'Tab') && showSenderDropdown) {
                            e.preventDefault()
                            const selected = filteredSenders[activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0]
                            if (selected) handleSenderSelection(String(selected.id))
                          }
                          if (e.key === 'Escape') {
                            setShowSenderDropdown(false)
                          }
                        }}
                        className={winInput}
                        required
                        disabled={!selectedItem}
                      />
                      <button
                        type="button"
                        aria-label="Toggle sender suggestions"
                        onMouseDown={(e) => {
                          e.preventDefault()
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
                              key={s.id}
                              type="button"
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
                  </div>
                  <div>
                    <label className={labelStyle}>Phone</label>
                    <input
                      type="text"
                      value={formData.sender_phone}
                      onChange={handleSenderPhoneChange}
                      className={`${winInput} font-mono`}
                      placeholder="09-xxx-xxx-xxx"
                      disabled={!selectedItem}
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Location</label>
                    <select 
                      value={formData.sender_loc} 
                      onChange={e => handlePersistChange('sender_loc', e.target.value)} 
                      className={winSelect} 
                      disabled={!selectedItem}
                      onFocus={handleSelectFocus}
                    >
                      <option value="MDY">MANDALAY</option>
                      <option value="YGN">YANGON</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Receiver */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-xs">Receiver</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelStyle}>Name <span className="text-red-500">*</span></label>
                    <input ref={receiverNameRef} type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Phone <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} className={`${winInput} font-mono`} required disabled={!selectedItem} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelStyle}>City</label>
                     <select value={formData.receiver_loc} onChange={e => setFormData({...formData, receiver_loc: e.target.value})} className={winSelect}  disabled={!selectedItem} onFocus={handleSelectFocus}>
                        <option value="MDY">Mandalay</option>
                        <option value="YGN">Yangon</option>
                      </select>
                    </div>
                    <div className="col-span-2 mt-1">
                      <label className={labelStyle}>Address</label>
                      <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={winInput} disabled={!selectedItem} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial & Status row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">💰 Financials</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelStyle}>COD</label>
                    <input type="number" value={formData.cod_amount || ''} onChange={e => {
                      const val = Number(e.target.value);
                      if (formData.fee_type === 'Bill') setOriginalCod(val + Number(formData.deli_fee));
                      else setOriginalCod(val);
                    }} className={winInput} disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Deli Fee</label>
                    <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${winInput} text-orange-600`} disabled={!selectedItem} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Type</label>
                    <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={winSelect}  disabled={!selectedItem} onFocus={handleSelectFocus}>
                      <option value="Deli">Deli (+)</option>
                      <option value="Kpay">Kpay</option>
                      <option value="Cash">Cash</option>
                      <option value="Bill">Bill (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-orange-600 font-semibold mb-1 uppercase text-xs">Total</label>
                    <div className="w-full bg-gray-900 py-2 px-3 rounded-lg flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-orange-400">{formData.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Status</label>
                    <select value={formData.status} onChange={e => handleStatusChange(e.target.value)} className={winSelect}  disabled={!selectedItem} onFocus={handleSelectFocus}>
                      <option value="At Office">📦 At Office</option>
                      <option value="On Way">🚵 On Way</option>
                      <option value="Delivered">✅ Delivered</option>
                      <option value="In-Transit">🚚 In-Transit</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Deliver Date</label>
                    <input
                      type="date"
                      value={formData.deliver_date}
                      onChange={e => setFormData({...formData, deliver_date: e.target.value})}
                      className={`${winInput} font-mono ${formData.status !== 'On Way' && formData.status !== 'Delivered' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      disabled={!selectedItem || (formData.status !== 'On Way' && formData.status !== 'Delivered')}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelStyle}>Delivery Rider</label>
                  <select value={formData.deliver_rider_id} onChange={e => setFormData({...formData, deliver_rider_id: e.target.value})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
                    <option value="">Select delivery rider...</option>
                    {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Return Utility</label>
                    <select value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
                      <option value="">Normal Delivery</option>
                      <option value="RT">Return Item (RT)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Cash Event</label>
                    <select value={formData.cash_added_date ? 'yes' : 'no'} onChange={e => setFormData({...formData, cash_added_date: e.target.value === 'yes' ? today : ''})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
                      <option value="no">No Cash Added</option>
                      <option value="yes">Cash Added Event</option>
                    </select>
                  </div>
                </div>
                {formData.cash_added_date && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <label className="block text-emerald-700 font-semibold mb-1.5 uppercase text-xs tracking-wide">Cash Added Date</label>
                    <input
                      type="date"
                      value={formData.cash_added_date}
                      onChange={e => setFormData({...formData, cash_added_date: e.target.value})}
                      className={`${winInput} border-emerald-200 focus:border-emerald-500`}
                      required
                      disabled={!selectedItem}
                    />
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={!selectedItem || loading}
                  className={`w-full py-3 text-sm font-bold rounded-lg uppercase tracking-wide transition-all shadow-md ${
                    !selectedItem || loading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-[0.99]'
                  }`}
                >
                  {loading ? 'Saving...' : 'Update & Next'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>      
    </div>
  )
} 