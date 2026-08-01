"use client"
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EditOrderModal from '@/components/EditOrderModal' // သင့် Component တည်နေရာလမ်းကြောင်းအတိုင်း ချိန်ပေးပါ
import { printVoucher } from "@/utils/print"
import { useOrderSelection } from '@/hooks/useOrderSelection'
import SelectionSummaryBar from '@/components/SelectionSummaryBar'
import OrderTable from '@/components/OrderTable'

const COLUMN_DEFS = [
  { key: 'image_url', label: 'Photo', defaultVisible: true }, 
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
  { key: 'received_date', label: 'Received Date', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'sender_name', label: 'Sender', defaultVisible: true },
  { key: 'sender_loc', label: 'S. City', defaultVisible: true },
  { key: 'receiver_name', label: 'Receiver', defaultVisible: true },
  { key: 'receiver_phone', label: 'Phone', defaultVisible: true },
  { key: 'receiver_address', label: 'Full Address', defaultVisible: false },
  { key: 'receiver_loc', label: 'R. City', defaultVisible: true },
  { key: 'fee_type', label: 'Type', defaultVisible: true },
  { key: 'cod_amount', label: 'COD (Ks)', defaultVisible: true },
  { key: 'deli_fee', label: 'Deli Fee (Ks)', defaultVisible: true },
  { key: 'total_amount', label: 'Total (Ks)', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: false },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: false },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: false },
  { key: 'cleared_date', label: 'Cleared Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false },
  { key: 'transit_date', label: 'Transit Date', defaultVisible: false },
  { key: 'transit_to', label: 'Transit To', defaultVisible: false },
  { key: 'agent_fee', label: 'Agent Fee', defaultVisible: false },
  { key: 'remark', label: 'Remark', defaultVisible: false },
  { key: 'barcode', label: 'Barcode', defaultVisible: false },
 
]


type FilterValue = string | string[];

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => setIsOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:border-orange-400"
      >
        <span className="truncate">
          {selectedValues.length > 0 ? `${selectedValues.length} selected` : 'All'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-[180px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-semibold text-orange-600"
            >
              Clear
            </button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {options.map(option => {
              const checked = selectedValues.includes(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) {
                        onChange(selectedValues.filter(val => val !== option.value));
                      } else {
                        onChange([...selectedValues, option.value]);
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-orange-500"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderList() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const filteredOrders = orders;
  // 🟢 Custom Hook ခေါ်ယူခြင်း
  const {
    selectedOrders,
    selectedCount,
    selectedCodTotal,
    selectedDeliTotal,
    selectedGrandTotal,
    isAllSelected: selectAll, // isAllSelected ကို selectAll နာမည်ဖြင့် အစားထိုးသုံးပါသည်
    isDraggingSelection,
    setIsDraggingSelection,
    toggleOrderSelection,
    selectAllFiltered,
    clearSelection,
    handleRowMouseDown,
    handleRowMouseEnter,
  } = useOrderSelection(orders);
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [userBranch, setUserBranch] = useState<string>('')

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: any } | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null) 
  const [imgScale, setImgScale] = useState<number>(1)
  const [imgRotation, setImgRotation] = useState<number>(0)
  const [imgTranslate, setImgTranslate] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewingHistoryOrder, setViewingHistoryOrder] = useState<any | null>(null)
  const [viewingDetailOrder, setViewingDetailOrder] = useState<any | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  
  
// Excel Export အတွက် State များ
const [showExcelModal, setShowExcelModal] = useState(false);
const [excelCols, setExcelCols] = useState<Record<string, boolean>>(() => {
  const initialState: Record<string, boolean> = {};
  COLUMN_DEFS.forEach(col => { 
    initialState[col.key] = col.defaultVisible; // အစပိုင်းမှာ လက်ရှိ visible ဖြစ်နေတဲ့ column တွေကို pre-select လုပ်ထားပေးမယ်
  });
  return initialState;
});







  // ၁။ Print ထုတ်မည့် Data ကို ယာယီသိမ်းထားမည့် State
  const [activePrintOrder, setActivePrintOrder] = useState<any | null>(null);

  // ၂။ print.ts က လွှတ်လိုက်တဲ့ Custom Event (အော်သံ) ကို နားထောင်ပြီး Data ဖမ်းယူမည့်စနစ်
  useEffect(() => {
    const handlePrintEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      setActivePrintOrder(customEvent.detail); // ပို့လိုက်တဲ့ order data ကို လှမ်းဖမ်းပြီး State ထဲထည့်ခြင်း
    };

    window.addEventListener("app:print-voucher", handlePrintEvent);
    return () => window.removeEventListener("app:print-voucher", handlePrintEvent);
  }, []);

  // ၃။ State ထဲကို Data ရောက်လာတာနဲ့ Browser ရဲ့ Print Window ကို Auto ဆွဲဖွင့်ပေးမည့်စနစ်
  useEffect(() => {
    if (activePrintOrder) {
      const timer = setTimeout(() => {
        window.print();
        setActivePrintOrder(null); // Print ပြီးသွားရင် State ကို Null ပြန်လုပ်ပြီး သန့်ရှင်းရေးလုပ်ခြင်း
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activePrintOrder]);

  useEffect(() => {
    if (!previewImage) {
      setImgScale(1)
      setImgRotation(0)
      setImgTranslate({ x: 0, y: 0 })
      setDragStart(null)
      setIsDragging(false)
    }
  }, [previewImage])


  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })

useEffect(() => {
  const savedCols = localStorage.getItem('all_in_one_visible_cols');
  if (savedCols) {
    try {
      setVisibleCols(JSON.parse(savedCols));
    } catch (error) {
      console.error("Error parsing visible columns from localStorage:", error);
    }
  }
}, []);

  const [showColDropdown, setShowColDropdown] = useState(false)
  const [showFilterBar, setShowFilterBar] = useState(true)
  const [colFilters, setColFilters] = useState<Record<string, FilterValue>>({})


  const fetchData = async ({
    append = false,
    branchCode,
    dateStr,
    searchStr,
  }: {
    append?: boolean;
    branchCode?: string;
    dateStr?: string;
    searchStr?: string;
  } = {}) => {
    const activeBranch = branchCode || userBranch;
    if (!activeBranch) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const start = append ? orders.length : 0;
    const end = start + 99;

    let query = supabase
      .from('orders')
      .select(
        `
          *,
          pickup_rider:riders!orders_pickup_rider_id_fkey(name),
          deliver_rider:riders!orders_deliver_rider_id_fkey(name)
        `,
        { count: 'exact' }
      )
      .eq('is_deleted', false)
      .eq('branch', activeBranch)
      .order('created_at', { ascending: false })
      .range(start, end);

    const activeSearch = (searchStr ?? globalSearch).trim();
    const activeDate = dateStr || selectedDate;

    if (activeSearch) {
      const escapedSearch = activeSearch.replace(/'/g, "''");
      query = query.or(
        `item_id.ilike.%${escapedSearch}%,receiver_phone.ilike.%${escapedSearch}%,receiver_name.ilike.%${escapedSearch}%,sender_name.ilike.%${escapedSearch}%`
      );
    } else if (activeDate) {
      query = query.eq('received_date', activeDate);
    }

    Object.entries(colFilters).forEach(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return;
      if (key === 'global_search') return;

      if (Array.isArray(value)) {
        const values = value.filter(Boolean);
        if (values.length > 0) {
          query = query.in(key, values);
        }
        return;
      }

      const filterValue = String(value).trim();
      if (!filterValue) return;

      if (['received_date', 'deliver_date', 'cleared_date', 'created_at', 'transit_date'].includes(key)) {
        query = query.eq(key, filterValue);
      } else if (key === 'pickup_rider') {
        query = query.ilike('pickup_rider.name', `%${filterValue}%`);
      } else if (key === 'deliver_rider') {
        query = query.ilike('deliver_rider.name', `%${filterValue}%`);
      } else {
        query = query.ilike(key, `%${filterValue}%`);
      }
    });

    const { data, error, count } = await query;

    if (error) {
      console.error(error);
      setOrders([]);
      setHasMore(false);
    } else {
      const nextData = data || [];
      const loadedCount = append ? orders.length + nextData.length : nextData.length;
      setOrders((prev) => (append ? [...prev, ...nextData] : nextData));
      setHasMore((count ?? 0) > loadedCount);
    }

    setLoading(false);
    setLoadingMore(false);
  }

  const fetchRiders = async () => {
    const { data } = await supabase.from('riders').select('*')
    if (data) setRiders(data)
  }

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      fetchRiders()
    }
  }, [router])

  const colFiltersKey = JSON.stringify(colFilters);

  useEffect(() => {
    if (!userBranch) return;

    const timer = window.setTimeout(() => {
      fetchData({
        branchCode: userBranch,
        dateStr: selectedDate,
        searchStr: globalSearch,
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [selectedDate, globalSearch, userBranch, colFiltersKey]);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null)
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  const handleExportExcel = () => {
  // အကယ်၍ row တွေ checkbox နဲ့ ရွေးထားရင် ရွေးထားတဲ့ data ကိုယူမယ်၊ မရွေးထားရင် လက်ရှိ filter ဖြစ်နေတဲ့ orders အားလုံးကို ယူမယ်
  const dataToExport = selectedOrders.size > 0 
    ? orders.filter(o => selectedOrders.has(o.id)) 
    : filteredOrders;

  if (dataToExport.length === 0) {
    alert("Export ထုတ်ရန် မှတ်တမ်းမရှိပါ။");
    return;
  }

  // ရွေးချယ်ထားတဲ့ Column Header တွေအတိုင်း Data ပုံစံပြောင်းလဲခြင်း
  const excelRows = dataToExport.map(order => {
    const rowData: Record<string, any> = {};
    
    COLUMN_DEFS.forEach(col => {
      if (excelCols[col.key]) {
        // သတ်မှတ်ထားတဲ့ column သာ ယူမယ် (အထူးသဖြင့် Object data တွေကို စာသားပြောင်းပေးမယ်)
        if (col.key === 'pickup_rider') {
          rowData[col.label] = order.pickup_rider?.name || '-';
        } else if (col.key === 'deliver_rider') {
          rowData[col.label] = order.deliver_rider?.name || '-';
        } else if (col.key === 'created_at') {
          rowData[col.label] = order.created_at ? new Date(order.created_at).toLocaleDateString() : '-';
        } else if (col.key === 'image_url') {
          rowData[col.label] = order.image_url ? 'Has Photo' : '-';
        } else if (col.key === 'branch') {
          rowData[col.label] = order.branch === 'MDY' ? 'MANDALAY' : order.branch === 'YGN' ? 'YANGON' : order.branch;
        } else {
          rowData[col.label] = order[col.key] ?? '-';
        }
      }
    });
    return rowData;
  });

  // SheetJS အသုံးပြုပြီး Excel Workbook ဖန်တီးခြင်း
  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders_Report");

  // ဖိုင်အမည်ကို ယနေ့ရက်စွဲဖြင့် ထုတ်ပေးခြင်း
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Deli_Orders_${todayStr}.xlsx`);
  
  // Modal ပိတ်လိုက်ခြင်း
  setShowExcelModal(false);
};

  

  
  const handleFilterChange = (col: string, val: string | string[]) => {
    setColFilters(prev => ({ ...prev, [col]: val }))
  }

  const resetFilters = () => {
    setColFilters({})
  }

  const activeFilterCount = Object.values(colFilters).filter(value => {
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  }).length

  const toggleColumn = (colKey: string) => {
  setVisibleCols(prev => {
    const updated = { ...prev, [colKey]: !prev[colKey] };
    localStorage.setItem('all_in_one_visible_cols', JSON.stringify(updated)); // localStorage ထဲ သိမ်းလိုက်ခြင်း
    return updated;
  });
};

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
      else fetchData({ append: false })
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
        o.status === 'Settled' ? 'bg-green-700 text-white border border-white' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
        o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}>{o.status}</span>
    )
    if (key === 'image_url') return (
  <div className="flex items-center justify-center">
    {o.image_url ? (
      /* ပုံရှိလျှင်: အပြာရောင် Click ရသော Photo Icon ပြမည် */
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPreviewImage(o.image_url); }}
        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
        title="ပုံကြည့်ရန် နှိပ်ပါ"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
    ) : (
      /* ပုံမရှိလျှင်: မီးခိုးရောင် မကြောနိုင်သော No Photo Icon ပြမည် */
      <span className="p-1 text-gray-300" title="ပုံမရှိပါ">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </span>
    )}
  </div>
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

 

  

  const locationOptions = Array.from(new Set([
    ...orders.map(o => o.sender_loc).filter(Boolean),
    ...orders.map(o => o.receiver_loc).filter(Boolean),
  ])).sort() as string[];

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
            <h1 className="text-base font-semibold text-gray-900 tracking-wide flex items-center gap-2">
  <span className="uppercase">{userBranch === 'MDY' ? 'Mandalay' : userBranch === 'YGN' ? 'Yangon' : 'Main'} Office</span>
  
  <input 
    type="date" 
    value={selectedDate}
    onChange={(e) => setSelectedDate(e.target.value)}
    className="ml-2 text-sm font-medium border border-gray-300 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm cursor-pointer"
  />
</h1>
            <p className="text-[11px] text-gray-500 font-medium hidden sm:block">Order Management · Right-click row for actions</p>
            <p className="text-[11px] text-gray-500 font-medium sm:hidden">Order Management · Tap 3-dots for actions</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* ── Columns Show/Hide Dropdown ── */}
<SelectionSummaryBar
  selectedCount={selectedCount}
  selectedCodTotal={selectedCodTotal}
  selectedDeliTotal={selectedDeliTotal}
  selectedGrandTotal={selectedGrandTotal}
  onClear={clearSelection}
/>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterBar(prev => !prev)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${showFilterBar ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
            >
              {showFilterBar ? 'Hide Filters' : 'Show Filters'}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-100"
              >
                Clear Filters
              </button>
            )}

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
                            checked={visibleCols[col.key] || false }  
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
          </div>

<button 
  onClick={() => {
    // Modal ဖွင့်ခါနီး လက်ရှိ screen ရဲ့ visible ဖြစ်နေတဲ့ columns တွေအတိုင်း update ဖြစ်အောင်လုပ်ပေးခြင်း
    const currentVisible: Record<string, boolean> = {};
    COLUMN_DEFS.forEach(col => { currentVisible[col.key] = visibleCols[col.key]; });
    setExcelCols(currentVisible);
    setShowExcelModal(true);
  }} 
  className="bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  Excel Export
</button>

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

      {/* 📱 Mobile Only Enhanced Filter Panel */}
<div className="sm:hidden bg-white border-b border-gray-200 flex flex-col transition-all">
  <div className="px-3 py-2 flex items-center gap-2">
    <div className="relative flex-1">
      <input 
  type="text" 
  placeholder="🔍 ID၊ ဖုန်း၊ အမည်ဖြင့် Database တစ်ခုလုံးမှ ရှာရန်..." 
  className="w-full bg-gray-50 border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-orange-500 focus:bg-white"
  value={globalSearch}
  onChange={e => setGlobalSearch(e.target.value)}
/>
    </div>
    <button 
      onClick={() => setShowMobileFilters(!showMobileFilters)}
      className={`p-1.5 border rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${showMobileFilters ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
    >
      ⚙️ Filter
    </button>
    {Object.values(colFilters).some(v => v !== '') && (
      <button 
        onClick={() => setColFilters({})}
        className="text-xs text-red-500 font-medium px-2 py-1.5 bg-red-50 rounded border border-red-100"
      >
        Reset
      </button>
    )}
  </div>

  {showMobileFilters && (
    <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2 bg-gray-50 border-t border-gray-100 animate-in slide-in-from-top-2 duration-150">
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Branch</label>
        <MultiSelectFilter
          label="Branch"
          options={[{ label: 'Mandalay', value: 'MDY' }, { label: 'Yangon', value: 'YGN' }]}
          selectedValues={Array.isArray(colFilters['branch']) ? colFilters['branch'] as string[] : []}
          onChange={(values) => handleFilterChange('branch', values)}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Status</label>
        <MultiSelectFilter
          label="Status"
          options={[
            { label: 'At Office', value: 'At Office' },
            { label: 'On Way', value: 'On Way' },
            { label: 'Delivered', value: 'Delivered' },
            { label: 'In-Transit', value: 'In-Transit' },
          ]}
          selectedValues={Array.isArray(colFilters['status']) ? colFilters['status'] as string[] : []}
          onChange={(values) => handleFilterChange('status', values)}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Payment Type</label>
        <MultiSelectFilter
          label="Payment Type"
          options={[
            { label: 'Deli', value: 'Deli' },
            { label: 'Kpay', value: 'Kpay' },
            { label: 'Cash', value: 'Cash' },
            { label: 'Bill', value: 'Bill' },
          ]}
          selectedValues={Array.isArray(colFilters['fee_type']) ? colFilters['fee_type'] as string[] : []}
          onChange={(values) => handleFilterChange('fee_type', values)}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Deliver Rider</label>
        <MultiSelectFilter
          label="Deliver Rider"
          options={riders.map(r => ({ label: r.name, value: r.name }))}
          selectedValues={Array.isArray(colFilters['deliver_rider']) ? colFilters['deliver_rider'] as string[] : []}
          onChange={(values) => handleFilterChange('deliver_rider', values)}
        />
      </div>
    </div>
  )}
</div>

     {/* ── Container Workspace Area (OrderTable Component) ── */}
<OrderTable
  orders={filteredOrders}
  columnDefs={COLUMN_DEFS}
  visibleCols={visibleCols}
  showFilterBar={showFilterBar}
  colFilters={colFilters}
  onFilterChange={handleFilterChange}
  riders={riders}
  locationOptions={locationOptions}
  loading={loading}
  loadingMore={loadingMore}
  hasMore={hasMore}
  onLoadMore={() => fetchData({ append: true })}
  
  // Selection Props
  selectedOrders={selectedOrders}
  isAllSelected={selectAll}
  onToggleSelectAll={() => {
    if (selectAll) {
      clearSelection();
    } else {
      selectAllFiltered();
    }
  }}
  onToggleOrderSelection={toggleOrderSelection}
  onRowMouseDown={handleRowMouseDown}
  onRowMouseEnter={handleRowMouseEnter}
  onStopDragging={() => setIsDraggingSelection(false)}

  // Event Callbacks
  onRowClick={(order) => setViewingDetailOrder(order)}
  onRowContextMenu={(e, order) => handleRowContextMenu(e, order)}
  onPreviewImage={(url) => setPreviewImage(url)}
/>  
      
     

      {/* ── 🌟 Responsive Action Sheet Context Menu (Desktop Dropdown & Mobile Bottom Sheet) ── */}
      {contextMenu && (
        <>
          {/* Mobile Backdrop Overlay Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-40 sm:hidden animate-in fade-in duration-200"
            onClick={() => setContextMenu(null)}
          />
          
          <div 
            className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl z-60 py-2 pb-6 w-full sm:fixed sm:bottom-auto sm:inset-x-auto sm:w-48 sm:rounded-lg sm:shadow-xl sm:py-1 sm:pb-1 border border-gray-200 animate-in slide-in-from-bottom duration-200 sm:animate-in sm:fade-in sm:zoom-in-95"
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

           <button
  onClick={() => { printVoucher(contextMenu.order.id); setContextMenu(null); }}
  className="w-full text-left px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium flex items-center gap-3 sm:gap-2"
>
  <svg 
    className="w-4 h-4 text-slate-500 sm:w-3.5 sm:h-3.5" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 1.252a1.125 1.125 0 0 1-1.107 1.328H7.218a1.125 1.125 0 0 1-1.107-1.328L6.34 18m11.318 0a1.148 1.148 0 0 0-.184-.532 2.25 2.25 0 0 0-2.286-.874L15 16.5m-8.66 1.5a1.148 1.148 0 0 1 .184-.532 2.25 2.25 0 0 1 2.286-.874L9 16.5m0 0v-4.688a1.125 1.125 0 0 1 1.125-1.125h3.75a1.125 1.125 0 0 1 1.125 1.125V16.5M9 16.5h6M6.75 6.75h10.5a2.25 2.25 0 0 1 2.25 2.25v3.75a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25Z" />
  </svg>
  Print Voucher
</button>
          </div>
        </>
      )}

      {/* ── Edit Modal Form ── */}
      {/* ── ပြင်ပမှ ခေါ်သုံးထားသော Edit Order Modal ── */}
<EditOrderModal 
  isOpen={editingOrder !== null} 
  onClose={() => setEditingOrder(null)} 
  orderData={editingOrder} 
  onSaveSuccess={() => {
    fetchData({ append: false }); // Update အောင်မြင်သွားရင် List ထဲမှာ Data ချက်ချင်း Refresh ဖြစ်အောင် ပြန်ခေါ်ပေးခြင်း
  }} 
/>

{/* ── 📜 PREMIUM VIEW HISTORY LOG MODAL ── */}
{viewingHistoryOrder && (
  <div 
    className="fixed inset-0 bg-gray-900/60 backdrop-blur-[3px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
    onClick={() => setViewingHistoryOrder(null)}
  >
    {/* Backdrop */}
    <div className="absolute inset-0" />
    
    {/* Modal Box */}
    <div 
      className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg h-[80vh] sm:h-auto sm:max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-gray-100"
      onClick={e => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              📜 Activity Logs
            </h3>
            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {viewingHistoryOrder.history?.length || 0} Events
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            Tracking ID: <span className="font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">{viewingHistoryOrder.item_id}</span>
          </p>
        </div>
        <button 
          onClick={() => setViewingHistoryOrder(null)}
          className="text-gray-400 hover:text-gray-700 bg-gray-200/60 hover:bg-gray-200 w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ml-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Modal Body (Timeline View) */}
      <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50 scrollbar-thin">
        {!viewingHistoryOrder.history || viewingHistoryOrder.history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <span className="text-3xl">📭</span>
            <p className="text-xs font-semibold italic">လှုပ်ရှားမှုမှတ်တမ်း (Log) မရှိသေးပါ။</p>
          </div>
        ) : (
          /* [...].reverse() သုံးပြီး နောက်ဆုံးပြင်ဆင်ချက်ကို ထိပ်ဆုံးမှာ ပြသမည် */
          <div className="relative border-l border-gray-200 pl-4 ml-2.5 space-y-5 my-1">
            {[...viewingHistoryOrder.history].reverse().map((log: any, index: number) => {
              const isLatest = index === 0; // ထိပ်ဆုံးတစ်ခု (အသစ်ဆုံး Log) ဟုတ်မဟုတ် စစ်ဆေးခြင်း
              
              return (
                <div key={index} className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Timeline Node Point */}
                  <span className={`absolute -left-[21.5px] top-2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-all
                    ${isLatest ? 'bg-orange-500 ring-4 ring-orange-100' : 'bg-gray-300 ring-4 ring-slate-100'}`} 
                  />
                  
                  {/* အသစ်ဆုံး Log ဖြစ်ပါက Pulse အစက်လေး လင်းနေစေရန် */}
                  {isLatest && (
                    <span className="absolute -left-[21.5px] top-2 w-3 h-3 rounded-full bg-orange-500 animate-ping opacity-75 z-0" />
                  )}
                  
                  {/* Log Card Box */}
                  <div className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all duration-200
                    ${isLatest ? 'border-orange-200 ring-1 ring-orange-100/50' : 'border-gray-200/80 hover:border-gray-300'}`}
                  >
                    {/* Card Top Block */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-2 mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md border
                        ${isLatest 
                          ? 'bg-orange-50 text-orange-700 border-orange-100' 
                          : 'bg-slate-50 text-slate-600 border-slate-100'}`}
                      >
                        ⚡ {log.action || 'Order Updated'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold font-mono tracking-tight bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        ⏱️ {log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB', { hour12: true }) : '-'}
                      </span>
                    </div>
                    
                    {/* Log Note Details (CRITICAL: whitespace-pre-line ပါဝင်သဖြင့် စာကြောင်းများ ကွဲပြားစွာဆင်းမည်) */}
                    <div className="text-xs text-gray-700 font-sans font-medium whitespace-pre-line leading-relaxed tracking-normal break-words bg-slate-50/70 p-2.5 rounded-lg border border-slate-100/60">
                      {log.note || '-'}
                    </div>
                    
                    {/* Card Footer: Operator Detail */}
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                      <span>Status</span>
                      <span className="flex items-center gap-1 text-gray-600">
                        👤 Operator: <span className="text-orange-600 font-extrabold">{log.operator || 'Unknown'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
        <button 
          onClick={() => setViewingHistoryOrder(null)}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-colors"
        >
          Close Window
        </button>
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
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
            onWheel={(e) => { e.preventDefault(); if (e.deltaY < 0) { setImgScale(prev => Math.min(prev + 0.2, 5)); } else { setImgScale(prev => Math.max(prev - 0.2, 0.5)); } }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              setIsDragging(true)
              setDragStart({ x: e.clientX - imgTranslate.x, y: e.clientY - imgTranslate.y })
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!isDragging || !dragStart) return
              setImgTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
            }}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
            onPointerLeave={() => setIsDragging(false)}
          >
            <img src={previewImage} alt="Preview" className="max-w-[95vw] max-h-[92vh] object-contain drop-shadow-[0_25px_25px_rgba(0,0,0,0.45)] pointer-events-none" style={{ transform: `translate(${imgTranslate.x}px, ${imgTranslate.y}px) scale(${imgScale}) rotate(${imgRotation}deg)`, transition: isDragging ? 'none' : 'transform 0.12s ease-out' }} />
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
  <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
    {/* Backdrop */}
    <div className="absolute inset-0" onClick={() => setViewingDetailOrder(null)} />
    
    {/* Responsive Modal Container */}
    <div className="relative bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl lg:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 overflow-hidden">
      
      {/* Modal Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">
              Parcel Details
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
              viewingDetailOrder.branch === 'MDY' 
                ? 'bg-orange-50 text-orange-700 border-orange-200' 
                : viewingDetailOrder.branch === 'YGN' 
                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              {viewingDetailOrder.branch === 'MDY' ? 'MANDALAY' : viewingDetailOrder.branch === 'YGN' ? 'YANGON' : viewingDetailOrder.branch || '-'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
              viewingDetailOrder.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
              viewingDetailOrder.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
              viewingDetailOrder.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>{viewingDetailOrder.status || 'At Office'}</span>
          </div>
          <h3 className="text-base font-mono font-bold text-gray-900 mt-1 break-words">ID: {viewingDetailOrder.item_id}</h3>
        </div>
        <button 
          onClick={() => setViewingDetailOrder(null)} 
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200/70 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors ml-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-5 flex flex-col gap-6 text-sm flex-1 overflow-y-auto bg-white">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* 📦 LEFT COLUMN: Route & Logistics Info */}
          <div className="flex flex-col gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">📍 Route Information</h4>
            
            <div className="space-y-1">
              <span className="text-gray-400 text-xs block">Sender (ပို့သူ)</span>
              <div className="text-gray-900 font-semibold text-sm break-words">
                {viewingDetailOrder.sender_name || '-'} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-1">({viewingDetailOrder.sender_loc || '-'})</span>
              </div>
            </div>
            
            <div className="space-y-1 pt-1">
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
              <div className="space-y-1 pt-1">
                <span className="text-gray-400 text-xs block">Full Address</span>
                <p className="text-gray-800 font-medium leading-relaxed break-words whitespace-pre-wrap bg-white p-3 rounded-xl border border-gray-100">
                  {viewingDetailOrder.receiver_address}
                </p>
              </div>
            )}

            {/* Transit Block */}
            {(viewingDetailOrder.transit_to || viewingDetailOrder.transit_date) && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 mt-1">
                <div>
                  <span className="text-gray-400 text-xs block">Transit To</span>
                  <span className="font-semibold text-gray-800 break-words">{viewingDetailOrder.transit_to || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Transit Date</span>
                  <span className="font-semibold text-gray-800 font-mono break-words">
                    {viewingDetailOrder.transit_date ? new Date(viewingDetailOrder.transit_date).toLocaleDateString() : '-'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 💵 RIGHT COLUMN: Financials & Riders */}
          <div className="flex flex-col gap-5">
            
            {/* Financial Details Box */}
            <div className="flex flex-col gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">💵 Financials</h4>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Payment Type</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-semibold text-gray-600 border border-gray-200">{viewingDetailOrder.fee_type || '-'}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">COD Amount</span>
                <span className="font-semibold text-gray-900 font-mono">{viewingDetailOrder.cod_amount?.toLocaleString() || 0} Ks</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Delivery Fee</span>
                <span className="font-semibold text-gray-900 font-mono">{viewingDetailOrder.deli_fee?.toLocaleString() || 0} Ks</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Agent Fee</span>
                <span className="font-semibold text-gray-900 font-mono">{viewingDetailOrder.agent_fee?.toLocaleString() || 0} Ks</span>
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200 mt-1">
                <span className="text-gray-900 font-bold">Total Net Amount</span>
                <span className="text-base font-mono font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                  {viewingDetailOrder.total_amount?.toLocaleString() || 0} Ks
                </span>
              </div>
            </div>

            {/* Riders Allocation */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div>
                <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Pickup Rider</span>
                <span className="font-semibold text-gray-800 break-words">{viewingDetailOrder.pickup_rider?.name || '-'}</span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Delivery Rider</span>
                <span className="font-semibold text-gray-800 break-words">{viewingDetailOrder.deliver_rider?.name || '-'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ⏱️ System Lifecycle Dates Grid */}
        <div className="bg-gray-50/30 border border-gray-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Received Date</span>
            <span className="font-medium text-gray-700 font-mono break-words">{viewingDetailOrder.received_date || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Deliver Date</span>
            <span className="font-medium text-gray-700 font-mono break-words">{viewingDetailOrder.deliver_date || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Cleared Date</span>
            <span className="font-medium text-gray-700 font-mono break-words">{viewingDetailOrder.cleared_date || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Created At</span>
            <span className="font-medium text-gray-700 font-mono break-words">
              {viewingDetailOrder.created_at ? new Date(viewingDetailOrder.created_at).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>

        {/* Attached Photo Details */}
        {viewingDetailOrder.image_url && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase">Attached Photo</span>
            <div 
              onClick={() => { setPreviewImage(viewingDetailOrder.image_url); }}
              className="relative rounded-xl overflow-hidden border border-gray-200 max-h-52 bg-gray-50 flex items-center justify-center cursor-zoom-in group shadow-sm"
            >
              <img src={viewingDetailOrder.image_url} alt="Parcel Attachment" className="max-w-full max-h-52 object-contain transition-transform duration-200 group-hover:scale-[1.02]" />
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 text-[10px] text-white rounded-md backdrop-blur-[2px]">Zoom Image</div>
            </div>
          </div>
        )}

        {/* Special Notes & Custom Warning Blocks */}
        {viewingDetailOrder.note && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl font-medium break-words leading-relaxed">
            ⚠️ <strong>Note:</strong> {viewingDetailOrder.note === 'RT' ? 'Return Item (ပစ္စည်းပြန်အပ်ငွေ)' : viewingDetailOrder.note}
          </div>
        )}

        {/* 📝 Remark Column Section (အသစ်ထည့်ထားသောအပိုင်း) */}
        {viewingDetailOrder.remark && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3.5 rounded-xl font-medium break-words leading-relaxed">
            📝 <strong>Remark:</strong> {viewingDetailOrder.remark}
          </div>
        )}

      </div>
      
      {/* Modal Footer Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3 shrink-0">
        <button 
          onClick={() => { setEditingOrder(viewingDetailOrder); setViewingDetailOrder(null); }}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-center shadow-md transition-colors text-sm"
        >
          Edit Order
        </button>
        <button 
          onClick={() => setViewingDetailOrder(null)}
          className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors text-sm"
        >
          Close
        </button>
      </div>

    </div>
  </div>
)}

{/* ── 🟢 EXCEL COLUMN SELECTOR MODAL ── */}
{showExcelModal && (
  <div 
    className="fixed inset-0 bg-gray-900/60 backdrop-blur-[3px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
    onClick={() => setShowExcelModal(false)}
  >
    <div className="absolute inset-0" />
    
    <div 
      className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-gray-100"
      onClick={e => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div className="px-5 py-4 bg-green-50 border-b border-green-100 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-sm font-extrabold text-green-900 uppercase tracking-wider flex items-center gap-1.5">
            📊 Export to Excel (.xlsx)
          </h3>
          <p className="text-[11px] text-green-700 font-medium mt-0.5">
            {selectedOrders.size > 0 
              ? `ရွေးချယ်ထားသော အော်ဒါ (${selectedOrders.size}) စောင်ကို ထုတ်ယူပါမည်။` 
              : `လက်ရှိစစ်ထုတ်ထားသော အော်ဒါ (${filteredOrders.length}) စောင်လုံးကို ထုတ်ယူပါမည်။`}
          </p>
        </div>
        <button 
          onClick={() => setShowExcelModal(false)}
          className="text-gray-400 hover:text-gray-700 bg-gray-200/60 hover:bg-gray-200 w-7 h-7 flex items-center justify-center rounded-full transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Modal Body (Columns Checkbox Grid) */}
      <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Excel တွင် ပါဝင်မည့် Column များ ရွေးရန်</span>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => {
                const allTrue: Record<string, boolean> = {};
                COLUMN_DEFS.forEach(c => allTrue[c.key] = true);
                setExcelCols(allTrue);
              }}
              className="text-[10px] font-bold text-green-600 hover:underline"
            >
              Select All
            </button>
            <span className="text-gray-300 text-[10px]">|</span>
            <button 
              type="button" 
              onClick={() => {
                const allFalse: Record<string, boolean> = {};
                COLUMN_DEFS.forEach(c => allFalse[c.key] = c.key === 'item_id'); // ID ကတော့ အနည်းဆုံး ကျန်ခဲ့ရမယ်
                setExcelCols(allFalse);
              }}
              className="text-[10px] font-bold text-red-500 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          {COLUMN_DEFS.map(col => (
            <label 
              key={`excel-${col.key}`} 
              className="flex items-center p-2 hover:bg-slate-50 active:bg-slate-100 cursor-pointer text-xs text-gray-700 font-medium rounded-lg transition-colors border border-transparent hover:border-slate-100"
            >
              <input 
                type="checkbox" 
                className="mr-2.5 w-4 h-4 text-green-600 rounded border-gray-300 accent-green-600 focus:ring-green-500"
                checked={excelCols[col.key] || false}  
                onChange={() => setExcelCols(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                disabled={col.key === 'item_id'} // Item ID ကို disable လုပ်ပြီး အမြဲတမ်း ပါဝင်နေစေခြင်း
              />
              <span className="truncate">{col.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3 shrink-0">
        <button 
          onClick={handleExportExcel}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-center shadow-md transition-colors text-xs flex items-center justify-center gap-2"
        >
          📂 Excel ဖိုင်ထုတ်မည် (Confirm)
        </button>
        <button 
          onClick={() => setShowExcelModal(false)}
          className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors text-xs"
        >
          မလုပ်တော့ပါ
        </button>
      </div>

    </div>
  </div>
)}

    </div>
  )
}