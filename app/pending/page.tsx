"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PendingEntry() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  
  // Pending Items များကို သိမ်းရန်
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [riders, setRiders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState<string>('')
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  // 🔥 Image Zoom & Rotate States
  const [zoomScale, setZoomScale] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)

  // 🔥 Mouse Drag (Pan) States
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // 🔥 Resizable Split Panel States (ဘယ်/ညာ ဆွဲချဲ့ ဆွဲသေးလုပ်ရန်)
  const [leftWidth, setLeftWidth] = useState<number>(500) // Default Area ကို ပိုကြီးကြီး ထားပေးထားသည်
  const [isResizing, setIsResizing] = useState<boolean>(false) // ✅ bable မှ boolean သို့ ပြင်ဆင်ပြီး
  const [isMobile, setIsMobile] = useState<boolean>(false)

  const today = new Date().toISOString().split('T')[0]

  // Form State
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

  // 1. Initial Load
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
      return
    }
    setUserBranch(storedBranch)
    fetchRiders(storedBranch)
    fetchPendingItems(storedBranch)

    // Mobile screen ဟုတ်မဟုတ် စစ်ဆေးရန် (Hydration error ကာကွယ်ရန်)
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [router])

  // 🔥 Divider ကို Drag ဆွဲပြီး Panel အကျယ်အဝန်း ညှိပေးသည့် Event Handler
  useEffect(() => {
    const handleMouseMoveResize = (e: MouseEvent) => {
      if (!isResizing) return
      // အနည်းဆုံး 300px မှ အများဆုံး 900px အထိသာ ဆွဲချဲ့ခွင့်ပြုမည်
      const newWidth = Math.max(300, Math.min(e.clientX, 900))
      setLeftWidth(newWidth)
    }

    const handleMouseUpResize = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMoveResize)
      window.addEventListener('mouseup', handleMouseUpResize)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveResize)
      window.removeEventListener('mouseup', handleMouseUpResize)
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

  const handleSelectItem = (item: any) => {
    setSelectedItem(item)
    setOriginalCod(item.cod_amount || 0)
    
    setZoomScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })

    setFormData({
      received_date: item.received_date || today,
      sender_name: item.sender_name || '',
      sender_loc: item.sender_loc || userBranch,
      receiver_name: item.receiver_name || '',
      receiver_phone: item.receiver_phone || '',
      receiver_address: item.receiver_address || '',
      receiver_loc: item.receiver_loc || 'MDY',
      cod_amount: item.cod_amount || 0,
      deli_fee: item.deli_fee || 0,
      fee_type: item.fee_type || 'Deli',
      total_amount: item.total_amount || 0,
      pickup_rider_id: item.pickup_rider_id || '',
      status: 'At Office',
      deliver_rider_id: item.deliver_rider_id || '',
      deliver_date: item.deliver_date || '',
      note: item.note || '',
      cash_added_date: item.cash_added_date || '',
      branch: item.branch || userBranch,
      image_url: item.image_url || ''
    })
    setTimeout(() => senderInputRef.current?.focus(), 50)
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

    setFormData(prev => ({ 
      ...prev, 
      cod_amount: currentCOD,
      total_amount: total 
    }))
  }, [originalCod, formData.deli_fee, formData.fee_type])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
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

    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', selectedItem.id)

    if (!error) {
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

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.25, 0.5))
  const handleRotateClockwise = () => setRotation(prev => prev + 90)
  const handleRotateCounterClockwise = () => setRotation(prev => prev - 90)
  const handleResetImage = () => { setZoomScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); }

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.15;
    if (e.deltaY < 0) {
      setZoomScale(prev => Math.min(prev + zoomFactor, 4))
    } else {
      setZoomScale(prev => Math.max(prev - zoomFactor, 0.4))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUpOrLeave = () => {
    setIsDragging(false)
  }

  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-xs tracking-wide"

  return (
    <div className="w-full min-h-screen bg-[#f3f3f3] text-sm text-gray-800 antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] flex flex-col h-screen select-none">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-gray-900 uppercase tracking-wide">Pending Data Entry</h1>
          <p className="hidden sm:block text-[11px] text-gray-500">ပုံကြည့်၍ ဒေတာဖြည့်သွင်းရန်</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg flex items-center gap-2">
          <span className="text-xs font-bold text-orange-700 font-mono">
            {pendingItems.length} PENDING ITEMS
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
        
        {/* ဘယ်ဘက်ခြမ်း - Image Viewer & Pending Queue */}
        <div 
          style={{ width: isMobile ? '100%' : `${leftWidth}px` }}
          className="w-full lg:flex-shrink-0 border-r border-gray-300 bg-gray-900 flex flex-col relative overflow-hidden"
        >
          {selectedItem ? (
            <>
              {/* ပုံချဲ့ကြည့်နိုင်သည့်နေရာ */}
              <div 
                className="flex-1 flex items-center justify-center p-3 bg-black overflow-hidden relative group select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                
                {/* floating image controller bar */}
                <div 
                  className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 border border-gray-700 shadow-xl z-20 transition-opacity opacity-90 hover:opacity-100"
                  onMouseDown={(e) => e.stopPropagation()}
                >
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
                  Zoom: {Math.round(zoomScale * 100)}% | 💡 Scroll ချုံ့ချဲ့ / Drag ဆွဲရွှေ့နိုင်သည်
                </div>
              </div>
              
              {/* အမြင့် လျှော့ချထားသော ပုံငယ်ပြသသည့်နေရာ */}
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

        {/* 🔥 ဆွဲချဲ့/ဆွဲသေး လုပ်နိုင်မည့် Divider Bar Control Line */}
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          className={`hidden lg:block w-2 h-full cursor-col-resize transition-colors flex-shrink-0 z-30 ${isResizing ? 'bg-orange-500' : 'bg-gray-800 hover:bg-orange-500'} border-l border-r border-gray-950/40`}
        />

        {/* ညာဘက်ခြမ်း - Entry Form */}
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto space-y-4">
            
            {/* Meta Row (Record ID မှ Item ID သို့ ပြောင်းလဲထားသောနေရာ) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="sm:col-span-2">
                <label className={labelStyle}>Item ID</label> {/* ✅ Label ပြောင်းထားသည် */}
                <input 
                  type="text" 
                  readOnly 
                  value={selectedItem?.item_id || selectedItem?.id || '[ Select an item ]'} /* ✅ Item ID တန်ဖိုးကို ပြသပေးသည် */
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 text-gray-500 font-mono font-bold rounded-lg text-sm cursor-not-allowed" 
                />
              </div>
              <div>
                <label className={labelStyle}>Arrival Date</label>
                <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={`${winInput} font-mono`} required />
              </div>
            </div>

            {/* Sender & Receiver Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Sender Card */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-600 bg-blue-50 p-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-xs">Sender Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelStyle}>Sender Name <span className="text-red-500">*</span></label>
                    <input ref={senderInputRef} type="text" value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Sender Location</label>
                    <select value={formData.sender_loc} onChange={e => setFormData({...formData, sender_loc: e.target.value})} className={winSelect} disabled={!selectedItem}>
                      <option value="MDY">MANDALAY</option>
                      <option value="YGN">YANGON</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Receiver Card */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-xs">Receiver Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelStyle}>Receiver Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Phone Number <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} placeholder="09-xxx-xxx-xxx" className={`${winInput} font-mono`} required disabled={!selectedItem} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelStyle}>City</label>
                      <select value={formData.receiver_loc} onChange={e => setFormData({...formData, receiver_loc: e.target.value})} className={winSelect} disabled={!selectedItem}>
                        <option value="MDY">Mandalay</option>
                        <option value="YGN">Yangon</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Address</label>
                      <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={winInput} disabled={!selectedItem} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financials & Status Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-3 uppercase tracking-wide text-xs">💰 Financial Accounts</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelStyle}>COD Amount</label>
                    <input type="number" value={formData.cod_amount || ''} onChange={e => {
                      const val = Number(e.target.value);
                      if (formData.fee_type === 'Bill') { setOriginalCod(val + Number(formData.deli_fee)); } else { setOriginalCod(val); }
                    }} className={`${winInput} font-mono`} disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Deli Fee</label>
                    <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${winInput} font-mono text-orange-600`} disabled={!selectedItem} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Pay Type</label>
                    <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={winSelect} disabled={!selectedItem}>
                      <option value="Deli">Deli (+)</option>
                      <option value="Kpay">Kpay</option>
                      <option value="Cash">Cash</option>
                      <option value="Bill">Bill (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-orange-600 font-semibold mb-1 uppercase text-xs">Total Final</label>
                    <div className="w-full bg-gray-900 py-2 px-3 rounded-lg flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-orange-400">{formData.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>Dispatch Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={winSelect} disabled={!selectedItem}>
                      <option value="At Office">📦 At Office</option>
                      <option value="Pending">📦 Pending</option>
                      <option value="In-Transit">🚚 In-Transit</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Pick Up Rider</label>
                    <select value={formData.pickup_rider_id} onChange={e => setFormData({...formData, pickup_rider_id: e.target.value})} className={winSelect} disabled={!selectedItem}>
                      <option value="">Select...</option>
                      {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                   <button 
                    type="submit" 
                    disabled={!selectedItem || loading}
                    className={`w-full py-3 text-sm font-bold rounded-lg uppercase tracking-wide transition-all shadow-md mt-1 ${!selectedItem || loading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-[0.99]'}`}
                  >
                    {loading ? 'Saving Data...' : 'Update & Next Item'}
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}