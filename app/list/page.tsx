"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 1. Column Definition ထဲတွင် branch ကို ထည့်သွင်းထားပါသည်
const COLUMN_DEFS = [
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
  { key: 'received_date', label: 'Received Date', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: true }, // ပေါ်လာအောင် ထည့်ပေးလိုက်ပါပြီ
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
  { key: 'cash_added_date', label: 'Cash Add Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false },
]

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [userBranch, setUserBranch] = useState<string>('')

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: any } | null>(null)

  // Column Visibility State
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })
  const [showColDropdown, setShowColDropdown] = useState(false)

  // Excel Filter States
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

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

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      fetchData(storedBranch)
    }
  }, [router])

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null)
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  // Filtering Logic
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

  // 2. Cells Generator (Branch အတွက် Badge အလှဆင်ထားသော Logic ပါဝင်ပါသည်)
  const renderCell = (o: any, key: string) => {
    if (key === 'branch') return (
      <span className={`px-2 py-0.5 rounded border text-[10px] font-black tracking-wider ${
        o.branch === 'MDY' 
          ? 'bg-orange-50 text-orange-700 border-orange-200/60' 
          : o.branch === 'YGN' 
          ? 'bg-purple-50 text-purple-700 border-purple-200/60' 
          : 'bg-slate-50 text-slate-600 border-slate-200'
      }`}>
        {o.branch === 'MDY' ? 'MANDALAY' : o.branch === 'YGN' ? 'YANGON' : o.branch}
      </span>
    )
    if (key === 'status') return (
      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
        o.status === 'Delivered' ? 'bg-green-50 text-green-700' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700' : 
        o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
      }`}>{o.status}</span>
    )
    if (['cod_amount', 'deli_fee', 'total_amount'].includes(key)) return <span className={key === 'total_amount' ? 'font-bold text-gray-900' : ''}>{o[key]?.toLocaleString() || '-'}</span>
    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600">{o[key] || '-'}</span>
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>
    if (key === 'created_at') return <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString()}</span>
    
    return o[key] || '-'
  }

  const filterInputCls = "w-full bg-transparent border-b border-gray-200 focus:border-blue-500 focus:outline-none py-1 text-xs text-gray-700 placeholder:text-gray-300 font-medium transition-colors"
  const modalInputStyle = "w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"

  return (
    <div className="w-full h-full flex flex-col bg-white font-sans overflow-hidden select-none">
      
      {/* --- Top Action Bar --- */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0 bg-white">
        <div>
          <h1 className="text-lg font-black text-gray-900 tracking-tight uppercase flex items-center gap-2">
            {userBranch === 'MDY' ? 'Mandalay' : userBranch === 'YGN' ? 'Yangon' : 'Main'} Office
            <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold">LIVE</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1 font-medium">Order Management System (Right-Click row for Actions)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <button 
              onClick={() => setShowColDropdown(!showColDropdown)}
              className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 font-semibold px-3 py-2 rounded-lg shadow-sm transition-all text-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              View Columns
            </button>
            
            {showColDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-2 max-h-96 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Show/Hide Columns</div>
                  {COLUMN_DEFS.map(col => (
                    <label key={col.key} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 font-medium">
                      <input 
                        type="checkbox" 
                        className="mr-3 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
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

          <button onClick={() => fetchData()} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 font-semibold px-3 py-2 rounded-lg shadow-sm transition-all text-xs flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
          <Link href="/entry" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 text-xs">
            <span>+</span> New Entry
          </Link>
        </div>
      </div>

      {/* --- Main Table Area --- */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left whitespace-nowrap text-[13px]">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="text-gray-400 border-b-2 border-gray-100 font-bold uppercase tracking-wider text-[10px]">
              {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                <th key={col.key} className={`py-3 px-4 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>

            <tr className="bg-gray-50/50 border-b border-gray-100 shadow-sm">
              {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                <th key={`filter-${col.key}`} className="px-3 py-2 font-normal">
                  <input 
                    className={filterInputCls} 
                    placeholder="Search..." 
                    value={colFilters[col.key] || ''}
                    onChange={e => handleFilterChange(col.key, e.target.value)} 
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={COLUMN_DEFS.length} className="p-16 text-center">
                  <div className="inline-flex items-center gap-3 text-gray-400 font-medium text-sm">
                    <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                    Loading Records...
                  </div>
                </td>
              </tr>
            ) : filteredOrders.map((o) => (
              <tr 
                key={o.id} 
                onContextMenu={(e) => handleRowContextMenu(e, o)} 
                className="hover:bg-slate-50/80 transition-colors group cursor-context-menu"
              >
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <td key={`${o.id}-${col.key}`} className={`py-3 px-4 text-gray-800 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''}`}>
                    {renderCell(o, col.key)}
                  </td>
                ))}
              </tr>
            ))}
            
            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={COLUMN_DEFS.length} className="p-12 text-center text-gray-400 font-medium">
                  မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* --- Minimal Footer --- */}
      <div className="px-5 py-3 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500 flex-shrink-0">
          <div className="flex gap-6">
            <span>Total Orders: <strong className="text-gray-900 text-sm ml-1">{filteredOrders.length}</strong></span>
          </div>
          <div className="flex gap-6 font-medium">
            <span>COD: <strong className="text-gray-900 ml-1">{filteredOrders.reduce((s,o)=>s+(o.cod_amount||0),0).toLocaleString()}</strong></span>
            <span>Deli: <strong className="text-blue-600 ml-1">{filteredOrders.reduce((s,o)=>s+(o.deli_fee||0),0).toLocaleString()}</strong></span>
          </div>
      </div>

      {/* --- Premium Right-Click Context Menu --- */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
            ID: {contextMenu.order.item_id}
          </div>
          <button 
            onClick={() => { setEditingOrder(contextMenu.order); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-semibold flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit Record
          </button>
          <button 
            onClick={() => { handleDeleteOrder(contextMenu.order.id); setContextMenu(null); }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 border-t border-gray-50"
          >
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete Record
          </button>
        </div>
      )}

      {/* --- Edit Modal --- */}
      {editingOrder && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] ring-1 ring-black/5">
                
                <div className="flex justify-between items-center pb-5 mb-6 border-b border-gray-100">
                    <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight">Update Order</h2>
                      <p className="text-gray-400 text-sm mt-1">Item ID: <span className="font-mono text-gray-700">{editingOrder.item_id}</span></p>
                    </div>
                    <button onClick={() => setEditingOrder(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <form className="grid grid-cols-1 md:grid-cols-4 gap-x-5 gap-y-5 text-sm" onSubmit={handleUpdate}>
                    <div>
                      <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Received Date</label>
                      <input type="date" className={modalInputStyle} value={editingOrder.received_date || ''} onChange={e => setEditingOrder({...editingOrder, received_date: e.target.value})}/>
                    </div>
                    {/* Modal ထဲတွင်ပါ Branch ကို စစ်ဆေး/ပြင်ဆင်နိုင်ရန် ထည့်သွင်းထားပါသည် */}
                    <div>
                      <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Branch</label>
                      <select className={modalInputStyle} value={editingOrder.branch || ''} onChange={e => setEditingOrder({...editingOrder, branch: e.target.value})}>
                        <option value="MDY">MANDALAY (MDY)</option>
                        <option value="YGN">YANGON (YGN)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Status</label>
                      <select className={modalInputStyle} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                            <option value="At Office">At Office</option>
                            <option value="Pending">Pending</option>
                            <option value="In-Transit">In-Transit</option>
                            <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Fee Type</label>
                      <input className={modalInputStyle} value={editingOrder.fee_type || ''} onChange={e => setEditingOrder({...editingOrder, fee_type: e.target.value})}/>
                    </div>

                    <div className="border-t border-gray-100 pt-5 md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Sender Name</label>
                        <input className={modalInputStyle} value={editingOrder.sender_name || ''} onChange={e => setEditingOrder({...editingOrder, sender_name: e.target.value})}/>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Sender City</label>
                        <input className={modalInputStyle} value={editingOrder.sender_loc || ''} onChange={e => setEditingOrder({...editingOrder, sender_loc: e.target.value})}/>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-5 md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Receiver Name</label>
                        <input className={modalInputStyle} value={editingOrder.receiver_name || ''} onChange={e => setEditingOrder({...editingOrder, receiver_name: e.target.value})}/>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Receiver Phone</label>
                        <input className={modalInputStyle} value={editingOrder.receiver_phone || ''} onChange={e => setEditingOrder({...editingOrder, receiver_phone: e.target.value})}/>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Receiver City</label>
                        <input className={modalInputStyle} value={editingOrder.receiver_loc || ''} onChange={e => setEditingOrder({...editingOrder, receiver_loc: e.target.value})}/>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Full Delivery Address</label>
                        <textarea rows={2} className={modalInputStyle} value={editingOrder.receiver_address || ''} onChange={e => setEditingOrder({...editingOrder, receiver_address: e.target.value})}/>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-5 md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-4 rounded-xl">
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">COD Amount</label>
                        <input type="number" className={modalInputStyle} value={editingOrder.cod_amount || 0} onChange={e => setEditingOrder({...editingOrder, cod_amount: Number(e.target.value)})}/>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Deli Fee</label>
                        <input type="number" className={modalInputStyle} value={editingOrder.deli_fee || 0} onChange={e => setEditingOrder({...editingOrder, deli_fee: Number(e.target.value)})}/>
                      </div>
                      <div>
                        <label className="block text-blue-600 font-bold text-xs mb-1.5 uppercase tracking-wider">Total Amount</label>
                        <input type="number" className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-lg font-black focus:outline-none" value={editingOrder.total_amount || 0} onChange={e => setEditingOrder({...editingOrder, total_amount: Number(e.target.value)})}/>
                      </div>
                    </div>

                    <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Cash Added Date</label>
                        <input type="date" className={modalInputStyle} value={editingOrder.cash_added_date || ''} onChange={e => setEditingOrder({...editingOrder, cash_added_date: e.target.value})}/>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold text-xs mb-1.5 uppercase tracking-wider">Note / Remarks</label>
                        <input className={modalInputStyle} value={editingOrder.note || ''} onChange={e => setEditingOrder({...editingOrder, note: e.target.value})}/>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end mt-4 pt-4 border-t border-gray-100">
                      <button type="button" onClick={() => setEditingOrder(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors mr-3">
                        Cancel
                      </button>
                      <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all">
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