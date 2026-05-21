"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [userBranch, setUserBranch] = useState<string>('')

  // Excel Filter States
  const [colFilters, setColFilters] = useState({
    item_id: '',
    received_date: '',
    sender_name: '',
    sender_loc: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_loc: '',
    fee_type: '',
    status: '',
    pickup_rider: '',
    deliver_rider: '',
    cash_added_date: ''
  })

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

  const filteredOrders = orders.filter(o => {
    return Object.keys(colFilters).every(key => {
      const filterValue = colFilters[key as keyof typeof colFilters].toLowerCase()
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

  // Clean Light Mode Inputs
  const filterInput = "w-full px-2 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-gray-700 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400 font-medium"
  const modalInputStyle = "w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"

  return (
    // Fullscreen Layout without outer margins
    <div className="w-full h-full flex flex-col bg-white text-gray-800 font-sans antialiased overflow-hidden">
      
      {/* Clean Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-base font-bold text-gray-900 tracking-wide uppercase">
              {userBranch === 'MDY' ? 'Mandalay' : userBranch === 'YGN' ? 'Yangon' : 'Main'} Office
            </h1>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">Order Management System</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link href="/entry" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 text-xs">
            <span>+</span> New Entry
          </Link>
          <button onClick={() => fetchData()} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold px-3 py-2 rounded-lg shadow-sm transition-all text-xs flex items-center gap-1.5">
            <span>↻</span> Refresh
          </button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold px-3 py-2 rounded-lg shadow-sm transition-all text-xs flex items-center gap-1.5 sm:ml-2">
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Table Container - Stretched to fill space with optimized padding for 16 columns */}
      <div className="flex-1 overflow-auto bg-gray-50/50">
        <table className="w-full text-left whitespace-nowrap text-[11px] md:text-xs">
          <thead className="sticky top-0 z-20">
            {/* Main Headers */}
            <tr className="bg-gray-100 text-gray-600 border-b border-gray-300 font-bold uppercase tracking-wider">
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-center w-[70px]">Action</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Item ID</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Date</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Sender</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-center">S.Loc</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Receiver</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Phone</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-center">R.Loc</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-center">Type</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-right">COD</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-right">Deli Fee</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-right bg-blue-50/50 text-blue-800">Total</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50 text-center">Status</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Pickup By</th>
              <th className="py-2.5 px-2 border-r border-gray-300/50">Deliver By</th>
              <th className="py-2.5 px-2">Cash Add</th>
            </tr>

            {/* Filter Inputs Row */}
            <tr className="bg-gray-200/60 border-b border-gray-300 shadow-sm">
              <th className="p-1.5 border-r border-gray-300/50 text-center text-gray-500">🔍</th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="ID..." onChange={e => handleFilterChange('item_id', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} type="date" onChange={e => handleFilterChange('received_date', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="Name..." onChange={e => handleFilterChange('sender_name', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="City" onChange={e => handleFilterChange('sender_loc', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="Name..." onChange={e => handleFilterChange('receiver_name', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="09..." onChange={e => handleFilterChange('receiver_phone', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="City" onChange={e => handleFilterChange('receiver_loc', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="Type" onChange={e => handleFilterChange('fee_type', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"></th>
              <th className="p-1.5 border-r border-gray-300/50"></th>
              <th className="p-1.5 border-r border-gray-300/50 bg-blue-50/30"></th>
              <th className="p-1.5 border-r border-gray-300/50">
                  <select className={`${filterInput} bg-white cursor-pointer`} onChange={e => handleFilterChange('status', e.target.value)}>
                      <option value="">All</option>
                      <option value="At Office">At Office</option>
                      <option value="Pending">Pending</option>
                      <option value="In-Transit">In-Transit</option>
                      <option value="Delivered">Delivered</option>
                  </select>
              </th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="Rider..." onChange={e => handleFilterChange('pickup_rider', e.target.value)} /></th>
              <th className="p-1.5 border-r border-gray-300/50"><input className={filterInput} placeholder="Rider..." onChange={e => handleFilterChange('deliver_rider', e.target.value)} /></th>
              <th className="p-1.5"><input className={filterInput} type="date" onChange={e => handleFilterChange('cash_added_date', e.target.value)} /></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={16} className="p-12 text-center font-medium text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    Loading Records...
                  </div>
                </td>
              </tr>
            ) : filteredOrders.map((o) => (
              <tr key={o.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="py-2 px-2 border-r border-gray-100 text-center">
                  <div className="flex gap-1 justify-center">
                      <button onClick={() => setEditingOrder(o)} className="text-blue-600 hover:bg-blue-100 px-1.5 py-1 rounded transition-colors font-medium text-[10px]">Edit</button>
                      <button onClick={() => { if(confirm("ဖျက်ရန် သေချာပါသလား?")) supabase.from('orders').delete().eq('id', o.id).then(() => fetchData()) }} className="text-red-500 hover:bg-red-50 px-1.5 py-1 rounded transition-colors font-medium text-[10px]">Del</button>
                  </div>
                </td>
                <td className="py-2 px-2 border-r border-gray-100 font-medium text-gray-900">{o.item_id}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-gray-500">{o.received_date}</td>
                <td className="py-2 px-2 border-r border-gray-100 font-medium">{o.sender_name}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-center text-gray-600">{o.sender_loc}</td>
                <td className="py-2 px-2 border-r border-gray-100 font-medium">{o.receiver_name}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-gray-600">{o.receiver_phone}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-center font-semibold text-gray-800">{o.receiver_loc}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-center">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-semibold text-gray-600">{o.fee_type}</span>
                </td>
                <td className="py-2 px-2 border-r border-gray-100 text-right font-medium">{o.cod_amount?.toLocaleString() || '-'}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-right font-medium text-gray-600">{o.deli_fee?.toLocaleString() || '-'}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-right font-bold text-blue-700 bg-blue-50/30">{o.total_amount?.toLocaleString() || '-'}</td>
                
                {/* Status Badges */}
                <td className="py-2 px-2 border-r border-gray-100 text-center">
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                      o.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 
                      o.status === 'In-Transit' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {o.status}
                  </span>
                </td>
                
                <td className="py-2 px-2 border-r border-gray-100 text-gray-600">{o.pickup_rider?.name || '-'}</td>
                <td className="py-2 px-2 border-r border-gray-100 text-gray-600">{o.deliver_rider?.name || '-'}</td>
                <td className="py-2 px-2 text-gray-600 font-medium">{o.cash_added_date || '-'}</td>
              </tr>
            ))}
            
            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={16} className="p-12 text-center text-gray-500 text-sm bg-gray-50/50">
                  မှတ်တမ်းများ မရှိသေးပါ။
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer Aggregates */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600 flex-shrink-0">
          <span>Total Records: <strong className="text-gray-900 ml-1 text-sm">{filteredOrders.length}</strong></span>
          <div className="w-px h-4 bg-gray-300 hidden sm:block" />
          <span>Total COD: <strong className="text-gray-900 ml-1 text-sm">{filteredOrders.reduce((s,o)=>s+(o.cod_amount||0),0).toLocaleString()}</strong> Ks</span>
          <div className="w-px h-4 bg-gray-300 hidden sm:block" />
          <span>Total Deli Fee: <strong className="text-blue-700 ml-1 text-sm">{filteredOrders.reduce((s,o)=>s+(o.deli_fee||0),0).toLocaleString()}</strong> Ks</span>
      </div>

      {/* Clean Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                
                <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        Edit Order: <span className="text-blue-600">{editingOrder.item_id}</span>
                      </h2>
                    </div>
                    <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>
                
                <form className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" onSubmit={handleUpdate}>
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Item ID</label>
                      <input disabled className="w-full px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed" value={editingOrder.item_id}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Received Date</label>
                      <input type="date" className={modalInputStyle} value={editingOrder.received_date} onChange={e => setEditingOrder({...editingOrder, received_date: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Order Status</label>
                      <select className={modalInputStyle} value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                            <option value="At Office">At Office</option>
                            <option value="Pending">Pending</option>
                            <option value="In-Transit">In-Transit</option>
                            <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Sender Name</label>
                      <input className={modalInputStyle} value={editingOrder.sender_name} onChange={e => setEditingOrder({...editingOrder, sender_name: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Sender City</label>
                      <input className={modalInputStyle} value={editingOrder.sender_loc} onChange={e => setEditingOrder({...editingOrder, sender_loc: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Receiver Name</label>
                      <input className={modalInputStyle} value={editingOrder.receiver_name} onChange={e => setEditingOrder({...editingOrder, receiver_name: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Receiver Phone</label>
                      <input className={modalInputStyle} value={editingOrder.receiver_phone} onChange={e => setEditingOrder({...editingOrder, receiver_phone: e.target.value})}/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 font-semibold mb-1">Full Delivery Address</label>
                      <input className={modalInputStyle} value={editingOrder.receiver_address || ''} onChange={e => setEditingOrder({...editingOrder, receiver_address: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">COD Amount (Ks)</label>
                      <input type="number" className={modalInputStyle} value={editingOrder.cod_amount} onChange={e => setEditingOrder({...editingOrder, cod_amount: Number(e.target.value)})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Deli Fee (Ks)</label>
                      <input type="number" className={modalInputStyle} value={editingOrder.deli_fee} onChange={e => setEditingOrder({...editingOrder, deli_fee: Number(e.target.value)})}/>
                    </div>
                    <div>
                      <label className="block text-blue-700 font-semibold mb-1">Total Amount</label>
                      <input type="number" className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-bold focus:outline-none" value={editingOrder.total_amount} onChange={e => setEditingOrder({...editingOrder, total_amount: Number(e.target.value)})}/>
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Cash Added Date</label>
                      <input type="date" className={modalInputStyle} value={editingOrder.cash_added_date || ''} onChange={e => setEditingOrder({...editingOrder, cash_added_date: e.target.value})}/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-700 font-semibold mb-1">Note / Remarks</label>
                      <input className={modalInputStyle} value={editingOrder.note || ''} onChange={e => setEditingOrder({...editingOrder, note: e.target.value})}/>
                    </div>
                    <button type="submit" className="md:col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow mt-3 transition-all text-sm">
                      Save Changes
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}