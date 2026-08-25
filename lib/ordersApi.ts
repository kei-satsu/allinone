export type OrderQuery = Record<string, string | number | boolean | undefined>

async function requestOrders<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Order request failed')
  }
  return payload as T
}

export async function getOrders(query: OrderQuery = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return requestOrders<{ data: any[]; total: number }>(`/api/orders?${params.toString()}`)
}

export async function createOrders(orders: any | any[]) {
  return requestOrders<{ data: any[] }>('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.isArray(orders) ? { orders } : { order: orders }),
  })
}

export async function updateOrders(orderIds: string | string[], updates: Record<string, unknown>) {
  return requestOrders<{ data: any[] }>('/api/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds: Array.isArray(orderIds) ? orderIds : [orderIds], updates }),
  })
}

export async function deleteOrders(orderIds: string | string[]) {
  return requestOrders<{ data: any[] }>('/api/orders', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds: Array.isArray(orderIds) ? orderIds : [orderIds] }),
  })
}
