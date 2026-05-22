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
  
  // Rider Collection အတွက် City Filter
  const [riderLocFilter, setRiderLocFilter] = useState('YGN')

  // Handovers data from cash_handovers table
  const [handovers, setHandovers] = useState<Record<string, number>>({})
  
  // Modal state for handover form
  const [handoverModal, setHandoverModal] = useState<{ open: boolean; riderName: string }>({ open: false, riderName: '' })
  const [handoverAmounts, setHandoverAmounts] = useState({ cash: 0, kpay: 0, wave: 0 })
  const [submitting, setSubmitting] = useState(false)

  // ၁။ Auth & Branch Configuration
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      setRiderLocFilter(storedBranch) 
    }
  }, [router])

  // ၂။ Database မှ Data ဆွဲယူခြင်း (Orders + Handovers)
  const fetchReport = async () => {
    if (!selectedDate || !userBranch) return
    setLoading(true)

    // Fetch orders
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_rider:riders!orders_pickup_rider_id_fkey(name),
        deliver_rider:riders!orders_deliver_rider_id_fkey(name)
      `)
      .eq('branch', userBranch) 
      .or(`deliver_date.eq.${selectedDate},cash_added_date.eq.${selectedDate}`)
      .order('item_id', { ascending: true })

    if (error) {
      console.error(error)
      alert("Report ဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။")
      setLoading(false)
      return
    }
    setReportData(data || [])

    // Fetch handovers for the selected date
    const { data: handoverData, error: handoverError } = await supabase
      .from('cash_handovers')
      .select('rider_name, total_amount')
      .eq('handover_date', selectedDate)
      .eq('created_by', userBranch)

    if (handoverError) {
      console.error(handoverError)
    } else {
      const handoverMap: Record<string, number> = {}
      handoverData?.forEach(h => {
        handoverMap[h.rider_name] = (handoverMap[h.rider_name] || 0) + h.total_amount
      })
      setHandovers(handoverMap)
    }
    setLoading(false)
  }

  useEffect(() => { 
    if(userBranch) fetchReport() 
  }, [selectedDate, userBranch])

  // ==========================================
  // ၃။ အခြေခံအချက်အလက် တွက်ချက်မှုများ
  // ==========================================
  const deliveredToday = reportData.filter(o => o.deliver_date === selectedDate)
  // Total COD from delivered orders (for summary box)
  const totalCodDelivered = deliveredToday.reduce((sum, o) => sum + (o.cod_amount || 0), 0)
  // Total handed in = sum of all handovers for the date
  const totalCashAdded = Object.values(handovers).reduce((a,b) => a+b, 0)

  // ==========================================
  // ၄။ Rider Summary (Ways, Due, HandedIn from handovers, Pending)
  // ==========================================
  const riderSummary: Record<string, { ways: number; due: number; handedIn: number; pending: number }> = {}
  
  reportData.forEach(o => {
    const riderName = o.deliver_rider?.name || 'Unknown Rider'
    
    if (o.receiver_loc === riderLocFilter) {
      if (!riderSummary[riderName]) {
        riderSummary[riderName] = { ways: 0, due: 0, handedIn: 0, pending: 0 }
      }

      // Today's deliveries (non-RT, status Delivered)
      if (o.deliver_date === selectedDate && o.status === 'Delivered' && o.note !== 'RT') {
        riderSummary[riderName].ways += 1
        riderSummary[riderName].due += (o.total_amount || 0)
      }
    }
  })

  // Apply handovers from the cash_handovers table
  Object.keys(riderSummary).forEach(rider => {
    riderSummary[rider].handedIn = handovers[rider] || 0
    riderSummary[rider].pending = riderSummary[rider].due - riderSummary[rider].handedIn
  })

  // Grand Totals for Rider Section
  const grandRiderWays = Object.values(riderSummary).reduce((a, b) => a + b.ways, 0)
  const grandRiderDue = Object.values(riderSummary).reduce((a, b) => a + b.due, 0)
  const grandRiderHandedIn = Object.values(riderSummary).reduce((a, b) => a + b.handedIn, 0)
  const grandRiderPending = Object.values(riderSummary).reduce((a, b) => a + b.pending, 0)

  // ==========================================
  // ၅။ OS Payout Logic (unchanged)
  // ==========================================
  const calculateOS = (cityName: string) => {
    const senders: Record<string, number> = {}
    let posSum = 0
    let negSum = 0

    reportData.forEach(o => {
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

    Object.values(senders).forEach(amt => {
      if (amt > 0) posSum += amt
      else if (amt < 0) negSum += amt
    })

    return { senders, posSum, negSum }
  }

  const osMDY = calculateOS('MDY')
  const osYGN = calculateOS('YGN')

  // ==========================================
  // ၆။ Handover submission
  // ==========================================
  const handleHandIn = async (riderName: string) => {
    setHandoverAmounts({ cash: 0, kpay: 0, wave: 0 })
    setHandoverModal({ open: true, riderName })
  }

  const submitHandover = async () => {
    const { cash, kpay, wave } = handoverAmounts
    const total = cash + kpay + wave
    if (total === 0) {
      alert("Please enter at least one positive amount.")
      return
    }

    setSubmitting(true)
    const { error } = await supabase
      .from('cash_handovers')
      .insert({
        rider_name: handoverModal.riderName,
        handover_date: selectedDate,
        cash_amount: cash,
        kpay_amount: kpay,
        wave_amount: wave,
        created_by: userBranch,
        notes: `Handover from ${handoverModal.riderName} on ${selectedDate}`
      })

    if (error) {
      alert("Failed to record handover: " + error.message)
    } else {
      alert(`✅ Recorded ${total.toLocaleString()} Ks for ${handoverModal.riderName}`)
      setHandoverModal({ open: false, riderName: '' })
      fetchReport() // Refresh to update handed-in amounts
    }
    setSubmitting(false)
  }

  // UI Styles
  const cardStyle = "bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between"
  const cardTitle = "text-xs font-bold text-slate-400 uppercase tracking-wider"
  const tableTh = "p-3 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200"

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-7 text-sm text-slate-700 antialiased">
      <div className="w-full max-w-[1650px] mx-auto space-y-6">
        
        {/* TOP INTERACTIVE CONTROL HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div className="flex items-center gap-3.5">
            <span className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-black tracking-widest">
              {userBranch === 'MDY' ? 'MANDALAY' : 'YANGON'}
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-wider uppercase">📅 Daily Settlement Report</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Realtime Node Data Operations Manager</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-500 text-xs px-2 uppercase tracking-wide">Query Target:</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:border-orange-500 text-sm shadow-sm"
            />
            <button onClick={fetchReport} className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg font-bold transition-all text-sm shadow-sm">
              🔄 REFRESH
            </button>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 rounded-lg font-bold transition-all text-sm shadow-sm">
              LOGOUT
            </button>
          </div>
        </div>

        {/* --- SUMMARY GRID BOXES --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          <div className={cardStyle}>
            <span className={cardTitle}>Total Deliver Ways</span>
            <p className="text-xl font-black text-slate-900 mt-2 font-mono">{deliveredToday.length} <span className="text-sm font-bold text-slate-400">Ways</span></p>
          </div>
          <div className={cardStyle}>
            <span className={cardTitle}>Total COD Delivered</span>
            <p className="text-xl font-black text-emerald-600 mt-2 font-mono">{totalCodDelivered.toLocaleString()} <span className="text-xs font-bold text-emerald-400">Ks</span></p>
          </div>
          <div className={cardStyle}>
            <span className={cardTitle}>Total Cash Handed In</span>
            <p className="text-xl font-black text-blue-600 mt-2 font-mono">{totalCashAdded.toLocaleString()} <span className="text-xs font-bold text-blue-400">Ks</span></p>
          </div>
          <div className={`${cardStyle} bg-slate-50/60 border-dashed`}>
            <span className={cardTitle}>Summary Block 4</span>
            <p className="text-sm font-bold text-slate-400 italic mt-3">[ Formula Later ]</p>
          </div>
          <div className={`${cardStyle} bg-slate-50/60 border-dashed`}>
            <span className={cardTitle}>Summary Block 5</span>
            <p className="text-sm font-bold text-slate-400 italic mt-3">[ Formula Later ]</p>
          </div>
          <div className={`${cardStyle} bg-slate-50/60 border-dashed`}>
            <span className={cardTitle}>Summary Block 6</span>
            <p className="text-sm font-bold text-slate-400 italic mt-3">[ Formula Later ]</p>
          </div>
        </div>

        {/* --- CORE ACCOUNTS BREAKDOWN --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Rider Hand-In Ledger with Hand In buttons */}
            <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚴</span>
                  <h2 className="font-black uppercase tracking-wider text-xs">Rider Hand-In Ledger</h2>
                </div>
                <select 
                  value={riderLocFilter} 
                  onChange={(e) => setRiderLocFilter(e.target.value)}
                  className="bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-md border border-slate-700 outline-none text-xs cursor-pointer"
                >
                  <option value="YGN">YGN Node Riders</option>
                  <option value="MDY">MDY Node Riders</option>
                </select>
              </div>

              <div className="p-5 flex-1 overflow-y-auto max-h-[400px]">
                {Object.keys(riderSummary).length === 0 ? (
                  <p className="text-slate-400 text-center py-12 font-bold italic">No rider movements recorded for this query.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className={tableTh}>Rider Name</th>
                        <th className={`${tableTh} text-center`}>Ways</th>
                        <th className={`${tableTh} text-right text-slate-600`}>Due (Ks)</th>
                        <th className={`${tableTh} text-right text-blue-600`}>Handed In (Ks)</th>
                        <th className={`${tableTh} text-right text-amber-600`}>Pending (Ks)</th>
                        <th className={`${tableTh} text-center`}>Action</th>
                        <th className={`${tableTh} text-center`}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(riderSummary).map(([rider, data]) => {
                        const isCleared = data.pending === 0 && data.due > 0
                        return (
                          <tr key={rider} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 font-bold text-slate-800">{rider}</td>
                            <td className="py-3 text-center font-mono font-bold text-slate-500">{data.ways}</td>
                            <td className="py-3 text-right font-mono font-black text-slate-700">{data.due.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono font-black text-blue-600">{data.handedIn.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono font-black text-amber-600">{data.pending.toLocaleString()}</td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => handleHandIn(rider)}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded text-xs font-bold transition"
                              >
                                💵 Hand In
                              </button>
                            </td>
                            <td className="py-3 text-center">
                              {isCleared ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-1 rounded-full">
                                  ✓ Cleared
                                </span>
                              ) : data.pending > 0 ? (
                                <span className="text-amber-600 text-xs font-bold">Pending</span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer Grand Totals */}
              <div className="bg-slate-900 text-slate-200 p-4 px-5 border-t border-slate-800 grid grid-cols-6 items-center text-xs font-black tracking-wider uppercase gap-1">
                <span className="col-span-1">Total Node</span>
                <span className="text-center font-mono text-slate-400">{grandRiderWays} W</span>
                <span className="text-right font-mono text-slate-300">{grandRiderDue.toLocaleString()}</span>
                <span className="text-right font-mono text-blue-400">{grandRiderHandedIn.toLocaleString()}</span>
                <span className="text-right font-mono text-amber-400">{grandRiderPending.toLocaleString()}</span>
                <span className="text-center"></span>
              </div>
            </div>

            {/* OS Payout Cards (unchanged) */}
            <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-emerald-600 text-white p-4">
                    <h2 className="font-black uppercase tracking-wider text-xs flex items-center gap-1">🏢 OS Payout (MDY Sender)</h2>
                    <p className="text-xs text-emerald-100/80 font-medium mt-0.5">Origin: MDY ➡️ Destination: MDY</p>
                  </div>
                  <div className="p-5 flex-1 overflow-y-auto max-h-[300px]">
                    {Object.keys(osMDY.senders).length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic font-medium">No MDY OS transactions.</p>
                    ) : (
                      <table className="w-full text-left">
                        <tbody>
                          {Object.entries(osMDY.senders).map(([sender, amt]) => (
                            <tr key={sender} className="border-b border-dashed border-slate-100 last:border-none">
                              <td className="py-2.5 font-bold text-slate-700">{sender}</td>
                              <td className={`py-2.5 text-right font-mono font-black ${amt >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {amt.toLocaleString()} K
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="bg-slate-900 text-slate-300 p-4 text-xs font-bold grid grid-cols-2 border-t border-slate-800">
                    <div className="flex justify-between border-r border-slate-800 pr-2"><span>Total (+)</span> <span className="text-emerald-400 font-mono font-black">{osMDY.posSum.toLocaleString()}</span></div>
                    <div className="flex justify-between pl-2"><span>Total (-)</span> <span className="text-rose-400 font-mono font-black">{Math.abs(osMDY.negSum).toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-violet-600 text-white p-4">
                    <h2 className="font-black uppercase tracking-wider text-xs flex items-center gap-1">✈️ OS Payout (YGN Sender)</h2>
                    <p className="text-xs text-violet-100/80 font-medium mt-0.5">Origin: YGN ➡️ Destination: MDY</p>
                  </div>
                  <div className="p-5 flex-1 overflow-y-auto max-h-[300px]">
                    {Object.keys(osYGN.senders).length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic font-medium">No YGN OS transactions.</p>
                    ) : (
                      <table className="w-full text-left">
                        <tbody>
                          {Object.entries(osYGN.senders).map(([sender, amt]) => (
                            <tr key={sender} className="border-b border-dashed border-slate-100 last:border-none">
                              <td className="py-2.5 font-bold text-slate-700">{sender}</td>
                              <td className={`py-2.5 text-right font-mono font-black ${amt >= 0 ? 'text-violet-600' : 'text-rose-500'}`}>
                                {amt.toLocaleString()} K
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="bg-slate-900 text-slate-300 p-4 text-xs font-bold grid grid-cols-2 border-t border-slate-800">
                    <div className="flex justify-between border-r border-slate-800 pr-2"><span>Total (+)</span> <span className="text-emerald-400 font-mono font-black">{osYGN.posSum.toLocaleString()}</span></div>
                    <div className="flex justify-between pl-2"><span>Total (-)</span> <span className="text-rose-400 font-mono font-black">{Math.abs(osYGN.negSum).toLocaleString()}</span></div>
                  </div>
                </div>
            </div>
        </div>

        {/* --- DETAILED DATA TABLE (unchanged) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-4 px-5 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-black text-slate-800 uppercase tracking-wider text-xs">Detailed Records Verification</h2>
            <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-mono font-black">
              {reportData.length} Vouchers Loaded
            </span>
          </div>
          
          <div className="overflow-x-auto max-h-[45vh]">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-100/80 sticky top-0 shadow-sm z-10 backdrop-blur-md">
                <tr className="text-slate-500 font-bold uppercase border-b border-slate-200 text-xs">
                  <th className="p-3.5">Item ID</th>
                  <th className="p-3.5">Sender / LOC</th>
                  <th className="p-3.5">Receiver / R.LOC</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Deli Date</th>
                  <th className="p-3.5 text-center">Cash Added</th>
                  <th className="p-3.5">Deliver Rider</th>
                  <th className="p-3.5 text-right">Deli Fee</th>
                  <th className="p-3.5 text-right">COD</th>
                  <th className="p-3.5 text-right pr-5">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={10} className="p-12 text-center font-bold text-slate-400 italic">Synchronizing database tables......</td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-rose-500 font-bold italic">No records found matching this operational date.</td></tr>
                ) : (
                  reportData.map((o) => {
                    const isDeliverMatch = o.deliver_date === selectedDate;
                    const isCashMatch = o.cash_added_date === selectedDate;

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3.5 font-mono font-black text-blue-600">{o.item_id}</td>
                        <td className="p-3.5">
                            <div className="font-bold text-slate-800">{o.sender_name}</div>
                            <div className="text-xs text-slate-400 font-semibold mt-0.5">{o.sender_loc}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{o.receiver_name}</div>
                          <div className="text-xs text-slate-400 font-semibold mt-0.5">{o.receiver_loc}</div>
                        </td>
                        <td className="p-3.5 text-center"><span className="px-2.5 py-1 bg-slate-100 rounded-md font-bold text-xs uppercase text-slate-600">{o.status}</span></td>
                        <td className={`p-3.5 font-mono font-bold text-center text-sm ${isDeliverMatch ? 'bg-emerald-50 text-emerald-700 border-x border-emerald-100/50' : 'text-slate-400'}`}>
                          {o.deliver_date || '-'}
                        </td>
                        <td className={`p-3.5 font-mono font-bold text-center text-sm ${isCashMatch ? 'bg-blue-50 text-blue-700 border-x border-blue-100/50' : 'text-slate-400'}`}>
                          {o.cash_added_date || '-'}
                        </td>
                        <td className="p-3.5 font-bold text-slate-700">{o.deliver_rider?.name || '-'}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-500">{o.deli_fee?.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-600">{o.cod_amount?.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-mono font-black text-slate-900 bg-slate-50/50 pr-5">{o.total_amount?.toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Handover Modal */}
      {handoverModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-slate-800 uppercase tracking-wider">
                Hand In Cash – {handoverModal.riderName}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Record payment received from rider</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cash (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.cash}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, cash: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">K-Pay (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.kpay}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, kpay: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Wave Pay (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.wave}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, wave: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="0"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600 font-mono">{(handoverAmounts.cash + handoverAmounts.kpay + handoverAmounts.wave).toLocaleString()} Ks</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHandoverModal({ open: false, riderName: '' })}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitHandover}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm Handover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}