import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const TABLES = new Set(['orders', 'senders', 'riders', 'cities', 'cash_handovers'])

function responseError(error: unknown, status = 500) {
  if (error && typeof error === 'object') {
    const databaseError = error as { message?: string; code?: string; details?: string; hint?: string }
    return NextResponse.json({
      error: databaseError.message || 'Database request failed',
      code: databaseError.code,
      details: databaseError.details,
      hint: databaseError.hint,
    }, { status })
  }

  return NextResponse.json({ error: error instanceof Error ? error.message : 'Database request failed' }, { status })
}

function applyFilters(query: any, filters: any[] = []) {
  for (const filter of filters) {
    if (filter.kind === 'eq') query = query.eq(filter.column, filter.value)
    else if (filter.kind === 'neq') query = query.neq(filter.column, filter.value)
    else if (filter.kind === 'gte') query = query.gte(filter.column, filter.value)
    else if (filter.kind === 'lte') query = query.lte(filter.column, filter.value)
    else if (filter.kind === 'in') query = query.in(filter.column, filter.value)
    else if (filter.kind === 'not') query = query.not(filter.column, filter.operator, filter.value)
    else if (filter.kind === 'or') query = query.or(filter.value)
    else if (filter.kind === 'filter') query = query.filter(filter.column, filter.operator, filter.value)
    else if (filter.kind === 'ilike') query = query.ilike(filter.column, filter.value)
  }
  return query
}

export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  return mutate(request, params, 'insert')
}

export async function PATCH(request: Request, { params }: { params: Promise<{ table: string }> }) {
  return mutate(request, params, 'update')
}

export async function DELETE(request: Request, { params }: { params: Promise<{ table: string }> }) {
  return mutate(request, params, 'delete')
}

async function mutate(request: Request, params: Promise<{ table: string }>, operation: 'insert' | 'update' | 'delete') {
  try {
    const { table } = await params
    if (!TABLES.has(table)) return responseError(new Error('Unsupported table'), 404)
    const body = await request.json()
    let query: any = supabaseServer.from(table)
    if (operation === 'insert') query = query.insert(body.rows || body.data || body)
    if (operation === 'update') query = query.update(body.updates || {})
    if (operation === 'delete') query = query.delete()
    query = applyFilters(query, body.filters)
    if (body.select) query = query.select(body.select)
    const result = await query
    if (result.error) return responseError(result.error)
    return NextResponse.json({ data: result.data || [] }, { status: operation === 'insert' ? 201 : 200 })
  } catch (error) {
    return responseError(error, 400)
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params
    if (!TABLES.has(table)) return responseError(new Error('Unsupported table'), 404)
    const input = JSON.parse(new URL(request.url).searchParams.get('query') || '{}')
    let query: any = supabaseServer.from(table).select(input.select || '*', { count: 'exact' })
    query = applyFilters(query, input.filters)
    if (input.order) query = query.order(input.order.column, { ascending: input.order.ascending })
    if (input.limit !== undefined) query = query.limit(input.limit)
    if (input.range) query = query.range(input.range.from, input.range.to)
    const result = await query
    if (result.error) return responseError(result.error)
    return NextResponse.json({ data: result.data || [], total: result.count || 0 })
  } catch (error) {
    return responseError(error, 400)
  }
}