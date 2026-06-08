import { getAuthToken } from './auth'

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
  if (envUrl.endsWith('/admin')) return envUrl
  if (envUrl.endsWith('/api/v1')) return `${envUrl}/admin`
  return `${envUrl}/admin`
}

export interface FlushHistoryItem {
  id: string
  user_id: string
  display_id: string
  user_name: string
  flushed_at: string
  spot_amount_flushed: number
  team_royalty_amount_flushed: number
  trigger_commission_type: string | null
  current_spot_balance: number
  current_team_royalty_balance: number
}

export interface FlushHistoryResponse {
  items: FlushHistoryItem[]
  total: number
  page: number
  limit: number
}

export interface FlushHistoryQuery {
  page?: number
  limit?: number
  user_id?: string
}

export async function getFlushHistory(query?: FlushHistoryQuery): Promise<FlushHistoryResponse> {
  const token = getAuthToken()
  if (!token) throw new Error('Authentication token not found. Please login.')

  const params = new URLSearchParams()
  if (query?.page) params.append('page', query.page.toString())
  if (query?.limit) params.append('limit', query.limit.toString())
  if (query?.user_id) params.append('user_id', query.user_id)

  const url = `${getBaseUrl()}/flush-history${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || err.error || `HTTP ${response.status}`)
  }
  return response.json()
}
