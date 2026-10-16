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

type OrderStatus = (typeof orderStatuses)[number]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')?.trim() || null
    const { data, error } = await supabaseServer.rpc('get_dashboard_status_counts', {
      p_branch: branch,
    })

    if (error) {
      const message = error.message.includes('get_dashboard_status_counts')
        ? 'Dashboard count function is not installed in Supabase. Run database/dashboard-status-counts.sql in the Supabase SQL Editor.'
        : error.message
      console.error('Dashboard status counts RPC error:', error)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const counts: Record<OrderStatus, number> = {
      Handover: 0,
      'On Way': 0,
      Delivered: 0,
      'At Office': 0,
      Arrived: 0,
      'On Hold': 0,
      Settled: 0,
    }

    for (const row of data || []) {
      const status = orderStatuses.find((value) => value === row.status)
      if (status) counts[status] = Number(row.order_count)
    }

    return NextResponse.json({ data: counts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dashboard status counts request failed'
    console.error('Dashboard status counts error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
