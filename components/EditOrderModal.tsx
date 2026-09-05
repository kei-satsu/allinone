"use client"
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/databaseApi'
import dynamic from 'next/dynamic'

// ImageUploader ကို Client-side သီးသန့်အလုပ်လုပ်ရန် Dynamic Import သုံးခြင်း
const ImageUploader = dynamic(
  () => import('@/components/ImageUploader'),
  { ssr: false }
)

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any;
  onSaveSuccess: () => void;
}

const MANUAL_CITIES = [
  { id: 'YGN', name: 'ရန်ကုန်' },
  { id: 'MDY', name: 'မန္တလေး' },
  { id: 'NPT', name: 'နေပြည်တော်' },
  { id: 'TGI', name: 'တောင်ကြီး' },
  { id: 'POL1', name: 'ပြင်ဦးလွင် SPY' },
  { id: 'POL2', name: 'ပြင်ဦးလွင် စိုပြေ' },
  { id: 'MGY', name: 'မကွေး' },
  { id: 'MYW', name: 'မုံရွာ' },
  { id: 'TDU', name: 'တံတားဦး' },
  { id: 'KYS', name: 'ကျောက်ဆည်' },
  { id: 'PTN', name: 'ပုသိမ်' },
  { id: 'SGG', name: 'စစ်ကိုင်း' },
  { id: 'SBO', name: 'ရွှေဘို' },
]

export default function EditOrderModal({ isOpen, onClose, orderData, onSaveSuccess }: EditOrderModalProps) {
  const [loading, setLoading] = useState(false)
  const [riders, setRiders] = useState<any[]>([])
  const [senders, setSenders] = useState<any[]>([])
  const [cities, setCities] = useState<any[]>([])
  const [filteredSenders, setFilteredSenders] = useState<any[]>([])
  const [showSenderDropdown, setShowSenderDropdown] = useState(false)
  const [originalCod, setOriginalCod] = useState<number>(0)
  const [resetKey, setResetKey] = useState<number>(Date.now())

  // Barcode Lock State
  const [isBarcodeLocked, setIsBarcodeLocked] = useState<boolean>(true)

  const [formData, setFormData] = useState({
    barcode: '',
    sender_id: '',
    received_date: '',
    sender_name: '',
    sender_phone: '', 
    sender_loc: 'MDY', 
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    receiver_loc: 'MDY',
    cod_amount: 0,
    deli_fee: 0,
    agent_fee: 0,
    fee_type: 'Deli',
    total_amount: 0,
    pickup_rider_id: '',
    status: 'At Office',
    deliver_rider_id: '',
    deliver_date: '',
    note: '',
    cleared_date: '',
    branch: '',
    image_url: '',
    remark: '',
    transit: [] as any[],
  })

  // 1. Form အချက်အလက်များ မူရင်းအတိုင်း ဖြည့်သွင်းခြင်း
  useEffect(() => {
    if (orderData && isOpen) {
      let transitList: any[] = [];
      if (Array.isArray(orderData.transit)) {
        transitList = orderData.transit;
      } else if (typeof orderData.transit === 'string') {
        try {
          transitList = JSON.parse(orderData.transit);
        } catch {
          transitList = [];
        }
      }

      setFormData({
        barcode: orderData.barcode || '',
        sender_id: orderData.sender_id || '',
        received_date: orderData.received_date || '',
        sender_name: orderData.sender_name || '',
        sender_phone: orderData.sender_phone || '',
        sender_loc: orderData.sender_loc || 'MDY',
        receiver_name: orderData.receiver_name || '',
        receiver_phone: orderData.receiver_phone || '',
        receiver_address: orderData.receiver_address || '',
        receiver_loc: orderData.receiver_loc || 'MDY',
        cod_amount: orderData.cod_amount || 0,
        deli_fee: orderData.deli_fee || 0,
        agent_fee: orderData.agent_fee || 0,
        fee_type: orderData.fee_type || 'Deli',
        total_amount: orderData.total_amount || 0,
        pickup_rider_id: orderData.pickup_rider_id || '',
        status: orderData.status || 'At Office',
        deliver_rider_id: orderData.deliver_rider_id || '',
        deliver_date: orderData.deliver_date || '',
        note: orderData.note || '',
        cleared_date: orderData.cleared_date || '',
        branch: orderData.branch || '',
        image_url: orderData.image_url || '',
        remark: orderData.remark || '',
        transit: transitList // UI Input နှင့် တိုက်ရိုက်ချိတ်ဆက်မည့် Array
      })

      setIsBarcodeLocked(true)

      if (orderData.fee_type === 'Bill') {
        setOriginalCod((orderData.cod_amount || 0) + (orderData.deli_fee || 0))
      } else {
        setOriginalCod(orderData.cod_amount || 0)
      }
      setResetKey(Date.now())
    }
  }, [orderData, isOpen])

  // 2. Senders, Cities နှင့် Riders Fetching
  useEffect(() => {
    if (!isOpen) return
    
    async function fetchSenders() {
      const { data, error } = await apiClient.from('senders').select('*').order('name', { ascending: true })
      if (!error && data) setSenders(data)
    }

    async function fetchCities() {
      const { data, error } = await apiClient.from('cities').select('*').order('name', { ascending: true })
      if (!error && data) setCities(data)
    }

    fetchSenders()
    fetchCities()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return;

    const currentBranch = localStorage.getItem('user_branch') || formData.branch;
    if (!currentBranch) return;

    async function fetchRiders() {
      const { data, error } = await apiClient
        .from('riders')
        .select('*')
        .eq('branch', currentBranch)
        .order('name', { ascending: true });

      if (!error && data) setRiders(data);
    }

    fetchRiders();
  }, [isOpen, formData.branch]);

  // 3. Sender Selection
  const handleSenderNameChange = (val: string) => {
    setFormData(prev => ({ ...prev, sender_name: val, sender_id: '' }))
    
    if (val.trim() === '') {
      setFilteredSenders([])
      setShowSenderDropdown(false)
    } else {
      const filtered = senders.filter(s => 
        s.name?.toLowerCase().includes(val.toLowerCase()) || 
        s.phone?.includes(val)
      )
      setFilteredSenders(filtered)
      setShowSenderDropdown(true)
    }
  }

  const selectSender = (selectedSender: any) => {
    setFormData(prev => ({
      ...prev,
      sender_id: selectedSender.id,
      sender_name: selectedSender.name,
      sender_phone: selectedSender.phone || '',
      sender_loc: selectedSender.location || prev.sender_loc
    }))
    setShowSenderDropdown(false)
  }

  // 4. Financial Calculation
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

  // 5. Phone Formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/-/g, '').replace(/\D/g, '')
    let formatted = s;
    if (s.length >= 2 && s.length < 5) formatted = `${s.slice(0, 2)}-${s.slice(2)}`
    else if (s.length >= 5 && s.length < 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
    else if (s.length >= 8) formatted = `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5, 8)}-${s.slice(8, 11)}`
    setFormData(prev => ({ ...prev, receiver_phone: formatted }))
  }

  // 6. Update Submission & History Log Generator
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sender_name || !formData.receiver_name || !formData.receiver_phone) {
      alert("လိုအပ်သောအချက်အလက်များ ပြည့်စုံစွာဖြည့်ပါ!")
      return;
    }

    if (!formData.sender_id) {
      alert("ကျေးဇူးပြု၍ ပေးပို့သူ (Sender) ကို List ကျလာသည့်အထဲမှ သေချာစွာ နှိပ်၍ရွေးချယ်ပေးပါ!")
      return;
    }

    if (formData.status === 'In-Transit') {
      const hasValidTransit = formData.transit.some(
        t => t.transit_to?.trim() && t.transit_date
      );
      if (!hasValidTransit) {
        alert("Status ကို 'In-Transit' ဟု ရွေးချယ်ပါက Transit Date နှင့် Transit To (Branch) တို့ကို သေချာစွာ ဖြည့်သွင်းပေးရပါမည်!")
        return;
      }
    }

    setLoading(true)

    const currentBranch = localStorage.getItem('user_branch') || formData.branch || 'MDY';

    // 🌟 UI ထဲတွင် ပြင်ဆင်ထားသော formData.transit ကို တိုက်ရိုက်အသုံးပြုမည်
    const updatedTransitList = formData.transit.map(item => ({
      transit_from: item.transit_from || null,
      transit_to: item.transit_to || null,
      transit_date: item.transit_date || null,
    }));

    // Legacy DB column များအတွက် Active Leg ကိုရှာပြီး Synchronize လုပ်ပေးခြင်း
    const activeLeg = updatedTransitList.find(
      (leg) => leg.transit_from === currentBranch || leg.transit_to === currentBranch
    ) || updatedTransitList[updatedTransitList.length - 1];

    // HISTORY LOG CALCULATION
    let changes: string[] = [];
    const fmtKg = (val: any) => `${(Number(val) || 0).toLocaleString()} Ks`;

    if ((orderData?.barcode || '') !== (formData.barcode || '')) {
      changes.push(`🏷️ Barcode: "${orderData?.barcode || ''}" ➔ "${formData.barcode}"`);
    }
    if ((orderData?.received_date || '') !== (formData.received_date || '')) {
      changes.push(`📅 Arrival Date: "${orderData?.received_date || 'N/A'}" ➔ "${formData.received_date}"`);
    }
    if ((orderData?.branch || '') !== (formData.branch || '')) {
      changes.push(`🏢 Branch: "${orderData?.branch || 'N/A'}" ➔ "${formData.branch}"`);
    }
    if ((orderData?.sender_name || '') !== (formData.sender_name || '')) {
      changes.push(`📤 Sender: "${orderData?.sender_name || ''}" ➔ "${formData.sender_name}"`);
    }
    if ((orderData?.receiver_name || '') !== (formData.receiver_name || '')) {
      changes.push(`📥 Receiver Name: "${orderData?.receiver_name || ''}" ➔ "${formData.receiver_name}"`);
    }
    if ((orderData?.receiver_phone || '') !== (formData.receiver_phone || '')) {
      changes.push(`📞 Receiver Phone: "${orderData?.receiver_phone || ''}" ➔ "${formData.receiver_phone}"`);
    }
    if (Number(orderData?.cod_amount || 0) !== Number(formData.cod_amount || 0)) {
      changes.push(`💰 COD Amount: ${fmtKg(orderData?.cod_amount)} ➔ ${fmtKg(formData.cod_amount)}`);
    }
    if (Number(orderData?.deli_fee || 0) !== Number(formData.deli_fee || 0)) {
      changes.push(`💵 Deli Fee: ${fmtKg(orderData?.deli_fee)} ➔ ${fmtKg(formData.deli_fee)}`);
    }
    if (Number(orderData?.agent_fee || 0) !== Number(formData.agent_fee || 0)) {
      changes.push(`🤝 Agent Fee: ${fmtKg(orderData?.agent_fee)} ➔ ${fmtKg(formData.agent_fee)}`);
    }
    if ((orderData?.status || 'At Office') !== (formData.status || 'At Office')) {
      changes.push(`📦 Status: "${orderData?.status || 'At Office'}" ➔ "${formData.status}"`);
    }

    if (changes.length === 0) {
      changes.push("ℹ️ Transit or order info updated");
    }

    const logNote = changes.join("\n");
    const operatorName = currentBranch || 'Unknown Office';

    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: "Order Updated",
      operator: operatorName,
      note: logNote
    };

    const updatedHistory = [...(orderData?.history || []), newLogEntry];

    const payload = {
      ...formData,
      barcode: formData.barcode?.trim() ? formData.barcode.trim() : null, 
      pickup_rider_id: formData.pickup_rider_id || null,
      deliver_rider_id: formData.deliver_rider_id || null,
      agent_fee: Number(formData.agent_fee) || 0,
      deliver_date: formData.deliver_date || null,
      cleared_date: formData.cleared_date || null,
      transit_date: activeLeg?.transit_date || null,
      transit_to: activeLeg?.transit_to || null,
      transit: updatedTransitList, // Correct multi-leg JSON array
      history: updatedHistory
    }

    const { error } = await apiClient
      .from('orders')
      .update(payload)
      .eq('id', orderData.id)

    setLoading(false)

    if (error) {
      alert("ပြင်ဆင်မှု မအောင်မြင်ပါ- " + error.message)
    } else {
      alert("Order နှင့် လှုပ်ရှားမှုမှတ်တမ်းကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။")
      onSaveSuccess()
      onClose()
    }
  }

  if (!isOpen) return null;

  const winInput = "w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"
  const transitCities = [
    ...MANUAL_CITIES,
    ...cities
      .filter(city => !MANUAL_CITIES.some(manualCity => manualCity.id === String(city['C.ID'])))
      .map(city => ({ id: String(city['C.ID']), name: city.name }))
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-2 sm:p-4 antialiased">
      <div className="bg-[#f4f4f5] rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              📝 Edit Order Details (Barcode: {formData.barcode || orderData?.id})
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">ရုံးခွဲ - {formData.branch === 'MDY' ? 'Mandalay' : 'Yangon'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors">×</button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-4">

            {/* Barcode */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
              <label className={labelStyle}>Barcode Code</label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    readOnly={isBarcodeLocked}
                    className={`${winInput} font-mono font-bold tracking-wide transition-all ${
                      isBarcodeLocked 
                        ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed select-none' 
                        : 'bg-amber-50/60 text-amber-900 border-amber-400 focus:ring-amber-200'
                    }`}
                    placeholder="Barcode ရိုက်ထည့်ပါ..."
                  />
                  {!isBarcodeLocked && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 font-bold uppercase animate-pulse">
                      ⚠️ Editing
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (isBarcodeLocked) {
                      if (confirm("Barcode ကို ပြင်ဆင်ရန် သေချာပါသလား?")) {
                        setIsBarcodeLocked(false);
                      }
                    } else {
                      setIsBarcodeLocked(true);
                    }
                  }}
                  className={`px-3.5 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                    isBarcodeLocked 
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300' 
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                  }`}
                >
                  {isBarcodeLocked ? '🔒 Lock ဖြည်မည်' : '🔓 Lock ပြန်ခတ်မည်'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
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
              <div>
                <label className={labelStyle}>Branch Office</label>
                <select value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} className={winSelect}>
                  <option value="MDY">MANDALAY</option>
                  <option value="YGN">YANGON</option>
                </select>
              </div>
            </div>

            {/* Sender Section */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs relative">
              <h3 className="font-bold text-gray-800 uppercase text-xs mb-3 flex items-center gap-1.5 text-blue-600">📤 Sender Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative">
                  <label className={labelStyle}>Sender Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.sender_name} 
                      onChange={e => handleSenderNameChange(e.target.value)}
                      onFocus={() => { if (formData.sender_name) setShowSenderDropdown(true) }}
                      onBlur={() => setTimeout(() => setShowSenderDropdown(false), 200)}
                      className={`${winInput} ${formData.sender_id ? 'border-emerald-500 bg-emerald-50/20' : ''}`} 
                      placeholder="ရှာဖွေရန် အမည်ရိုက်ပါ..."
                      required 
                    />
                    {formData.sender_id && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-bold">✓ Selected</span>
                    )}
                  </div>
                  {showSenderDropdown && filteredSenders.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredSenders.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => selectSender(s)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-none flex justify-between items-center"
                        >
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-gray-400 font-mono text-xs">{s.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelStyle}>Sender Phone</label>
                  <input 
                    type="text" 
                    value={formData.sender_phone} 
                    className={`${winInput} font-mono bg-gray-50`} 
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelStyle}>Sender Office Location</label>
                  <input 
                    type="text" 
                    value={formData.sender_loc === 'MDY' ? 'MANDALAY' : formData.sender_loc === 'YGN' ? 'YANGON' : formData.sender_loc} 
                    className={`${winInput} bg-gray-50 font-semibold`}
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Receiver Section */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs">
              <h3 className="font-bold text-gray-800 uppercase text-xs mb-3 flex items-center gap-1.5 text-emerald-600">📥 Receiver Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className={labelStyle}>Receiver Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} className={winInput} required />
                </div>
                <div>
                  <label className={labelStyle}>Phone Number <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.receiver_phone} onChange={handlePhoneChange} className={`${winInput} font-mono`} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelStyle}>Full Delivery Address</label>
                  <input type="text" value={formData.receiver_address} onChange={e => setFormData({...formData, receiver_address: e.target.value})} className={winInput} />
                </div>
                <div>
                  <label className={labelStyle}>Destination City</label>
                  <select 
                    value={formData.receiver_loc} 
                    onChange={e => setFormData({...formData, receiver_loc: e.target.value})} 
                    className={winSelect}
                    required
                  >
                    <option value="">Select city...</option>
                    {cities.map((city) => (
                      <option key={city['C.ID']} value={city['C.ID']}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Remark Section */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs">
              <label className={labelStyle}>Remark (အထွေထွေမှတ်ချက်)</label>
              <textarea 
                value={formData.remark} 
                onChange={e => setFormData({...formData, remark: e.target.value})} 
                className={`${winInput} h-20 resize-none`} 
                placeholder="ဒီ Order နဲ့ပတ်သက်ပြီး မှတ်သားရန်ရှိသည်များကို ရေးသားပါ..."
              />
            </div>

            {/* Voucher Image */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs">
              <label className={labelStyle}>Voucher Image</label>
              {formData.image_url && (
                <div className="mb-2 relative rounded border border-gray-200 bg-gray-50 flex items-center justify-center p-2 group">
                  <img src={formData.image_url} alt="Current Voucher" className="max-h-24 object-contain" />
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs transition-colors shadow-md"
                  >
                    ✕
                  </button>
                </div>
              )}
              <ImageUploader 
                key={resetKey}
                onUploadSuccess={(url) => setFormData(prev => ({ ...prev, image_url: url }))} 
              />
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-4">
            {/* Financial Accounts */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs">
              <h3 className="font-bold text-gray-800 text-xs mb-3 uppercase flex items-center gap-1.5">💰 Financial Accounts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelStyle}>COD Amount</label>
                  <div className="relative">
                    <input type="number" value={formData.cod_amount || ''} onChange={e => setOriginalCod(Number(e.target.value))} className={`${winInput} pl-7 font-mono font-bold text-gray-900`} />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">K</span>
                  </div>
                </div>
                <div>
                  <label className={labelStyle}>Delivery Fee</label>
                  <div className="relative">
                    <input type="number" value={formData.deli_fee || ''} onChange={e => setFormData({...formData, deli_fee: Number(e.target.value)})} className={`${winInput} pl-7 font-mono text-orange-600 font-bold`} />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">K</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
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
                  <label className={labelStyle}>Total Final</label>
                  <div className="w-full bg-gray-900 py-2.5 px-3 rounded-lg flex items-center justify-between h-[46px]">
                    <span className="font-mono font-bold text-sm text-orange-400">{formData.total_amount.toLocaleString()}</span>
                    <span className="text-[11px] font-semibold text-orange-300">Ks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle}>Dispatch Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={winSelect}>
                      <option value="At Office">📦 At Office</option>
                      <option value="On Way">🚵 On Way</option>
                      <option value="Delivered">✅ Delivered</option>
                      <option value="In-Transit">🚚 In-Transit</option>
                      <option value="Via-Agent">🚐 Via-Agent</option>
                      <option value="Returned">↗️ Returned</option>
                      <option value="Settled">💰 Settled</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Deliver Date</label>
                  <input type="date" value={formData.deliver_date} onChange={e => setFormData({...formData, deliver_date: e.target.value})} className={`${winInput} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 items-end">
                <div>
                  <label className={labelStyle}>Delivery Rider</label>
                  <select 
                    value={formData.deliver_rider_id} 
                    onChange={e => setFormData({...formData, deliver_rider_id: e.target.value})} 
                    className={`${winSelect} h-[46px]`}
                  >
                    <option value="">Select delivery rider...</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Agent Fee</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.agent_fee || ''}
                      onChange={e => setFormData({...formData, agent_fee: Number(e.target.value)})}
                      className={`${winInput} pl-7 font-mono text-indigo-600 font-bold text-xs h-[46px]`}
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">K</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle}>Return Utility</label>
                  <select value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className={winSelect}>
                    <option value="">Normal Delivery</option>
                    <option value="RT">Return Item (RT)</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Cash Event</label>
                  <select 
                    value={formData.cleared_date ? "yes" : "no"} 
                    onChange={e => setFormData({
                      ...formData, 
                      cleared_date: e.target.value === "yes" ? (formData.cleared_date || new Date().toISOString().split('T')[0]) : ""
                    })} 
                    className={winSelect}
                  >
                    <option value="no">Not Cleared</option>
                    <option value="yes">Cleared</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className={labelStyle}>Cleared Date</label>
                <input 
                  type="date" 
                  value={formData.cleared_date || ''} 
                  onChange={e => setFormData({...formData, cleared_date: e.target.value})} 
                  className={`${winInput} font-mono`} 
                />
              </div>
            </div>

            {/* Transit Information */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 uppercase text-xs flex items-center gap-1.5 text-indigo-600">🚛 Transit Information</h3>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    transit: [...prev.transit, { transit_from: '', transit_to: '', transit_date: '' }]
                  }))}
                  className="px-2.5 py-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-colors"
                >
                  + Add Transit
                </button>
              </div>

              {formData.transit.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No transit legs recorded.</p>
              )}

              <div className="space-y-3">
                {formData.transit.map((leg: any, index: number) => (
                  <div key={index} className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Transit Leg {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          transit: prev.transit.filter((_, legIndex) => legIndex !== index)
                        }))}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelStyle}>From Branch</label>
                        <select
                          value={leg.transit_from || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            transit: prev.transit.map((item, legIndex) => legIndex === index
                              ? { ...item, transit_from: e.target.value }
                              : item)
                          }))}
                          className={`${winSelect} h-[46px]`}
                        >
                          <option value="">City မရွေးချယ်ရသေးပါ...</option>
                          {transitCities.map(city => <option key={`from-${city.id}`} value={city.id}>{city.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>To Branch</label>
                        <select
                          value={leg.transit_to || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            transit: prev.transit.map((item, legIndex) => legIndex === index
                              ? { ...item, transit_to: e.target.value }
                              : item)
                          }))}
                          className={`${winSelect} h-[46px]`}
                        >
                          <option value="">City မရွေးချယ်ရသေးပါ...</option>
                          {transitCities.map(city => <option key={`to-${city.id}`} value={city.id}>{city.name}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelStyle}>Transit Date</label>
                        <input
                          type="date"
                          value={leg.transit_date || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            transit: prev.transit.map((item, legIndex) => legIndex === index
                              ? { ...item, transit_date: e.target.value }
                              : item)
                          }))}
                          className={`${winInput} h-[46px] font-mono text-base`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 font-semibold rounded-lg text-sm text-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={loading} onClick={handleUpdateSubmit} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 font-semibold rounded-lg text-sm text-white shadow-md transition-colors disabled:opacity-50">
            {loading ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  )
}