export type ApiQuery = Record<string, string | number | boolean | undefined>

type Filter = { kind: string; column?: string; operator?: string; value?: unknown }
type ApiError = Error & { code?: string; details?: string; hint?: string }

class ApiQueryBuilder<T = any> implements PromiseLike<{ data: T[] | T | null; error: Error | null; count?: number }> {
  private query: Record<string, any> = { filters: [] as Filter[] }
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: any
  private one = false

  constructor(private readonly table: string) {}
  select(columns = '*', _options?: unknown) { this.query.select = columns; return this }
  eq(column: string, value: unknown) { this.query.filters.push({ kind: 'eq', column, value }); return this }
  neq(column: string, value: unknown) { this.query.filters.push({ kind: 'neq', column, value }); return this }
  gte(column: string, value: unknown) { this.query.filters.push({ kind: 'gte', column, value }); return this }
  lte(column: string, value: unknown) { this.query.filters.push({ kind: 'lte', column, value }); return this }
  in(column: string, value: unknown[]) { this.query.filters.push({ kind: 'in', column, value }); return this }
  not(column: string, operator: string, value: unknown) { this.query.filters.push({ kind: 'not', column, operator, value }); return this }
  or(value: string) { this.query.filters.push({ kind: 'or', value }); return this }
  filter(column: string, operator: string, value: unknown) { this.query.filters.push({ kind: 'filter', column, operator, value }); return this }
  ilike(column: string, value: unknown) { this.query.filters.push({ kind: 'ilike', column, value }); return this }
  order(column: string, options: { ascending?: boolean } = {}) { this.query.order = { column, ascending: options.ascending ?? true }; return this }
  range(from: number, to: number) { this.query.range = { from, to }; return this }
  limit(value: number) { this.query.limit = value; return this }
  insert(payload: any) { this.operation = 'insert'; this.payload = payload; return this }
  update(payload: any) { this.operation = 'update'; this.payload = payload; return this }
  delete() { this.operation = 'delete'; return this }
  single() { this.one = true; return this }
  maybeSingle() { this.one = true; return this }
  then<TResult1 = { data: any; error: ApiError | null; count?: number }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: ApiError | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    const method = this.operation === 'select' ? 'GET' : this.operation === 'insert' ? 'POST' : this.operation === 'update' ? 'PATCH' : 'DELETE'
    const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
    const url = `/api/table/${this.table}`
    if (method === 'GET') init.body = undefined
    else init.body = JSON.stringify({ rows: this.payload, data: this.payload, updates: this.payload, select: this.query.select, filters: this.query.filters })
    const target = method === 'GET' ? `${url}?query=${encodeURIComponent(JSON.stringify(this.query))}` : url
    return fetch(target, init).then(async response => {
      const payload = await response.json().catch(() => ({}))
      const data = this.one ? (payload.data?.[0] || null) : (payload.data || null)
      const result = response.ok ? { data, error: null, count: payload.total } : { data: null, error: Object.assign(new Error(payload.error || 'Database request failed'), payload) as ApiError }
      return onfulfilled ? onfulfilled(result) : result as TResult1
    }, onrejected)
  }
}

export const apiClient = { from: <T = any>(table: string) => new ApiQueryBuilder<T>(table) }

async function requestApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Database request failed')
  return payload as T
}

function queryString(query: ApiQuery) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function getRiders(query: ApiQuery = {}) { return requestApi<{ data: any[]; total: number }>(`/api/riders?${queryString(query)}`) }
export function getCities(query: ApiQuery = {}) { return requestApi<{ data: any[]; total: number }>(`/api/cities?${queryString(query)}`) }
export function getCashHandovers(query: ApiQuery = {}) { return requestApi<{ data: any[]; total: number }>(`/api/cash-handovers?${queryString(query)}`) }
export function getSenderSummary(branch: string, date: string) { return requestApi<{ data: any[]; total: number }>(`/api/sender-summary?${queryString({ branch, date })}`) }

export function createCity(city: Record<string, unknown>) {
  return requestApi<{ data: any[] }>('/api/cities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(city) })
}

export function createCashHandover(handover: Record<string, unknown> | Record<string, unknown>[]) {
  return requestApi<{ data: any[] }>('/api/cash-handovers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(handover) })
}

export function updateRider(id: string, updates: Record<string, unknown>) {
  return requestApi<{ data: any[] }>('/api/riders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id], updates }) })
}

export function createRider(rider: Record<string, unknown>) {
  return requestApi<{ data: any[] }>('/api/riders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rider) })
}

export function deleteRider(id: string) {
  return requestApi<{ data: any[] }>('/api/riders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
}