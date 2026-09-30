'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import BarcodeScannerModal from '@/components/BarcodeScannerModal'
import OrderTable, { type ColumnDef } from '@/components/OrderTable'
import { useOrderSelection } from '@/hooks/useOrderSelection'
import { apiClient } from '@/lib/databaseApi'

type TransitLeg = {
  transit_from?: string | null
  transit_to?: string | null
  transit_date?: string | null
}

type StockOrder = {
  id: string
  item_id?: string | null
  barcode?: string | null
  branch?: string | null
  status?: string | null
  last_check?: string | null
  transit?: unknown
  transit_to?: string | null
  transit_date?: string | null
  created_at?: string | null
  [key: string]: unknown
}

type StockStatus = 'All' | 'At Office' | 'On Way' | 'Arrived' | 'Checked'
type StockColumnFilters = Record<string, string | string[]>
type QueryResult = { data: StockOrder[] | StockOrder | null; error: Error | null }
type QueryFactory = (from: number, to: number) => PromiseLike<QueryResult>

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'item_id', label: 'Item ID', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'last_check', label: 'Last Check', defaultVisible: true },
  { key: 'sender_name', label: 'Sender', defaultVisible: true },
  { key: 'receiver_name', label: 'Receiver', defaultVisible: true },
  { key: 'receiver_phone', label: 'Phone', defaultVisible: true },
  { key: 'receiver_loc', label: 'R. City', defaultVisible: true },
  { key: 'cod_amount', label: 'COD (Ks)', defaultVisible: true },
  { key: 'deli_fee', label: 'Deli Fee (Ks)', defaultVisible: true },
  { key: 'total_amount', label: 'Total (Ks)', defaultVisible: true },
  { key: 'transit_to', label: 'Last Transit To', defaultVisible: true },
  { key: 'branch', label: 'Origin', defaultVisible: false },
]

const STOCK_STATUSES = ['At Office', 'On Way', 'Arrived']
const PAGE_SIZE = 500

function subscribeToBranch(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('user-branch-changed', onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('user-branch-changed', onStoreChange)
  }
}

function getBranchSnapshot() {
  return window.localStorage.getItem('user_branch') || ''
}

function getServerBranchSnapshot() {
  return ''
}

function getTransitLegs(transit: unknown): TransitLeg[] {
  let value = transit
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value as TransitLeg[] : []
}

function getLastTransitLeg(order: StockOrder) {
  const legs = getTransitLegs(order.transit)
  return legs.length ? legs[legs.length - 1] : null
}

function belongsInStockCheck(order: StockOrder, branch: string) {
  const origin = String(order.branch || '').trim().toUpperCase()
  const currentBranch = branch.trim().toUpperCase()
  const status = String(order.status || '').trim()
  const transitLegs = getTransitLegs(order.transit)

  if (origin === currentBranch && status === 'At Office') return true
  if (origin === currentBranch && status === 'On Way' && transitLegs.length === 0) return true

  const lastDestination = String(transitLegs.at(-1)?.transit_to || '').trim().toUpperCase()
  return lastDestination === currentBranch && (status === 'On Way' || status === 'Arrived')
}

async function fetchAllPages(createQuery: QueryFactory) {
  const rows: StockOrder[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await createQuery(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function branchName(branch: string) {
  if (branch === 'MDY') return 'Mandalay'
  if (branch === 'YGN') return 'Yangon'
  return branch || 'Branch'
}

function getTodayDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function hasBeenCheckedToday(order: StockOrder) {
  return String(order.last_check || '').slice(0, 10) === getTodayDate()
}

export default function StockCheckPage() {
  const router = useRouter()
  const userBranch = useSyncExternalStore(subscribeToBranch, getBranchSnapshot, getServerBranchSnapshot)
  const [orders, setOrders] = useState<StockOrder[]>([])
  const [statusFilter, setStatusFilter] = useState<StockStatus>('All')
  const [columnFilters, setColumnFilters] = useState<StockColumnFilters>({})
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [checkingOrderIds, setCheckingOrderIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userBranch) {
      router.push('/login')
      return
    }

    let isCurrent = true
    const branch = userBranch.trim().toUpperCase()

    const loadStockOrders = async () => {
      try {
        const localOrders = await fetchAllPages((from, to) => apiClient
          .from<StockOrder>('orders')
          .select('*')
          .eq('is_deleted', false)
          .eq('branch', branch)
          .in('status', STOCK_STATUSES)
          .order('created_at', { ascending: false })
          .range(from, to))

        const inboundOrders = await fetchAllPages((from, to) => apiClient
          .from<StockOrder>('orders')
          .select('*')
          .eq('is_deleted', false)
          .in('status', ['Arrived', 'On Way'])
          .filter('transit', 'cs', JSON.stringify([{ transit_to: branch }]))
          .order('created_at', { ascending: false })
          .range(from, to))

        if (!isCurrent) return
        const uniqueOrders = new Map<string, StockOrder>()
        for (const order of [...localOrders, ...inboundOrders]) uniqueOrders.set(order.id, order)

        const stockOrders = [...uniqueOrders.values()]
          .filter((order) => belongsInStockCheck(order, branch))
          .map((order) => {
            const lastLeg = getLastTransitLeg(order)
            return {
              ...order,
              transit_to: lastLeg?.transit_to || order.transit_to || '',
              transit_date: lastLeg?.transit_date || order.transit_date || '',
            }
          })
          .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))

        setOrders(stockOrders)
        setErrorMessage('')
      } catch (error) {
        if (!isCurrent) return
        setErrorMessage(error instanceof Error ? error.message : 'Stock စာရင်းကို ရယူ၍မရပါ။')
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    void loadStockOrders()
    return () => { isCurrent = false }
  }, [refreshKey, router, userBranch])

  const visibleCols = useMemo(() => Object.fromEntries(COLUMN_DEFS.map((column) => [column.key, column.defaultVisible])), [])
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return orders.filter((order) => {
      const checkedToday = hasBeenCheckedToday(order)
      const matchesStatus = statusFilter === 'All'
        || (statusFilter === 'Checked' ? checkedToday : !checkedToday && order.status === statusFilter)
      const searchableValues = [order.item_id, order.barcode, order.sender_name, order.receiver_name, order.receiver_phone]
      const matchesSearch = !query || searchableValues.some((value) => String(value || '').toLocaleLowerCase().includes(query))
      const matchesColumns = COLUMN_DEFS.filter((column) => visibleCols[column.key]).every((column) => {
        const filterValue = columnFilters[column.key]
        const cellValue = String(order[column.key] ?? '').toLocaleLowerCase()
        if (Array.isArray(filterValue)) return filterValue.length === 0 || filterValue.some((value) => cellValue === value.toLocaleLowerCase())
        return !filterValue?.trim() || cellValue.includes(filterValue.trim().toLocaleLowerCase())
      })
      return matchesStatus && matchesSearch && matchesColumns
    })
  }, [columnFilters, orders, search, statusFilter, visibleCols])

  const selection = useOrderSelection(orders)
  const statusCounts = useMemo(() => orders.reduce<Record<StockStatus, number>>((counts, order) => {
    if (hasBeenCheckedToday(order)) counts.Checked += 1
    else if (order.status === 'At Office' || order.status === 'On Way' || order.status === 'Arrived') counts[order.status] += 1
    return counts
  }, { All: orders.length, 'At Office': 0, 'On Way': 0, Arrived: 0, Checked: 0 }), [orders])

  const handleCheckOrder = async (order: StockOrder) => {
    if (checkingOrderIds.has(order.id) || hasBeenCheckedToday(order)) return
    setCheckingOrderIds((current) => new Set(current).add(order.id))
    setErrorMessage('')

    try {
      const { error } = await apiClient.from('orders').update({ last_check: getTodayDate() }).eq('id', order.id)
      if (error) throw error
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, last_check: getTodayDate() } : item))
      setScanMessage(`${order.item_id || 'Order'} ကို ဒီနေ့စစ်ပြီးပါပြီ။ Checked ထဲသို့ ရွှေ့ထားပါတယ်။`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'စစ်ဆေးမှုကို သိမ်း၍မရပါ။')
    } finally {
      setCheckingOrderIds((current) => {
        const next = new Set(current)
        next.delete(order.id)
        return next
      })
    }
  }

  const handleScan = (barcode: string) => {
    const scannedCode = barcode.trim()
    setIsScannerOpen(false)
    setStatusFilter('All')
    setSearch(scannedCode)
    const matchingOrder = orders.find((order) => [order.item_id, order.barcode].some((value) => String(value || '').toLocaleLowerCase() === scannedCode.toLocaleLowerCase()))
    setScanMessage(matchingOrder
      ? `${matchingOrder.item_id || scannedCode} ကိုတွေ့ပါတယ်။ စစ်မယ်ဆို Check ကိုနှိပ်ပါ။`
      : `${scannedCode} ကို ဒီ branch ရဲ့ Stock Check စာရင်းမှာ မတွေ့ပါ။`)
  }

  const handleRefresh = () => {
    setLoading(true)
    setRefreshKey((current) => current + 1)
  }

  const handleColumnFilterChange = (key: string, value: string | string[]) => {
    setColumnFilters((current) => ({ ...current, [key]: value }))
  }

  const activeColumnFilterCount = Object.values(columnFilters).filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value.trim())).length

  const statusOptions: StockStatus[] = ['All', 'At Office', 'On Way', 'Arrived', 'Checked']
  const renderStatusTabs = () => (
    <nav aria-label="Stock status" className="flex items-center gap-1">
      {statusOptions.map((status) => (
        <button key={status} type="button" onClick={() => setStatusFilter(status)} aria-pressed={statusFilter === status} className={`flex min-h-8 shrink-0 items-center gap-1.5 border px-2.5 text-[11px] font-semibold transition ${statusFilter === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'}`}>
          {status}<span className={`tabular-nums ${statusFilter === status ? 'text-white/70' : 'text-slate-400'}`}>{statusCounts[status]}</span>
        </button>
      ))}
    </nav>
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f4f1] text-slate-900">
      <header className="z-30 shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700 sm:gap-2 sm:text-[11px] sm:tracking-[0.14em]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {branchName(userBranch)} Branch
            </div>
            <h1 className="text-lg font-bold leading-tight text-slate-950 sm:text-xl">Stock Check</h1>
          </div>
          <div className="hidden lg:block">{renderStatusTabs()}</div>
          <div className="ml-auto flex w-auto min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <label className="relative hidden min-w-0 flex-1 sm:block sm:w-72 sm:flex-none">
              <span className="sr-only">Search orders</span>
              <svg aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-4-4" /></svg>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, barcode..." className="h-10 w-full rounded-sm border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <button type="button" onClick={() => setIsScannerOpen(true)} aria-label="Scan barcode" title="Scan barcode" className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 border border-emerald-700 bg-emerald-800 px-2 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto sm:px-3">
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M7 9v6m3-6v6m3-6v6m3-6v6" /></svg>
              <span className="hidden sm:inline">Scan</span>
            </button>
            <button type="button" onClick={handleRefresh} aria-label="Refresh stock list" title="Refresh" className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 sm:w-auto sm:px-3">
              <svg aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5m11-1a8 8 0 00-14.4-4.8L4 12m16 0-1.6 5.8A8 8 0 014 17" /></svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col">
        <div className="stock-check-mobile-only shrink-0 px-3 pt-2">
          <div className="overflow-x-auto pb-1">{renderStatusTabs()}</div>
        </div>

        <details className="stock-check-mobile-only mx-3 mb-2 shrink-0 border border-slate-200 bg-white" open={mobileFiltersOpen} onToggle={(event) => setMobileFiltersOpen(event.currentTarget.open)}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-slate-700">
            <span>Filter columns{activeColumnFilterCount ? ` (${activeColumnFilterCount})` : ''}</span>
            <span className="flex items-center gap-2 text-slate-400">
              {activeColumnFilterCount > 0 && <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setColumnFilters({}) }} className="text-[11px] font-semibold text-emerald-700">Clear</button>}
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
            </span>
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3">
            {COLUMN_DEFS.filter((column) => visibleCols[column.key]).map((column) => (
              <label key={column.key} className="min-w-0 text-[10px] font-semibold text-slate-500">
                <span className="mb-1 block truncate">{column.label}</span>
                <input value={typeof columnFilters[column.key] === 'string' ? columnFilters[column.key] as string : ''} onChange={(event) => handleColumnFilterChange(column.key, event.target.value)} placeholder={`Filter ${column.label}`} className="h-9 w-full border border-slate-300 px-2 text-xs font-normal text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100" />
              </label>
            ))}
          </div>
        </details>

        {scanMessage && <div aria-live="polite" className="mb-2 flex shrink-0 items-center justify-between gap-3 px-2 text-xs text-slate-600 sm:mb-3 sm:text-sm">
          <span className="min-w-0 truncate">{scanMessage}</span>
          <button type="button" onClick={() => setScanMessage('')} aria-label="Dismiss scan message" className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>}

        {errorMessage && (
          <div role="alert" className="mx-3 mb-3 flex shrink-0 items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{errorMessage}</span>
            <button type="button" onClick={handleRefresh} className="shrink-0 font-bold underline underline-offset-2">ပြန်စမ်းရန်</button>
          </div>
        )}

        <OrderTable
          orders={visibleOrders}
          columnDefs={COLUMN_DEFS}
          visibleCols={visibleCols}
          showFilterBar={true}
          colFilters={columnFilters}
          onFilterChange={handleColumnFilterChange}
          riders={[]}
          locationOptions={[]}
          loading={loading}
          loadingMore={false}
          hasMore={false}
          onLoadMore={() => {}}
          selectedOrders={selection.selectedOrders}
          isAllSelected={visibleOrders.length > 0 && visibleOrders.every((order) => selection.selectedOrders.has(order.id))}
          onToggleSelectAll={() => selection.selectAllFiltered(visibleOrders)}
          onToggleOrderSelection={selection.toggleOrderSelection}
          onRowMouseDown={selection.handleRowMouseDown}
          onRowMouseEnter={selection.handleRowMouseEnter}
          onStopDragging={() => selection.setIsDraggingSelection(false)}
          onRowClick={() => {}}
          onRowContextMenu={() => {}}
          onPreviewImage={(url) => setPreviewImage(url)}
          onCheckOrder={handleCheckOrder}
          isOrderChecked={hasBeenCheckedToday}
          checkingOrderIds={checkingOrderIds}
          mobileCompact
          fullBleed
        />
      </main>

      {previewImage && (
        <div role="dialog" aria-modal="true" aria-label="Order photo" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-8" onClick={() => setPreviewImage(null)}>
          <button type="button" aria-label="Close photo" onClick={() => setPreviewImage(null)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center bg-white text-slate-800 sm:right-6 sm:top-6">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
          <Image src={previewImage} alt="Order" width={1400} height={1000} unoptimized className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}

      <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleScan} />
    </div>
  )
}