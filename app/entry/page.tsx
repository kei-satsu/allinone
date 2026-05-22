"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EntryForm() {
  const router = useRouter()
  const senderInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [riders, setRiders] = useState<any[]>([])
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [userBranch, setUserBranch] = useState<string>('') 
  
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
    branch: '' 
  })

  // 1. Initial Load, Auth Check & Auto Focus
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      setFormData(prev => ({ ...prev, branch: storedBranch, sender_loc: storedBranch }))
    }

    async function fetchRiders() {
      const { data } = await supabase.from('riders').select('*')
      if (data) setRiders(data)
    }
    fetchRiders()
    
    senderInputRef.current?.focus()
  }, [router])

  // 2. စုစုပေါင်းငွေ အလိုလိုတွက်ချက်ခြင်း
  useEffect(() => {
    let currentCOD = originalCod;
    const deli = Number(formData.deli_fee) || 0;

    if (formData.fee_type === 'Bill') {
        currentCOD = originalCod - deli;
    }

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

  // 3. Phone Formatter
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
  }

  // 4. Submit လုပ်ခြင်း
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
        alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
        return;
    }

    setLoading(true)
    
    const payload = {
        ...formData,
        pickup_rider_id: formData.pickup_rider_id || null,
        deliver_rider_id: formData.deliver_rider_id || null,
        deliver_date: formData.deliver_date || null,
        cash_added_date: formData.cash_added_date || null, 
    }

    const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select()
    
    if (error) {
        alert("Error: " + error.message)
    } else if (data && data.length > 0) {
        const generatedId = data[0].item_id;
        alert(`Voucher သိမ်းဆည်းပြီးပါပြီ!\nID: ${generatedId}`);
        
        setOriginalCod(0)
        setFormData(prev => ({
            ...prev,
            sender_name: '', receiver_name: '', receiver_phone: '', receiver_address: '',
            cod_amount: 0, deli_fee: 0, fee_type: 'Deli', total_amount: 0, note: '', cash_added_date: '',
            pickup_rider_id: '', deliver_rider_id: '', status: 'At Office', deliver_date: ''
        }))
        
        setTimeout(() => senderInputRef.current?.focus(), 50)
    }
    setLoading(false)
  }

  // Ultra-Compact Modern Light Input Styles
  const modernInput = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all placeholder:text-slate-400 hover:border-slate-300"
  const modernSelect = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all hover:border-slate-300 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.55rem_auto] bg-[right_0.75rem_center] bg-no-repeat"
  const labelStyle = "block text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-wider"

  return (
    <div className="w-full h-screen bg-slate-50 text-xs text-slate-700 antialiased flex flex-col overflow-hidden">
      
      {/* 1. Ultra-Compact Header Panel */}
      <div className="w-full px-4 py-2.5 md:px-6 bg-white border-b border-slate-200/80 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-slate-900 uppercase">
              New Items Entry Form
            </h1>
            <p className="hidden sm:block text-[10px] text-slate-400 font-medium">All In One Delivery System</p>
          </div>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-2 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hidden xs:inline">Node: </span>
          <span className="text-[10px] font-extrabold text-slate-700 tracking-wider">
            {userBranch === 'MDY' ? 'MANDALAY' : 'YANGON'}
          </span>
        </div>
      </div>

      {/* 2. Main Layout Container (w-full ဖြင့် အပြည့်ကားထားသည်) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <form onSubmit={handleSubmit} className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* LEFT COLUMN: Core Logistics & Client Data (8/12 width သို့ တိုးမြှင့်ထားသည်) */}
            <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
              
              {/* Top Meta Controls Box */}
              <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1">
                  <div>
                      <label className={labelStyle}>Item ID</label>
                      <input 
                          type="text" 
                          readOnly 
                          placeholder="[ Auto ]" 
                          className="w-full px-3 py-2 bg-slate-50 border border-dashed border-slate-200 text-slate-400 font-mono font-bold rounded-lg text-center text-xs cursor-not-allowed select-none" 
                          tabIndex={-1}
                      />
                  </div>
                  <div>
                      <label className={labelStyle}>Arrival Date</label>
                      <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={`${modernInput} font-mono`} required />
                  </div>
                  <div>
                      <label className={labelStyle}>Pick Up Rider</label>
                      <select value={formData.pickup_rider_id} onChange={e => setFormData({...formData, pickup_rider_id: e.target.value})} className={modernSelect}>
                          <option value="">Select rider...</option>
                          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                  </div>
              </div>

              {/* Sender Card */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-blue-500/20 transition-colors flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-blue-50 text-blue-600 rounded-md">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    </div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Sender Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <label className={labelStyle}>Sender Name <span className="text-rose-500">*</span></label>
                          <input ref={senderInputRef} type="text" value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} className={modernInput} placeholder="Enter sender name" required />
                      </div>
                      <div>
                          <label className={labelStyle}>Sender Office Location</label>
                          <select value={formData.sender_loc} onChange={e => setFormData({...formData, sender_loc: e.target.value})} className={modernSelect}>
                            <option value="MDY">MANDALAY</option>
                            <option value="YGN">YANGON</option>
                          </select>
                      </div>
                  </div>
              </div>

              {/* Receiver Card */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-emerald-500/20 transition-colors flex-[2_2_0%]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Receiver Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                          <label className={labelStyle}>Receiver Name <span className="text-rose-500">*</span></label>
                          <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={modernInput} placeholder="Enter name" required />
                      </div>
                      <div>
                          <label className={labelStyle}>Phone Number <span className="text-rose-500">*</span></label>
                          <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} placeholder="09-xxx-xxx-xxx" className={`${modernInput} font-mono tracking-wide`} required />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                          <label className={labelStyle}>Full Delivery Address</label>
                          <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={modernInput} placeholder="Enter detailed address..." />
                      </div>
                      <div>
                          <label className={labelStyle}>Destination City</label>
                          <select value={formData.receiver_loc} onChange={e => setFormData({...formData, receiver_loc: e.target.value})} className={modernSelect}>
                              <option value="MDY">Mandalay (MDY)</option>
                              <option value="YGN">Yangon (YGN)</option>
                              <option value="NPT">Nay Pyi Taw (NPT)</option>
                          </select>
                      </div>
                  </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Financials, Status Operations & Submit (4/12 width) */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
              
              {/* Financial Calculations Section */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex-1">
                  <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <span className="text-amber-500">💰</span> Financial Accounts
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
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
                                className={`${modernInput} font-mono font-bold pl-6 text-slate-900`} 
                                placeholder="0" 
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">K</span>
                          </div>
                      </div>
                      
                      <div>
                          <label className={labelStyle}>Delivery Fee</label>
                          <div className="relative">
                            <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${modernInput} font-mono text-orange-600 font-bold pl-6`} placeholder="0" />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">K</span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 items-end">
                      <div>
                          <label className={labelStyle}>Payment Type</label>
                          <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={modernSelect}>
                              <option value="Deli">Deli (+)</option>
                              <option value="Kpay">Kpay (Prepaid)</option>
                              <option value="Cash">Cash (Prepaid)</option>
                              <option value="Bill">Bill (-)</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-orange-600 font-black mb-1 uppercase text-[10px] tracking-wider">Total Final</label>
                          <div className="w-full bg-slate-900 py-2 px-3 rounded-lg flex items-center justify-between shadow-sm">
                              <span className="font-mono font-black text-sm text-orange-400">
                                {formData.total_amount.toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-orange-400/80">Ks</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Status & Actions Combined Panel */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-4 flex-2">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className={labelStyle}>Dispatch Status</label>
                          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={modernSelect}>
                              <option value="At Office">📦 At Office</option>
                              <option value="In-Transit">🚚 In-Transit</option>
                              <option value="Delivered">✅ Delivered</option>
                          </select>
                      </div>
                      <div>
                          <label className={labelStyle}>Deliver Date</label>
                          <input type="date" value={formData.deliver_date} onChange={e => setFormData({...formData, deliver_date: e.target.value})} className={`${modernInput} font-mono`} />
                      </div>
                  </div>

                  <div>
                      <label className={labelStyle}>Delivery Rider</label>
                      <select value={formData.deliver_rider_id} onChange={e => setFormData({...formData, deliver_rider_id: e.target.value})} className={modernSelect}>
                          <option value="">Select delivery rider...</option>
                          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                  </div>

                  {/* System Utilities */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                          <label className={labelStyle}>Return Utility</label>
                          <select value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className={modernSelect}>
                            <option value="">Normal Delivery</option>
                            <option value="RT">Return Item (RT)</option>
                          </select>
                      </div>
                      <div>
                          <label className={labelStyle}>Cash Event</label>
                          <select value={formData.cash_added_date ? "yes" : "no"} onChange={e => setFormData({...formData, cash_added_date: e.target.value === "yes" ? today : ""})} className={modernSelect}>
                            <option value="no">No Cash Added</option>
                            <option value="yes">Cash Added Event</option>
                          </select>
                      </div>
                  </div>

                  {/* Expandable Cash Date Field */}
                  {formData.cash_added_date && (
                     <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 animate-fadeIn">
                        <label className="block text-emerald-700 font-bold mb-1 uppercase text-[9px] tracking-wider">Date Received</label>
                        <input 
                          type="date" 
                          value={formData.cash_added_date} 
                          onChange={e => setFormData({...formData, cash_added_date: e.target.value})} 
                          className={`${modernInput} bg-white border-emerald-200 text-emerald-800 focus:border-emerald-500`}
                          required
                        />
                     </div>
                  )}
              </div>

              {/* Action Trigger Save Button */}
              <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className={`w-full py-3.5 text-xs font-black rounded-xl tracking-widest uppercase transition-all shadow-sm ${
                      loading 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-95 active:scale-[0.99]'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          SAVING TO DB...
                        </>
                      ) : 'Save Item'}
                    </span>
                  </button>
              </div>

            </div>
        </form>
      </div>
    </div>
  )
}