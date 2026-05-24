"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const COLUMN_DEFS = [
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
  { key: 'received_date', label: 'Received Date', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: true },
  { key: 'sender_name', label: 'Sender', defaultVisible: true },
  { key: 'sender_loc', label: 'S. City', defaultVisible: true },
  { key: 'receiver_name', label: 'Receiver', defaultVisible: true },
  { key: 'receiver_phone', label: 'Phone', defaultVisible: true },
  { key: 'receiver_loc', label: 'R. City', defaultVisible: true },
  { key: 'receiver_address', label: 'Full Address', defaultVisible: false },
  { key: 'fee_type', label: 'Type', defaultVisible: true },
  { key: 'cod_amount', label: 'COD (Ks)', defaultVisible: true },
  { key: 'deli_fee', label: 'Deli Fee (Ks)', defaultVisible: true },
  { key: 'total_amount', label: 'Total (Ks)', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: true },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: true },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: false },
  { key: 'cash_added_date', label: 'Cash Add Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false },
]

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [userBranch, setUserBranch] = useState<string>('')

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: any } | null>(null)

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })
  const [showColDropdown, setShowColDropdown] = useState(false)

  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // ── Windows 10 style input classes ──
  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"

  const fetchData = async (branchCode?: string) => {
    const activeBranch = branchCode || userBranch;
    if (!activeBranch) return;

    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_rider:riders!orders_pickup_rider_id_fkey(name),
        deliver_rider:riders!orders_deliver_rider_id_fkey(name)
      `)
      .eq('branch', activeBranch)
      .order('created_at', { ascending: false })

    if (error) console.error(error)
    else setOrders(data || [])
    setLoading(false)
  }

  const fetchRiders = async () => {
    const { data, error } = await supabase.from('riders').select('*')
    if (data) setRiders(data)
  }

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      fetchData(storedBranch)
      fetchRiders()
    }
  }, [router])

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null)
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  const filteredOrders = orders.filter(o => {
    return Object.keys(colFilters).every(key => {
      const filterValue = colFilters[key]?.toLowerCase()
      if (!filterValue) return true
      let cellValue = ""
      if (key === 'pickup_rider') cellValue = o.pickup_rider?.name || ""
      else if (key === 'deliver_rider') cellValue = o.deliver_rider?.name || ""
      else cellValue = String(o[key] || "")
      return cellValue.toLowerCase().includes(filterValue)
    })
  })

  const handleFilterChange = (col: string, val: string) => {
    setColFilters(prev => ({ ...prev, [col]: val }))
  }

  const toggleColumn = (colKey: string) => {
    setVisibleCols(prev => ({ ...prev, [colKey]: !prev[colKey] }))
  }

  const handleRowContextMenu = (e: React.MouseEvent, order: any) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      order: order
    })
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm("ဒီမှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား?")) {
      const { error } = await supabase.from('orders').delete().eq('id', orderId)
      if (error) alert(error.message)
      else fetchData()
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { pickup_rider, deliver_rider, ...updateData } = editingOrder;

    if (updateData.pickup_rider_id === "") updateData.pickup_rider_id = null;
    if (updateData.deliver_rider_id === "") updateData.deliver_rider_id = null;

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', editingOrder.id);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("အချက်အလက်များကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ!");
      setEditingOrder(null);
      fetchData();
    }
  }

  const renderCell = (o: any, key: string) => {
    if (key === 'branch') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
        o.branch === 'MDY' 
          ? 'bg-orange-50 text-orange-700 border-orange-200' 
          : o.branch === 'YGN' 
          ? 'bg-purple-50 text-purple-700 border-purple-200' 
          : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}>
        {o.branch === 'MDY' ? 'MANDALAY' : o.branch === 'YGN' ? 'YANGON' : o.branch}
      </span>
    )
    if (key === 'status') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
        o.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
        o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}>{o.status}</span>
    )
    if (['cod_amount', 'deli_fee', 'total_amount'].includes(key)) return (
      <span className={key === 'total_amount' ? 'font-bold text-gray-900' : ''}>
        {o[key]?.toLocaleString() || '-'}
      </span>
    )
    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 border border-gray-200">{o[key] || '-'}</span>
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>
    if (key === 'created_at') return <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString()}</span>
    return o[key] || '-'
  }

  const filterInputCls = "w-full bg-transparent border-b border-gray-300 focus:border-orange-500 focus:outline-none py-1 text-[11px] text-gray-700 placeholder:text-gray-400 font-medium transition-colors"

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] overflow-hidden select-none">
      
      {/* ── Windows 10 Title Bar ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase">
              {userBranch === 'MDY' ? 'Mandalay' : userBranch === 'YGN' ? 'Yangon' : 'Main'} Office
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">Order Management · Right-click row for actions</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Columns toggle */}
          <div className="relative">
            <button 
              onClick={() => setShowColDropdown(!showColDropdown)}
              className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Columns
            </button>
            
            {showColDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)} />
                <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Show/Hide Columns</div>
                  {COLUMN_DEFS.map(col => (
                    <label key={col.key} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700 font-medium">
                      <input 
                        type="checkbox" 
                        className="mr-2.5 w-3.5 h-3.5 text-orange-500 rounded border-gray-300 focus:ring-orange-400"
                        checked={visibleCols[col.key]} 
                        onChange={() => toggleColumn(col.key)}
                        disabled={col.key === 'item_id'} 
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Refresh */}
          <button onClick={() => fetchData()} className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>

          {/* New Entry */}
          <Link href="/entry" className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1.5 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Entry
          </Link>
        </div>
      </div>

      {/* ── Table Area ── */}
      <div className="flex-1 overflow-auto bg-white mx-3 sm:mx-5 my-3 rounded-lg border border-gray-200 shadow-sm">
        {/* Mobile: horizontal scroll wrapper */}
        <div className="min-w-[800px] lg:min-w-0">
          <table className="w-full text-left whitespace-nowrap text-[12px]">
            {/* Header Row */}
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="text-gray-400 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={col.key} className={`py-2.5 px-3 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>

              {/* Filter Row */}
              <tr className="bg-gray-50/80 border-b border-gray-200">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={`filter-${col.key}`} className="px-2 py-1.5 font-normal">
                    <input 
                      className={filterInputCls} 
                      placeholder="Filter..." 
                      value={colFilters[col.key] || ''}
                      onChange={e => handleFilterChange(col.key, e.target.value)} 
                    />
                  </th>
                ))}
              </tr>
            </thead>

            {/* Data Rows */}
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_DEFS.length} className="p-20 text-center">
                    <div className="inline-flex items-center gap-3 text-gray-400 font-medium text-sm">
                      <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      Loading Records...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.map((o) => (
                <tr 
                  key={o.id} 
                  onContextMenu={(e) => handleRowContextMenu(e, o)} 
                  className="hover:bg-gray-50/80 transition-colors cursor-context-menu"
                >
                  {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                    <td key={`${o.id}-${col.key}`} className={`py-2.5 px-3 text-gray-700 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''}`}>
                      {renderCell(o, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_DEFS.length} className="p-16 text-center text-gray-400 font-medium">
                    မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* ── Status Bar ── */}
      <div className="px-4 py-2.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between text-[11px] text-gray-500 flex-shrink-0">
          <div className="flex gap-5">
            <span>Total: <strong className="text-gray-900 ml-1">{filteredOrders.length}</strong></span>
          </div>
          <div className="flex gap-5 font-medium">
            <span>COD: <strong className="text-gray-900 ml-1">{filteredOrders.reduce((s,o)=>s+(o.cod_amount||0),0).toLocaleString()} Ks</strong></span>
            <span>Deli: <strong className="text-orange-600 ml-1">{filteredOrders.reduce((s,o)=>s+(o.deli_fee||0),0).toLocaleString()} Ks</strong></span>
          </div>
      </div>

      {/* ── Windows 10 Style Context Menu ── */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            ID: {contextMenu.order.item_id}
          </div>
          <button 
            onClick={() => { setEditingOrder(contextMenu.order); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit Record
          </button>
          <button 
            onClick={() => { handleDeleteOrder(contextMenu.order.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100"
          >
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete Record
          </button>
        </div>
      )}

      {/* ── Edit Modal (Windows 10 Dialog Style) ── */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Update Order</h2>
                      <p className="text-[11px] text-gray-500 mt-0.5">Item ID: <span className="font-mono text-gray-700">{editingOrder.item_id}</span></p>
                    </div>
                    <button onClick={() => setEditingOrder(null)} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                {/* Modal Body */}
                <form className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm" onSubmit={handleUpdate}>
                    <div>
                      <label className={labelStyle}>Received Date</label>
                      <input type="date" className={winInput} value={editingOrder.received_date || ''} onChange={e => setEditingOrder({...editingOrder, received_date: e.target.value})}/>
                    </div>
                    <div>
                      <label className={labelStyle}>Branch</label>
                      <select className={winSelect} value={editingOrder.branch || ''} onChange={e => setEditingOrder({...editingOrder, branch: e.target.value})}>
                        <option value="MDY">MANDALAY (MDY)</option>
                        <option value="YGN">YANGON (YGN)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Status</label>
                      <select className={winSelect} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                        <option value="At Office">At Office</option>
                        <option value="Pending">Pending</option>
                        <option value="In-Transit">In-Transit</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Pick Up Rider</label>
                      <select className={winSelect} value={editingOrder.pickup_rider_id || ''} onChange={e => setEditingOrder({...editingOrder, pickup_rider_id: e.target.value})}>
                        <option value="">Select...</option>
                        {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                      <div>
                        <label className={labelStyle}>Sender Name</label>
                        <input className={winInput} value={editingOrder.sender_name || ''} onChange={e => setEditingOrder({...editingOrder, sender_name: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Sender City</label>
                        <select className={winSelect} value={editingOrder.sender_loc || ''} onChange={e => setEditingOrder({...editingOrder, sender_loc: e.target.value})}>
                          <option value="MDY">MANDALAY</option>
                          <option value="YGN">YANGON</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                      <div>
                        <label className={labelStyle}>Receiver Name</label>
                        <input className={winInput} value={editingOrder.receiver_name || ''} onChange={e => setEditingOrder({...editingOrder, receiver_name: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Receiver Phone</label>
                        <input className={winInput} value={editingOrder.receiver_phone || ''} onChange={e => setEditingOrder({...editingOrder, receiver_phone: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Destination City</label>
                        <select className={winSelect} value={editingOrder.receiver_loc || ''} onChange={e => setEditingOrder({...editingOrder, receiver_loc: e.target.value})}>
                          <option value="MDY">Mandalay (MDY)</option>
                          <option value="YGN">Yangon (YGN)</option>
                          <option value="NPT">Nay Pyi Taw (NPT)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelStyle}>Full Delivery Address</label>
                        <textarea rows={2} className={winInput} value={editingOrder.receiver_address || ''} onChange={e => setEditingOrder({...editingOrder, receiver_address: e.target.value})}/>
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100 bg-gray-50/50 -mx-6 px-6 py-4">
                      <div>
                        <label className={labelStyle}>Payment Type</label>
                        <select className={winSelect} value={editingOrder.fee_type || ''} onChange={e => setEditingOrder({...editingOrder, fee_type: e.target.value})}>
                          <option value="Deli">Deli (+)</option>
                          <option value="Kpay">Kpay (Prepaid)</option>
                          <option value="Cash">Cash (Prepaid)</option>
                          <option value="Bill">Bill (-)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>COD Amount</label>
                        <input type="number" className={winInput} value={editingOrder.cod_amount || 0} onChange={e => setEditingOrder({...editingOrder, cod_amount: Number(e.target.value)})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Deli Fee</label>
                        <input type="number" className={winInput} value={editingOrder.deli_fee || 0} onChange={e => setEditingOrder({...editingOrder, deli_fee: Number(e.target.value)})}/>
                      </div>
                      <div>
                        <label className="block text-orange-600 font-semibold mb-1 uppercase text-[11px] tracking-wide">Total Amount</label>
                        <input type="number" className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-md text-orange-800 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-100" value={editingOrder.total_amount || 0} onChange={e => setEditingOrder({...editingOrder, total_amount: Number(e.target.value)})}/>
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
                      <div>
                        <label className={labelStyle}>Deliver Rider</label>
                        <select className={winSelect} value={editingOrder.deliver_rider_id || ''} onChange={e => setEditingOrder({...editingOrder, deliver_rider_id: e.target.value})}>
                          <option value="">Select...</option>
                          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>Deliver Date</label>
                        <input type="date" className={winInput} value={editingOrder.deliver_date || ''} onChange={e => setEditingOrder({...editingOrder, deliver_date: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Cash Added Date</label>
                        <input type="date" className={winInput} value={editingOrder.cash_added_date || ''} onChange={e => setEditingOrder({...editingOrder, cash_added_date: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelStyle}>Note / Remarks</label>
                        <select className={winSelect} value={editingOrder.note || ''} onChange={e => setEditingOrder({...editingOrder, note: e.target.value})}>
                          <option value="">Normal Delivery</option>
                          <option value="RT">Return Item (RT)</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button type="button" onClick={() => setEditingOrder(null)} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors border border-gray-200">
                        Cancel
                      </button>
                      <button type="submit" className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-md shadow-sm transition-all">
                        Save Changes
                      </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}