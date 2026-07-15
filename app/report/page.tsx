"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import EditOrderModal from '@/components/EditOrderModal'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs';

// ── Column အားလုံးသတ်မှတ်ချက် ──
const COLUMN_DEFS = [
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
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
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'image_url', label: 'Photo', defaultVisible: true }, 
  { key: 'pickup_rider', label: 'Pickup By', defaultVisible: true },
  { key: 'deliver_rider', label: 'Deliver By', defaultVisible: true },
  { key: 'deliver_date', label: 'Deliver Date', defaultVisible: true },
  { key: 'note', label: 'Note', defaultVisible: true },
  { key: 'transit_to', label: 'Transit To', defaultVisible: false },
]

export default function DailyReport() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  
  // ── States ဆိုင်ရာ သတ်မှတ်ချက်များ ──
  const [selectedDate, setSelectedDate] = useState(today)
  const [reportData, setReportData] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userBranch, setUserBranch] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [handovers, setHandovers] = useState<any[]>([])


  

  
  
  // Mobile ပေါ်မှာ Summary ကတ်တွေကို ပိတ်/ဖွင့် လုပ်ဖို့ State (ဖုန်းမှာ နေရာမရှုပ်အောင် ပုံမှန်ကို Hidden ထားပါမည်)
  const [showMobileSummary, setShowMobileSummary] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [expandedMobileCards, setExpandedMobileCards] = useState<Record<string, boolean>>({})
  
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

    // LocalStorage ထဲတွင် ရွေးခဲ့ဖူးသော Date ရှိမရှိ စစ်ဆေးခြင်း
    const savedDate = localStorage.getItem('report_selected_date')
    const activeDate = savedDate || today
    if (savedDate) {
      setSelectedDate(savedDate)
    }
    
    fetchData(storedBranch, activeDate)
  }, [router])

  // ── Date ပြောင်းလဲချိန်တွင် အသုံးပြုမည့် သီးသန့် Handler ──
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    localStorage.setItem('report_selected_date', newDate) // LocalStorage ထဲသို့ အသစ်သိမ်းမည်
    fetchData(userBranch, newDate)
  }

  const fetchData = async (branchCode?: string, targetDate?: string) => {
    const activeBranch = branchCode || userBranch;
    const activeDate = targetDate || selectedDate;
    if (!activeBranch) return;

    setLoading(true)

    try {
      // ၁။ Orders များအားဆွဲထုတ်ခြင်း
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          pickup_rider:riders!orders_pickup_rider_id_fkey(name),
          deliver_rider:riders!orders_deliver_rider_id_fkey(name)
        `)
        .eq('is_deleted', false)
// ✨ Logic အသစ်အရ Master .or() တစ်ခုတည်းအောက်မှာ စုစည်းပေးလိုက်ပါပြီ
.or(`and(deliver_date.eq."${activeDate}",or(and(branch.eq."${activeBranch}",transit_to.is.null),and(branch.neq."${activeBranch}",transit_to.eq."${activeBranch}"))),and(fee_type.in.(Cash,Kpay),received_date.eq."${activeDate}",or(branch.eq."${activeBranch}",transit_to.eq."${activeBranch}"))`)
.order('created_at', { ascending: false })

      if (ordersError) {
        console.error('Orders Error:', ordersError)
        alert(`Orders fetch failed: ${ordersError.message || ordersError}`)
      } else {
        setReportData(ordersData || [])
      }

      // ၂။ Handovers စာရင်းဆွဲထုတ်ခြင်း (.eq မှာတော့ "" ထည့်စရာမလိုပါ)
      const { data: handoversData, error: handoversError } = await supabase
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
    const { data, error } = await supabase.from('riders').select('*')
    if (data) setRiders(data)
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
  const filteredOrders = reportData.filter(o => {
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
      else cellValue = String(o[key] || "")
      return cellValue.toLowerCase().includes(filterValue)
    })
  })

  // 💡 (ကုဒ်သစ်) ရွေးချယ်ထားသော ပါဆယ် ID များကို ထိန်းချုပ်ရန် State
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// 💡 (ကုဒ်သစ်) Select All အားလုံးကို တစ်ပြိုင်နက် ရွေးရန်/ဖျက်ရန်
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    const allVisibleIds = filteredOrders.map(o => o.id);
    setSelectedIds(allVisibleIds);
  } else {
    setSelectedIds([]);
  }
};

// 💡 (ကုဒ်သစ်) တစ်ကွက်ချင်းစီ Checkbox နှိပ်ပုံ
const handleSelectRow = (id: string, checked: boolean) => {
  if (checked) {
    setSelectedIds(prev => [...prev, id]);
  } else {
    setSelectedIds(prev => prev.filter(itemId => itemId !== id));
  }
};

// 💡 (ကုဒ်သစ်) ရွေးချယ်ထားသော ပါဆယ်များ၏ အရေအတွက်နှင့် ပမာဏများကို တွက်ချက်ခြင်း
const selectedOrders = filteredOrders.filter(o => selectedIds.includes(o.id));
const totalSelectedCount = selectedOrders.length;

const totalCod = selectedOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);
const totalDeliFee = selectedOrders.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
const grandTotal = selectedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  

  // Handover အမှတ်တမ်းတစ်ခု ဖျက်ခြင်း
  const deleteHandover = async (handoverId: string) => {
    if (!confirm('ဖျက်မှာသေချာပြီလား?')) return
    
    try {
      const { error } = await supabase
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
      const { error } = await supabase
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
    if (key === 'status') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
        o.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
        o.status === 'On Way' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
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
    ) : <span className="text-gray-400 font-mono text-[10px]">-</span>
    
    if (['cod_amount', 'deli_fee', 'total_amount'].includes(key)) return (
      <span className={key === 'total_amount' ? 'font-bold text-gray-900' : ''}>
        {o[key]?.toLocaleString() || '0'} Ks
      </span>
    )
    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 border border-gray-200">{o[key] || '-'}</span>
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>
    return o[key] || '-'
  }

  
  // Delivered ဖြစ်ပြီးသား ပါဆယ်များအတွက် Senders နှင့် မြို့အလိုက် COD စာရင်းတွက်ချက်ခြင်း
  const senderCodByLoc = reportData
    .filter(o => 
      o.status === 'Delivered' &&       // 👈 ၁။ Status သည် Delivered ဖြစ်ရမည်
      o.sender_name &&                  // 👈 ၂။ Sender အမည် ပါဝင်ရမည်
      o.deliver_date === selectedDate   // 👈 ၃။ ယနေ့ ရက်စွဲနှင့် ကိုက်ညီရမည်
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

  const deliveredOrders = reportData.filter(o => o.status === 'Delivered');
  const riderSummaryTotal = deliveredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const riderSummaryCashIn = handovers.filter(h => h.transaction_type === 'Cash-in').reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  const riderSummaryOop = handovers.filter(h => h.transaction_type === 'OOP').reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  const riderSummaryGap = riderSummaryTotal - (riderSummaryCashIn + riderSummaryOop);

  // ၂။ ရုံးခွဲအလိုက် ရှင်းပြီးသား Office Paid စုစုပေါင်းကို တွက်ချက်သည်
  const officePaidTotal = reportData
    .filter(o => 
      o.received_date === selectedDate && 
      (o.fee_type === 'Cash' || o.fee_type === 'Kpay') && 
      o.receiver_loc === userBranch
    )
    .reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);

  // ၁။ Deli Fee စုစုပေါင်းများနှင့် မြို့အလိုက် သတ်မှတ်ချက်များကို အရင်တွက်ချက်သည်
  const billdeliTotal = reportData.reduce((sum, o) => 
  sum + ((o.status === 'Delivered' && (o.fee_type === 'Deli' || o.fee_type === 'Bill')) ? (Number(o.deli_fee) || 0) : 0), 
  0
);

const tableDeliFeeTotal = officePaidTotal + billdeliTotal;

  const oppositeCity = userBranch === 'MDY' ? 'YGN' : 'MDY';
  const oppositeCityDeliTotal = reportData.reduce((sum, o) => 
  sum + ((o.sender_loc === oppositeCity && o.status === 'Delivered') ? (Number(o.deli_fee) || 0) : 0), 
  0
);
  const oppositeCityDeliHalf = oppositeCityDeliTotal / 2;
  const oppositeCityDeliRemaining = tableDeliFeeTotal - oppositeCityDeliHalf;

  const senderLocCount = Object.keys(senderCodByLoc).length;
  const senderCodTotal = Object.values(senderCodByLoc).reduce(
    (acc, senders) => acc + Object.values(senders).reduce((sum, amount) => sum + amount, 0), 
    0
  );
  

  // ၃။ တစ်ဖက်မြို့က ရှင်းလိုက်သည့် Opposite Paid စုစုပေါင်းကို တွက်ချက်သည်
  const oppositePaidTotal = reportData
    .filter(o => 
      o.received_date === selectedDate && 
      (o.fee_type === 'Cash' || o.fee_type === 'Kpay') && 
      o.receiver_loc === oppositeCity
    )
    .reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);

  // ၄။ ယနေ့ရက်စွဲအတိုင်း Delivered ဖြစ်သွားသည့် Rider ပါဆယ်များ၏ တန်ဖိုးစုစုပေါင်း (grandTotalToPay) ကို ကြိုတင်တွက်ထုတ်သည်
  const grandTotalToPayCalculated = reportData
    .filter(o => o.status === 'Delivered' && o.deliver_date === selectedDate)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // ၅။ ✨ သင်အလိုရှိသော ပုံသေနည်းအတိုင်း ဒေတာ ၃ ခုကို ပေါင်းပြီး tableTotalAmount ကို သတ်မှတ်သည်
  const tableTotalAmount = grandTotalToPayCalculated + oppositePaidTotal + officePaidTotal;

  const handleExportFullExcel = async () => {
  if (filteredOrders.length === 0) {
    alert("Export လုပ်ရန် ပါဆယ်ဒေတာမရှိပါ။");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const branchName = userBranch === 'MDY' ? 'Mandalay' : 'Yangon';

  // ========== အသုံးပြုမယ့် Style ပုံစံများ ==========
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  const dataStyle: Partial<ExcelJS.Style> = {
    alignment: { vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  const moneyStyle: Partial<ExcelJS.Style> = {
    ...dataStyle,
    numFmt: '#,##0',   // ဂဏန်းတွေကို comma ခံပြီးပြမယ် (ဒဿမမပါ)
  };

  // ============================================================
  // SHEET 1: စာရင်းချုပ် (Summary Dashboard)
  // ============================================================
  const wsSummary = workbook.addWorksheet('စာရင်းချုပ် (Summary)');
  wsSummary.columns = [
    { header: 'အမျိုးအမည် (Metric)', key: 'metric', width: 42 },
    { header: 'ပမာဏ / အချက်အလက် (Value)', key: 'value', width: 28 },
  ];

  // Header row style
  const summaryHeaderRow = wsSummary.getRow(1);
  summaryHeaderRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  const totalCodAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);
  const totalDeliFeeAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0);
  const totalNetAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const summaryRows = [
    { metric: 'အစီရင်ခံစာ ရက်စွဲ (Report Date)', value: selectedDate },
    { metric: 'ဂိတ်ခွဲ (Branch)', value: branchName },
    { metric: 'စုစုပေါင်း ပါဆယ်အရေအတွက်', value: `${filteredOrders.length} ထုပ်` },
    { metric: '----------------------------------------', value: '-------------------' },
    { metric: 'စုစုပေါင်း ရရန်ရှိသော COD (Total COD)', value: totalCodAmount },
    { metric: 'စုစုပေါင်း Delivery Fee', value: totalDeliFeeAmount },
    { metric: 'စုစုပေါင်း ပမာဏ (Net Total Amount)', value: totalNetAmount },
    { metric: '----------------------------------------', value: '-------------------' },
    { metric: 'ဂိတ်ရှင်းပြီး စုစုပေါင်း (Office Paid)', value: typeof officePaidTotal !== 'undefined' ? officePaidTotal : 0 },
    { metric: 'ဆန့်ကျင်ဘက်ဂိတ်ရှင်းပြီး (Opposite Paid)', value: typeof oppositePaidTotal !== 'undefined' ? oppositePaidTotal : 0 },
    { metric: 'စုစုပေါင်းစာရင်းချုပ် (Grand Total Table)', value: typeof tableTotalAmount !== 'undefined' ? tableTotalAmount : 0 },
  ];

  summaryRows.forEach((row) => {
    wsSummary.addRow(row);
  });

  // အကြောင်းအရာတွေကို data style ပေး၊ ငွေတွေဆို moneyStyle ပေး
  wsSummary.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header skip
    row.eachCell((cell) => {
      cell.style = dataStyle;
      if (cell.value && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
    });
  });

  // ============================================================
  // SHEET 2: ပါဆယ်မှတ်တမ်းအသေးစိတ် (Orders)
  // ============================================================
  const wsTable = workbook.addWorksheet('ပါဆယ်အသေးစိတ် (Orders)');

  // Column တွေကို visibleCols နဲ့ ညှိမယ်
  const visibleColDefs = COLUMN_DEFS.filter(col => visibleCols[col.key]);
  const columns = visibleColDefs.map(col => ({
    header: col.label,
    key: col.key,
    width: 18,
  }));
  wsTable.columns = columns;

  // Header style
  const tableHeaderRow = wsTable.getRow(1);
  tableHeaderRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Data ဖြည့်
  filteredOrders.forEach(o => {
    const rowValues: any[] = [];
    visibleColDefs.forEach(col => {
      let value = o[col.key];
      if (col.key === 'pickup_rider') value = o.pickup_rider?.name || o.pickup_rider || '-';
      if (col.key === 'deliver_rider') value = o.deliver_rider?.name || o.deliver_rider || '-';
      if (['cod_amount', 'deli_fee', 'total_amount'].includes(col.key)) value = Number(value) || 0;
      rowValues.push(value ?? '-');
    });
    wsTable.addRow(rowValues);
  });

  // Data row styling
  wsTable.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, colNumber) => {
      cell.style = dataStyle;
      // ငွေကြေးကော်လံတွေကို money format
      const colKey = visibleColDefs[colNumber - 1]?.key;
      if (colKey && ['cod_amount', 'deli_fee', 'total_amount'].includes(colKey)) {
        cell.numFmt = '#,##0';
      }
    });
  });

  // Freeze header row
  wsTable.views = [{ state: 'frozen', ySplit: 1 }];

  // ============================================================
  // SHEET 3: COD ခွဲဝေမှုမှတ်တမ်း (Handovers) - ရှိမှသာ
  // ============================================================
  const rawHandovers = (typeof handoverForm !== 'undefined' ? handovers : (typeof handoverForm !== 'undefined' ? handovers : []));
  if (rawHandovers && rawHandovers.length > 0) {
    const wsHandovers = workbook.addWorksheet('COD ခွဲဝေမှု (Handovers)');
    wsHandovers.columns = [
      { header: 'စဉ် (No)', key: 'no', width: 8 },
      { header: 'အပ်နှံသည့် ရက်စွဲ', key: 'date', width: 18 },
      { header: 'Rider အမည်', key: 'rider', width: 18 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'အပ်နှံငွေ အမျိုးအစား', key: 'txnType', width: 16 },
      { header: 'ပမာဏ (Amount)', key: 'amount', width: 25 },
      { header: 'မှတ်ချက်', key: 'note', width: 25 },
    ];

    const hHeaderRow = wsHandovers.getRow(1);
    hHeaderRow.eachCell((cell) => cell.style = headerStyle);

    rawHandovers.forEach((h: any, idx: number) => {
      wsHandovers.addRow({
        no: idx + 1,
        date: h.created_at ? new Date(h.created_at).toLocaleDateString() : '-',
        rider: h.rider_name || h.rider || '-',
        type: h.type || h.payment_method || '-',
        txnType: h.type || h.transaction_type || '-',
        amount: Number(h.amount) || 0,
        note: h.note || h.remark || '-',
      });
    });

    wsHandovers.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        cell.style = dataStyle;
        if (colNumber === 6) cell.numFmt = '#,##0'; // amount column
      });
    });
    wsHandovers.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ============================================================
  // SHEET 4: OS အလိုက် COD ခွဲဝေမှုစာရင်း (OS COD Summary)
  // ============================================================
  if (senderCodByLoc && Object.keys(senderCodByLoc).length > 0) {
    const wsOs = workbook.addWorksheet('OS အလိုက် COD စာရင်း');
    wsOs.columns = [
      { header: 'စဉ် (No)', key: 'no', width: 8 },
      { header: 'မြို့ (Location)', key: 'location', width: 18 },
      { header: 'Online Shop (OS) အမည်', key: 'shop', width: 30 },
      { header: 'ပြန်ပေးရမည့် COD ပမာဏ (Ks)', key: 'amount', width: 25 },
    ];

    const osHeaderRow = wsOs.getRow(1);
    osHeaderRow.eachCell((cell) => cell.style = headerStyle);

    let osIndex = 1;
    Object.entries(senderCodByLoc).forEach(([loc, senders]: [string, any]) => {
      Object.entries(senders).forEach(([senderName, amount]: [string, any]) => {
        wsOs.addRow({
          no: osIndex++,
          location: loc === 'MDY' ? 'Mandalay' : loc === 'YGN' ? 'Yangon' : loc,
          shop: senderName,
          amount: Number(amount) || 0,
        });
      });
    });

    wsOs.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell, colNumber) => {
        cell.style = dataStyle;
        if (colNumber === 4) cell.numFmt = '#,##0';
      });
    });
    wsOs.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ============================================================
  // Download
  // ============================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Full_Report_${branchName}_${selectedDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] font-[system-ui] overflow-hidden select-none">
      
      {/* ── Title Bar / Header ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase flex items-center gap-2">
              Daily Report · {userBranch === 'MDY' ? 'Mandalay' : 'Yangon'} Office
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
                        checked={visibleCols[col.key]} 
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

          <button onClick={() => fetchData(userBranch, selectedDate)} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all">
            Refresh
          </button>

{/* 💡 (ကုဒ်သစ်) Export Excel Button */}
          <button 
            onClick={handleExportFullExcel} 
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition-all flex items-center gap-1.5"
            title="Export filtered data to Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export
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

              
              {/* 🔴 အနီရောင်နေရာ (Bottom Left Placeholder - ပုံထဲက Rider Name List နေရာ) 
              <div className="flex-1 p-2 bg-red-50/40 relative">
                <div className="absolute inset-1 top-2  rounded flex flex-col items-center justify-center">
                   <span className="text-[10px] uppercase tracking-wide text-orange-600">Total</span>
              <span className="text-right text-sm font-bold">{oppositePaidTotal.toLocaleString()} Ks</span>
                </div>
              </div> */}

           

            </div>

           {/* ---------------------------------------------------- */}
{/* ညာဘက်ခြမ်း (Blue Area - Table & Buttons) - Width 70% */}
{/* ---------------------------------------------------- */}
<div className="w-[70%] p-2 relative bg-blue-50/20 flex flex-col h-full">
  
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
    let grandTotalToPay = 0;
    let grandTotalCashIn = 0;
    let grandTotalOop = 0;
    let grandTotalGap = 0;

    let grandTotalDelivered = 0;
    let grandTotalOnWay = 0;
    let grandTotalWays = 0;

    // 1. Rider တစ်ယောက်ချင်းစီရဲ့ Data တွက်ချက်ခြင်းအပိုင်း
    const rows = riders.map(rider => {
      const riderOrders = reportData.filter(o => 
        o.deliver_rider_id === rider.id && 
        o.deliver_date === selectedDate
      );

      const deliveredCount = riderOrders.filter(o => o.status === 'Delivered').length;
      const onWayCount = riderOrders.filter(o => o.status === 'On Way').length;
      const totalWayCount = riderOrders.length; 

      const totalToPay = riderOrders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      const riderHandovers = handovers.filter(h => h.rider_name === rider.name);
      const cashIn = riderHandovers.filter(h => h.transaction_type === 'Cash-in').reduce((sum, h) => sum + (h.amount || 0), 0);
      const oop = riderHandovers.filter(h => h.transaction_type === 'OOP').reduce((sum, h) => sum + (h.amount || 0), 0);
      const gap = totalToPay - (cashIn + oop);

      if (totalToPay === 0 && cashIn === 0 && oop === 0 && totalWayCount === 0) return null;

      grandTotalToPay += totalToPay;
      grandTotalCashIn += cashIn;
      grandTotalOop += oop;
      grandTotalGap += gap;
      
      grandTotalDelivered += deliveredCount;
      grandTotalOnWay += onWayCount;
      grandTotalWays += totalWayCount;

      let gapColor = "text-green-600";
      if (gap > 0) gapColor = "text-red-600 font-bold";
      else if (gap < 0) gapColor = "text-amber-600 font-bold";

      return (
        <tr key={rider.id} className="hover:bg-blue-50/30 transition-colors">
          <td className="px-2 py-1.5 font-semibold text-gray-900 truncate" title={rider.name}>👤 {rider.name}</td>
          
          <td className="px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
              <span className="bg-green-50 text-green-700 px-1 rounded border border-green-200" title="Delivered">D:{deliveredCount}</span>
              <span className="bg-blue-50 text-blue-700 px-1 rounded border border-blue-200" title="On Way">O:{onWayCount}</span>
              <span className="bg-gray-100 text-gray-700 px-1 rounded border border-gray-200 font-bold" title="Total">T:{totalWayCount}</span>
            </div>
          </td>

          <td className="px-2 py-1.5 text-right font-mono text-gray-900">{totalToPay.toLocaleString()}</td>
          <td className="px-2 py-1.5 text-right font-mono text-blue-600">{cashIn.toLocaleString()}</td>
          <td className="px-2 py-1.5 text-right font-mono text-purple-600">{oop.toLocaleString()}</td>
          <td className={`px-2 py-1.5 text-right font-mono ${gapColor}`}>
            {gap > 0 ? `+${gap.toLocaleString()}` : gap.toLocaleString()}
          </td>
        </tr>
      );
    }).filter(Boolean);

    let totalGapColor = "text-green-700";
    if (grandTotalGap > 0) totalGapColor = "text-red-700";
    else if (grandTotalGap < 0) totalGapColor = "text-amber-700";

    return (
      <div className="flex-1 min-h-0 flex flex-col rounded border border-blue-200 bg-white mx-1 mb-1 z-10 shadow-inner">
        
        {/* 🟢 အပေါ်ဘက်ခြမ်း: Table Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-[11px] whitespace-nowrap table-fixed">
            <thead className="bg-blue-50/50 text-gray-600 font-bold uppercase text-[9px] tracking-wider border-b border-blue-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 w-[22%]">Rider Name</th>
                <th className="px-2 py-2 text-center w-[18%]">Way (D/O/T)</th>
                <th className="px-2 py-2 text-right w-[15%]">Total</th>
                <th className="px-2 py-2 text-right w-[15%]">အပ်ငွေ</th>
                <th className="px-2 py-2 text-right w-[15%]">စိုက်ငွေ</th>
                <th className="px-2 py-2 text-right w-[15%]">ကွာဟချက်</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400 font-medium">
                    ယနေ့အတွက် Rider စာရင်းချုပ် မရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                rows
              )}
            </tbody>
          </table>
        </div>

        {/* 🔵 အောက်ဘက်ခြမ်း: Fixed Footer Summary Area */}
        <div className="bg-blue-50 border-t-2 border-blue-200 font-bold text-gray-950 shadow-sm shrink-0">
          <table className="w-full text-left text-[11px] whitespace-nowrap table-fixed">
            <tbody>
              <tr className="font-bold">
                <td className="px-2 py-2 text-blue-900 font-bold w-[22%]">Total</td>
                
                <td className="px-2 py-2 text-center w-[18%]">
                  <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                    <span className="bg-green-100 text-green-800 px-1 rounded border border-green-300">D:{grandTotalDelivered}</span>
                    <span className="bg-blue-100 text-blue-800 px-1 rounded border border-blue-300">O:{grandTotalOnWay}</span>
                    <span className="bg-gray-200 text-gray-800 px-1 rounded border border-gray-200 font-bold">T:{grandTotalWays}</span>
                  </div>
                </td>

                <td className="px-2 py-2 text-right font-mono text-blue-900 w-[15%]">{grandTotalToPay.toLocaleString()}</td>
                <td className="px-2 py-2 text-right font-mono text-blue-700 w-[15%]">{grandTotalCashIn.toLocaleString()}</td>
                <td className="px-2 py-2 text-right font-mono text-purple-700 w-[15%]">{grandTotalOop.toLocaleString()}</td>
                <td className={`px-2 py-2 text-right font-mono w-[15%] ${totalGapColor}`}>
                  {grandTotalGap > 0 ? `+${grandTotalGap.toLocaleString()}` : grandTotalGap.toLocaleString()}
                </td>
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
      💰 COD ခွဲဝေမှု စာရင်း
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
        .filter(item => item.locTotal > 0) // စုစုပေါင်းပမာဏ ၀ ပြား ဖြစ်နေသော မြို့များကို ဖျောက်ထားရန်
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
                  .filter(([_, totalCod]) => Number(totalCod) > 0) // Sender တစ်ဦးချင်းစီတွင် ၀ ဖြစ်နေပါက ဖျောက်ထားရန်
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

</div> {/* 👈 အပြင်ဘက်ဆုံး Layout အတွက် မူလအတိုင်း ပိတ်ပေးထားသည့် ဒုတိယမြောက် Div */}

      {/* ── Workspace Table / List Area (Flex item optimized) ── */}
      <div className="flex-1 overflow-auto bg-white sm:mx-4 sm:my-3 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
        
        {/* Desktop View Table */}
        <div className="hidden sm:block">
          <table className="w-full text-left whitespace-nowrap text-[12px]">
          <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(229,231,235,1)]">
  <tr className="text-gray-400 border-b border-gray-200 bg-gray-50/70">
    {/* 💡 Checkbox Header ကော်လံ အသစ် */}
    <th className="px-4 py-3 w-10 text-center bg-gray-50/70">
      <input 
        type="checkbox"
        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
        checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
        onChange={e => handleSelectAll(e.target.checked)}
      />
    </th>
    {COLUMN_DEFS.map(col => visibleCols[col.key] && (
      <th key={col.key} className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-gray-500">
        {col.label}
      </th>
    ))}
  </tr>
  
  {/* Filter Layout */}
  <tr>
    {/* 💡 Filter တန်းအတွက် Checkbox ကော်လံနေရာလွတ် တစ်ကွက်ဖြည့်ပေးခြင်း */}
    <td className="px-4 py-1.5 bg-gray-50/30"></td>
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
      {/* 💡 Checkbox ကြောင့် ကော်လံတစ်ခုပိုလာသဖြင့် colSpan ကို + 1 ပေါင်းပေးရပါသည် */}
      <td colSpan={COLUMN_DEFS.length + 1} className="text-center py-10 font-medium text-gray-400">Loading Report Logs...</td>
    </tr>
  ) : filteredOrders.length === 0 ? (
    <tr>
      <td colSpan={COLUMN_DEFS.length + 1} className="text-center py-10 font-medium text-gray-400">ယနေ့ရက်စွဲအတွက် ပါဆယ်မှတ်တမ်း မရှိသေးပါ။</td>
    </tr>
  ) : filteredOrders.map(o => (
    <tr 
      key={o.id} 
      className={`hover:bg-gray-50/80 transition-colors cursor-context-menu ${selectedIds.includes(o.id) ? 'bg-orange-50/30' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault(); 
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          order: o
        });
      }}
    >
      {/* 💡 တစ်ကွက်ချင်းစီအတွက် Row Checkbox အသစ် */}
      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox"
          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
          checked={selectedIds.includes(o.id)}
          onChange={e => handleSelectRow(o.id, e.target.checked)}
        />
      </td>
      {COLUMN_DEFS.map(col => visibleCols[col.key] && (
        <td key={col.key} className="px-4 py-2.5 font-medium">
          {renderCell(o, col.key)}
        </td>
      ))}
    </tr>
  ))}
</tbody>
          </table>
          {/* 💡 (ကုဒ်သစ်) ရွေးချယ်ထားသော ပါဆယ်ပမာဏများကို ပြသပေးမည့် Sticky Floating Summary Footer */}
        {selectedIds.length > 0 && (
  <div className="sticky bottom-0 left-0 right-0 bg-white border-t-2 border-orange-500 px-4 py-2 flex flex-wrap items-center justify-start gap-5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-30 animate-fade-in sm:rounded-b-lg">
    
    {/* ၁။ အရေအတွက် ပြကွက် (ဘယ်ဘက်အစ) */}
    <div className="flex items-center gap-2 border-r border-gray-200 pr-4 py-0.5">
      <span className="bg-orange-500 text-white font-black px-2 py-0.5 rounded text-[10px] tracking-wide">
        {totalSelectedCount} ထုပ်
      </span>
      <span className="text-[11px] text-gray-500 font-bold">ရွေးချယ်ထားသည်</span>
    </div>
    
    {/* ၂။ ပမာဏတွက်ချက်မှုများ စုစည်းပြသမှုအပိုင်း (ဘယ်ဘက်သို့ ကပ်ထားသည်) */}
    <div className="flex flex-wrap items-center gap-5 text-[11px]">
      
      {/* Total COD */}
      <div className="flex flex-col items-start">
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total COD</span>
        <span className="font-extrabold text-gray-800 text-[12px]">{totalCod.toLocaleString()} Ks</span>
      </div>
      
      {/* Total Deli Fee */}
      <div className="flex flex-col items-start border-l border-gray-100 pl-4">
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Deli Fee</span>
        <span className="font-extrabold text-gray-800 text-[12px]">{totalDeliFee.toLocaleString()} Ks</span>
      </div>
      
      {/* Net Total Amount (Orange Highlight Box) */}
      <div className="flex flex-col items-start border-l border-gray-100 pl-4 bg-orange-50/80 px-3 py-0.5 rounded-md border border-orange-100">
        <span className="text-[9px] text-orange-600 font-black uppercase tracking-wider">Net Total Amount</span>
        <span className="font-black text-orange-600 text-[12px]">{grandTotal.toLocaleString()} Ks</span>
      </div>

    </div>
  </div>
)}
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
                  {o.image_url && (
                    <span 
                      onClick={() => setPreviewImage(o.image_url)} 
                      className="cursor-pointer text-xs bg-gray-100 p-0.5 px-1.5 rounded border border-gray-200 text-gray-500 font-medium"
                    >
                      🖼️ Photo
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