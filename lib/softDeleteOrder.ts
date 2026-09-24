import { supabase } from '@/lib/supabase'

export async function softDeleteOrder(orderId: string | number) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return { error: new Error('Authentication is required') }
  }

  const response = await fetch('/api/orders/soft-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId }),
  })
  const payload = await response.json().catch(() => ({}))

  return response.ok
    ? { error: null, data: payload.data }
    : { error: new Error(payload.error || 'Unable to move order to trash') }
}
