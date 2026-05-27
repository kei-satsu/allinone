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

  const today = new Date().toISOString().split('T')[0]

  // Form State (ပေးထားသော Entry ပုံစံအတိုင်း)
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
    status: 'At Office', // Pending ကနေ ဖြည့်ပြီးရင် At Office ပြောင်းမည်
    deliver_rider_id: '',
    deliver_date: '',
    note: '',
    cash_added_date: '',
    branch: '',
    image_url: ''
  })

  // 1. Initial Load (Branch, Riders & Pending Data)
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
      return
    }
    setUserBranch(storedBranch)
    fetchRiders(storedBranch)
    fetchPendingItems(storedBranch)
  }, [router])

  async function fetchRiders(branch: string) {
    const { data } = await supabase.from('riders').select('*').eq('branch', branch)
    if (data) setRiders(data)
  }

  // Pending (ဒေတာမဖြည့်ရသေးသော) စာရင်းများကို ဆွဲထုတ်ခြင်း
  async function fetchPendingItems(branch: string) {
    const { data, error } = await supabase
      .from('orders') // သင့် Table နာမည်အတိုင်း ပြင်ပါ
      .select('*')
      .eq('branch', branch)
      .eq('status', 'Pending')
      .order('created_at', { ascending: false }) // နောက်ဆုံးရိုက်ထားတဲ့ပုံ အရင်ပေါ်အောင်

    if (!error && data) {
      setPendingItems(data)
      // Pending item ရှိရင် ပထမဆုံးတစ်ခုကို အလိုအလျောက် ရွေးပေးထားမည်
      if (data.length > 0 && !selectedItem) {
        handleSelectItem(data[0])
      }
    }
  }

  // Pending List ထဲက ပုံတစ်ပုံကို ရွေးလိုက်သောအခါ Form ထဲ Data ထည့်ခြင်း
  const handleSelectItem = (item: any) => {
    setSelectedItem(item)
    setOriginalCod(item.cod_amount || 0)
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
      status: 'At Office', // Form ဖွင့်တာနဲ့ At Office အဖြစ် အသင့်ပြင်ထားမည်
      deliver_rider_id: item.deliver_rider_id || '',
      deliver_date: item.deliver_date || '',
      note: item.note || '',
      cash_added_date: item.cash_added_date || '',
      branch: item.branch || userBranch,
      image_url: item.image_url || ''
    })
    // နာမည်ဖြည့်မည့်နေရာကို Auto Focus လုပ်ပေးမည်
    setTimeout(() => senderInputRef.current?.focus(), 50)
  }

  // 2. စုစုပေါင်းငွေ အလိုလိုတွက်ချက်ခြင်း (Entry အတိုင်း)
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

  // Phone Formatter
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
  }

  // 3. Update Mechanism
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

    // Insert အစား ရွေးထားသော ID ကို Update လုပ်ခြင်း
    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', selectedItem.id) // သင့် DB ရဲ့ Primary Key ကို id အဖြစ် ယူဆထားသည်

    if (!error) {
      // အောင်မြင်သွားလျှင် Pending List ထဲမှ ဖြုတ်ထုတ်လိုက်မည်
      const updatedPending = pendingItems.filter(item => item.id !== selectedItem.id)
      setPendingItems(updatedPending)
      
      if (updatedPending.length > 0) {
        handleSelectItem(updatedPending[0]) // နောက်တစ်ပုံကို အလိုလို ရွေးပေးမည်
      } else {
        setSelectedItem(null)
      }
    } else {
      alert("Error: ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ။")
      console.error(error)
    }
    setLoading(false)
  }

  const winInput = "w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 text-base placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 text-base focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1.5 uppercase text-xs tracking-wide"

  return (
    <div className="w-full min-h-screen bg-[#f3f3f3] text-base text-gray-800 antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] flex flex-col h-screen">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">Pending Data Entry</h1>
          <p className="hidden sm:block text-xs text-gray-500">ပုံကြည့်၍ ဒေတာဖြည့်သွင်းရန်</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-4 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-sm font-bold text-orange-700 font-mono">
            {pendingItems.length} PENDING ITEMS
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
        {/* ဘယ်ဘက်ခြမ်း - Image Viewer & Pending Queue */}
        <div className="w-full lg:w-1/3 border-r border-gray-300 bg-gray-900 flex flex-col relative overflow-hidden">
          {selectedItem ? (
            <>
              {/* ပုံချဲ့ကြည့်နိုင်သော နေရာ */}
              <div className="flex-1 flex items-center justify-center p-2 bg-black overflow-auto">
                <img 
                  src={selectedItem.image_url} 
                  alt="Voucher" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              
              {/* အောက်ခြေရှိ Pending Queue List */}
              <div className="h-32 bg-gray-950 border-t border-gray-800 p-2 flex gap-2 overflow-x-auto">
                {pendingItems.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    onClick={() => handleSelectItem(item)}
                    className={`min-w-[80px] h-full rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedItem.id === item.id ? 'border-orange-500 scale-95 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={item.image_url} className="w-full h-full object-cover" alt="thumb" />
                  </div>
                ))}
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <h3 className="text-xl font-bold text-white mb-2">အကုန် ပြီးသွားပါပြီ 🎉</h3>
                <p>Data ဖြည့်ရန် Pending စာရင်း မရှိတော့ပါ။</p>
             </div>
          )}
        </div>

        {/* ညာဘက်ခြမ်း - Entry Form (Scrollable) */}
        <div className="w-full lg:w-2/3 flex-1 overflow-y-auto p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto space-y-6">
            
            {/* Meta Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="sm:col-span-2">
                <label className={labelStyle}>Record ID</label>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedItem?.id || '[ Select an item ]'} 
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 text-gray-500 font-mono font-bold rounded-lg text-base cursor-not-allowed" 
                />
              </div>
              <div>
                <label className={labelStyle}>Arrival Date</label>
                <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={`${winInput} font-mono`} required />
              </div>
            </div>

            {/* Sender & Receiver Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Sender Card */}
              <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-600 bg-blue-50 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-sm">Sender Details</h3>
                </div>
                <div className="space-y-4">
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
              <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </span>
                  <h3 className="font-semibold text-gray-800 uppercase tracking-wide text-sm">Receiver Details</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelStyle}>Receiver Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required disabled={!selectedItem} />
                  </div>
                  <div>
                    <label className={labelStyle}>Phone Number <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} placeholder="09-xxx-xxx-xxx" className={`${winInput} font-mono`} required disabled={!selectedItem} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
               <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 uppercase tracking-wide text-sm">💰 Financial Accounts</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-orange-600 font-semibold mb-1.5 uppercase text-xs">Total Final</label>
                    <div className="w-full bg-gray-900 py-3 px-4 rounded-lg flex items-center justify-between">
                      <span className="font-mono font-bold text-lg text-orange-400">{formData.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    className={`w-full py-4 text-base font-bold rounded-lg uppercase tracking-wide transition-all shadow-md mt-2 ${!selectedItem || loading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-[0.99]'}`}
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