"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EntryForm() {
  const router = useRouter()
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

  // 1. Login စစ်ဆေးခြင်းနှင့် Branch သတ်မှတ်ခြင်း
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

  // 3. ဖုန်းနံပါတ် Formatter
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
        cash_added_date: formData.cash_added_date || null, // UI က ရွေးထားတဲ့ Date ကို ပို့ပေးမှာဖြစ်ပါတယ်
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
        
        // Form Reset
        setOriginalCod(0)
        setFormData(prev => ({
            ...prev,
            sender_name: '', receiver_name: '', receiver_phone: '', receiver_address: '',
            cod_amount: 0, deli_fee: 0, fee_type: 'Deli', total_amount: 0, note: '', cash_added_date: '',
            pickup_rider_id: '', deliver_rider_id: '', status: 'At Office', deliver_date: ''
        }))
    }
    setLoading(false)
  }

  // Premium UI Design Classes 
  const glassInput = "w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-slate-600 font-medium"
  const glassSelect = "w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-orange-500/50 transition-all font-bold"

  return (
    <div className="w-full h-full text-xs md:text-sm text-slate-300 antialiased flex flex-col pb-2">
      
      <div className="flex-1 flex flex-col bg-slate-900/20 backdrop-blur-xl rounded-2xl border border-slate-800/80 shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden">
        
        {/* Top Control Header Panel */}
        <div className="p-4 md:p-5 bg-slate-900/40 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h1 className="text-sm md:text-base font-black tracking-wider bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent uppercase">
                📝 NEW VOUCHER ENTRY
              </h1>
            </div>
            <p className="text-slate-500 text-[11px] font-medium mt-0.5">Create secure database record for incoming packages</p>
          </div>
          
          <div className="bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Office: </span>
            <span className="text-xs font-black text-orange-400 tracking-wide">{userBranch === 'MDY' ? 'MANDALAY (MDY)' : 'YANGON (YGN)'}</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6 max-h-[calc(100vh-160px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800 hover:[&::-webkit-scrollbar-thumb]:bg-slate-700">
          <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* System ID & Date Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <div>
                      <label className="block text-slate-500 font-bold mb-1.5 tracking-wide uppercase text-[10px]">Item ID</label>
                      <input 
                          type="text" 
                          readOnly 
                          placeholder="[ Auto-Generated ]" 
                          className="w-full px-4 py-2.5 bg-slate-950/20 border border-dashed border-slate-800 text-orange-400/60 font-mono font-bold rounded-xl text-center text-sm cursor-not-allowed select-none" 
                      />
                  </div>
                  <div>
                      <label className="block text-slate-400 font-bold mb-1.5 tracking-wide uppercase text-[10px]">Arrival Date</label>
                      <input type="date" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} className={`${glassInput} font-mono`} required />
                  </div>
                  <div>
                      <label className="block text-slate-400 font-bold mb-1.5 tracking-wide uppercase text-[10px]">Pick Up Rider</label>
                      <select value={formData.pickup_rider_id} onChange={e => setFormData({...formData, pickup_rider_id: e.target.value})} className={glassSelect}>
                          <option value="" className="bg-slate-950 text-slate-500">Select Rider...</option>
                          {riders.map(r => <option key={r.id} value={r.id} className="bg-slate-950 text-slate-200">{r.name}</option>)}
                      </select>
                  </div>
              </div>

              {/* Information Grid Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Side: Sender Box */}
                  <div className="border border-slate-800/80 p-5 rounded-xl bg-slate-950/10 backdrop-blur-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                      <h3 className="font-black text-blue-400 mb-4 uppercase tracking-wider text-xs flex items-center gap-2 border-b border-slate-800 pb-2">
                        🔹 Sender Information
                      </h3>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Sender Name *</label>
                              <input type="text" value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} className={glassInput} required />
                          </div>
                          <div>
                              <label className="block text-slate-400 font-bold mb-2 uppercase text-[10px]">Sender Office Location</label>
                              <div className="flex space-x-6 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50 w-fit">
                                  <label className="flex items-center font-bold text-slate-300 cursor-pointer select-none text-xs">
                                    <input type="radio" name="sloc" checked={formData.sender_loc === 'MDY'} onChange={() => setFormData({...formData, sender_loc: 'MDY'})} className="mr-2 w-4 h-4 accent-orange-500"/> MDY
                                  </label>
                                  <label className="flex items-center font-bold text-slate-300 cursor-pointer select-none text-xs">
                                    <input type="radio" name="sloc" checked={formData.sender_loc === 'YGN'} onChange={() => setFormData({...formData, sender_loc: 'YGN'})} className="mr-2 w-4 h-4 accent-orange-500"/> YGN
                                  </label>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Side: Receiver Box */}
                  <div className="border border-slate-800/80 p-5 rounded-xl bg-slate-950/10 backdrop-blur-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                      <h3 className="font-black text-emerald-400 mb-4 uppercase tracking-wider text-xs flex items-center gap-2 border-b border-slate-800 pb-2">
                        🔸 Receiver Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                              <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Receiver Name *</label>
                              <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={glassInput} required />
                          </div>
                          <div>
                              <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Phone Number *</label>
                              <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} placeholder="09-xxx-xxx-xxx" className={`${glassInput} font-mono tracking-wide`} required />
                          </div>
                      </div>
                      <div className="mb-4">
                          <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Full Delivery Address</label>
                          <textarea value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={`${glassInput} h-[42px] resize-none py-2`} rows={1} />
                      </div>
                      <div>
                          <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Destination City</label>
                          <select value={formData.receiver_loc} onChange={e => setFormData({...formData, receiver_loc: e.target.value})} className={glassSelect}>
                              <option value="MDY" className="bg-slate-950">Mandalay (MDY)</option>
                              <option value="YGN" className="bg-slate-950">Yangon (YGN)</option>
                              <option value="NPT" className="bg-slate-950">Nay Pyi Taw (NPT)</option>
                          </select>
                      </div>
                  </div>
              </div>

              {/* Pricing Financial Section */}
              <div className="border border-amber-500/20 p-5 rounded-xl bg-gradient-to-b from-amber-500/[0.02] to-transparent shadow-inner">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                          <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">COD Amount (Ks)</label>
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
                              className={`${glassInput} font-mono text-orange-400 font-bold`} 
                              placeholder="0" 
                          />
                      </div>
                      
                      <div>
                          <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Delivery Fee (Ks)</label>
                          <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${glassInput} font-mono text-rose-400 font-bold`} placeholder="0" />
                      </div>
                      <div>
                          <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px]">Fee Payment Type</label>
                          <select value={formData.fee_type} onChange={e => setFormData({...formData, fee_type: e.target.value})} className={glassSelect}>
                              <option value="Deli" className="bg-slate-950">Deli (+)</option>
                              <option value="Kpay" className="bg-slate-950">Kpay (Prepaid)</option>
                              <option value="Cash" className="bg-slate-950">Cash (Prepaid)</option>
                              <option value="Bill" className="bg-slate-950">Bill (-)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-amber-400 font-black mb-1.5 uppercase text-[10px] tracking-wider">Calculated Total</label>
                          <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-400 h-[40px] flex items-center justify-center rounded-xl font-mono font-black text-base shadow-inner">
                              {formData.total_amount.toLocaleString()} <span className="text-[10px] ml-1 font-sans font-bold text-orange-500">Ks</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Delivery Management Status & Checkbox Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Status Inputs */}
                  <div className="border border-slate-800 p-4 rounded-xl bg-slate-950/10 backdrop-blur-sm">
                      <h3 className="font-bold text-slate-400 mb-3.5 uppercase tracking-wide text-[11px] border-b border-slate-800 pb-1.5">⚡ Delivery Dispatch</h3>
                      <div className="mb-3">
                          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={glassSelect}>
                              <option value="At Office" className="bg-slate-950">At Office (ရောက်ရှိ)</option>
                              <option value="In-Transit" className="bg-slate-950">In-Transit (လမ်းခရီး)</option>
                              <option value="Delivered" className="bg-slate-950">Delivered (ပို့ပြီး)</option>
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <input type="date" value={formData.deliver_date} onChange={e => setFormData({...formData, deliver_date: e.target.value})} className={`${glassInput} font-mono`} />
                          <select value={formData.deliver_rider_id} onChange={e => setFormData({...formData, deliver_rider_id: e.target.value})} className={glassSelect}>
                              <option value="" className="bg-slate-950 text-slate-500">Rider...</option>
                              {riders.map(r => <option key={r.id} value={r.id} className="bg-slate-950">{r.name}</option>)}
                          </select>
                      </div>
                  </div>

                  {/* 💡 FIXED: Cash Added Component with Dynamic Date Picker */}
                  <div className="border border-slate-800 p-4 rounded-xl bg-slate-950/20 flex flex-col justify-center space-y-3">
                      <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all select-none font-bold text-xs ${
                        formData.note === 'RT' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                          : 'bg-slate-950/40 text-slate-500 border-slate-800/80 hover:border-slate-700'
                      }`}>
                          <input type="checkbox" className="mr-3 w-5 h-5 rounded border-slate-800 bg-slate-950 text-rose-500 accent-rose-500" checked={formData.note === 'RT'} onChange={e => setFormData({...formData, note: e.target.checked ? 'RT' : ''})} />
                          ⚠️ RETURN ITEM SYSTEM RECORD (RT)
                      </label>
                      
                      <div className={`flex flex-col p-3 rounded-xl border transition-all ${
                        formData.cash_added_date 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-800'
                      }`}>
                          <label className={`flex items-center cursor-pointer select-none font-bold text-xs ${
                            formData.cash_added_date ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                              <input 
                                type="checkbox" 
                                className="mr-3 w-5 h-5 rounded border-slate-800 bg-slate-950 text-emerald-500 accent-emerald-500" 
                                checked={!!formData.cash_added_date} 
                                onChange={e => setFormData({...formData, cash_added_date: e.target.checked ? today : ''})} 
                              />
                              💵 CASH ADDED
                          </label>
                          
                          {/* Checkbox ကို ထောက်လိုက်မှ ပွင့်လာမည့် Date field */}
                          {formData.cash_added_date && (
                            <div className="mt-3 pt-2.5 border-t border-emerald-500/20 animate-fadeIn">
                              <label className="block text-emerald-500/70 font-bold mb-1.5 uppercase text-[10px] tracking-wider">Cash Added Date *</label>
                              <input 
                                type="date" 
                                value={formData.cash_added_date} 
                                onChange={e => setFormData({...formData, cash_added_date: e.target.value})} 
                                className={`${glassInput} font-mono border-emerald-500/30 text-emerald-300 focus:border-emerald-500`}
                                required
                              />
                            </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Action Trigger Button */}
              <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className={`w-full py-3.5 text-xs font-black rounded-xl tracking-widest uppercase transition-all shadow-[0_4px_20px_rgba(249,115,22,0.15)] ${
                      loading 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:from-orange-600 hover:to-amber-600 font-extrabold hover:shadow-[0_4px_24px_rgba(249,115,22,0.3)]'
                    }`}
                  >
                      {loading ? '⚡ SYNCHRONIZING WITH DATABASE...' : '💾 SAVE VOUCHER NOW'}
                  </button>
              </div>
          </form>
        </div>
        
      </div>
    </div>
  )
}