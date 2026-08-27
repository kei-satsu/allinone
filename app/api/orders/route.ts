import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const SORT_COLUMNS = new Set([
  'created_at',
  'received_date',
  'deliver_date',
  'updated_at',
  'deleted_at',
  'status',
])

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error'
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(Number(searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 1000)
    const from = (page - 1) * limit
    const to = from + limit - 1
    const status = searchParams.get('status')
    const senderId = searchParams.get('sender_id')
    const deliverRiderId = searchParams.get('deliver_rider_id')
    const pickupRiderId = searchParams.get('pickup_rider_id')
    const branch = searchParams.get('branch')
    const pending = searchParams.get('pending') === 'true'
    const cleared = searchParams.get('cleared')
    const excludeStatus = searchParams.get('exclude_status')
    const isDeleted = searchParams.get('is_deleted')
    const id = searchParams.get('id')
    const search = searchParams.get('search')?.trim()
    const sortByParam = searchParams.get('sortBy') || 'created_at'
    const sortBy = SORT_COLUMNS.has(sortByParam) ? sortByParam : 'created_at'
    const ascending = (searchParams.get('order') || 'desc').toLowerCase() === 'asc'

    let query = supabaseServer
      .from('orders')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending })
      .range(from, to)

    if (status) {
      const statuses = status.split(',').map((value) => value.trim()).filter(Boolean)
      query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', statuses[0])
    }
    if (senderId) query = query.eq('sender_id', senderId)
    if (deliverRiderId) query = query.eq('deliver_rider_id', deliverRiderId)
    if (pickupRiderId) query = query.eq('pickup_rider_id', pickupRiderId)
    if (branch) query = query.eq('branch', branch)
    if (isDeleted !== null) query = query.eq('is_deleted', isDeleted === 'true')
    if (id) query = query.eq('id', id)
    if (pending) query = query.or('receiver_name.is.null,receiver_name.eq.""')
    if (cleared === 'true') query = query.not('cleared_date', 'is', null)
    if (excludeStatus) query = query.not('status', 'in', `(${excludeStatus.split(',').join(',')})`)
    if (search) {
      const escapedSearch = search.replace(/[%(),]/g, '')
      query = query.or(
        `id.ilike.%${escapedSearch}%,item_id.ilike.%${escapedSearch}%,barcode.ilike.%${escapedSearch}%,receiver_name.ilike.%${escapedSearch}%,receiver_phone.ilike.%${escapedSearch}%,receiver_loc.ilike.%${escapedSearch}%,receiver_address.ilike.%${escapedSearch}%`,
      )
    }

    const { data, count, error } = await query
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Orders GET error:', error)
    return jsonError(errorMessage(error), 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orders = Array.isArray(body) ? body : body.orders || [body.order || body]
    if (!Array.isArray(orders) || orders.length === 0) return jsonError('Order payload is required', 400)

    const { data, error } = await supabaseServer.from('orders').insert(orders).select()
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ data: data || [] }, { status: 201 })
  } catch (error) {
    console.error('Orders POST error:', error)
    return jsonError(errorMessage(error), 400)
  }
}

export async function PATCH(request: Request) {
  return updateOrders(request)
}

export async function PUT(request: Request) {
  return updateOrders(request)
}

async function updateOrders(request: Request) {
  try {
    const body = await request.json()
    const orderIds = body.orderIds || body.ids || (body.order?.id ? [body.order.id] : body.id ? [body.id] : [])
    const updates = body.updates || body.order || body.data

    if (!Array.isArray(orderIds) || orderIds.length === 0 || !updates || typeof updates !== 'object') {
      return jsonError('Order IDs and update payload are required', 400)
    }

    const { data, error } = await supabaseServer
      .from('orders')
      .update(updates)
      .in('id', orderIds)
      .select()
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Orders update error:', error)
    return jsonError(errorMessage(error), 400)
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const orderIds = body.orderIds || body.ids || (body.id ? [body.id] : [])
    if (!Array.isArray(orderIds) || orderIds.length === 0) return jsonError('Order IDs are required', 400)

    const { data, error } = await supabaseServer.from('orders').delete().in('id', orderIds).select()
    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Orders DELETE error:', error)
    return jsonError(errorMessage(error), 400)
  }
}
