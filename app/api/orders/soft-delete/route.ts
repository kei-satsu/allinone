import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

type HistoryEntry = {
  timestamp: string
  action: string
  operator: string
  note: string
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    const accessToken = authorization?.replace(/^Bearer\s+/i, '')
    if (!accessToken) return jsonError('Authentication is required', 401)

    const { data: authData, error: authError } = await supabaseServer.auth.getUser(accessToken)
    if (authError || !authData.user) return jsonError('Authentication is required', 401)

    const body = await request.json()
    const orderId = body?.orderId
    if (orderId === undefined || orderId === null || orderId === '') {
      return jsonError('Order ID is required', 400)
    }

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('username')
      .eq('id', authData.user.id)
      .maybeSingle()

    const operator = profile?.username
      || authData.user.user_metadata?.username
      || authData.user.email?.split('@')[0]
      || 'Unknown User'
    const timestamp = new Date().toISOString()

    const { data: order, error: readError } = await supabaseServer
      .from('orders')
      .select('history')
      .eq('id', orderId)
      .maybeSingle()

    if (readError) return jsonError(readError.message, 500)
    if (!order) return jsonError('Order not found', 404)

    const history = Array.isArray(order.history) ? order.history : []
    const deleteEntry: HistoryEntry = {
      timestamp,
      action: 'Order Soft Deleted',
      operator,
      note: 'Moved to Recently Deleted',
    }

    const { data, error } = await supabaseServer
      .from('orders')
      .update({
        is_deleted: true,
        deleted_at: timestamp,
        history: [...history, deleteEntry],
      })
      .eq('id', orderId)
      .select()
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Order soft delete error:', error)
    return jsonError(error instanceof Error ? error.message : 'Unable to delete order', 400)
  }
}
