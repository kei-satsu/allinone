"use client"
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/databaseApi'
import { useRouter } from 'next/navigation'
import EditOrderModal from '@/components/EditOrderModal'
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// ── Column အားလုံးသတ်မှတ်ချက် ──
const COLUMN_DEFS = [
  { key: 'item_id', label: 'Item ID', defaultVisible: false },
  { key: 'received_date', label: 'Received Date', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'sender_name', label: 'Sender', defaultVisible: true },
  { key: 'sender_loc', label: 'S. City', defaultVisible: true },
  { key: 'receiver_name', label: 'Receiver', defaultVisible: true },
  { key: 'receiver_phone', label: 'Phone', defaultVisible: true },
  { key: 'receiver_loc', label: 'R. City', defaultVisible: false },
  { key: 'receiver_address', label: 'Full Address', defaultVisible: true },
  { key: 'fee_type', label: 'Type', defaultVisible: true },
  { key: 'cod_amount', label: 'COD (Ks)', defaultVisible: true },
  { key: 'deli_fee', label: 'Deli Fee (Ks)', defaultVisible: true },
  { key: 'total_amount', label: 'Total (Ks)', defaultVisible: true },
  { key: 'agent_fee', label: 'Agent Fee', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'image_url', label: 'Photo', defaultVisible: true }, 
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: false },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: false },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: true },
  { key: 'note', label: 'Note', defaultVisible: true },
  { key: 'transit_date', label: 'Transit Date', defaultVisible: true },
  { key: 'transit_to', label: 'Transit To', defaultVisible: true },
  { key: 'remark', label: 'Remark', defaultVisible: false },

]

export default function DailyReport() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  
  // ── States ဆိုင်ရာ သတ်မှတ်ချက်များ ──
  const [selectedDate, setSelectedDate] = useState(today)
  const [reportData, setReportData] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [cities, setCities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userBranch, setUserBranch] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [handovers, setHandovers] = useState<any[]>([])
  
  // Mobile ပေါ်မှာ Summary ကတ်တွေကို ပိတ်/ဖွင့် လုပ်ဖို့ State (ဖုန်းမှာ နေရာမရှုပ်အောင် ပုံမှန်ကို Hidden ထားပါမည်)
  const [showMobileSummary, setShowMobileSummary] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [expandedMobileCards, setExpandedMobileCards] = useState<Record<string, boolean>>({})
  const [includeTransitToYGN, setIncludeTransitToYGN] = useState(true)
  
  // ── Right-Click Context Menu အတွက် State ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: any } | null>(null);

  // Column Toggle & Grid Filters
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    COLUMN_DEFS.forEach(col => { initialState[col.key] = col.defaultVisible })
    return initialState
  })
  const [showColDropdown, setShowColDropdown] = useState(false)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // Edit / Handover/ Image Preview States
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [imgScale, setImgScale] = useState<number>(1)
  const [imgRotation, setImgRotation] = useState<number>(0)
  const [imgTranslate, setImgTranslate] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewHandoverModal, setViewHandoverModal] = useState(false)
  const [handoverContextMenu, setHandoverContextMenu] = useState<{ x: number; y: number; handoverId: string } | null>(null)
  
  // Handover States
  const [handoverModal, setHandoverModal] = useState<{ open: boolean; riderName: string }>({ open: false, riderName: '' })
  const [handoverForm, setHandoverForm] = useState({
    amount: 0,
    payment_method: 'Cash',       
    transaction_type: 'Cash-in',   
    note: ''
  })

  // UI Styles Tailwind configuration
  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const winSelect = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all appearance-none bg-no-repeat bg-[length:0.75rem_auto] bg-[right_1rem_center] cursor-pointer shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"

  // ဘယ်နေရာပဲနှိပ်နှိပ် Context Menu ကို ပြန်ပိတ်ပေးမည့် Event
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null)
      setHandoverContextMenu(null)
    }
    window.addEventListener('click', handleCloseMenu)
    return () => window.removeEventListener('click', handleCloseMenu)
  }, [])

  useEffect(() => {
    if (!previewImage) {
      setImgScale(1)
      setImgRotation(0)
      setImgTranslate({ x: 0, y: 0 })
      setDragStart(null)
      setIsDragging(false)
    }
  }, [previewImage]);

  // ── 1. Initial Load (Auth, Riders နှင့် သိမ်းဆည်းထားသော ရက်စွဲအား ပြန်ထုတ်ခြင်း) ──
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
      return
    }
    
    setUserBranch(storedBranch)
    fetchRiders()
    fetchCities()

    // LocalStorage ထဲတွင် ရွေးခဲ့ဖူးသော Date ရှိမရှိ စစ်ဆေးခြင်း
    const savedDate = localStorage.getItem('transit_selected_date')
    const activeDate = savedDate || today
    if (savedDate) {
      setSelectedDate(savedDate)
    }
    
    fetchData(storedBranch, activeDate)
  }, [router])

  // ── Date ပြောင်းလဲချိန်တွင် အသုံးပြုမည့် သီးသန့် Handler ──
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    localStorage.setItem('transit_selected_date', newDate) // LocalStorage ထဲသို့ အသစ်သိမ်းမည်
    fetchData(userBranch, newDate)
  }

  const fetchData = async (branchCode?: string, targetDate?: string) => {
    const activeBranch = branchCode || userBranch;
    const activeDate = targetDate || selectedDate;
    if (!activeBranch) return;

    setLoading(true)

    try {
    // 🎯 ၁။ activeBranch သို့မဟုတ် activeDate မရောက်သေးပါက Query မဆွဲဘဲ ရပ်ထားမည်
if (!activeBranch || !activeDate) return;

// ၂။ Orders များအားဆွဲထုတ်ခြင်း
const { data: ordersData, error: ordersError } = await apiClient
  .from('orders')
  .select(`
    *,
    pickup_rider:riders!orders_pickup_rider_id_fkey(name),
    deliver_rider:riders!orders_deliver_rider_id_fkey(name)
  `)
  .eq('is_deleted', false)
  .eq('deliver_date', activeDate)
  // 🌟 JSONB Filter ကို PostgREST filter 'cs' (Contains) ဖြင့် အမှားအယွင်းမရှိအောင် အတိအကျ စစ်ထုတ်ခြင်း
  .filter('transit', 'cs', `[{"transit_from": "${activeBranch}"}]`)
  .order('created_at', { ascending: false });

if (ordersError) {
  // 🌟 Error အတိအကျကို Console တွင် မြင်ရအောင် Print ထုတ်ခြင်း
  console.error('Orders Error Details:', {
    message: ordersError.message,
    details: ordersError.details,
    hint: ordersError.hint,
    code: ordersError.code,
  });
  alert(`Orders fetch failed: ${ordersError.message || ordersError.details || 'Unknown Error'}`);
} else {
  // 🌟 Filter လုပ်ပြီးတာနဲ့ activeBranch နဲ့ ကိုက်ညီသော transit_to & transit_date များကို Mapping လုပ်ခြင်း
  const mappedOrders = (ordersData || [])
    .filter((order: any) => {
      const transitList = Array.isArray(order.transit) ? order.transit : [];
      return transitList.length > 0 && transitList.some((leg: any) => leg.transit_from === activeBranch || leg.transit_form === activeBranch);
    })
    .map((order: any) => {
      const transitList = Array.isArray(order.transit) ? order.transit : [];
      
      // activeBranch နဲ့ ကိုက်ညီတဲ့ transit leg ကို ရှာယူခြင်း
      const activeLeg = transitList.find((leg: any) => leg.transit_from === activeBranch || leg.transit_form === activeBranch);

      return {
        ...order,
        // Root level object ထဲသို့ transit_to နှင့် transit_date ကို Extract လုပ်ပြီး ထည့်ပေးခြင်း
        transit_to: activeLeg?.transit_to || order.transit_to || '-',
        transit_date: activeLeg?.transit_date || order.transit_date || '-',
      };
    });

  // Mapped ဖြစ်ပြီးသား data ကို State ထဲ ထည့်ခြင်း
  setReportData(mappedOrders);
}
      // ၂။ Handovers စာရင်းဆွဲထုတ်ခြင်း
      const { data: handoversData, error: handoversError } = await apiClient
        .from('cash_handovers')
        .select('*')
        .eq('branch', activeBranch)
        .eq('date', activeDate)

      if (handoversError) {
        console.error('Handovers Error:', handoversError)
        alert(`Handovers fetch failed: ${handoversError.message || handoversError}`)
      } else {
        setHandovers(handoversData || [])
      }
    } catch (error: any) {
      console.error('Network fetch failed:', error)
      alert(`Network request failed: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

const fetchRiders = async () => {
  const { data, error } = await apiClient.from('riders').select('*')
  if (data) setRiders(data)
}

const fetchCities = async () => {
  const { data, error } = await apiClient.from('cities').select('*')
  if (data) setCities(data)
}

  // ── History Log System ──
  const appendLog = (currentHistory: any[], action: string, note: string) => {
    const operator = userBranch || 'Unknown Office';
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: action,      
      operator: operator,  
      note: note           
    };
    return [...(currentHistory || []), newLogEntry];
  };

  // ── Filter Logics ──
  const isDeliveredLikeStatus = (status: string | null | undefined) => {
    const normalized = String(status || '').trim()
    return normalized === 'Delivered' || normalized === 'Settled'
  }

  const getNormalizedStatus = (status: string | null | undefined) => {
    return isDeliveredLikeStatus(status) ? 'Delivered' : String(status || '').trim() || '-'
  }

  const activeReportData = includeTransitToYGN
    ? reportData
    : reportData.filter(order => order.transit_to !== 'YGN')

  const filteredOrders = activeReportData.filter(o => {
    if (colFilters['global_search']) {
      const query = colFilters['global_search'].toLowerCase()
      const isMatch = 
        String(o.item_id || '').toLowerCase().includes(query) ||
        String(o.receiver_phone || '').toLowerCase().includes(query) ||
        String(o.receiver_name || '').toLowerCase().includes(query) ||
        String(o.sender_name || '').toLowerCase().includes(query)
      if (!isMatch) return false
    }

    return Object.keys(colFilters).every(key => {
      if (key === 'global_search') return true
      const filterValue = colFilters[key]?.toLowerCase()
      if (!filterValue) return true
      let cellValue = ""
      if (key === 'pickup_rider') cellValue = o.pickup_rider?.name || ""
      else if (key === 'deliver_rider') cellValue = o.deliver_rider?.name || ""
      else if (key === 'status') {
        const normalizedStatus = getNormalizedStatus(o.status)
        const normalizedFilter = filterValue === 'settled' ? 'delivered' : filterValue
        cellValue = normalizedStatus
        return cellValue.toLowerCase().includes(normalizedFilter)
      } else {
        cellValue = String(o[key] || "")
      }
      return cellValue.toLowerCase().includes(filterValue)
    })
  })

  

  // Handover အမှတ်တမ်းတစ်ခု ဖျက်ခြင်း
  const deleteHandover = async (handoverId: string) => {
    if (!confirm('ဖျက်မှာသေချာပြီလား?')) return
    
    try {
      const { error } = await apiClient
        .from('cash_handovers')
        .delete()
        .eq('id', handoverId)
      
      if (error) throw error
      alert('အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။')
      fetchData(userBranch, selectedDate)
      setHandoverContextMenu(null)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Handover Submission 
  const submitHandover = async () => {
    if (!handoverModal.riderName) return
    setSubmitting(true)
    try {
      const { error } = await apiClient
        .from('cash_handovers')
        .insert([{
          rider_name: handoverModal.riderName,
          branch: userBranch,
          date: selectedDate,
          amount: handoverForm.amount,
          payment_method: handoverForm.payment_method,
          transaction_type: handoverForm.transaction_type,
          note: handoverForm.note,
          created_at: new Date().toISOString()
        }])

      if (error) throw error
      alert(`${handoverModal.riderName} ရဲ့ အပ်ငွေကို (${handoverForm.transaction_type}) ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ।`)
      setHandoverModal({ open: false, riderName: '' })
      setHandoverForm({ amount: 0, payment_method: 'Cash', transaction_type: 'Cash-in', note: '' })
      fetchData()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

const exportToExcel = () => {
  // ── ၁။ Excel Workbook အသစ် တည်ဆောက်ခြင်း ──
  const workbook = new ExcelJS.Workbook();

  // ==========================================
  // SHEET 1: Workspace Orders (Blue Theme 💙)
  // ==========================================
  const wsMain = workbook.addWorksheet("ရှင်းပြီး Ways များ");
  
  const exportKeys = [
    'item_id', 'received_date', 'sender_name', 'sender_loc', 
    'receiver_name', 'receiver_phone', 'receiver_address', 'receiver_loc', 
    'cod_amount', 'deli_fee', 'fee_type', 'total_amount', 'agent_fee', 
    'status', 'transit_to', 'transit_date'
  ];

  // COLUMN_DEFS မှ Headers နှင့် Keys များကို အစဉ်လိုက် စစ်ထုတ်ခြင်း
  const targetCols = COLUMN_DEFS.filter(col => exportKeys.includes(col.key));
  const mainHeaders = targetCols.map(col => col.label);

  const mainRows = filteredOrders.map(o => {
    return targetCols.map(col => {
      if (col.key === 'pickup_rider') return o.pickup_rider?.name || '-';
      if (col.key === 'deliver_rider') return o.deliver_rider?.name || '-';
      if (['cod_amount', 'deli_fee', 'total_amount', 'agent_fee'].includes(col.key)) {
        return o[col.key] != null ? Number(o[col.key]) : 0; // Number သီးသန့်ပြောင်းမှ Format ချရတာ လှမှာပါ
      }
      return o[col.key] || '-';
    });
  });

  // Excel Native Table ထည့်သွင်းခြင်း
  wsMain.addTable({
    name: 'WorkspaceOrdersTable',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2', // အပြာရောင် လိုင်းကျား Theme
      showRowStripes: true,
    },
    columns: mainHeaders.map(h => ({ name: h })),
    rows: mainRows,
  });

  // ငွေကြေးကော်လံများကို Thousand Separator (#,##0) Format သတ်မှတ်ခြင်း
  targetCols.forEach((col, idx) => {
    if (['cod_amount', 'deli_fee', 'total_amount', 'agent_fee'].includes(col.key)) {
      wsMain.getColumn(idx + 1).numFmt = '#,##0';
    }
  });


  // ==========================================
  // SHEET 2: အပ်ငွေ Summary (Green Theme 💚)
  // ==========================================
  const wsSummary = workbook.addWorksheet("ရှင်းငွေ Summary");
  let grandTotal = 0;
  let grandAgentDeli = 0;
  let grandOfficeDeli = 0;
  let grandActualTotal = 0;

  const summaryRows: any[][] = [];
  cities.forEach(city => {
    const transitOrders = activeReportData.filter(o => 
      o.transit_to === city["C.ID"] && 
      isDeliveredLikeStatus(o.status) && 
      o.deliver_date === selectedDate
    );
    const total = transitOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const cityDeliFeeSum = transitOrders.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
    const cityAgentTotal = transitOrders.reduce((sum, o) => sum + (Number(o.agent_fee) || 0), 0);
    const netDeliFee = cityDeliFeeSum - cityAgentTotal;
    const actualTotal = total - cityAgentTotal;

    if (total === 0 && cityDeliFeeSum === 0) return;

    grandTotal += total;
    grandAgentDeli += cityAgentTotal;
    grandOfficeDeli += netDeliFee;
    grandActualTotal += actualTotal;

    summaryRows.push([`👤 ${city.name}`, total, cityAgentTotal, netDeliFee, actualTotal]);
  });

  if (summaryRows.length > 0) {
    summaryRows.push(['Total', grandTotal, grandAgentDeli, grandOfficeDeli, grandActualTotal]);
  }

  wsSummary.addTable({
    name: 'DepositSummaryTable',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium9', showRowStripes: true }, // အစိမ်းရောင် Theme
    columns: [
      { name: 'City / Rider' },
      { name: 'Total Amount' },
      { name: 'Agent Deli' },
      { name: 'Office Deli' },
      { name: 'Actual Total' }
    ],
    rows: summaryRows,
  });

  // Summary မှ ငွေကြေးကော်လံများ Format ချခြင်း
  for (let i = 2; i <= 5; i++) {
    wsSummary.getColumn(i).numFmt = '#,##0';
  }


  // ==========================================
  // SHEET 3: COD ခွဲဝေမှုစာရင်း (Dark Grey/Teal Theme 🖤)
  // ==========================================
  const wsCod = workbook.addWorksheet("COD Distribution");
  const codRows: any[][] = [];

  Object.entries(senderCodByLoc)
    .map(([loc, senders]) => {
      const locTotal = Object.values(senders).reduce((a, b) => Number(a) + Number(b), 0);
      return { loc, senders, locTotal };
    })
    .filter(item => item.locTotal > 0)
    .sort((a, b) => b.locTotal - a.locTotal)
    .forEach(({ loc, senders }) => {
      Object.entries(senders)
        .filter(([_, totalCod]) => Number(totalCod) > 0)
        .forEach(([senderName, totalCod]) => {
          codRows.push([loc, senderName, Number(totalCod)]);
        });
    });

  wsCod.addTable({
    name: 'CodDistributionTable',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium1', showRowStripes: true }, 
    columns: [
      { name: '📍 Region/Location' },
      { name: '👤 Sender Name' },
      { name: 'COD Amount (Ks)' }
    ],
    rows: codRows,
  });

  wsCod.getColumn(3).numFmt = '#,##0';


  // ==========================================
  // ── ၅။ Auto-fit Columns Width (စာသားအရှည်အလိုက် ကော်လံအကျယ်ညှိခြင်း) ──
  // ==========================================
  workbook.worksheets.forEach(sheet => {
    sheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const valStr = cell.value ? cell.value.toString() : '';
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      // မြန်မာစာလုံးများအတွက် space အနည်းငယ်ပိုချန်ပြီး အနည်းဆုံးအကျယ်ကို ၁၄ ပေးထားပါတယ်
      column.width = Math.max(maxLen + 4, 14); 
    });
  });

  // ── ၆။ File အဖြစ် ပြောင်းလဲပြီး ဒေါင်းလုဒ်ချပေးခြင်း ──
  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Transit_Report_${userBranch || 'Office'}_${selectedDate}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  });
};

  // agent fee တည်းဖြတ်မှုအတွက်
  const [agentFeeValues, setAgentFeeValues] = useState<Record<string, string>>({});

  const updateAgentFee = async (orderId: string, newValue: string) => {
  const numValue = newValue === '' ? null : Number(newValue);
  // Optimistic update - အရင် UI မှာပြောင်း
  setReportData(prev =>
    prev.map(o => (o.id === orderId ? { ...o, agent_fee: numValue } : o))
  );
  // Database update
  const { error } = await apiClient
    .from('orders')
    .update({ agent_fee: numValue })
    .eq('id', orderId);
  if (error) {
    alert('Update failed: ' + error.message);
    // Rollback - မူလဒေတာပြန်ယူမယ် (သို့မဟုတ် refetch)
    fetchData();
  }
};

  // Cell Rendering Styles
  const renderCell = (o: any, key: string) => {

if (key === 'sender_loc' || key === 'receiver_loc') {
      const location = o[key];
      if (location === 'MDY') {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border bg-blue-50 text-blue-700 border-blue-200 shadow-sm">
            MDY
          </span>
        );
      }
      if (location === 'YGN') {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border bg-red-50 text-red-700 border-red-200 shadow-sm">
            YGN
          </span>
        );
      }
      return location || '-';
    }

    if (key === 'branch') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
        o.branch === 'MDY' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'
      }`}>
        {o.branch === 'MDY' ? 'MANDALAY' : 'YANGON'}
      </span>
    )
    if (key === 'status') {
      const normalizedStatus = getNormalizedStatus(o.status)
      return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
          normalizedStatus === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
          normalizedStatus === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
          normalizedStatus === 'On Way' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}>{normalizedStatus}</span>
      )
    }
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
        {o[key]?.toLocaleString() || '0'} Ks
      </span>
    )

if (key === 'agent_fee') {
  const currentVal = agentFeeValues[o.id] ?? (o.agent_fee != null ? o.agent_fee.toString() : '');
  return (
    <input
      type="number"
      className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-orange-500 bg-white"
      value={currentVal}
      onChange={(e) => setAgentFeeValues(prev => ({ ...prev, [o.id]: e.target.value }))}
      onBlur={() => {
        const newVal = agentFeeValues[o.id] ?? (o.agent_fee != null ? o.agent_fee.toString() : '');
        // မပြောင်းဘူးဆိုရင် ဘာမှမလုပ်
        if (newVal !== (o.agent_fee != null ? o.agent_fee.toString() : '')) {
          updateAgentFee(o.id, newVal);
        }
        // state ထဲက ဖယ်ထုတ် (optional: လိုင်းအားလုံး refresh ဖြစ်အောင်)
        setAgentFeeValues(prev => {
          const copy = { ...prev };
          delete copy[o.id];
          return copy;
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onClick={(e) => e.stopPropagation()} // row click မဖြစ်အောင်
    />
  );
}

    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 border border-gray-200">{o[key] || '-'}</span>
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>
    return o[key] || '-'
  }

  // Delivered ဖြစ်ပြီးသား ပါဆယ်များအတွက် Senders နှင့် မြို့အလိုက် COD စာရင်းတွက်ချက်ခြင်း
  const senderCodByLoc = activeReportData
    .filter(o => 
      isDeliveredLikeStatus(o.status) && 
      o.sender_name && 
      o.deliver_date === selectedDate // 👈 ဒီ Filter အခြေအနေကို အသစ်ဖြည့်သွင်းလိုက်တာပါ
    )
    .reduce((acc: Record<string, Record<string, number>>, o) => {
      const loc = o.sender_loc || 'Unknown City';
      const sender = o.sender_name;
      const cod = Number(o.cod_amount || 0);
      
      if (!acc[loc]) acc[loc] = {};
      if (!acc[loc][sender]) acc[loc][sender] = 0;
      acc[loc][sender] += cod;
      return acc;
    }, {});

  const deliveredOrders = activeReportData.filter(o => isDeliveredLikeStatus(o.status));
  const riderSummaryTotal = deliveredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const riderSummaryCashIn = handovers.filter(h => h.transaction_type === 'Cash-in').reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  const riderSummaryOop = handovers.filter(h => h.transaction_type === 'OOP').reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  const riderSummaryGap = riderSummaryTotal - (riderSummaryCashIn + riderSummaryOop);

  // ၁။ Deli Fee စုစုပေါင်းများနှင့် မြို့အလိုက် သတ်မှတ်ချက်များကို အရင်တွက်ချက်သည်
  const tableDeliFeeTotal = activeReportData.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
  const oppositeCity = userBranch === 'MDY' ? 'YGN' : 'MDY';
  const oppositeCityDeliTotal = activeReportData
    .filter(o => o.sender_loc === oppositeCity)
    .reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
  const oppositeCityDeliHalf = oppositeCityDeliTotal / 2;
  const oppositeCityDeliRemaining = tableDeliFeeTotal - oppositeCityDeliHalf;

  const senderLocCount = Object.keys(senderCodByLoc).length;
  const senderCodTotal = Object.values(senderCodByLoc).reduce((acc, senders) => acc + Object.values(senders).reduce((sum, amount) => sum + amount, 0), 0);

  // ၂။ ရုံးခွဲအလိုက် ရှင်းပြီးသား Office Paid စုစုပေါင်းကို တွက်ချက်သည်
  const officePaidTotal = activeReportData
    .filter(o => 
      o.received_date === selectedDate && 
      (o.fee_type === 'Cash' || o.fee_type === 'Kpay') && 
      o.sender_loc === userBranch
    )
    .reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);

  // ၃။ တစ်ဖက်မြို့က ရှင်းလိုက်သည့် Opposite Paid စုစုပေါင်းကို တွက်ချက်သည်
  const oppositePaidTotal = activeReportData
    .filter(o => 
      o.received_date === selectedDate && 
      (o.fee_type === 'Cash' || o.fee_type === 'Kpay') && 
      o.sender_loc === oppositeCity
    )
    .reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);

  // ၄။ ယနေ့ရက်စွဲအတိုင်း Delivered ဖြစ်သွားသည့် Rider ပါဆယ်များ၏ တန်ဖိုးစုစုပေါင်း (grandTotalToPay) ကို ကြိုတင်တွက်ထုတ်သည်
  const grandTotalToPayCalculated = activeReportData
    .filter(o => isDeliveredLikeStatus(o.status) && o.deliver_date === selectedDate)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // ၅။ ✨ သင်အလိုရှိသော ပုံသေနည်းအတိုင်း ဒေတာ ၃ ခုကို ပေါင်းပြီး tableTotalAmount ကို သတ်မှတ်သည်
  const tableTotalAmount = grandTotalToPayCalculated + oppositePaidTotal + officePaidTotal;

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] font-[system-ui] overflow-hidden select-none">
      
      {/* ── Title Bar / Header ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase flex items-center gap-2">
              Transit Report · {userBranch === 'MDY' ? 'Mandalay' : 'Yangon'} Office
            </h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <input 
            type="date" 
            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-md text-xs font-medium text-gray-700" 
            value={selectedDate} 
            onChange={(e) => handleDateChange(e.target.value)} 
          />

          <div className="relative">
            <button 
              onClick={() => setShowColDropdown(!showColDropdown)}
              className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
            >
              Columns
            </button>
            
            {showColDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1.5">Show/Hide Columns</div>
                  {COLUMN_DEFS.map(col => (
                    <label key={col.key} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-xs text-gray-700 font-medium rounded-md">
                      <input 
                        type="checkbox" 
                        className="mr-2 w-4 h-4 text-orange-500 rounded border-gray-300 accent-orange-500"
                        checked={visibleCols[col.key] || false } 
                        onChange={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        disabled={col.key === 'item_id'} 
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIncludeTransitToYGN(prev => !prev)}
            className={`font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all border ${
              includeTransitToYGN
                ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Transit to YGN: {includeTransitToYGN ? 'Included' : 'Excluded'}
          </button>

          <button onClick={() => fetchData(userBranch, selectedDate)} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all">
            Refresh
          </button>
{/* 🟢 အသစ်ထည့်ရမည့် Export Excel Button */}
<button 
  onClick={exportToExcel} 
  className="bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all flex items-center gap-1.5"
>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="w-4 h-4"
  >
    <path d="M3 3h18v18H3z" />
    <path d="M21 9H3" />
    <path d="M21 15H3" />
    <path d="M12 3v18" />
  </svg>
  Export Excel
</button>

        </div>
      </div>

      {/* ── Mobile Global Search & Advanced Dropdown Filters ── */}
      <div className="sm:hidden px-3 py-2 bg-white border-b border-gray-200 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            placeholder="🔍 Global Search (ID၊ ဖုန်း၊ အမည်)..." 
            className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
            value={colFilters['global_search'] || ''} 
            onChange={e => setColFilters(prev => ({ ...prev, global_search: e.target.value }))}
          />
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`px-2 py-1.5 border rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${showMobileFilters ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
          >
            ⚙️ Filter
          </button>
        </div>

        {/* Mobile Advanced Dropdown Selection */}
        {showMobileFilters && (
          <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 animate-in slide-in-from-top-2 duration-100">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Branch</label>
              <select
                className="w-full bg-white border border-gray-200 rounded p-1 text-xs font-medium text-gray-700 focus:outline-none focus:border-orange-500"
                value={colFilters['branch'] || ''}
                onChange={e => setColFilters(prev => ({ ...prev, branch: e.target.value }))}
              >
                <option value="">All Branch</option>
                <option value="MDY">MDY</option>
                <option value="YGN">YGN</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Type</label>
              <select
                className="w-full bg-white border border-gray-200 rounded p-1 text-xs font-medium text-gray-700 focus:outline-none focus:border-orange-500"
                value={colFilters['fee_type'] || ''}
                onChange={e => setColFilters(prev => ({ ...prev, fee_type: e.target.value }))}
              >
                <option value="">All Type</option>
                 <option value="Deli">Deli</option>
                          <option value="Kpay">Kpay</option>
                          <option value="Cash">Cash</option>
                          <option value="Bill">Bill</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Status</label>
              <select
                className="w-full bg-white border border-gray-200 rounded p-1 text-xs font-medium text-gray-700 focus:outline-none focus:border-orange-500"
                value={colFilters['status'] || ''}
                onChange={e => setColFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="At Office">At Office</option>
                <option value="On Way">On Way</option>
                <option value="Delivered">Delivered</option>
                <option value="In-Transit">In-Transit</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Deliver Rider</label>
              <select
                className="w-full bg-white border border-gray-200 rounded p-1 text-xs font-medium text-gray-700 focus:outline-none focus:border-orange-500"
                value={colFilters['deliver_rider'] || ''}
                onChange={e => setColFilters(prev => ({ ...prev, deliver_rider: e.target.value }))}
              >
                <option value="">All Rider</option>
                {riders.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            {Object.values(colFilters).some(v => v !== '') && (
              <button 
                onClick={() => setColFilters({})} 
                className="col-span-2 text-center text-[11px] text-red-600 bg-red-50 py-1 rounded font-semibold border border-red-100 mt-1"
              >
                ❌ Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Mobile Summary Show/Hide Toggle Button */}
        <button
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="w-full bg-orange-50 border border-orange-200 text-orange-700 font-bold px-3 py-1.5 rounded-md text-[11px] flex items-center justify-center gap-1.5 active:bg-orange-100 transition-all"
        >
          {showMobileSummary ? '🙈 Summary ကတ်များ ပြန်ဝှက်ရန်' : '📊 Rider / Sender စာရင်းချုပ်ကြည့်ရန်'}
        </button>
      </div>

           
        
        {/* ── Cards Layout Wrapper (Responsive managed with state) ── */}
      <div className={`${showMobileSummary ? 'grid' : 'hidden sm:grid'} mx-4 mt-3 grid-cols-1 lg:grid-cols-2 gap-4 shrink-0 transition-all`}>

        {/* ========================================================= */}
        {/* ဘယ်ဘက် Column: ကတ် (၁) - Rider Ngwe ရှင်းမှုမှတ်တမ်း Card */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-3 h-full">

        
          
          {/* ထိပ်ဆုံးက Metric Cards ၄ ခု */}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-3 text-xs font-semibold text-orange-900 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase tracking-wide text-orange-600">Total</span>
              <span className="text-right text-sm font-bold">{tableTotalAmount.toLocaleString()} Ks</span>
            </div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-3 text-xs font-semibold text-indigo-900 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase tracking-wide text-indigo-600">Total Deli Fee</span>
              <span className="text-right text-sm font-bold">{tableDeliFeeTotal.toLocaleString()} Ks</span>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-3 text-xs font-semibold text-emerald-900 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase tracking-wide text-emerald-600">{userBranch === 'MDY' ? 'Yangon' : 'Mandalay'} Deli Fee</span>
              <span className="text-right text-sm font-bold">{oppositeCityDeliHalf.toLocaleString()} Ks</span>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-3 text-xs font-semibold text-purple-900 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] uppercase tracking-wide text-purple-600">{userBranch === 'MDY' ? 'Mandalay' : 'Yangon'} Deli Fee</span>
              <span className="text-right text-sm font-bold">{oppositeCityDeliRemaining.toLocaleString()} Ks</span>
            </div>
          </div>

        

          {/* 🔴 🟣 🔵 အသစ်ပြင်ဆင်ထားသော Layout (Image ထဲကအတိုင်း ဘယ်ညာကပ်လျက်) */}
          <div className="flex flex-row bg-white rounded-lg border border-gray-200 shadow-sm h-[320px] overflow-hidden mt-1">
            
            {/* ---------------------------------------------------- */}
            {/* ဘယ်ဘက်ခြမ်း (Purple & Red Areas) - Width 30% */}
            {/* ---------------------------------------------------- */}
            <div className="w-[30%] flex flex-col border-r border-gray-200 shrink-0">
              
              {/* 🟣 ခရမ်းရောင်နေရာ (Top Left Placeholder - ပုံထဲက Title နေရာ) */}


              <div className="h-[100px] p-2 bg-purple-50/40 border-b border-gray-200 relative">
                <div className="absolute inset-1  rounded flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wide text-orange-600">{userBranch === 'MDY' ? 'Yangon' : 'Mandalay'} Paid</span>
              <span className="text-right text-sm font-bold">{oppositePaidTotal.toLocaleString()} Ks</span>
                </div>
              </div>

                   {/* 🟣 ခရမ်းရောင်နေရာ (Top Left Placeholder - ပုံထဲက Title နေရာ) */}
              <div className="h-[100px] p-2 bg-purple-50/40 border-b border-gray-200 relative">
                <div className="absolute inset-1  rounded flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wide text-orange-600">Office Paid</span>
              <span className="text-right text-sm font-bold">{officePaidTotal.toLocaleString()} Ks</span>
                </div>
              </div>

               
              {/* 🔴 အနီရောင်နေရာ (Bottom Left Placeholder - ပုံထဲက Rider Name List နေရာ) */}
              <div className="flex-1 p-2 bg-red-50/40 relative">
                <div className="absolute inset-1 top-2  rounded flex flex-col items-center justify-center">
                   <span className="text-[10px] uppercase tracking-wide text-orange-600">Total</span>
              <span className="text-right text-sm font-bold">{oppositePaidTotal.toLocaleString()} Ks</span>
                </div>
              </div>

           

            </div>

            {/* ---------------------------------------------------- */}
            {/* ညာဘက်ခြမ်း (Blue Area - Table & Buttons) - Width 70% */}
            {/* ---------------------------------------------------- */}
            <div className="w-[70%] p-2 relative bg-blue-50/20 flex flex-col h-full">
              
              {/* 🔵 အပြာရောင် Frame (Box ကို ကွပ်ထားသည်) */}
              
              
              {/* Header & Buttons (Blue Box အတွင်း) */}
              <div className="flex justify-between items-center pb-2 z-10 px-2 pt-1 relative shrink-0">
                <h2 className="text-[11px] font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
                  💵 အပ်ငွေ Summary
                </h2>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setViewHandoverModal(true)}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold px-2.5 py-1 rounded text-[10px] border border-blue-300 shadow-sm transition-all flex items-center gap-1"
                  >
                    အပ်ငွေစရင်း
                  </button>
                  <button 
                    onClick={() => setHandoverModal({ open: true, riderName: riders[0]?.name || '' })}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-2.5 py-1 rounded text-[10px] shadow-sm transition-all flex items-center gap-1"
                  >
                    ငွေထည့်ရန်
                  </button>
                </div>
              </div>

              {/* တွက်ချက်ခြင်းနှင့် Layout တည်ဆောက်ခြင်းအပိုင်း */}
              {(() => {
                let grandTotal = 0;
                let grandAgentDeli = 0;
                let grandOfficeDeli = 0;
                let grandActualTotal = 0;

                // 1. Rider တစ်ယောက်ချင်းစီရဲ့ Data တွက်ချက်ခြင်းအပိုင်း

// 🌟 POL1 နှင့် POL2 အတွက် Custom City စာရင်း သတ်မှတ်ခြင်း
const customCities = [
  { "C.ID": "POL1", name: "Pyin Oo Lwin (SPY)" },
  { "C.ID": "POL2", name: "Pyin Oo Lwin (စိုပြေ)" },
];

// 🌟 Database မှ Cities စာရင်းနှင့် Custom Cities ကို ပေါင်းစပ်ခြင်း (ထပ်နေပါက DB အတိုင်းယူမည်)
const allCities = [
  ...cities,
  ...customCities.filter(custom => !cities.some(c => c["C.ID"] === custom["C.ID"]))
];

const rows = allCities.map(city => {
  const transitOrders = activeReportData.filter(o => 
    o.transit_to === city["C.ID"] && 
    isDeliveredLikeStatus(o.status) && 
    o.deliver_date === selectedDate
  );

  const total = transitOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cityDeliFeeSum = transitOrders.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
  const cityAgentTotal = transitOrders.reduce((sum, o) => sum + (Number(o.agent_fee) || 0), 0);
  const netDeliFee = cityDeliFeeSum - cityAgentTotal;
  const actualTotal = total - cityAgentTotal;

  if (total === 0 && cityDeliFeeSum === 0) return null;

  grandTotal += total;
  grandAgentDeli += cityAgentTotal;
  grandOfficeDeli += netDeliFee;
  grandActualTotal += actualTotal;

  return (
    <tr key={city["C.ID"]} className="hover:bg-blue-50/30 transition-colors">
      <td className="px-2 py-1.5 font-semibold text-gray-900 truncate" title={city.name}>👤 {city.name}</td>
      <td className="px-2 py-1.5 text-right font-mono text-gray-900">{total.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right font-mono text-blue-600">{cityAgentTotal.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right font-mono text-purple-600">{netDeliFee.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right font-mono">{actualTotal.toLocaleString()}</td>
    </tr>
  );
}).filter(Boolean);

               

                return (
                  <div className="flex-1 min-h-0 flex flex-col rounded border border-blue-200 bg-white mx-1 mb-1 z-10 shadow-inner">
                    
                    {/* 🟢 အပေါ်ဘက်ခြမ်း: ရိုးရိုး Data Row များပြသပေးပြီး Content များလာပါက Scroll ဆွဲနိုင်မည့် Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-[11px] whitespace-nowrap table-fixed">
                        <thead className="bg-blue-50/50 text-gray-600 font-bold uppercase text-[9px] tracking-wider border-b border-blue-100 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-2 w-[24%]">City</th>
                            <th className="px-2 py-2 text-right w-[19%]">Total</th>
                            <th className="px-2 py-2 text-right w-[19%]">Agent Deli</th>
                            <th className="px-2 py-2 text-right w-[19%]">Office Deli</th>
                            <th className="px-2 py-2 text-right w-[19%]">Actural Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-gray-400 font-medium">
                                ယနေ့အတွက် Rider စာရင်းချုပ် မရှိသေးပါ။
                              </td>
                            </tr>
                          ) : (
                            rows
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* 🔵 အောက်ဘက်ခြမ်း: ဒေတာ ရှိရှိမရှိရှိ အောက်ခြေမှာ Layout အရ အမြဲတမ်း Fixed ကပ်နေမည့် Total Footer Area */}
                    <div className="bg-blue-50 border-t-2 border-blue-200 font-bold text-gray-950 shadow-sm shrink-0">
                      <table className="w-full text-left text-[11px] whitespace-nowrap table-fixed">
                        <tbody>
                          <tr className="font-bold">
                            <td className="px-2 py-2 text-blue-900 font-bold w-[24%]">Total</td>
                            <td className="px-2 py-2 text-right font-mono text-blue-900 w-[19%]">{grandTotal.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono text-blue-700 w-[19%]">{grandAgentDeli.toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-mono text-purple-700 w-[19%]">{grandOfficeDeli.toLocaleString()}</td>
                            <td className={`px-2 py-2 text-right font-mono w-[19%] `}> {grandActualTotal.toLocaleString()} </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                );
              })()}

            </div>
              
          </div>
        </div>

        {/* ========================================================= */}
        {/* ဒီအောက်မှာ ညာဘက်ခြမ်း COD ခွဲဝေမှုကတ် တွေ ဆက်ရှိနေမှာပါ... */}
        {/* ========================================================= */}
        
      
       
        {/* ကတ် (၂) - Sender အလိုက် ပြန်ပေးရမယ့် COD စာရင်း Card */}
<div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3 h-full">
  <div className="border-b border-gray-100 pb-2 shrink-0">
    <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
       COD ခွဲဝေမှု စာရင်း
    </h2>
  </div>

  {/* Outer Scrollable Area */}
  <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
    {(() => {
      // ၁။ ဒေတာများကို ပမာဏတွက်ချက်ပြီး၊ ၀ ဖြစ်နေလျှင် ဖယ်ထုတ်ကာ၊ အများဆုံးမှ အနည်းဆုံးသို့ စီခြင်း
      const sortedAndFilteredLocs = Object.entries(senderCodByLoc)
        .map(([loc, senders]) => {
          const locTotal = Object.values(senders).reduce((a, b) => Number(a) + Number(b), 0);
          return { loc, senders, locTotal };
        })
        .filter(item => item.locTotal !== 0) // စုစုပေါင်းပမာဏ ၀ ပြား ဖြစ်နေသော မြို့များကို ဖျောက်ထားရန်
        .sort((a, b) => b.locTotal - a.locTotal); // COD အများဆုံးမြို့ကို ထိပ်ဆုံးသို့ တင်ရန်

      // ပြစရာ မြို့စာရင်း လုံးဝမရှိတော့ပါက
      if (sortedAndFilteredLocs.length === 0) {
        return (
          <div className="h-full flex items-center justify-center text-xs text-gray-400 font-medium py-8">
            ယနေ့အတွက် Delivered ဖြစ်ပြီးသား COD ပေးရန်မရှိသေးပါ။
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedAndFilteredLocs.map(({ loc, senders, locTotal }) => (
            // 💡 သတ်မှတ်ထားသော အမြင့် h-80 ကို ပုံသေ အသုံးပြုထားပါသည်
            <div key={loc} className="p-3 border border-orange-100 rounded-lg bg-orange-50/20 flex flex-col gap-2 shadow-sm h-80">
              
              {/* မြို့အလိုက် Header အကွက် */}
              <div className="font-bold text-orange-800 text-xs border-b border-orange-200/60 pb-1 flex items-center justify-between shrink-0">
                <span>📍 City/LOC: {loc}</span>
                <span className="text-[10px] bg-orange-100 px-1.5 py-0.5 rounded text-orange-700 font-bold">
                  {locTotal.toLocaleString()} Ks
                </span>
              </div>

              {/* Sender များစာရင်း (မဆန့်ပါက ကတ်ထဲတွင် Scroll ဆွဲနိုင်သည်) */}
              <div className="text-[11px] space-y-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                {Object.entries(senders)
                  .filter(([_, totalCod]) => Number(totalCod) !== 0) // Sender တစ်ဦးချင်းစီတွင် ၀ ဖြစ်နေပါက ဖျောက်ထားရန်
                  .map(([senderName, totalCod]) => (
                    <div key={senderName} className="flex justify-between items-center bg-white p-1.5 rounded border border-gray-100 shadow-xs">
                      <span className="font-medium text-gray-700 truncate max-w-[110px]" title={senderName}>👤 {senderName}</span>
                      <span className="font-bold text-gray-900">{Number(totalCod).toLocaleString()} Ks</span>
                    </div>
                  ))}
              </div>

            </div>
          ))} {/* 💡 အပိတ် Error ကို ဒီနေရာမှာ သေချာပြင်ဆင်ထားပါတယ်ဗျာ */}
        </div>
      );
    })()}
  </div>
</div>

      </div>

      {/* ── Workspace Table / List Area (Flex item optimized) ── */}
      <div className="flex-1 overflow-auto bg-white sm:mx-4 sm:my-3 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
        
        {/* Desktop View Table */}
        <div className="hidden sm:block">
          <table className="w-full text-left whitespace-nowrap text-[12px]">
            <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(229,231,235,1)]">
              <tr className="text-gray-400 border-b border-gray-200 bg-gray-50/70">
                {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                  <th key={col.key} className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                    {col.label}
                  </th>
                ))}
              </tr>
              
              {/* Filter Layout */}
              <tr>
                {COLUMN_DEFS.map(col => {
                  if (!visibleCols[col.key]) return null;

                  return (
                    <td key={col.key} className="px-3 py-1.5">
                      {col.key === 'image_url' ? (
                        <div className="h-4"></div>
                      ) : col.key === 'branch' ? (
                        <select
                          className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px] text-gray-700 font-medium cursor-pointer"
                          value={colFilters[col.key] || ''}
                          onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        >
                          <option value="">All Branch</option>
                          <option value="MDY">MDY</option>
                          <option value="YGN">YGN</option>
                        </select>
                      ) : col.key === 'fee_type' ? (
                        <select
                          className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px] text-gray-700 font-medium cursor-pointer"
                          value={colFilters[col.key] || ''}
                          onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        >
                          <option value="">All Type</option>
                          <option value="Deli">Deli</option>
                          <option value="Kpay">Kpay</option>
                          <option value="Cash">Cash</option>
                          <option value="Bill">Bill</option>
                        </select>
                      ) : col.key === 'status' ? (
                        <select
                          className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px] text-gray-700 font-medium cursor-pointer"
                          value={colFilters[col.key] || ''}
                          onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        >
                          <option value="">All Status</option>
                          <option value="At Office">At Office</option>
                          <option value="On Way">On Way</option>
                          <option value="Delivered">Delivered</option>
                          <option value="In-Transit">In-Transit</option>
                        </select>
                      ) : col.key === 'pickup_rider' || col.key === 'deliver_rider' ? (
                        <select
                          className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px] text-gray-700 font-medium cursor-pointer"
                          value={colFilters[col.key] || ''}
                          onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        >
                          <option value="">All Rider</option>
                          {riders.map(r => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder={`Filter ${col.label}...`}
                          className="w-full bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none py-0.5 text-[11px]"
                          value={colFilters[col.key] || ''}
                          onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_DEFS.length} className="text-center py-10 font-medium text-gray-400">Loading Report Logs...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_DEFS.length} className="text-center py-10 font-medium text-gray-400">ယနေ့ရက်စွဲအတွက် ပါဆယ်မှတ်တမ်း မရှိသေးပါ။</td>
                </tr>
              ) : filteredOrders.map(o => (
                <tr 
                  key={o.id} 
                  className="hover:bg-gray-50/80 transition-colors cursor-context-menu"
                  onContextMenu={(e) => {
                    e.preventDefault(); 
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      order: o
                    });
                  }}
                >
                  {COLUMN_DEFS.map(col => visibleCols[col.key] && (
                    <td key={col.key} className="px-4 py-2.5 font-medium">
                      {renderCell(o, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View Responsive Cards */}
        <div className="sm:hidden flex flex-col divide-y divide-gray-100 pb-20">
          {loading ? (
            <p className="text-center py-8 text-xs text-gray-400 font-medium">Loading Report Logs...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-xs text-gray-400 font-medium">ယနေ့ရက်စွဲအတွက် ပါဆယ်မှတ်တမ်း မရှိသေးပါ။</p>
          ) : filteredOrders.map(o => (
            <div key={o.id} className="p-4 bg-white flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 text-sm">{o.item_id}</span>
                 {o.image_url ? (
  /* ပုံရှိလျှင် */
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); setPreviewImage(o.image_url); }}
    className="p-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
    title="ပုံကြည့်ရန် နှိပ်ပါ"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </button>
) : (
  /* ပုံမရှိလျှင် */
  <span className="p-1 text-gray-300 bg-gray-50 rounded-md" title="ပုံမရှိပါ">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  </span>
)}
                </div>
                <div className="flex gap-1.5 items-center">
                  {renderCell(o, 'status')}
                  <button 
                    onClick={() => setEditingOrder(o)}
                    className="p-1 px-2.5 bg-orange-50 border border-orange-200 text-orange-600 rounded font-semibold text-[11px]"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-600 space-y-1 mt-0.5">
                <p><span className="text-gray-400">Sender:</span> <strong className="text-gray-700">{o.sender_name}</strong> ({o.sender_loc})</p>
                <p><span className="text-gray-400">Receiver:</span> <strong className="text-gray-700">{o.receiver_name}</strong> - {o.receiver_phone}</p>
                <p><span className="text-gray-400">Total Amount:</span> <strong className="text-gray-900">{o.total_amount?.toLocaleString()} Ks</strong> ({o.fee_type})</p>
                {o.note && <p className="text-[11px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit mt-1">⚠️ {o.note === 'RT' ? 'Return Item' : o.note}</p>}
              </div>

              {/* Expand Toggle Button */}
              <div className="pt-1.5 border-t border-dashed border-gray-100 mt-1 flex justify-between items-center">
                <button 
                  onClick={() => setExpandedMobileCards(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                  className="text-[11px] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-0.5"
                >
                  {expandedMobileCards[o.id] ? "🔼 အချက်အလက်များ သိမ်းရန်" : "🔽 အချက်အလက်အားလုံး ပြရန်"}
                </button>
              </div>

              {/* Expanded All Fields Details View */}
              {expandedMobileCards[o.id] && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-1 animate-in fade-in duration-100">
                  <div><span className="text-gray-400 block">Received Date:</span> <span className="text-gray-800 font-semibold">{o.received_date || '-'}</span></div>
                  <div><span className="text-gray-400 block">Branch:</span> <span className="text-gray-800 font-semibold">{o.branch || '-'}</span></div>
                  <div><span className="text-gray-400 block">COD Amount:</span> <span className="text-gray-800 font-semibold">{o.cod_amount?.toLocaleString() || 0} Ks</span></div>
                  <div><span className="text-gray-400 block">Deli Fee:</span> <span className="text-gray-800 font-semibold">{o.deli_fee?.toLocaleString() || 0} Ks</span></div>
                  <div><span className="text-gray-400 block">Pickup By:</span> <span className="text-gray-800 font-semibold">{o.pickup_rider?.name || '-'}</span></div>
                  <div><span className="text-gray-400 block">Deliver By:</span> <span className="text-gray-800 font-semibold">{o.deliver_rider?.name || '-'}</span></div>
                  <div><span className="text-gray-400 block">Deliver Date:</span> <span className="text-gray-800 font-semibold">{o.deliver_date || '-'}</span></div>
                  <div><span className="text-gray-400 block">Cleared Date:</span> <span className="text-gray-800 font-semibold">{o.cleared_date || '-'}</span></div>
                  <div className="col-span-2"><span className="text-gray-400 block">Full Address:</span> <span className="text-gray-800 font-semibold break-words">{o.receiver_address || '-'}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* ── ပြင်ပမှ ခေါ်သုံးထားသော Edit Order Modal ── */}
<EditOrderModal 
  isOpen={editingOrder !== null} 
  onClose={() => setEditingOrder(null)} 
  orderData={editingOrder} 
  onSaveSuccess={() => {
    fetchData(); // Update အောင်မြင်သွားရင် Report စာရင်းထဲမှာ Data ချက်ချင်း Refresh ဖြစ်သွားအောင် ပြန်ခေါ်ပေးခြင်း
  }} 
/>

      {/* ── Add Cash / Handover Modal ── */}
      {handoverModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">💵ငွေအပ်မှတ်တမ်းသွင်းရန်</h3>
              <button onClick={() => setHandoverModal({ open: false, riderName: '' })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            
            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className={labelStyle}>Rider Name</label>
                <select 
                  className={winSelect} 
                  value={handoverModal.riderName} 
                  onChange={e => setHandoverModal({ ...handoverModal, riderName: e.target.value })}
                >
                  {riders.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelStyle}>Amount (Ngwe ပမာဏ)</label>
                <input 
                  type="number" 
                  className={winInput} 
                  value={handoverForm.amount} 
                  onChange={e => setHandoverForm({...handoverForm, amount: Number(e.target.value)})} 
                />
              </div>

              <div>
                <label className={labelStyle}>Payment Method</label>
                <select 
                  className={winSelect} 
                  value={handoverForm.payment_method} 
                  onChange={e => setHandoverForm({...handoverForm, payment_method: e.target.value})}
                >
                  <option value="Cash">Cash</option>
                  <option value="Kpay">Kpay</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Transaction Type (အမျိုးအစား)</label>
                <select 
                  className={winSelect} 
                  value={handoverForm.transaction_type} 
                  onChange={e => setHandoverForm({...handoverForm, transaction_type: e.target.value})}
                >
                  <option value="Cash-in">အပ်ငွေ</option>
                  <option value="OOP">စိုက်ငွေ</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Note</label>
                <input 
                  type="text" 
                  placeholder="မှတ်ချက်ရှိပါက ဖြည့်သွင်းရန်..."
                  className={winInput} 
                  value={handoverForm.note} 
                  onChange={e => setHandoverForm({...handoverForm, note: e.target.value})} 
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => setHandoverModal({ open: false, riderName: '' })} 
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={submitHandover} 
                disabled={submitting}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Cash Handovers History Popup Modal (Split Tables View) ── */}
      {viewHandoverModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">📋 ငွေအပ်နှံမှုနှင့် စိုက်ငွေမှတ်တမ်း</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">ရက်စွဲ - {selectedDate} · ရုံးခွဲ - {userBranch === 'MDY' ? 'Mandalay' : 'Yangon'}</p>
              </div>
              <button onClick={() => setViewHandoverModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            {/* Modal Body / Split Table Comparative View */}
            <div className="flex-1 overflow-auto p-5">
              {handovers.length === 0 ? (
                <p className="text-center py-12 text-xs text-gray-400 font-medium">ယနေ့ရက်စွဲအတွက် စာရင်းမှတ်တမ်း မရှိသေးပါ။</p>
              ) : (
                (() => {
                  // Transaction Type အလိုက် စာရင်းခွဲထုတ်ခြင်း
                  const cashInItems = handovers.filter(h => h.transaction_type !== 'OOP');
                  const oppItems = handovers.filter(h => h.transaction_type === 'OOP');
                  
                  // စုစုပေါင်း ငွေပမာဏတွက်ချက်ခြင်း
                  const totalCashIn = cashInItems.reduce((sum, h) => sum + (h.amount || 0), 0);
                  const totalOpp = oppItems.reduce((sum, h) => sum + (h.amount || 0), 0);

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* 💰 TABLE 1: CASH IN (ငွေဝင်စာရင်း) */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100 px-3">
                          <span className="text-xs font-bold text-green-800">အပ်ငွေ</span>
                          <span className="text-xs font-mono font-bold text-green-700">Total: {totalCashIn.toLocaleString()} Ks</span>
                        </div>
                        <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-[50vh]">
                          <table className="w-full text-left whitespace-nowrap text-xs">
                            <thead className="sticky top-0 bg-gray-100 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 shadow-sm">
                              <tr>
                                <th className="px-3 py-2">Rider Name</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                                <th className="px-3 py-2">Method</th>
                                <th className="px-3 py-2">Note</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                              {cashInItems.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-[11px]">အပ်ငွေမရှိပါ။</td></tr>
                              ) : (
                                cashInItems.map((h) => (
                                  <tr 
                                    key={h.id} 
                                    className="hover:bg-gray-50/60 transition-colors cursor-context-menu"
                                    onContextMenu={(e) => {
                                      e.preventDefault()
                                      setHandoverContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        handoverId: h.id
                                      })
                                    }}
                                  >
                                    <td className="px-3 py-2 text-gray-900 font-semibold">👤 {h.rider_name}</td>
                                    <td className="px-3 py-2 text-right font-bold text-green-600">{h.amount?.toLocaleString()} Ks</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.payment_method === 'Kpay' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                        {h.payment_method}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={h.note}>{h.note || '-'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 💸 TABLE 2: OPP (အထွေထွေအသုံးစရိတ်စာရင်း) */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center bg-purple-50 p-2 rounded-lg border border-purple-100 px-3">
                          <span className="text-xs font-bold text-purple-800">စိုက်ငွေ</span>
                          <span className="text-xs font-mono font-bold text-purple-700">Total: {totalOpp.toLocaleString()} Ks</span>
                        </div>
                        <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-[50vh]">
                          <table className="w-full text-left whitespace-nowrap text-xs">
                            <thead className="sticky top-0 bg-gray-100 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 shadow-sm">
                              <tr>
                                <th className="px-3 py-2">Rider Name</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                                <th className="px-3 py-2">Method</th>
                                <th className="px-3 py-2">Note</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                              {oppItems.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-[11px]">စိုက်ငွေ မရှိပါ။</td></tr>
                              ) : (
                                oppItems.map((h) => (
                                  <tr 
                                    key={h.id} 
                                    className="hover:bg-gray-50/60 transition-colors cursor-context-menu"
                                    onContextMenu={(e) => {
                                      e.preventDefault()
                                      setHandoverContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        handoverId: h.id
                                      })
                                    }}
                                  >
                                    <td className="px-3 py-2 text-gray-900 font-semibold">👤 {h.rider_name}</td>
                                    <td className="px-3 py-2 text-right font-bold text-purple-600">{h.amount?.toLocaleString()} Ks</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.payment_method === 'Kpay' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                        {h.payment_method}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={h.note}>{h.note || '-'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button 
                onClick={() => setViewHandoverModal(false)} 
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-semibold text-gray-700 transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Preview Modal ── */}
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

      {/* ── Custom Right-Click Context Menu ── */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 z-[100] w-40 text-xs font-semibold text-gray-700 border-l-4 border-l-orange-500"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
            Options
          </div>
          <button 
            onClick={() => {
              setEditingOrder(contextMenu.order);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
          >
            ✏️ Edit Order
          </button>
        </div>
      )}

      {/* ── Cash Handover Context Menu ── */}
      {handoverContextMenu && (
        <div 
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 z-[100] w-40 text-xs font-semibold text-gray-700 border-l-4 border-l-red-500"
          style={{ top: handoverContextMenu.y, left: handoverContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
            Actions
          </div>
          <button 
            onClick={() => deleteHandover(handoverContextMenu.handoverId)}
            className="w-full text-left px-3 py-2 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors text-red-600 font-semibold"
          >
            🗑️ Delete Record
          </button>
        </div>
      )}

    </div>
  )
}