'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import OrderTable, { type ColumnDef } from '@/components/OrderTable'
import { useOrderSelection } from '@/hooks/useOrderSelection'

const ORDER_STATUSES = [
  'Handover',
  'On Way',
  'Delivered',
  'At Office',
  'Arrived',
  'On Hold',
  'Settled',
] as const

type OrderStatus = (typeof ORDER_STATUSES)[number]
type StatusOrder = Record<string, unknown> & { id: string }
type StatusCounts = Record<OrderStatus, number>
type FilterValue = string | string[]
type StatusOrdersResponse = {
  data?: StatusOrder[]
  total?: number
  error?: string
}
type StatusCountsResponse = {
  data?: StatusCounts
  error?: string
}

const PAGE_SIZE = 50

function getRelationName(value: unknown) {
  if (typeof value !== 'object' || value === null || !('name' in value)) return ''
  return String(value.name ?? '')
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'row_number', label: 'No.', defaultVisible: true },
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
  { key: 'refund_date', label: 'Refund Date', defaultVisible: false },
  { key: 'note', label: 'Note', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false },
  { key: 'transit_date', label: 'Transit Date', defaultVisible: false },
  { key: 'transit_to', label: 'Transit To', defaultVisible: false },
  { key: 'agent_fee', label: 'Agent Fee', defaultVisible: false },
  { key: 'remark', label: 'Remark', defaultVisible: false },
  { key: 'barcode', label: 'Barcode', defaultVisible: false },
  { key: 'last_check', label: 'Last Check', defaultVisible: false },
]

const DEFAULT_VISIBLE_COLS: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map((column) => [column.key, column.defaultVisible]),
)
const COLUMN_PREFERENCES_KEY = 'all_in_one_visible_cols'
let cachedColumnPreferences: string | null | undefined
let cachedVisibleCols: Record<string, boolean> = DEFAULT_VISIBLE_COLS

function subscribeToColumnPreferences(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === COLUMN_PREFERENCES_KEY) onStoreChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener('order-status-columns-changed', onStoreChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('order-status-columns-changed', onStoreChange)
  }
}

function getColumnPreferencesSnapshot() {
  const savedColumns = window.localStorage.getItem(COLUMN_PREFERENCES_KEY)
  if (savedColumns === cachedColumnPreferences) return cachedVisibleCols

  cachedColumnPreferences = savedColumns
  if (!savedColumns) {
    cachedVisibleCols = DEFAULT_VISIBLE_COLS
    return cachedVisibleCols
  }

  try {
    const parsed: unknown = JSON.parse(savedColumns)
    const preferences = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
    cachedVisibleCols = COLUMN_DEFS.reduce<Record<string, boolean>>((columns, column) => {
      const preference = preferences[column.key]
      columns[column.key] = column.key === 'item_id'
        ? true
        : typeof preference === 'boolean'
          ? preference
          : column.defaultVisible
      return columns
    }, {})
  } catch (error) {
    console.error('Error parsing visible order-status columns from localStorage:', error)
    cachedVisibleCols = DEFAULT_VISIBLE_COLS
  }

  return cachedVisibleCols
}

function getServerColumnPreferencesSnapshot() {
  return DEFAULT_VISIBLE_COLS
}

function getStatusFromLocation(): OrderStatus {
  const value = new URLSearchParams(window.location.search).get('status')
  return ORDER_STATUSES.find((status) => status === value) || 'Handover'
}

function subscribeToBranch(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('user-branch-changed', onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('user-branch-changed', onStoreChange)
  }
}

function getBranchSnapshot() {
  return window.localStorage.getItem('user_branch') || 'ALL'
}

function getServerBranchSnapshot() {
  return 'ALL'
}

function subscribeToStatus(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener('order-status-changed', onStoreChange)
  return () => {
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener('order-status-changed', onStoreChange)
  }
}

function getServerStatusSnapshot(): OrderStatus {
  return 'Handover'
}

export default function OrderStatusPage() {
  const branch = useSyncExternalStore(subscribeToBranch, getBranchSnapshot, getServerBranchSnapshot)
  const status = useSyncExternalStore(subscribeToStatus, getStatusFromLocation, getServerStatusSnapshot)
  const [orders, setOrders] = useState<StatusOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const requestVersionRef = useRef(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null)
  const [countsError, setCountsError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCompact, setIsCompact] = useState(false)
  const visibleCols = useSyncExternalStore(
    subscribeToColumnPreferences,
    getColumnPreferencesSnapshot,
    getServerColumnPreferencesSnapshot,
  )
  const [showColDropdown, setShowColDropdown] = useState(false)
  const [showFilterBar, setShowFilterBar] = useState(true)
  const [colFilters, setColFilters] = useState<Record<string, FilterValue>>({})
  const selection = useOrderSelection(orders)

  const filteredOrders = orders

  const locationOptions = useMemo(() => Array.from(new Set(
    orders.flatMap((order) => [order.sender_loc, order.receiver_loc]).filter(Boolean).map(String),
  )).sort(), [orders])

  const riders = useMemo(() => Array.from(new Set(
    orders.flatMap((order) => [
      getRelationName(order.pickup_rider),
      getRelationName(order.deliver_rider),
    ]).filter(Boolean),
  )).sort().map((name) => ({ name })), [orders])

  const handleFilterChange = (column: string, value: string | string[]) => {
    setColFilters((current) => ({ ...current, [column]: value }))
  }

  const resetFilters = () => setColFilters({})

  const activeFilterCount = Object.values(colFilters).filter((value) => (
    Array.isArray(value) ? value.length > 0 : Boolean(value.trim())
  )).length

  const toggleColumn = (columnKey: string) => {
    if (columnKey === 'item_id') return

    const defaultVisible = COLUMN_DEFS.find((column) => column.key === columnKey)?.defaultVisible ?? false
    const updated = { ...visibleCols, [columnKey]: !(visibleCols[columnKey] ?? defaultVisible) }
    localStorage.setItem(COLUMN_PREFERENCES_KEY, JSON.stringify(updated))
    window.dispatchEvent(new Event('order-status-columns-changed'))
  }

  useEffect(() => {
    if (!branch) return

    const controller = new AbortController()
    const loadCounts = async () => {
      setStatusCounts(null)
      setCountsError('')

      try {
        const params = new URLSearchParams({ branch })
        const response = await fetch(`/api/dashboard-status-counts?${params}`, {
          signal: controller.signal,
        })
        const payload = await response.json() as StatusCountsResponse
        if (!response.ok) throw new Error(payload.error || 'Unable to load status counts')
        if (!payload.data) throw new Error('Status counts response is missing data')

        setStatusCounts(payload.data)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Dashboard status tab counts error:', error)
        setCountsError(error instanceof Error ? error.message : 'Unable to load status counts')
      }
    }

    void loadCounts()
    return () => controller.abort()
  }, [branch, refreshKey])

  useEffect(() => {
    if (!branch) return

    requestVersionRef.current += 1
    const controller = new AbortController()
    const loadFirstPage = async () => {
      setLoading(true)
      setLoadingMore(false)
      setErrorMessage('')
      setOrders([])
      setPage(1)
      setTotalOrders(0)
      setHasMore(false)

      try {
        const params = new URLSearchParams({
          branch,
          status,
          page: '1',
          limit: String(PAGE_SIZE),
          filters: JSON.stringify(colFilters),
        })
        const response = await fetch(`/api/dashboard-status-orders?${params}`, {
          signal: controller.signal,
        })
        const payload = await response.json() as StatusOrdersResponse
        if (!response.ok) throw new Error(payload.error || 'Unable to load orders')

        const rows = payload.data || []
        setOrders(rows)
        const total = payload.total || 0
        setTotalOrders(total)
        setHasMore(rows.length < total)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Dashboard status orders error:', error)
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load orders')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadFirstPage()
    return () => controller.abort()
  }, [branch, colFilters, refreshKey, status])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    const requestVersion = requestVersionRef.current
    setLoadingMore(true)
    setErrorMessage('')
    try {
      const nextPage = page + 1
      const params = new URLSearchParams({
        branch,
        status,
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        filters: JSON.stringify(colFilters),
      })
      const response = await fetch(`/api/dashboard-status-orders?${params}`)
      const payload = await response.json() as StatusOrdersResponse
      if (!response.ok) throw new Error(payload.error || 'Unable to load more orders')
      if (requestVersionRef.current !== requestVersion) return

      const rows = payload.data || []
      setOrders((current) => [...current, ...rows])
      setPage(nextPage)
      setHasMore(nextPage * PAGE_SIZE < totalOrders)
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return
      console.error('Dashboard status orders pagination error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load more orders')
    } finally {
      if (requestVersionRef.current === requestVersion) setLoadingMore(false)
    }
  }, [branch, colFilters, hasMore, loadingMore, page, status, totalOrders])

  const selectStatus = (nextStatus: OrderStatus) => {
    selection.clearSelection()
    const params = new URLSearchParams(window.location.search)
    params.set('status', nextStatus)
    window.history.pushState(window.history.state, '', `${window.location.pathname}?${params}`)
    window.dispatchEvent(new Event('order-status-changed'))
  }

  return (
    <main className="h-full min-h-0 overflow-hidden bg-slate-50 px-3 py-2 sm:px-6 sm:py-4">
      <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-2 sm:gap-3">
        <header className={`sticky top-0 z-30 flex shrink-0 flex-wrap items-center bg-slate-50/95 backdrop-blur transition-all duration-200 ${
          isCompact ? 'gap-2 py-0.5' : 'gap-3'
        }`}>
          <div className={`min-w-0 ${isCompact ? 'order-1' : 'order-1 flex-1'}`}>
            <Link href="/" className={`text-sm font-semibold text-orange-600 hover:text-orange-700 ${isCompact ? 'hidden' : ''}`}>
              ← Dashboard
            </Link>
            <h1 className={`font-black text-slate-900 transition-all duration-200 ${
              isCompact ? 'truncate text-sm sm:text-base' : 'mt-2 text-xl sm:text-2xl'
            }`}>
              Order Status • {branch === 'ALL' ? 'All Branches' : branch}
            </h1>
          </div>
          <nav
            aria-label="Order status"
            className={`flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white transition-all duration-300 ease-in-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isCompact
                ? 'order-2 flex-1 translate-y-0 p-1 opacity-100'
                : 'order-3 basis-full translate-y-1 p-2 opacity-100'
            }`}
          >
            {ORDER_STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={status === item}
                aria-label={`${item}: ${statusCounts ? (statusCounts[item] ?? 0).toLocaleString() : 'count loading'}`}
                onClick={() => selectStatus(item)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  isCompact ? 'px-3 py-1.5 text-xs' : ''
                } ${
                  status === item
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                }`}
              >
                {item}
                <span className={`ml-2 inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 font-bold ${
                  isCompact ? 'text-[10px]' : 'text-xs'
                } ${
                  status === item
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {statusCounts ? (statusCounts[item] ?? 0).toLocaleString() : '…'}
                </span>
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className={`order-2 shrink-0 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 ${
              isCompact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
            }`}
          >
            Refresh
          </button>
        </header>

        {countsError && (
          <p role="alert" className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {countsError}
          </p>
        )}

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 sm:py-3">
            <h2 className="font-bold text-slate-800">{status} Orders</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm font-semibold text-slate-500">
                {loading
                  ? 'Loading…'
                  : activeFilterCount > 0
                    ? `${filteredOrders.length.toLocaleString()} of ${totalOrders.toLocaleString()} matching`
                    : `${orders.length.toLocaleString()} of ${totalOrders.toLocaleString()} loaded`}
              </span>
              <button
                type="button"
                onClick={() => setShowFilterBar((current) => !current)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                  showFilterBar
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {showFilterBar ? 'Hide Filters' : 'Show Filters'}
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-100"
                >
                  Clear Filters
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={showColDropdown}
                  onClick={() => setShowColDropdown((current) => !current)}
                  className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-400"
                >
                  Columns
                </button>
                {showColDropdown && (
                  <>
                    <button
                      type="button"
                      aria-label="Close column settings"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setShowColDropdown(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-1 max-h-80 w-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2.5 shadow-xl">
                      <div className="mb-1.5 border-b border-gray-100 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Show/Hide Columns
                      </div>
                      {COLUMN_DEFS.map((column) => (
                        <label
                          key={column.key}
                          className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            className="mr-2.5 h-3.5 w-3.5 rounded border-gray-300 accent-orange-500"
                            checked={visibleCols[column.key] ?? column.defaultVisible}
                            onChange={() => toggleColumn(column.key)}
                            disabled={column.key === 'item_id'}
                          />
                          <span className="truncate">{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          )}

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
            onLoadMore={loadMore}
            selectedOrders={selection.selectedOrders}
            isAllSelected={selection.isAllSelected}
            onToggleSelectAll={() => selection.selectAllFiltered(filteredOrders)}
            onToggleOrderSelection={selection.toggleOrderSelection}
            onRowMouseDown={selection.handleRowMouseDown}
            onRowMouseEnter={selection.handleRowMouseEnter}
            onStopDragging={() => selection.setIsDraggingSelection(false)}
            onRowClick={() => {}}
            onRowContextMenu={(event) => event.preventDefault()}
            onPreviewImage={() => {}}
            onTableScroll={(scrollTop) => setIsCompact(scrollTop > 16)}
            mobileCompact
            fullBleed
            hideScrollbars
          />
        </section>
      </div>
    </main>
  )
}
