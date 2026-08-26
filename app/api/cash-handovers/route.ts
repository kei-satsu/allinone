import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch')
  const riderId = searchParams.get('rider_id')
  const select = searchParams.get('select') || '*'
  let query = supabaseServer.from('cash_handovers').select(select, { count: 'exact' }).order('created_at', { ascending: false })
  if (branch) query = query.eq('branch', branch)
  if (riderId) query = query.eq('rider_id', riderId)
  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body) ? body : body.handovers || [body.handOver || body]
    const { data, error } = await supabaseServer.from('cash_handovers').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cash handover request failed' }, { status: 400 })
  }
}