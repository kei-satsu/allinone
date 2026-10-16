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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')?.trim() || 'ALL'
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    if (!orderStatuses.some((value) => value === status)) {
      return NextResponse.json({ error: 'A valid order status is required' }, { status: 400 })
    }

    const { data, error } = await supabaseServer.rpc('get_dashboard_status_orders', {
      p_branch: branch,
      p_status: status,
      p_page: page,
      p_limit: limit,
    })

    if (error) {
      const message = error.message.includes('get_dashboard_status_orders')
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
