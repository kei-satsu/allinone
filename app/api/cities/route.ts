import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const select = searchParams.get('select') || '*'
  const { data, count, error } = await supabaseServer.from('cities').select(select, { count: 'exact' }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: count || 0 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body) ? body : body.cities || [body.city || body]
    const { data, error } = await supabaseServer.from('cities').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    return NextResponse.json({ data: data || [] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'City request failed' }, { status: 400 })
  }
}