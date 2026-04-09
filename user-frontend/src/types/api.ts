export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface ApiError {
  code: number
  message: string
  details?: Record<string, string[]>
}
