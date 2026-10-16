import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const orderStatuses = [
  'Handover',
  'On Way',
  'Delivered',
  'At Office',
  'Arrived',
  'On Hold',
  'Settled',
] as const

const FILTERABLE_COLUMNS = new Set([
  'item_id',
  'received_date',
  'branch',
  'sender_name',
  'sender_loc',
  'receiver_name',
  'receiver_phone',
  'receiver_address',
  'receiver_loc',
  'fee_type',
  'status',
  'cod_amount',
  'deli_fee',
  'total_amount',
  'pickup_rider',
  'deliver_rider',
  'deliver_date',
  'cleared_date',
  'refund_date',
  'note',
  'created_at',
  'transit_to',
  'transit_date',
  'agent_fee',
  'remark',
  'barcode',
  'last_check',
])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')?.trim() || 'ALL'
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const filtersParam = searchParams.get('filters')
    let filters: Record<string, string | string[]> = {}

    if (!orderStatuses.some((value) => value === status)) {
      return NextResponse.json({ error: 'A valid order status is required' }, { status: 400 })
    }

    if (filtersParam) {
      if (filtersParam.length > 10_000) {
        return NextResponse.json({ error: 'Order filters are too large' }, { status: 400 })
      }

      let parsedFilters: unknown
      try {
        parsedFilters = JSON.parse(filtersParam)
      } catch {
        return NextResponse.json({ error: 'Order filters must be valid JSON' }, { status: 400 })
      }

      if (typeof parsedFilters !== 'object' || parsedFilters === null || Array.isArray(parsedFilters)) {
        return NextResponse.json({ error: 'Order filters must be an object' }, { status: 400 })
      }

      filters = {}
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (!FILTERABLE_COLUMNS.has(key)) {
          return NextResponse.json({ error: `Unsupported order filter: ${key}` }, { status: 400 })
        }
        if (typeof value === 'string' && value.length <= 200) {
          filters[key] = value
        } else if (Array.isArray(value) && value.length <= 100 && value.every(
          (item): item is string => typeof item === 'string' && item.length <= 200,
        )) {
          filters[key] = value
        } else {
          return NextResponse.json({ error: `Invalid value for order filter: ${key}` }, { status: 400 })
        }
      }
    }

    const { data, error } = await supabaseServer.rpc('get_dashboard_status_orders_filtered', {
      p_branch: branch,
      p_status: status,
      p_page: page,
      p_limit: limit,
      p_filters: filters,
    })

    if (error) {
      const message = error.message.includes('get_dashboard_status_orders_filtered')
        ? 'Dashboard order list function is not installed in Supabase. Run database/dashboard-status-counts.sql in the Supabase SQL Editor.'
        : error.message
      console.error('Dashboard status orders RPC error:', error)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const result = data as { data?: unknown[]; total?: number } | null
    return NextResponse.json({
      data: result?.data || [],
      total: Number(result?.total || 0),
      page,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dashboard status orders request failed'
    console.error('Dashboard status orders error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
