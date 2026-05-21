"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DailyReport() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userBranch, setUserBranch] = useState<string>('')
  
  // Rider Collection အတွက် လွယ်လွယ်ပြောင်းလို့ရမယ့် R.LOC Filter
  const [riderLocFilter, setRiderLocFilter] = useState('YGN')

  // ၁။ Component စတင်ချိန်တွင် Login ဝင်ထားသော ရုံးခွဲကို စစ်ဆေးခြင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      // MDY က ဝင်ရင် Default အနေနဲ့ MDY Rider တွေကိုပဲ အရင်ပြအောင် သတ်မှတ်မယ်
      setRiderLocFilter(storedBranch) 
    }
  }, [router])

  const fetchReport = async () => {
    if (!selectedDate || !userBranch) return
    setLoading(true)

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_rider:riders!orders_pickup_rider_id_fkey(name),
        deliver_rider:riders!orders_deliver_rider_id_fkey(name)
      `)
      .eq('branch', userBranch) // <--- လက်ရှိ ရုံးခွဲရဲ့ Data ကိုသာ ယူမည်
      .or(`deliver_date.eq.${selectedDate},cash_added_date.eq.${selectedDate}`)
      .order('item_id', { ascending: true })

    if (error) {
      console.error(error)
      alert("Report ဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။")
    } else {
      setReportData(data || [])
    }
    setLoading(false)
  }

  // userBranch သို့မဟုတ် selectedDate ပြောင်းတိုင်း Data အသစ်ပြန်ခေါ်မည်
  useEffect(() => { 
    if(userBranch) fetchReport() 
  }, [selectedDate, userBranch])

  // ==========================================
  // ၁။ အခြေခံတွက်ချက်မှုများ (Basic Stats)
  // ==========================================
  const deliveredToday = reportData.filter(o => o.deliver_date === selectedDate)
  const cashAddedToday = reportData.filter(o => o.cash_added_date === selectedDate)
  const totalCodDelivered = deliveredToday.reduce((sum, o) => sum + (o.cod_amount || 0), 0)
  const totalCashAdded = cashAddedToday.reduce((sum, o) => sum + (o.cod_amount || 0), 0)

  // ==========================================
  // ၂။ Rider Collection (Excel SUMIFS Formula)
  // ==========================================
  const riderSummary: Record<string, number> = {}
  reportData.forEach(o => {
    // Condition: Delivered, Not RT, R.LOC matches filter, Cash Added is empty
    if (
        o.status === 'Delivered' && 
        o.note !== 'RT' && 
        o.receiver_loc === riderLocFilter && 
        !o.cash_added_date
    ) {
      const riderName = o.deliver_rider?.name || 'Unknown Rider'
      if (!riderSummary[riderName]) riderSummary[riderName] = 0
      riderSummary[riderName] += (o.total_amount || 0) 
    }
  })

  // ==========================================
  // ၃။ OS Payout (VBA SyncByCity Logic)
  // ==========================================
  const calculateOS = (cityName: string) => {
    const senders: Record<string, number> = {}
    let posSum = 0
    let negSum = 0

    reportData.forEach(o => {
      // Condition: LOC = cityName, R.LOC = MDY, Status = Delivered, Not RT
      if (
          o.sender_loc === cityName && 
          o.receiver_loc === 'MDY' && 
          o.status === 'Delivered' && 
          o.note !== 'RT'
      ) {
        const senderName = o.sender_name || 'Unknown'
        if (!senders[senderName]) senders[senderName] = 0
        senders[senderName] += (o.cod_amount || 0) 
      }
    })

    // Positive & Negative Sums ခွဲခြင်း
    Object.values(senders).forEach(amt => {
      if (amt > 0) posSum += amt
      else if (amt < 0) negSum += amt
    })

    return { senders, posSum, negSum }
  }

  const osMDY = calculateOS('MDY')
  const osYGN = calculateOS('YGN')

  return (
    <div className="min-h-screen bg-gray-100 p-2 md:p-6 font-sans text-sm">
      <div className="max-w-[1500px] mx-auto">
        
        {/* Header & Date Picker */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm mb-6 gap-4 border border-gray-200">
          <div>
            <div className="flex items-center gap-2">
                <span className="bg-blue-900 text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest">
                    {userBranch === 'MDY' ? 'MANDALAY' : userBranch === 'YGN' ? 'YANGON' : ''}
                </span>
                <h1 className="text-2xl font-black text-blue-900 tracking-tight">📅 DAILY REPORT</h1>
            </div>
            <p className="text-gray-500 font-bold text-xs mt-2">နေ့စဉ် ပို့ဆောင်မှုနှင့် ငွေရှင်းတမ်း အစီရင်ခံစာ</p>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border">
            <label className="font-bold text-gray-700 ml-2">Select Date:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg shadow-inner outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
            />
            <button onClick={fetchReport} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold">
              🔄 REFRESH
            </button>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-bold">
              LOGOUT
            </button>
          </div>
        </div>

        {/* --- ရှင်းတမ်း အနှစ်ချုပ်များ (Settlement Summaries) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* ၁။ Rider Collection Summary */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
                <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
                    <h2 className="font-bold uppercase tracking-wider text-xs">🚴 Rider Collection</h2>
                    <select 
                        value={riderLocFilter} 
                        onChange={(e) => setRiderLocFilter(e.target.value)}
                        className="bg-white text-blue-900 font-bold p-1 rounded outline-none text-xs"
                    >
                        <option value="YGN">YGN (Yangon)</option>
                        <option value="MDY">MDY (Mandalay)</option>
                    </select>
                </div>
                <div className="p-4 flex-1">
                    {Object.keys(riderSummary).length === 0 ? (
                        <p className="text-gray-400 text-center text-xs mt-10 font-bold">No riders to collect for this date & city.</p>
                    ) : (
                        <table className="w-full text-left">
                            <tbody>
                                {Object.entries(riderSummary).map(([rider, amt]) => (
                                    <tr key={rider} className="border-b border-dashed border-gray-200 last:border-none">
                                        <td className="py-2 font-bold text-gray-700">{rider}</td>
                                        <td className="py-2 text-right font-black text-blue-700">{amt.toLocaleString()} Ks</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-gray-50 p-4 border-t flex justify-between items-center font-black">
                    <span className="text-gray-600 uppercase text-xs">Total to Collect</span>
                    <span className="text-blue-800 text-lg">{Object.values(riderSummary).reduce((a, b) => a + b, 0).toLocaleString()} Ks</span>
                </div>
            </div>

            {/* ၂။ OS MDY Payout Summary */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
                <div className="bg-green-700 text-white p-4">
                    <h2 className="font-bold uppercase tracking-wider text-xs">🏢 OS Payout (MDY Sender)</h2>
                    <p className="text-[10px] text-green-200">LOC=MDY, R.LOC=MDY</p>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                    {Object.keys(osMDY.senders).length === 0 ? (
                        <p className="text-gray-400 text-center text-xs mt-10 font-bold">No MDY OS payouts.</p>
                    ) : (
                        <table className="w-full text-left">
                            <tbody>
                                {Object.entries(osMDY.senders).map(([sender, amt]) => (
                                    <tr key={sender} className="border-b border-dashed border-gray-200">
                                        <td className="py-2 font-bold text-gray-700">{sender}</td>
                                        <td className="py-2 text-right font-bold text-green-700">{amt.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-gray-800 text-white p-3 text-xs font-bold flex flex-col gap-1">
                    <div className="flex justify-between"><span>Total (+)</span> <span className="text-green-400">{osMDY.posSum.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Total (-)</span> <span className="text-red-400">{Math.abs(osMDY.negSum).toLocaleString()}</span></div>
                </div>
            </div>

            {/* ၃။ OS YGN Payout Summary */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
                <div className="bg-purple-700 text-white p-4">
                    <h2 className="font-bold uppercase tracking-wider text-xs">✈️ OS Payout (YGN Sender)</h2>
                    <p className="text-[10px] text-purple-200">LOC=YGN, R.LOC=MDY</p>
                </div>
                <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                    {Object.keys(osYGN.senders).length === 0 ? (
                        <p className="text-gray-400 text-center text-xs mt-10 font-bold">No YGN OS payouts.</p>
                    ) : (
                        <table className="w-full text-left">
                            <tbody>
                                {Object.entries(osYGN.senders).map(([sender, amt]) => (
                                    <tr key={sender} className="border-b border-dashed border-gray-200">
                                        <td className="py-2 font-bold text-gray-700">{sender}</td>
                                        <td className="py-2 text-right font-bold text-purple-700">{amt.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="bg-gray-800 text-white p-3 text-xs font-bold flex flex-col gap-1">
                    <div className="flex justify-between"><span>Total (+)</span> <span className="text-green-400">{osYGN.posSum.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Total (-)</span> <span className="text-red-400">{Math.abs(osYGN.negSum).toLocaleString()}</span></div>
                </div>
            </div>

        </div>

        {/* --- မူလ Detailed Table --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
            <h2 className="font-bold text-gray-700">Detailed Records for {selectedDate}</h2>
            <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-1 rounded font-bold">
              {reportData.length} Records
            </span>
          </div>
          
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                <tr className="text-gray-600 uppercase border-b-2">
                  <th className="p-3 border-r">Item ID</th>
                  <th className="p-3 border-r">Sender / LOC</th>
                  <th className="p-3 border-r">Receiver / R.LOC</th>
                  <th className="p-3 border-r text-center">Status</th>
                  <th className="p-3 border-r text-center">Deli Date</th>
                  <th className="p-3 border-r text-center">Cash Added</th>
                  <th className="p-3 border-r">Deliver RD</th>
                  <th className="p-3 border-r text-right">Deli Fee</th>
                  <th className="p-3 border-r text-right">COD</th>
                  <th className="p-3 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="p-10 text-center font-bold text-gray-400">Loading Report...</td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan={10} className="p-10 text-center text-red-500 font-bold">No records found for this date.</td></tr>
                ) : (
                  reportData.map((o) => {
                    const isDeliverMatch = o.deliver_date === selectedDate;
                    const isCashMatch = o.cash_added_date === selectedDate;

                    return (
                      <tr key={o.id} className="hover:bg-yellow-50 transition-colors">
                        <td className="p-3 border-r font-mono font-bold text-blue-700">{o.item_id}</td>
                        <td className="p-3 border-r">
                            <div className="font-bold">{o.sender_name}</div>
                            <div className="text-[9px] text-gray-400">{o.sender_loc}</div>
                        </td>
                        <td className="p-3 border-r">
                          <div className="font-bold">{o.receiver_name}</div>
                          <div className="text-[9px] text-gray-400">{o.receiver_loc}</div>
                        </td>
                        <td className="p-3 border-r font-bold text-[9px] uppercase text-center text-gray-600">{o.status}</td>
                        <td className={`p-3 border-r font-bold text-center ${isDeliverMatch ? 'bg-green-100 text-green-700' : 'text-gray-400'}`}>
                          {o.deliver_date || '-'}
                        </td>
                        <td className={`p-3 border-r font-bold text-center ${isCashMatch ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>
                          {o.cash_added_date || '-'}
                        </td>
                        <td className="p-3 border-r font-bold text-purple-600">{o.deliver_rider?.name || '-'}</td>
                        <td className="p-3 border-r text-right font-bold text-red-400">{o.deli_fee?.toLocaleString()}</td>
                        <td className="p-3 border-r text-right font-bold text-green-600">{o.cod_amount?.toLocaleString()}</td>
                        <td className="p-3 text-right font-black text-blue-900 bg-blue-50">{o.total_amount?.toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}