import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch')
  const date = searchParams.get('date')
  if (!branch || !date) return NextResponse.json({ error: 'branch and date are required' }, { status: 400 })
  const { data, error } = await supabaseServer.rpc('get_sender_daily_summary', { p_branch: branch, p_date: date })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], total: data?.length || 0 })
}