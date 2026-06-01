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
  { key: 'image_url', label: 'Photo', defaultVisible: true }, 
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: true },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: true },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: false },
  { key: 'cash_added_date', label: 'Cash Add Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false },
]

const extractPublicId = (url: string) => {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const rightPart = parts[1];
    const pathParts = rightPart.split('/');
    if (pathParts[0].startsWith('v')) {
      pathParts.shift(); 
    }
    return pathParts.join('/').split('.')[0]; 
  } catch (error) {
    return null;
  }
}

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [userBranch, setUserBranch] = useState<string>('')

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: any } | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null) 
  const [viewingHistoryOrder, setViewingHistoryOrder] = useState<any | null>(null)
  const [viewingDetailOrder, setViewingDetailOrder] = useState<any | null>(null);

  const [imgScale, setImgScale] = useState<number>(1)
  const [imgRotation, setImgRotation] = useState<number>(0)

  useEffect(() => {
    if (!previewImage) {
      setImgScale(1)
      setImgRotation(0)
    }
  }, [previewImage])

  const appendLog = (currentHistory: any[], action: string, note: string) => {
    const operator = userBranch || localStorage.getItem('user_branch') || 'Unknown Office';
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: action,      
      operator: operator,  
      note: note           
    };
    return [...(currentHistory || []), newLogEntry];
  };

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })
  const [showColDropdown, setShowColDropdown] = useState(false)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

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
      .eq('is_deleted', false)
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
    // 📱 Mobile Global Search Logics
    if (colFilters['global_search']) {
      const query = colFilters['global_search'].toLowerCase()
      const isMatch = 
        String(o.item_id || '').toLowerCase().includes(query) ||
        String(o.receiver_phone || '').toLowerCase().includes(query) ||
        String(o.receiver_name || '').toLowerCase().includes(query) ||
        String(o.sender_name || '').toLowerCase().includes(query)
      if (!isMatch) return false
    }

    // 💻 Desktop Grid Filter Logics
    return Object.keys(colFilters).every(key => {
      if (key === 'global_search') return true
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

  const handleRowContextMenu = (e: React.MouseEvent | any, order: any) => {
    if (e.preventDefault) e.preventDefault()

    // Mobile ဖုန်းဖြစ်ပါက (Coordinates) မလိုအပ်ဘဲ တိုက်ရိုက် Bottom Sheet ဖွင့်ရန်
    if (window.innerWidth < 640) {
      setContextMenu({ x: 0, y: 0, order })
      return
    }

    const menuWidth = 160  
    const menuHeight = 160 

    let x = e.clientX
    let y = e.clientY

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }

    setContextMenu({ x, y, order })
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm("ဒီမှတ်တမ်းကို အမှိုက်ပုံး (Recently Deleted) ထဲသို့ ထည့်ရန် သေချာပါသလား?")) {
      const { error } = await supabase
        .from('orders')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', orderId)

      if (error) alert(error.message)
      else fetchData() 
    }
  }

  const handleRemoveImageOnly = async (order: any) => {
    if (!order.image_url) return;
    if (confirm("ဒီပါဆယ်မှတ်တမ်းရဲ့ ပုံကိုပဲ သီးသန့် အပြီးဖျက်ရန် သေချာပါသလား?")) {
      setLoading(true);
      const publicId = extractPublicId(order.image_url);
      
      if (publicId) {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId })
        });
      }

      const { error } = await supabase
        .from('orders')
        .update({ image_url: null })
        .eq('id', order.id);

      if (error) {
        alert(error.message);
      } else {
        alert("ပုံကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။");
        setEditingOrder({ ...editingOrder, image_url: null });
        fetchData();
      }
      setLoading(false);
    }
  }

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingOrder) return;

    if (confirm("ပုံဟောင်းကို ဖျက်ပြီး ပုံအသစ်နှင့် လဲလှယ်ရန် သေချာပါသလား?")) {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'for_allinone'); 

        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const uploadedData = await res.json();
        if (uploadedData.error) throw new Error(uploadedData.error.message);

        const newImageUrl = uploadedData.secure_url;

        if (editingOrder.image_url) {
          const oldPublicId = extractPublicId(editingOrder.image_url);
          if (oldPublicId) {
            await fetch('/api/cloudinary/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicId: oldPublicId })
            });
          }
        }

        const { error } = await supabase
          .from('orders')
          .update({ image_url: newImageUrl })
          .eq('id', editingOrder.id);

        if (error) throw error;

        setEditingOrder({ ...editingOrder, image_url: newImageUrl });
        alert("ပုံအသစ်ကို အောင်မြင်စွာ လဲလှယ်ပြီးပါပြီ။");
        fetchData();
      } catch (err: any) {
        alert("Error: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { pickup_rider, deliver_rider, ...updateData } = editingOrder;

    if (updateData.pickup_rider_id === "") updateData.pickup_rider_id = null;
    if (updateData.deliver_rider_id === "") updateData.deliver_rider_id = null;

    let changes: string[] = [];
    
    if (contextMenu?.order?.status !== editingOrder.status) {
      changes.push(`Status ကို "${contextMenu?.order?.status || 'At Office'}" မှ "${editingOrder.status}" သို့ ပြောင်းလဲခဲ့သည်`);
    }
    
    if (contextMenu?.order?.deliver_rider_id !== editingOrder.deliver_rider_id) {
      const selectedRider = riders.find(r => r.id === editingOrder.deliver_rider_id);
      changes.push(`Rider ကို "${selectedRider ? selectedRider.name : 'ဖြုတ်လိုက်သည်'}" သို့ တာဝန်ပေးခဲ့သည်`);
    }

    if (changes.length === 0) {
      changes.push("ပါဆယ်အချက်အလက်များကို အသေးစိတ် ပြင်ဆင်ခဲ့သည်");
    }

    const logNote = changes.join("၊ ");
    const updatedHistory = appendLog(editingOrder.history, "Order Updated", logNote);

    const { error } = await supabase
      .from('orders')
      .update({
        ...updateData,
        history: updatedHistory 
      })
      .eq('id', editingOrder.id);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("အချက်အလက်များနှင့် လှုပ်ရှားမှုမှတ်တမ်းကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ!");
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
    if (key === 'image_url') return o.image_url ? (
      <div className="flex items-center justify-center">
        <img 
          src={o.image_url} 
          alt="Attachment" 
          onClick={(e) => { e.stopPropagation(); setPreviewImage(o.image_url); }}
          className="w-8 h-8 object-cover rounded border border-gray-200 cursor-pointer hover:scale-110 hover:shadow transition-all"
        />
      </div>
    ) : (
      <span className="text-gray-400 font-mono text-[10px]">-</span>
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
      
      {/* ── Title Bar ── */}
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
            <p className="text-[11px] text-gray-500 font-medium hidden sm:block">Order Management · Right-click row for actions</p>
            <p className="text-[11px] text-gray-500 font-medium sm:hidden">Order Management · Tap 3-dots for actions</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* ── Columns Show/Hide Dropdown ── */}
          <div className="relative">
            <button 
              onClick={() => setShowColDropdown(!showColDropdown)}
              className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Columns
            </button>
            
            {showColDropdown && (
              <>
                <div className="fixed inset-0 bg-black/20 sm:bg-transparent z-40 transition-opacity animate-in fade-in duration-200" onClick={() => setShowColDropdown(false)} />
                <div className="fixed bottom-4 inset-x-4 sm:absolute sm:bottom-auto sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 w-auto sm:w-52 bg-white border border-gray-200 rounded-xl sm:rounded-lg shadow-2xl sm:shadow-xl z-50 py-2.5 max-h-[70vh] sm:max-h-80 overflow-y-auto animate-in slide-in-from-bottom-5 sm:slide-in-from-top-2 duration-200">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 sm:border-none mb-1.5">Show/Hide Columns</div>
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-x-2 gap-y-0.5 px-2 sm:px-0">
                    {COLUMN_DEFS.map(col => (
                      <label key={col.key} className="flex items-center px-2.5 py-2 sm:py-1.5 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-xs text-gray-700 font-medium rounded-md sm:rounded-none transition-colors">
                        <input 
                          type="checkbox" 
                          className="mr-2.5 w-4 h-4 sm:w-3.5 sm:h-3.5 text-orange-500 rounded border-gray-300 accent-orange-500"
                          checked={visibleCols[col.key]} 
                          onChange={() => toggleColumn(col.key)}
                          disabled={col.key === 'item_id'} 
                        />
                        <span className="truncate">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={() => fetchData()} className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>

          <Link href="/entry" className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1.5 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Entry
          </Link>
        </div>
      </div>

      {/* 📱 Mobile Only Quick Filter (ID/Phone Bar) */}
      <div className="sm:hidden px-3 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="🔍 ID၊ ဖုန်း သို့မဟုတ် အမည်ဖြင့် ရှာရန်..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white"
            value={colFilters['global_search'] || ''}
            onChange={e => setColFilters(prev => ({ ...prev, global_search: e.target.value }))}
          />
          <span className="absolute left-2.5 top-2 text-gray-400 text-[10px]" />
        </div>
        {colFilters['global_search'] && (
          <button 
            onClick={() => setColFilters(prev => ({ ...prev, global_search: '' }))}
            className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Container Workspace Area ── */}
      <div className="flex-1 overflow-auto bg-white sm:mx-5 sm:my-3 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
        
        {/* 💻 Desktop Table View (Only visible on screens bigger than Mobile) */}
        <div className="hidden sm:block min-w-[800px] lg:min-w-0">
          <table className="w-full text-left whitespace-nowrap text-[12px]">
            <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(229,231,235,1)]">
              <tr className="text-gray-400 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={col.key} className={`py-2.5 px-3 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''} ${col.key === 'image_url' ? 'text-center' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={`filter-${col.key}`} className="px-2 py-1.5 font-normal">
                    {col.key !== 'image_url' ? (
                      <input 
                        className={filterInputCls} 
                        placeholder="Filter..." 
                        value={colFilters[col.key] || ''}
                        onChange={e => handleFilterChange(col.key, e.target.value)} 
                      />
                    ) : (
                      <div className="h-5" /> 
                    )}
                  </th>
                ))}
              </tr>
            </thead>
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
                  onClick={() => setViewingDetailOrder(o)}
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
            </tbody>
          </table>
        </div>

        {/* 📱 Mobile Optimized Card List (Only visible on Mobile Phones) */}
        <div className="sm:hidden flex flex-col divide-y divide-gray-100 h-full overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2 justify-center">
              <span className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Loading Records...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs font-medium">
              မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
            </div>
          ) : (
            filteredOrders.map((o) => (
              <div 
                key={o.id} 
                onClick={() => setViewingDetailOrder(o)}
                className="bg-white p-3.5 flex flex-col gap-2.5 shadow-sm border-b border-gray-100 active:bg-gray-50/80 transition-colors"
              >
                {/* Card Top Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 text-sm">{o.item_id}</span>
                    {renderCell(o, 'branch')}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {renderCell(o, 'status')}
                    
                    {/* Mobile 3-Dots Action Trigger Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRowContextMenu(e, o); }}
                      className="p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-500 active:bg-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Logistics Route Information */}
                <div className="grid grid-cols-2 gap-2 text-xs border-y border-gray-50 py-2 bg-gray-50/40 rounded-md px-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Sender</span>
                    <span className="font-medium text-gray-800 truncate block">{o.sender_name || '-'} ({o.sender_loc || '-'})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Receiver</span>
                    <span className="font-medium text-gray-800 truncate block">{o.receiver_name || '-'} ({o.receiver_loc || '-'})</span>
                  </div>
                  {o.receiver_phone && (
                    <div className="col-span-2 pt-0.5">
                      <a 
                        href={`tel:${o.receiver_phone}`} 
                        className="text-orange-600 font-semibold inline-flex items-center gap-1 hover:underline text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 {o.receiver_phone} (နှိပ်၍ ဖုန်းခေါ်ရန်)
                      </a>
                    </div>
                  )}
                </div>

                {/* Pricing & Fees Grid */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex gap-4 text-gray-500 text-[11px]">
                    <span>COD: <strong className="text-gray-700">{o.cod_amount?.toLocaleString() || 0} Ks</strong></span>
                    <span>Deli: <strong className="text-gray-700">{o.deli_fee?.toLocaleString() || 0} Ks</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold text-xs">Total: {o.total_amount?.toLocaleString() || 0} Ks</span>
                    {o.image_url && (
                      <img 
                        src={o.image_url} 
                        alt="Parcel" 
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(o.image_url); }}
                        className="w-6 h-6 object-cover rounded border border-gray-200"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && filteredOrders.length === 0 && (
          <div className="hidden sm:block p-16 text-center text-gray-400 font-medium">
            မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
          </div>
        )}
      </div>
      
      {/* ── Status Bar ── */}
      <div className="px-4 py-2.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between text-[11px] text-gray-500 flex-shrink-0 shadow-inner">
          <div className="flex gap-5">
            <span>Total: <strong className="text-gray-900 ml-1">{filteredOrders.length}</strong></span>
          </div>
          <div className="flex gap-4 sm:gap-5 font-medium">
            <span>COD: <strong className="text-gray-900 ml-0.5 sm:ml-1">{filteredOrders.reduce((s,o)=>s+(o.cod_amount||0),0).toLocaleString()} Ks</strong></span>
            <span>Deli: <strong className="text-orange-600 ml-0.5 sm:ml-1">{filteredOrders.reduce((s,o)=>s+(o.deli_fee||0),0).toLocaleString()} Ks</strong></span>
          </div>
      </div>

      {/* ── 🌟 Responsive Action Sheet Context Menu (Desktop Dropdown & Mobile Bottom Sheet) ── */}
      {contextMenu && (
        <>
          {/* Mobile Backdrop Overlay Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-40 sm:hidden animate-in fade-in duration-200"
            onClick={() => setContextMenu(null)}
          />
          
          <div 
            className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl z-50 py-2 pb-6 w-full sm:fixed sm:bottom-auto sm:inset-x-auto sm:w-48 sm:rounded-lg sm:shadow-xl sm:py-1 sm:pb-1 border border-gray-200 animate-in slide-in-from-bottom duration-200 sm:animate-in sm:fade-in sm:zoom-in-95"
            style={typeof window !== 'undefined' && window.innerWidth >= 640 ? { top: contextMenu.y, left: contextMenu.x } : undefined}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Mobile Bottom Sheet Drawer Drag Bar handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-1.5 sm:hidden" />
            
            <div className="px-4 py-2 sm:px-3 sm:py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              ID: {contextMenu.order.item_id}
            </div>
            
            <button 
              onClick={() => { setEditingOrder(contextMenu.order); setContextMenu(null); }}
              className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-gray-700 hover:bg-gray-50 active:bg-gray-100 font-medium flex items-center gap-3 sm:gap-2"
            >
              <svg className="w-4 h-4 text-orange-500 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Record
            </button>

            <button 
              onClick={() => { setViewingHistoryOrder(contextMenu.order); setContextMenu(null); }}
              className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-gray-700 hover:bg-gray-50 active:bg-gray-100 font-medium flex items-center gap-3 sm:gap-2 border-t border-gray-100"
            >
              <svg className="w-4 h-4 text-blue-500 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              View History Log
            </button>

            <button 
              onClick={() => { handleDeleteOrder(contextMenu.order.id); setContextMenu(null); }}
              className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-red-600 hover:bg-red-50 active:bg-red-100 font-medium flex items-center gap-3 sm:gap-2 border-t border-gray-100"
            >
              <svg className="w-4 h-4 text-red-500 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete Record
            </button>
          </div>
        </>
      )}

      {/* ── Edit Modal Form ── */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl w-full max-w-5xl my-auto max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200">
                <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-gray-50/50 rounded-t-xl">
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold text-gray-900">Update Order</h2>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">Item ID: <span className="font-mono text-gray-700">{editingOrder.item_id}</span></p>
                    </div>
                    <button onClick={() => setEditingOrder(null)} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-5 p-4 sm:p-6">
                  <form className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm" onSubmit={handleUpdate}>
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
                          <option value="At Office">📦 At Office</option>
                          <option value="On Way">🚵 On Way</option>
                          <option value="Delivered">✅ Delivered</option>
                          <option value="In-Transit">🚚 In-Transit</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>Pick Up Rider</label>
                        <select className={winSelect} value={editingOrder.pickup_rider_id || ''} onChange={e => setEditingOrder({...editingOrder, pickup_rider_id: e.target.value})}>
                          <option value="">Select...</option>
                          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
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

                      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
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

                      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 bg-gray-50/50 -mx-4 px-4 sm:-mx-6 sm:px-6 py-4">
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

                      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
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
                        <button type="button" onClick={() => setEditingOrder(null)} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-md shadow-sm transition-all">Save Changes</button>
                      </div>
                  </form>

                  {/* Sidebar Photo Area */}
                  <div className="w-full lg:w-64 border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col items-center">
                    <span className={labelStyle + " w-full text-left mb-2"}>Attached Order Photo</span>
                    {editingOrder.image_url ? (
                      <div className="w-full flex flex-col gap-3">
                        <div className="relative w-full h-44 bg-white border border-gray-300 rounded overflow-hidden flex items-center justify-center group shadow-sm">
                          <img src={editingOrder.image_url} alt="Order attachment" className="max-w-full max-h-full object-contain" />
                          <div onClick={() => setPreviewImage(editingOrder.image_url)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium cursor-pointer">Click to enlarge</div>
                        </div>
                        <label className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded text-center text-xs cursor-pointer shadow-sm block transition-colors">
                          📷 Replace New Photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} disabled={loading} />
                        </label>
                        <button type="button" onClick={() => handleRemoveImageOnly(editingOrder)} disabled={loading} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-1.5 px-3 border border-red-200 rounded text-center text-xs shadow-sm transition-colors">🗑️ Delete Photo Only</button>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-3">
                        <div className="w-full h-44 border border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 text-xs bg-white">
                          <svg className="w-8 h-8 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          No image uploaded
                        </div>
                        <label className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-1.5 px-3 rounded text-center text-xs cursor-pointer shadow-sm block transition-all">➕ Upload Photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} disabled={loading} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
            </div>
        </div>
      )}

      {/* ── Telegram Style Image Viewer ── */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-[60] animate-in fade-in duration-200 select-none" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 text-gray-200 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-2 transition-all z-20 shadow-lg border border-white/10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing" onWheel={(e) => { e.preventDefault(); if (e.deltaY < 0) { setImgScale(prev => Math.min(prev + 0.2, 5)); } else { setImgScale(prev => Math.max(prev - 0.2, 0.5)); } }} onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-[95vw] max-h-[92vh] object-contain drop-shadow-[0_25px_25px_rgba(0,0,0,0.45)] pointer-events-none" style={{ transform: `scale(${imgScale}) rotate(${imgRotation}deg)`, transition: 'transform 0.12s ease-out' }} />
          </div>
          <div className="absolute bottom-8 bg-zinc-900/80 backdrop-blur-md text-gray-300 rounded-full flex items-center justify-center gap-4 px-6 py-2 z-20 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgScale(prev => Math.max(prev - 0.2, 0.5))} className="p-1.5 hover:text-white hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg></button>
            <span className="text-xs font-mono w-14 text-center font-semibold text-gray-400">{Math.round(imgScale * 100)}%</span>
            <button onClick={() => setImgScale(prev => Math.min(prev + 0.2, 5))} className="p-1.5 hover:text-white hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg></button>
            <span className="w-px h-5 bg-white/10 mx-0.5" />
            <button onClick={() => setImgRotation(prev => prev - 90)} className="p-1.5 hover:text-white hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-6 5m0 0l-5-6m5 6V9a6 6 0 0112 0v3" /></svg></button>
            <button onClick={() => setImgRotation(prev => prev + 90)} className="p-1.5 hover:text-white hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15l6 5m0 0l5-6m-5 6V9a6 6 0 00-12 0v3" /></svg></button>
            <span className="w-px h-5 bg-white/10 mx-0.5" />
            <button onClick={() => { setImgScale(1); setImgRotation(0); }} className="p-1.5 bg-orange-600 hover:bg-orange-500 rounded-full text-white shadow-md transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
          </div>
        </div>
      )}

    {/* ── 🌟 Full Detail View Modal ── */}
{viewingDetailOrder && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
    {/* Backdrop ကို နှိပ်ရင် ပိတ်သွားအောင် */}
    <div className="absolute inset-0" onClick={() => setViewingDetailOrder(null)} />
    
    {/* 💡 Modal Size ကို ပိုကျယ်အောင် လုပ်ထားပြီး ဖုန်းမှာ Screen အပြည့်နီးပါး (h-[90vh]) ပေးထားပါတယ် */}
    <div className="relative bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 overflow-hidden">
      
      {/* Modal Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">Parcel Details</span>
          <h3 className="text-base font-mono font-bold text-gray-900 mt-1 break-words">ID: {viewingDetailOrder.item_id}</h3>
        </div>
        <button 
          onClick={() => setViewingDetailOrder(null)} 
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200/70 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors ml-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* 💡 Modal Body - နေရာအကျယ်ကြီးနဲ့ အောက်ကို အဝောာ့အပြတ် Scroll ဆွဲလို့ရမယ့်အပိုင်း */}
      <div className="p-5 flex flex-col gap-6 text-sm flex-1 overflow-y-auto bg-white">
        
        {/* Status & Dates (ရိုးရိုးရှင်းရှင်း အကန့်မပါဘဲ ခွဲပြထားပါတယ်) */}
        <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Current Status</span>
            <span className="font-bold text-gray-900 text-sm break-words">{viewingDetailOrder.status || 'At Office'}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Received Date</span>
            <span className="font-semibold text-gray-700 text-sm break-words">{viewingDetailOrder.received_date || '-'}</span>
          </div>
        </div>

        {/* Route Information (ဘယ်လိုစာတိုရှည်ရှည် လွတ်လွတ်လပ်လပ် ဆန့်မယ့်အပိုင်း) */}
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Route Information</h4>
          
          <div className="space-y-1">
            <span className="text-gray-400 text-xs block">Sender (ပို့သူ)</span>
            <div className="text-gray-900 font-semibold text-sm break-words">
              {viewingDetailOrder.sender_name || '-'} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-1">({viewingDetailOrder.sender_loc || '-'})</span>
            </div>
          </div>
          
          <div className="space-y-1 pt-2">
            <span className="text-gray-400 text-xs block">Receiver (ယူသူ)</span>
            <div className="text-gray-900 font-semibold text-sm break-words">
              {viewingDetailOrder.receiver_name || '-'} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-1">({viewingDetailOrder.receiver_loc || '-'})</span>
            </div>
          </div>

          {viewingDetailOrder.receiver_phone && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex justify-between items-center gap-4 mt-1">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-orange-400 uppercase block mb-0.5">Phone Number</span>
                <span className="font-mono font-bold text-orange-800 text-base block break-words">{viewingDetailOrder.receiver_phone}</span>
              </div>
              <a href={`tel:${viewingDetailOrder.receiver_phone}`} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm text-xs shrink-0 transition-colors">ခေါ်ဆိုရန်</a>
            </div>
          )}

          {viewingDetailOrder.receiver_address && (
            <div className="space-y-1 pt-2">
              <span className="text-gray-400 text-xs block">Full Address</span>
              <p className="text-gray-800 font-medium leading-relaxed break-words whitespace-pre-wrap bg-gray-50 p-3 rounded-xl border border-gray-100">
                {viewingDetailOrder.receiver_address}
              </p>
            </div>
          )}
        </div>

        {/* Financials (စာသားမကျပ်အောင် ဘယ်/ညာအပြည့် ဖြန့်ခင်းပြသပေးထားပါတယ်) */}
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-5">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Financials ({viewingDetailOrder.fee_type || 'Deli'})</h4>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">COD Amount</span>
            <span className="font-semibold text-gray-900 font-mono">{viewingDetailOrder.cod_amount?.toLocaleString() || 0} Ks</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Delivery Fee</span>
            <span className="font-semibold text-gray-900 font-mono">{viewingDetailOrder.deli_fee?.toLocaleString() || 0} Ks</span>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200 mt-1">
            <span className="text-gray-900 font-bold">Total Net Amount</span>
            <span className="text-base font-mono font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
              {viewingDetailOrder.total_amount?.toLocaleString() || 0} Ks
            </span>
          </div>
        </div>

        {/* Riders (အပေါ်အောက်အပြည့် နေရာပေးထားလို့ နာမည်ရှည်လည်း အဆင်ပြေပါတယ်) */}
        <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Pickup Rider</span>
            <span className="font-semibold text-gray-800 break-words">{viewingDetailOrder.pickup_rider?.name || '-'}</span>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Delivery Rider</span>
            <span className="font-semibold text-gray-800 break-words">{viewingDetailOrder.deliver_rider?.name || '-'}</span>
          </div>
        </div>

        {/* Attached Photo */}
        {viewingDetailOrder.image_url && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase">Attached Photo</span>
            <div 
              onClick={() => { setPreviewImage(viewingDetailOrder.image_url); }}
              className="relative rounded-xl overflow-hidden border border-gray-200 max-h-52 bg-gray-50 flex items-center justify-center cursor-zoom-in"
            >
              <img src={viewingDetailOrder.image_url} alt="Parcel Attachment" className="max-w-full max-h-52 object-contain" />
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 text-[10px] text-white rounded-md backdrop-blur-[2px]">Zoom Image</div>
            </div>
          </div>
        )}

        {/* Special Notes */}
        {viewingDetailOrder.note && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl font-medium break-words leading-relaxed">
            ⚠️ <strong>Note:</strong> {viewingDetailOrder.note === 'RT' ? 'Return Item (ပစ္စည်းပြန်အပ်ငွေ)' : viewingDetailOrder.note}
          </div>
        )}

      </div>
      
      {/* Modal Footer Actions (အောက်ခြေမှာ ငြိမ်ငြိမ်လေး ကပ်နေမှာပါ) */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3 shrink-0">
        <button 
          onClick={() => { setEditingOrder(viewingDetailOrder); setViewingDetailOrder(null); }}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-center shadow-md transition-colors"
        >
          Edit Order
        </button>
        <button 
          onClick={() => setViewingDetailOrder(null)}
          className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
        >
          Close
        </button>
      </div>

    </div>
  </div>
)}

    </div>
  )
}