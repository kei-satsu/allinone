import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('LOC')
    let query = supabaseServer
      .from('senders')
      .select('*, orders(id, status, cleared_date)')
      .order('name', { ascending: true })

    if (location) query = query.eq('LOC', location)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [], total: data?.length || 0 })
  } catch (error) {
    console.error('Senders GET error:', error)
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Sender payload is required' }, { status: 400 })
    }
    const { data, error } = await supabaseServer.from('senders').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = body?.id
    const updates = body?.updates
    if (!id || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Sender ID and update payload are required' }, { status: 400 })
    }
    const { data, error } = await supabaseServer.from('senders').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }
}