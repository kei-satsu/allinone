"use client"
import { useState, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/databaseApi'
import { useRouter } from 'next/navigation'
import AddCityForm from "@/components/AddCityForm";
import { createWorker } from 'tesseract.js'


interface QueueItem {
  local_id: string;
  payload: any;
}

 

export default function PendingEntry() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  const receiverNameRef = useRef<HTMLInputElement>(null)

  const thumbContainerRef = useRef<HTMLDivElement>(null)
  
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Persisted fields across items ──
  const [persistSenderName, setPersistSenderName] = useState('')
  const [persistSenderLoc, setPersistSenderLoc] = useState('MDY')
  const [persistPickupRiderId, setPersistPickupRiderId] = useState('')
  const [persistSenderPhone, setPersistSenderPhone] = useState('')
  const [persistSenderId, setPersistSenderId] = useState<string | null>(null)

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
  const selectedBarcode = selectedItem?.barcode || selectedItem?.item_id || selectedItem?.id || ''

     // Rider ID ဖြင့် Rider Name ရှာပေးသည့် Helper Logic
const getRiderName = (riderId: string | number | null) => {
  if (!riderId) return 'N/A';
  const rider = riders?.find((r: any) => r.id === riderId);
  return rider ? `${rider.name} (${riderId})` : riderId;
};

// History Log ထည့်ပေးသည့် Helper Function
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
   

  const [formData, setFormData] = useState({
    received_date: today,
    sender_id: null as string | null,
    sender_name: '',
    sender_phone: '',
    sender_loc: 'MDY', 
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    receiver_loc: userBranch,
    cod_amount: 0,
    deli_fee: 0,
    fee_type: 'Deli',
    total_amount: 0,
    pickup_rider_id: '',
    status: '',
    deliver_rider_id: '',
    deliver_date: '',
    note: '',
    cleared_date: '',
    branch: '',
    image_url: '',
    remark: ''
  })

  

  const [ocrLoading, setOcrLoading] = useState(false)
const [ocrText, setOcrText] = useState('')
const [showOcrModal, setShowOcrModal] = useState(false)

const handleExtractText = async () => {
    if (!selectedItem?.image_url) return;
    setOcrLoading(true);
    setOcrWords([]);
    setOcrText('');
    setShowOcrModal(true);

    try {
      const targetUrl = getCloudinaryUrl(selectedItem.image_url, CLOUDINARY_TRANSFORMS.main);
      
      // 🌟 မြန်မာစာအပြင် အင်္ဂလိပ်စာပါ နှစ်မျိုးလုံး ဖတ်နိုင်ရန် 'mya+eng' ဟု ပြောင်းပါ
      const worker = await createWorker('mya+eng');
      
      const { data } = await worker.recognize(targetUrl);
      
      if (data && data.text) {
        setOcrText(data.text);
      }

      const words = (data as any)?.words as OcrWord[];
      if (words && words.length > 0) {
        setOcrWords(words);
      }

      if ((!data?.text || !data.text.trim()) && (!words || words.length === 0)) {
        alert('ပုံထဲမှ စာသားများကို ဖတ်ယူ၍ မရပါ။');
        setShowOcrModal(false);
      }
      
      await worker.terminate();
    } catch (err) {
      console.error('OCR Extraction Error:', err);
      alert('OCR Scan ဖတ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။');
      setShowOcrModal(false);
    } finally {
      setOcrLoading(false);
    }
  };
// OCR Words နဲ့ Image Size မှတ်ရန် State များ
interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const [ocrWords, setOcrWords] = useState<OcrWord[]>([]);
const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });

  // Keep a small, predictable set of Cloudinary delivery variants.
  // These values are intentionally independent of viewport size, DPR, or zoom state.
  const CLOUDINARY_TRANSFORMS = {
    main: 'w_1200,q_auto,f_auto',
    thumbnail: 'w_120,q_auto,f_auto',
    grid: 'w_150,q_auto,f_auto'
  } as const

  // Add or replace only the delivery transformation segment. Stored image_url
  // values are never changed, and non-Cloudinary URLs pass through unchanged.
  const getCloudinaryUrl = (url: string, transform: string = CLOUDINARY_TRANSFORMS.thumbnail) => {
    if (!url || typeof url !== 'string') return ''

    const sourceUrl = url.trim()
    let parsedUrl: URL

    try {
      parsedUrl = new URL(sourceUrl)
    } catch {
      return sourceUrl
    }

    const isCloudinaryHost = /(^|\.)res\.cloudinary\.com$/i.test(parsedUrl.hostname) || /(^|\.)cloudinary\.com$/i.test(parsedUrl.hostname)
    const uploadMarker = '/upload/'
    const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker)

    if (!isCloudinaryHost || uploadIndex === -1) return sourceUrl

    const pathPrefix = parsedUrl.pathname.slice(0, uploadIndex + uploadMarker.length)
    const pathAfterUpload = parsedUrl.pathname.slice(uploadIndex + uploadMarker.length)
    const pathSegments = pathAfterUpload.split('/')
    const firstSegment = pathSegments[0] || ''

    // Cloudinary transformations are the path segment immediately after
    // /upload/. Remove an existing one before applying our stable variant so
    // repeated renders cannot produce malformed or stacked transformations.
    const transformationSegmentPattern = /^(?:w_|h_|c_|q_|f_|dpr_|g_|ar_|fl_|e_|o_|r_|x_|y_|z_|u_|l_|so_|du_|vc_|af_|ki_|pg_|dn_|bo_|co_|cs_|d_)/
    if (firstSegment.includes(',') || transformationSegmentPattern.test(firstSegment)) {
      pathSegments.shift()
    }

    parsedUrl.pathname = `${pathPrefix}${transform}/${pathSegments.join('/')}`
    return parsedUrl.toString()
  };

  // ၁။ City Interface
interface City {
  "C.ID": string;
  name: string;
  sort_order?: number;
}

// 2. State
const [cities, setCities] = useState<City[]>([]);

// မိမိ ရောက်နေသော / သုံးနေသော Current Branch ID (ဥပမာ 'YGN')


const loadCities = async (targetBranch?: string) => {
  // Parameter မပါလာပါက userBranch သို့မဟုတ် localStorage မှ ယူမည်
  const activeBranch = targetBranch || userBranch || localStorage.getItem('user_branch') || '';

  const { data, error } = await apiClient
    .from("cities")
    .select('*')
    .order('sort_order', { ascending: true });  
  
  if (error) {
    console.error("Error fetching cities:", error);
    return;
  }
  
  if (data) {
    // activeBranch ပေါ်မူတည်ပြီး ထိပ်ဆုံး ရွှေ့ပေးခြင်း
    const topCity = data.filter((city: any) => city["C.ID"] === activeBranch);
    const otherCities = data.filter((city: any) => city["C.ID"] !== activeBranch);

    setCities([...topCity, ...otherCities]);
  }
};



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
    loadCities(storedBranch)

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
    const { data } = await apiClient.from('riders').select('*').eq('branch', branch)
    if (data) setRiders(data)
  }

  useEffect(() => {
    if (!userBranch) return
    async function fetchSenders() {
      const { data, error } = await apiClient.from('senders').select('*').order('name', { ascending: true })
      if (!error && data) setSenders(data)
    }
    fetchSenders()
  }, [userBranch])

 async function fetchPendingItems(branch: string) {
  const { data, error } = await apiClient
    .from('orders')
    .select('*')
    .eq('branch', branch)
    .eq('is_deleted', false)
    .or('receiver_name.is.null,receiver_name.eq.""') 
    .order('created_at', { ascending: true })

  if (!error && data) {
    setPendingItems(data)
    if (data.length > 0 && !selectedItem) {
      // 💡 3rd Parameter အနေနဲ့ branch ကို ထည့်ပေးလိုက်ပါ
      handleSelectItem(data[0], true, branch) 
    }
  }
}

// 💡 (အသစ်ထည့်ရန်) ရွေးထားသော အော်ဒါပုံပြောင်းသွားပါက ထိုပုံငယ်လေးဆီသို့ Auto Scroll ဆွဲပေးခြင်း
  useEffect(() => {
    if (thumbContainerRef.current && selectedItem) {
      // Container အောက်ရှိ data-active="true" သတ်မှတ်ထားသော Element ကို ရှာဖွေခြင်း
      const activeElement = thumbContainerRef.current.querySelector('[data-active="true"]');
      
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',   // ညင်သာချောမွေ့စွာ Scroll ဖြစ်စေရန်
          block: 'nearest',     // ဒေါင်လိုက်အတွက် အနီးစပ်ဆုံးအနေအထားတွင်ထားရန်
          inline: 'center'      // ✨ ရွေးချယ်ထားသည့်ပုံကို Carousel ၏ အလယ်ကောင်တည့်တည့်သို့ ရောက်အောင်ဆွဲပေးခြင်း
        });
      }
    }
  }, [selectedItem]); // selectedItem ပြောင်းလဲတိုင်း အလုပ်လုပ်မည် (Arrow Key ဖြင့် ရွှေ့လျှင်လည်း အကျုံးဝင်ပါသည်)

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
          // Try to find an existing sender first to avoid duplicates
          const nameTrim = String(payload.sender?.name || '').trim()
          let senderToUse: any = null
          if (nameTrim) {
            const { data: found, error: findErr } = await apiClient
              .from('senders')
              .select('*')
              .ilike('name', nameTrim)
              .eq('LOC', payload.sender?.LOC)
              .maybeSingle()
            if (!findErr && found) senderToUse = found
          }

          if (!senderToUse) {
            const { data: newSender, error: sErr } = await apiClient
              .from('senders')
              .insert([{ name: nameTrim, phone: payload.sender?.phone, LOC: payload.sender?.LOC }])
              .select()
              .single()
            if (sErr) throw sErr
            senderToUse = newSender
          }

          // Update order with sender id
          const finalOrder = { ...payload.order, sender_id: senderToUse.id }
          const { error: oErr } = await apiClient.from('orders').update(finalOrder).eq('id', finalOrder.id)
          if (oErr) throw oErr

          // Ensure dropdown state has this sender
          setSenders(prev => prev.some(s => String(s.id) === String(senderToUse.id)) ? prev : [...prev, senderToUse])
        } 
        // 🌟 ၂။ ပုံမှန် ရှိပြီးသား Sender မို့ အော်ဒါတစ်ခုတည်း Update လုပ်မည့်အပိုင်း
        else if (payload && payload.type === 'update_order') {
          const { error } = await apiClient.from('orders').update(payload.order).eq('id', payload.order.id)
          if (error) throw error
        } else if (payload && payload.type === 'order') {
          const { error } = await apiClient.from('orders').insert([payload.order || payload])
          if (error) throw error
        } else {
          const { error } = await apiClient.from('orders').insert([itemToSync.payload])
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

// handleSelectItem function ကို ဒီလို ပြင်ကြည့်ပါ
const handleSelectItem = (item: any, shouldFocusInput = true, branchOverride?: string) => {
  const activeBranch = branchOverride || userBranch || localStorage.getItem('user_branch') || ''

  setSelectedItem(item)
  setOriginalCod(item.cod_amount || 0)
  setZoomScale(1); setRotation(0); setPosition({ x: 0, y: 0 })

  setSelectedSenderId(item.sender_id ? String(item.sender_id) : '')
  setSearchQuery(item.sender_name || '')

  
  
  setFormData(prev => ({
    received_date: item.received_date || today,
    // item မှာ data ရှိရင် အဲ့ဒါကိုပဲယူ၊ မရှိမှသာ persist လုပ်ထားတာကို ယူ
    sender_id: item.sender_id || (item.receiver_name ? null : persistSenderId) || null,
    sender_name: item.sender_name || (item.receiver_name ? '' : persistSenderName) || '',
    sender_phone: item.sender_phone || (item.receiver_name ? '' : persistSenderPhone) || '',
    sender_loc: item.sender_loc || (item.receiver_name ? activeBranch : persistSenderLoc) || activeBranch,
    // ကျန်တဲ့ field တွေကတော့ item က လာတဲ့အတိုင်းပဲ ထားပါ
    receiver_name: item.receiver_name || '',
    receiver_phone: item.receiver_phone || '',
    receiver_address: item.receiver_address || '',
    receiver_loc: item.receiver_loc || activeBranch,
    cod_amount: item.cod_amount || 0,
    deli_fee: item.deli_fee || 0,
    fee_type: item.fee_type || 'Deli',
    total_amount: item.total_amount || 0,
    pickup_rider_id: item.pickup_rider_id || persistPickupRiderId || '',
    status: item.status === 'Pending' ? 'At Office' : (item.status || 'At Office'),
    deliver_rider_id: item.deliver_rider_id || '',
    deliver_date: item.deliver_date || '',
    note: item.note || '',
    cleared_date: item.cleared_date || '',
    branch: item.branch || activeBranch,
    image_url: item.image_url || '',
    remark: item.remark || ''
  })

)
setOcrWords([]);
  if (shouldFocusInput) {
    setTimeout(() => receiverNameRef.current?.focus(), 50)
  }
}


  const handleUndo = async () => {
    if (processedStack.length === 0) return
    const lastId = processedStack[processedStack.length - 1]
    setProcessedStack(prev => prev.slice(0, -1))
    const { data, error } = await apiClient.from('orders').select('*').eq('id', lastId).single()
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
    setPersistSenderPhone(formatted)
  }

  const handleSenderSelection = (senderId: string) => {
    if (!senderId) {
      setSelectedSenderId('')
       setPersistSenderId(null) // ID ပါ ဖျက်မယ်
      setFormData(prev => ({ ...prev, sender_id: null, sender_name: '', sender_phone: '' }))
      return
    }

    const selected = senders.find(sender => String(sender.id) === senderId)
    if (!selected) return

    setSelectedSenderId(senderId)
    setSearchQuery(selected.name || '')
    setActiveSuggestionIndex(-1)
    setShowSenderDropdown(false)
    // ✨ Persist သိမ်းရန်
  setPersistSenderId(senderId)
  setPersistSenderName(selected.name ?? '')
  setPersistSenderPhone(selected.phone ?? '')
  setPersistSenderLoc(selected.LOC ?? '') // LOC ဆိုသည်မှာ sender location
    setFormData(prev => ({
      ...prev,
      sender_id: selected.id,
      sender_name: selected.name ?? '',
      sender_phone: selected.phone ?? '',
      sender_loc: selected.LOC ?? (prev.sender_loc || 'MDY')
    }))
     setTimeout(() => receiverNameRef.current?.focus(), 30) // cursor ကို receiver name သို့ ပြောင်း
}

  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return alert("စာရင်းသွင်းရန် Item ရွေးချယ်ပါ။")
    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
      return alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
    }
    setLoading(true)

    



// Log Note ပြင်ဆင်ခြင်း
const logNote = [
  `Status: ${formData.status || selectedItem?.status || 'N/A'}`,
  `Pickup Rider: ${getRiderName(formData.pickup_rider_id)}`,
  `Deliver Rider: ${getRiderName(formData.deliver_rider_id)}`,
  `Sender: ${formData.sender_name || 'N/A'} (${formData.sender_phone || 'N/A'})`,
  `Receiver: ${formData.receiver_name || 'N/A'} (${formData.receiver_phone || 'N/A'})`,
  `City: ${formData.receiver_loc || 'N/A'}`,
  `COD: ${formData.cod_amount || 0} Ks`,
  `Deli: ${formData.deli_fee || 0} Ks`,
  `Total: ${formData.total_amount || 0} Ks`,
  `Cleared Date: ${formData.cleared_date || 'N/A'}`
].join(' | ');

  // ✨ [အသစ်ထည့်ရန်] ၂။ မူလ selectedItem.history ထဲသို့ Log အသစ် ပေါင်းထည့်ခြင်း
  const updatedHistory = appendLog(selectedItem.history, "Data Entry Processed", logNote);

  let finalSenderId = formData.sender_id
  const isOnlineNow = navigator.onLine

  // Base Order Payload ပြင်ဆင်ခြင်း
  const baseOrderPayload: any = {
    ...formData,
    history: updatedHistory, // 👈 ✨ [အသစ်ထည့်ရန်] history ကို Payload ထဲ ထည့်ပေးလိုက်ပါ
    pickup_rider_id: formData.pickup_rider_id || null,
    deliver_rider_id: formData.deliver_rider_id || null,
    cleared_date: formData.cleared_date || null,
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
          // Try to find existing sender by name and LOC (case-insensitive) to avoid duplicates
          const nameTrim = (formData.sender_name || '').trim()
          let existingSender: any = null
          if (nameTrim) {
            const { data: found, error: findErr } = await apiClient
              .from('senders')
              .select('*')
              .ilike('name', nameTrim)
              .eq('LOC', formData.sender_loc)
              .maybeSingle()
            if (!findErr && found) existingSender = found
          }

          if (existingSender) {
            finalSenderId = existingSender.id
            baseOrderPayload.sender_id = existingSender.id
            // ensure local state contains this sender
            setSenders(prev => prev.some(s => String(s.id) === String(existingSender.id)) ? prev : [...prev, existingSender])
          } else {
            const { data: newSender, error: senderError } = await apiClient
              .from('senders')
              .insert([{ name: nameTrim, phone: formData.sender_phone, LOC: formData.sender_loc }])
              .select()
              .single()

            if (senderError) throw new Error("Sender အသစ်သိမ်းဆည်းမှု မအောင်မြင်ပါ: " + senderError.message)
            
            if (newSender) {
              finalSenderId = newSender.id
              baseOrderPayload.sender_id = newSender.id
              // Local state ထဲပါ တန်းထည့်ပေးထားမယ်
              setSenders(prev => [...prev, newSender])
            }
          }
        }

        // ပြီးမှ Order ကို Update လုပ်မယ်
        const { error: orderError } = await apiClient.from('orders').update(baseOrderPayload).eq('id', selectedItem.id)
        if (orderError) throw orderError

       // ── 💡 ပုံရွှေ့ပေးမည့် Logic အသစ် (နေရာ ၂ ခုလုံးတွင် ဤကုဒ်ဖြင့် အစားထိုးပါ) ──

// ၁။ လက်ရှိ ရွေးချယ်ထားတဲ့ပုံရဲ့ နေရာ (Index) ကို အရင်မှတ်ထားမယ်
const currentIndex = pendingItems.findIndex(item => item.id === selectedItem.id);

// ၂။ လက်ရှိပုံကို ဖယ်ထုတ်လိုက်တဲ့ စာရင်းအသစ်ကို တွက်ချက်မယ်
const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id);

// ၃။ UI States များကို Update လုပ်မယ်
setPendingItems(updatedPending);
setProcessedStack(prev => [...prev, selectedItem.id]);

// ၄။ နောက်ပုံ သို့မဟုတ် ရှေ့ပုံကို သွားမည့် လမ်းကြောင်းကို စစ်ဆေးမယ်
if (updatedPending.length > 0) {
  if (currentIndex < pendingItems.length - 1) {
    // 🌟 အလည်ကပုံဆိုရင် -> ညာဘက်က နောက်တစ်ပုံဆီကို Auto ဆက်သွားမယ်
    handleSelectItem(updatedPending[currentIndex]);
  } else {
    // 🌟 နောက်ဆုံးပုံ ဖြစ်နေရင် -> ဘယ်ဘက်က သူ့ရှေ့ကပုံဆီကို Auto ပြန်သွားမယ်
    handleSelectItem(updatedPending[updatedPending.length - 1]);
  }
} else {
  setSelectedItem(null);
}
// ──────────────────────────────────────────────
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
       // ── 💡 ပုံရွှေ့ပေးမည့် Logic အသစ် (နေရာ ၂ ခုလုံးတွင် ဤကုဒ်ဖြင့် အစားထိုးပါ) ──

// ၁။ လက်ရှိ ရွေးချယ်ထားတဲ့ပုံရဲ့ နေရာ (Index) ကို အရင်မှတ်ထားမယ်
const currentIndex = pendingItems.findIndex(item => item.id === selectedItem.id);

// ၂။ လက်ရှိပုံကို ဖယ်ထုတ်လိုက်တဲ့ စာရင်းအသစ်ကို တွက်ချက်မယ်
const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id);

// ၃။ UI States များကို Update လုပ်မယ်
setPendingItems(updatedPending);
setProcessedStack(prev => [...prev, selectedItem.id]);

// ၄။ နောက်ပုံ သို့မဟုတ် ရှေ့ပုံကို သွားမည့် လမ်းကြောင်းကို စစ်ဆေးမယ်
if (updatedPending.length > 0) {
  if (currentIndex < pendingItems.length - 1) {
    // 🌟 အလည်ကပုံဆိုရင် -> ညာဘက်က နောက်တစ်ပုံဆီကို Auto ဆက်သွားမယ်
    handleSelectItem(updatedPending[currentIndex]);
  } else {
    // 🌟 နောက်ဆုံးပုံ ဖြစ်နေရင် -> ဘယ်ဘက်က သူ့ရှေ့ကပုံဆီကို Auto ပြန်သွားမယ်
    handleSelectItem(updatedPending[updatedPending.length - 1]);
  }
} else {
  setSelectedItem(null);
}
// ──────────────────────────────────────────────
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
                  
                 {/* 💡 ၁။ အပြင်ဘက်တွင် Scroll နှင့် Flex အမြင့်အတွက် သီးသန့် Div တစ်ခုအဖြစ် ထားရှိပါ */}
<div className="flex-1 overflow-y-auto pb-4 pr-1 scrollbar-thin">
  
  {/* 💡 ၂။ အတွင်းဘက်တွင် Grid Layout ချရန်အတွက် သီးသန့် Div တစ်ခု ထပ်မံပတ်ပေးလိုက်ပါ */}
  <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-3">
    
    {pendingItems.map((item, idx) => (
      <div
        key={item.id || idx}
        onClick={() => {
          handleSelectItem(item);
          setIsThumbGridOpen(false);
        }}
        className={`
          aspect-square w-full min-w-0 min-h-0 
          bg-gray-900 rounded-lg overflow-hidden 
          cursor-pointer border-2 transition-all duration-200 
          relative group
          ${selectedItem?.id === item.id 
            ? 'border-orange-500 ring-2 ring-orange-500/30 ring-inset' 
            : 'border-gray-800 hover:border-gray-500'
          }
        `}
      >
  <img 
  src={getCloudinaryUrl(item.image_url, CLOUDINARY_TRANSFORMS.grid)} 
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover select-none pointer-events-none" 
  alt="thumb" 
/>
        {item.uploader_note && (
          <span 
            className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black animate-pulse" 
            title="Has Note" 
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-gray-300 px-1 py-0.5 truncate text-center font-mono group-hover:text-white">
          No. {idx + 1}
        </div>
      </div>
    ))}

  </div> {/* 💡 အတွင်းဘက် Grid ပိတ်တာဖြစ်ပါတယ် */}
</div> {/* 💡 အပြင်ဘက် Scroll Area ပိတ်တာဖြစ်ပါတယ် */}
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
  onClick={handleExtractText}
  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1 border border-orange-500/30"
  title="Scan & Copy Text"
>
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  Scan Text
</button>
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
{/* Container Wrapper */}
<div 
  className="relative inline-block"
  style={{
    transform: `translate(${position.x}px, ${position.y}px) scale(${zoomScale}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 75ms ease-out'
  }}
>
  {/* ပုံအမှန် */}
  <img 
    src={getCloudinaryUrl(selectedItem.image_url, CLOUDINARY_TRANSFORMS.main)} 
    alt="Voucher" 
    draggable={false} 
    onLoad={(e) => {
      // ပုံရဲ့ မူလ Resolution အစစ်ကို ရယူခြင်း
      const target = e.currentTarget;
      setImgNaturalSize({
        width: target.naturalWidth,
        height: target.naturalHeight
      });
    }}
    className="max-w-full max-h-[75vh] object-contain shadow-2xl pointer-events-auto select-none"
  />

  {/* ✨ Google Lens Style Interactive OCR Text Overlay Layer */}
  {/* ✨ Google Lens Style Interactive OCR Text Overlay Layer */}
  {ocrWords.length > 0 && imgNaturalSize.width > 0 && (
    <div 
      className="absolute inset-0 pointer-events-auto select-text z-10 overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()} // 💡 စာသား Highlight ဆွဲစဉ် ပုံပါ လိုက်ရွှေ့မသွားစေရန် တားဆီးခြင်း
    >
      {ocrWords.map((word, idx) => {
        const { x0, y0, x1, y1 } = word.bbox;
        const left = (x0 / imgNaturalSize.width) * 100;
        const top = (y0 / imgNaturalSize.height) * 100;
        const width = ((x1 - x0) / imgNaturalSize.width) * 100;
        const height = ((y1 - y0) / imgNaturalSize.height) * 100;

        return (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              fontSize: `min(${height * 2}px, 1rem)`,
              lineHeight: 1,
            }}
            className="text-transparent hover:bg-orange-400/30 selection:bg-orange-500/50 selection:text-white cursor-text whitespace-nowrap overflow-hidden flex items-center justify-center leading-none"
            title={word.text}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  )}
</div>
                <div className="absolute bottom-2 right-3 text-[10px] bg-black/60 text-gray-400 px-2 py-0.5 rounded font-mono pointer-events-none z-10">
                  Zoom: {Math.round(zoomScale * 100)}%
                </div>
              </div>
              
              {/* Bottom Strip Zone with Expand Grid Trigger */}
              <div 
  ref={thumbContainerRef}
  className="h-20 bg-gray-950 border-t border-gray-800 p-1.5 flex gap-2 overflow-x-auto scrollbar-thin flex-shrink-0 items-center"
>
                
                {/* ✨ Grid Trigger Icon Button */}
                <div className="sticky left-0 z-10 flex items-center gap-2 bg-transparent flex-shrink-0">
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

                <div className="w-px h-full bg-gray-800 shrink-0" /></div>

                {/* Horizontal list of thumbnails */}
                {pendingItems.map((item, idx) => {
    // လက်ရှိ item သည် ရွေးချယ်ထားသည့် item ဟုတ်မဟုတ် စစ်ဆေးခြင်း
    const isActive = selectedItem?.id === item.id;

    return (
      <div 
        key={item.id} 
        onClick={() => handleSelectItem(item)}
        // 💡 ၂။ အဆင့် (၂) ရှိ querySelector မှ အလွယ်တကူ ရှာနိုင်ရန် data-active သတ်မှတ်ပေးပါ
        data-active={isActive ? "true" : "false"}
        className={`relative h-full w-14 rounded border cursor-pointer overflow-hidden group transition-all duration-200 shrink-0 select-none ${
          isActive ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-gray-800 hover:border-gray-500'
        }`}
      >

        <img 
        src={getCloudinaryUrl(item.image_url, CLOUDINARY_TRANSFORMS.thumbnail)} 
        loading="lazy"
        decoding="async"
        alt="thumb" 
        className="w-full h-full object-cover select-none pointer-events-none" 
      />
          
        {item.uploader_note && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black animate-pulse" title="Has Note" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-gray-300 px-1 py-0.5 truncate text-center font-mono group-hover:text-white">
          No. {idx + 1}
        </div>
      </div>
    );
  })}
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
<div className="flex-1 overflow-y-auto p-5 bg-gray-50/60 custom-scrollbar">
  <form onSubmit={handleSubmit} className="w-full space-y-5">
    
    {(selectedItem?.uploader_note || selectedBarcode) && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {selectedItem?.uploader_note && <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm transition-all animate-fadeIn">
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          Note for this Parcel
        </span>
        <p className="text-gray-950 font-medium text-sm leading-relaxed">{selectedItem.uploader_note}</p>
      </div>}
        {selectedBarcode && (
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 p-4 rounded-r-xl shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Barcode Number</span>
            <span className="font-mono font-bold text-gray-900 tracking-widest select-all break-all">{selectedBarcode}</span>
          </div>
        )}
      </div>
    )}

    {/* Section 1: Core Logistics Info */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
      <div>
        <label className={labelStyle}>Item ID</label>
        <input type="text" readOnly value={selectedItem?.item_id || selectedItem?.id || '[ Select Item ]'} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 text-gray-500 font-mono font-bold rounded-lg text-sm cursor-not-allowed select-all" />
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

    {/* Section 2: Sender & Receiver Cards */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* Sender Block */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2.5">
          <span className="text-blue-600 bg-blue-50 p-1.5 rounded-lg ring-4 ring-blue-500/5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </span>
          <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Sender Information</h3>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className={labelStyle}>Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                ref={senderInputRef}
                type="text"
                value={searchQuery || formData.sender_name}
                onChange={e => {
                  const v = e.target.value
                   setPersistSenderName(v) 
                  setPersistSenderId(null) 
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSenderDropdown && filteredSenders.length > 0 && (
                <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl divide-y divide-gray-50 animate-fadeIn">
                  {filteredSenders.map((s, index) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => handleSenderSelection(String(s.id))}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${index === activeSuggestionIndex ? 'bg-orange-50 text-orange-950 font-medium' : 'hover:bg-gray-50'}`}
                    >
                      <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{s.phone} — {s.LOC}</div>
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

      {/* Receiver Block */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2.5">
          <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg ring-4 ring-emerald-500/5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </span>
          <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Receiver Information</h3>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className={labelStyle}>Name <span className="text-red-500">*</span></label>
            <input ref={receiverNameRef} type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
          </div>
          <div>
            <label className={labelStyle}>Phone <span className="text-red-500">*</span></label>
            <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} className={`${winInput} font-mono`} required disabled={!selectedItem} />
          </div>
          <div>
  <label className={labelStyle}>Address</label>
  <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={winInput} disabled={!selectedItem} placeholder="လမ်း၊ အိမ်နံပါတ်၊ ရပ်ကွက် ဖြည့်သွင်းရန်" />
</div>
<div>
  <div className="flex justify-between items-center mb-1.5">
    <label className="block text-gray-600 font-semibold uppercase text-xs tracking-wide">City</label>
    <button
      type="button"
      onClick={() => setIsModalOpen(true)}
      className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100/80 px-2 py-1 rounded-lg border border-blue-200 transition-all active:scale-95"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      Add New City
    </button>
  </div>
  <select 
    value={formData.receiver_loc} 
    onChange={e => setFormData({...formData, receiver_loc: e.target.value})} 
    className={winSelect}  
    disabled={!selectedItem} 
    onFocus={handleSelectFocus}
  >
    <option value="">-- Select City --</option>
    {cities.map((city) => (
      <option key={city["C.ID"]} value={city["C.ID"]}>{city.name}</option>
    ))}
  </select>
</div>
        </div>
      </div>
    </div>

    {/* Section 3: Financials & Status / Remarks */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* Financials Block */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-xl shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2.5">
            <span className="text-orange-600 bg-orange-50 p-1.5 rounded-lg ring-4 ring-orange-500/5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Financial Pricing</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelStyle}>COD Amount</label>
              <input type="number" value={formData.cod_amount || ''} onChange={e => {
                const val = Number(e.target.value);
                if (formData.fee_type === 'Bill') setOriginalCod(val + Number(formData.deli_fee));
                else setOriginalCod(val);
              }} className={`${winInput} font-mono font-bold text-gray-900`} disabled={!selectedItem} placeholder="0" />
            </div>
            <div>
              <label className={labelStyle}>Deli Fee</label>
              <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${winInput} font-mono font-bold text-orange-600`} disabled={!selectedItem} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelStyle}>Fee Type</label>
              <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
                <option value="Deli">Deli (+)</option>
                <option value="Kpay">Kpay</option>
                <option value="Cash">Cash</option>
                <option value="Bill">Bill (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-orange-600 font-bold mb-1 uppercase text-xs tracking-wide">Total Collected</label>
              <div className="w-full bg-gray-950 py-2 px-3 rounded-lg flex items-center justify-between border border-gray-800 shadow-inner h-[38px]">
                <span className="font-mono font-black text-base text-orange-400">{formData.total_amount.toLocaleString()}</span>
                <span className="text-[10px] text-gray-500 font-bold font-mono">MMK</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-100 hidden xl:block">
          <p className="text-xs text-gray-400 italic">Please re-check calculations before submitting the data entry.</p>
        </div>
      </div>

      {/* Status & Assignment Block */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1 border-b border-gray-100 pb-2.5">
          <span className="text-purple-600 bg-purple-50 p-1.5 rounded-lg ring-4 ring-purple-500/5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </span>
          <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Status & Execution</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Current Status</label>
            <select value={formData.status} onChange={e => handleStatusChange(e.target.value)} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
              <option value="At Office">📦 At Office</option>
              <option value="On Way">🚵 On Way</option>
              <option value="Delivered">✅ Delivered</option>
              <option value="In-Transit">🚚 In-Transit</option>
              <option value="Via-Agent">🚐 Via-Agent</option>
            </select>
          </div>
          <div>
            <label className={labelStyle}>Deliver Date</label>
            <input
              type="date"
              value={formData.deliver_date}
              onChange={e => setFormData({...formData, deliver_date: e.target.value})}
              className={`${winInput} font-mono ${!['On Way', 'Delivered', 'Returned'].includes(formData.status) ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : ''}`}
              disabled={!selectedItem || !['On Way', 'Delivered', 'Returned'].includes(formData.status)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Return Utility</label>
            <select value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
              <option value="">Normal Delivery</option>
              <option value="RT">Return Item (RT)</option>
            </select>
          </div>
          <div>
            <label className={labelStyle}>Cash Event</label>
            <select value={formData.cleared_date ? 'yes' : 'no'} onChange={e => setFormData({...formData, cleared_date: e.target.value === 'yes' ? today : ''})} className={winSelect} disabled={!selectedItem} onFocus={handleSelectFocus}>
              <option value="no">Not Cleared</option>
              <option value="yes">Cleared</option>
            </select>
          </div>
        </div>

        {formData.cleared_date && (
          <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl transition-all animate-fadeIn">
            <label className="block text-emerald-800 font-bold mb-1 uppercase text-xs tracking-wide">Cleared Date</label>
            <input
              type="date"
              value={formData.cleared_date}
              onChange={e => setFormData({...formData, cleared_date: e.target.value})}
              className={`${winInput} border-emerald-200 focus:border-emerald-500 focus:ring-emerald-100 font-mono`}
              required
              disabled={!selectedItem}
            />
          </div>
        )}

        {/* ✨ Added Field: Entry Remark */}
        <div className="pt-1">
          <label className={labelStyle}>Entry Remark</label>
          <textarea
            value={formData.remark || ''}
            onChange={e => setFormData({...formData, remark: e.target.value})}
            className={`${winInput} h-[76px] resize-none transition-all leading-relaxed placeholder-gray-400`}
            placeholder="ရုံးတွင်းမှတ်သားရန် အချက်အလက်များ သို့မဟုတ် မှတ်ချက်များရေးရန်..."
            disabled={!selectedItem}
          />
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={!selectedItem || loading}
            className={`w-full py-3 text-sm font-bold rounded-xl uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
              !selectedItem || loading 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white active:scale-[0.995] hover:shadow-orange-500/10'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                Saving System...
              </>
            ) : 'Update & Next (Enter)'}
          </button>
        </div>
      </div>
    </div>
  </form>
</div>
      </div> 
      <AddCityForm 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
      onCityAdded={loadCities} 
    />     

{/* OCR Text Result Popup Modal */}
{showOcrModal && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">
      
      {/* Modal Header */}
      <div className="px-5 py-3.5 bg-gray-900 text-white flex items-center justify-between">
        <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
          <span>🔍 Recognized Text Result</span>
        </h3>
        <button 
          onClick={() => setShowOcrModal(false)}
          className="text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-5 overflow-y-auto flex-1">
        {ocrLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-medium animate-pulse">Voucher မှ စာလုံးများကို ဖတ်ယူနေပါသည်...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              readOnly
              value={ocrText}
              className="w-full h-48 p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs text-gray-800 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button
          onClick={() => setShowOcrModal(false)}
          className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition"
        >
          Close
        </button>
        <button
          disabled={ocrLoading || !ocrText}
          onClick={() => {
            navigator.clipboard.writeText(ocrText)
            alert('စာသားများကို Copy ကူးယူပြီးပါပြီ!')
          }}
          className="px-4 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-lg transition shadow disabled:opacity-50"
        >
          Copy All Text
        </button>
      </div>

    </div>
  </div>
)}

    </div>
  )
} 