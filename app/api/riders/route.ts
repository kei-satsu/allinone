import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function errorResponse(error: unknown, status = 500) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Rider request failed' }, { status })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')
    const id = searchParams.get('id')
    const select = searchParams.get('select') || '*'
    const page = Math.max(Number(searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '1000'), 1), 1000)
    let query = supabaseServer.from('riders').select(select, { count: 'exact' }).order('name', { ascending: true })
    if (branch) query = query.eq('branch', branch)
    if (id) query = query.eq('id', id)
    const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)
    if (error) return errorResponse(error)
    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    return errorResponse(error, 400)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body) ? body : body.riders || [body.rider || body]
    if (!rows.length) return errorResponse(new Error('Rider payload is required'), 400)
    const { data, error } = await supabaseServer.from('riders').insert(rows).select()
    if (error) return errorResponse(error)
    return NextResponse.json({ data: data || [] }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 400)
  }
}

export async function PATCH(request: Request) {
  return mutate(request, 'update')
}

export async function DELETE(request: Request) {
  return mutate(request, 'delete')
}

async function mutate(request: Request, operation: 'update' | 'delete') {
  try {
    const body = await request.json()
    const ids = body.ids || body.riderIds || (body.id ? [body.id] : [])
    if (!Array.isArray(ids) || !ids.length) return errorResponse(new Error('Rider IDs are required'), 400)
    let query = supabaseServer.from('riders')
    const result = operation === 'update'
      ? await query.update(body.updates || body.rider || {}).in('id', ids).select()
      : await query.delete().in('id', ids).select()
    if (result.error) return errorResponse(result.error)
    return NextResponse.json({ data: result.data || [] })
  } catch (error) {
    return errorResponse(error, 400)
  }
}