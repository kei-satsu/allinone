import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')?.trim()
    const branchOrNull = branch && branch !== 'ALL' ? branch : null
    const { data, error } = await supabaseServer.rpc('get_dashboard_summary', { p_branch: branchOrNull })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dashboard summary request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
