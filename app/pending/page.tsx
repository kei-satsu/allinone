"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PendingEntry() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [riders, setRiders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState<string>('')
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [loading, setLoading] = useState(false)

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

  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    received_date: today,
    sender_name: '',
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

    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [router])

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

  async function fetchPendingItems(branch: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('branch', branch)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPendingItems(data)
      if (data.length > 0 && !selectedItem) {
        handleSelectItem(data[0])
      }
    }
  }

  // ── Select item & load form ──
  const handleSelectItem = (item: any) => {
    setSelectedItem(item)
    setOriginalCod(item.cod_amount || 0)
    setZoomScale(1); setRotation(0); setPosition({ x: 0, y: 0 })

    setFormData(prev => ({
      received_date: item.received_date || today,
      sender_name: persistSenderName || item.sender_name || '',
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
      branch: item.branch || userBranch,
      image_url: item.image_url || ''
    }))
    setTimeout(() => senderInputRef.current?.focus(), 50)
  }

  // ── Load previous item from stack ──
  const handleUndo = async () => {
    if (processedStack.length === 0) return
    const lastId = processedStack[processedStack.length - 1]
    // Remove it from stack
    setProcessedStack(prev => prev.slice(0, -1))
    // Fetch that item
    const { data, error } = await supabase.from('orders').select('*').eq('id', lastId).single()
    if (!error && data) {
      // Re-insert it into pending list if it's still pending? Actually it might have been updated, but we'll load it anyway.
      // We can add it back to pendingItems for consistency
      setPendingItems(prev => [data, ...prev])
      handleSelectItem(data)
    }
  }

  // Persist field handlers
  const handlePersistChange = (field: string, value: string) => {
    if (field === 'sender_name') setPersistSenderName(value)
    else if (field === 'sender_loc') setPersistSenderLoc(value)
    else if (field === 'pickup_rider_id') setPersistPickupRiderId(value)
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // COD calculation
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

  // ── Smooth Enter key handling for selects ──
  const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const form = e.currentTarget.form
      if (!form) return
      const elements = Array.from(form.elements) as HTMLElement[]
      const index = elements.indexOf(e.currentTarget)
      // Find next input/select/textarea that is not disabled
      for (let i = index + 1; i < elements.length; i++) {
        const el = elements[i] as HTMLElement
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) {
          if (!el.hasAttribute('disabled')) {
            el.focus()
            break
          }
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return alert("စာရင်းသွင်းရန် Item ရွေးချယ်ပါ။")
    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
      return alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
    }
    setLoading(true)
    const payload = {
      ...formData,
      pickup_rider_id: formData.pickup_rider_id || null,
      deliver_rider_id: formData.deliver_rider_id || null,
      deliver_date: formData.deliver_date || null,
      cash_added_date: formData.cash_added_date || null,
    }
    const { error } = await supabase.from('orders').update(payload).eq('id', selectedItem.id)
    if (!error) {
      // Push to processed stack
      setProcessedStack(prev => [...prev, selectedItem.id])
      const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id)
      setPendingItems(updatedPending)
      if (updatedPending.length > 0) {
        handleSelectItem(updatedPending[0])
      } else {
        setSelectedItem(null)
      }
    } else {
      alert("Error: ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ။")
    }
    setLoading(false)
  }

  // Image helpers (same)
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
          className="w-full lg:flex-shrink-0 border-r border-gray-300 bg-gray-900 flex flex-col relative overflow-hidden"
        >
          {selectedItem ? (
            <>
              <div 
                className="flex-1 flex items-center justify-center p-3 bg-black overflow-hidden relative group select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                {/* Image control bar (same) */}
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 border border-gray-700 shadow-xl z-20 transition-opacity opacity-90 hover:opacity-100" onMouseDown={e => e.stopPropagation()}>
                  <button type="button" onClick={handleZoomIn} className="p-1 bg-gray-800 hover:bg-orange-500 text-white rounded transition text-xs" title="Zoom In">➕</button>
                  <button type="button" onClick={handleZoomOut} className="p-1 bg-gray-800 hover:bg-orange-500 text-white rounded transition text-xs" title="Zoom Out">➖</button>
                  <button type="button" onClick={handleRotateCounterClockwise} className="p-1 bg-gray-800 hover:bg-orange-500 text-white rounded transition text-xs" title="Rotate Left">↩️</button>
                  <button type="button" onClick={handleRotateClockwise} className="p-1 bg-gray-800 hover:bg-orange-500 text-white rounded transition text-xs" title="Rotate Right">↪️</button>
                  <div className="w-px h-4 bg-gray-700 mx-0.5" />
                  <button type="button" onClick={handleResetImage} className="text-[10px] bg-gray-700 hover:bg-red-500 px-1.5 py-1 rounded text-gray-200 font-medium transition">RESET</button>
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
              <div className="h-20 bg-gray-950 border-t border-gray-800 p-1.5 flex gap-2 overflow-x-auto scrollbar-thin flex-shrink-0">
                {pendingItems.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    onClick={() => handleSelectItem(item)}
                    className={`w-14 h-full min-w-[56px] rounded-md overflow-hidden cursor-pointer border-2 transition-all ${selectedItem.id === item.id ? 'border-orange-500 scale-95 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={item.image_url} className="w-full h-full object-cover" alt="thumb" draggable={false} />
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
                  onKeyDown={handleSelectKeyDown}
                  disabled={!selectedItem}
                >
                  <option value="">Select rider</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {/* Sender & Receiver cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Sender (with persistence) */}
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
                    <input 
                      ref={senderInputRef} 
                      type="text" 
                      value={formData.sender_name} 
                      onChange={e => handlePersistChange('sender_name', e.target.value)} 
                      className={winInput} 
                      required 
                      disabled={!selectedItem} 
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Location</label>
                    <select 
                      value={formData.sender_loc} 
                      onChange={e => handlePersistChange('sender_loc', e.target.value)} 
                      className={winSelect} 
                      onKeyDown={handleSelectKeyDown}
                      disabled={!selectedItem}
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
                    <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Phone <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} className={`${winInput} font-mono`} required disabled={!selectedItem} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelStyle}>City</label>
                      <select value={formData.receiver_loc} onChange={e => setFormData({...formData, receiver_loc: e.target.value})} className={winSelect} onKeyDown={handleSelectKeyDown} disabled={!selectedItem}>
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
                    <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={winSelect} onKeyDown={handleSelectKeyDown} disabled={!selectedItem}>
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
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={winSelect} onKeyDown={handleSelectKeyDown} disabled={!selectedItem}>
                      <option value="At Office">📦 At Office</option>
                      <option value="Pending">📦 Pending</option>
                      <option value="In-Transit">🚚 In-Transit</option>
                    </select>
                  </div>
                  {/* Extra empty space or notes? Already have button. */}
                </div>
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