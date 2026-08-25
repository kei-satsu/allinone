export type SenderQuery = Record<string, string | undefined>

async function requestSenders<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Sender request failed')
  return payload as T
}

export async function getSenders(query: SenderQuery = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return requestSenders<{ data: any[]; total: number }>(`/api/senders?${params.toString()}`)
}

export async function createSender(sender: Record<string, unknown>) {
  return requestSenders<{ data: Record<string, unknown> }>('/api/senders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sender),
  })
}

export async function updateSender(id: string, updates: Record<string, unknown>) {
  return requestSenders<{ data: Record<string, unknown> }>('/api/senders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, updates }),
  })
}
