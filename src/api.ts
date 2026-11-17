import type { Slot, Status } from '../shared/shop'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต', 0)
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(data.error ?? 'เกิดข้อผิดพลาด', res.status)
  return data as T
}

export const send = <T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export interface CalendarDay {
  date: string
  closed: boolean
  off: boolean
  reason: string
  free: number
}

export interface SlotsResponse {
  date: string
  closed: boolean
  reason: string
  slots: Slot[]
}

/** what a customer sees about their own booking */
export interface TicketData {
  code: string
  serviceId: string
  staffId: string
  date: string
  start: number
  end: number
  name: string
  price: number
  status: Status
}

export interface RawBooking {
  code: string
  service_id: string
  staff_id: string
  date: string
  start_min: number
  end_min: number
  name: string
  price: number
  status: Status
}

export const toTicket = (b: RawBooking): TicketData => ({
  code: b.code,
  serviceId: b.service_id,
  staffId: b.staff_id,
  date: b.date,
  start: b.start_min,
  end: b.end_min,
  name: b.name,
  price: b.price,
  status: b.status,
})

export interface AdminBooking extends RawBooking {
  id: number
  phone: string
  note: string
  created_at: string
}

export interface AdminDay {
  date: string
  now: { date: string; min: number }
  closed: boolean
  reason: string
  bookings: AdminBooking[]
  week: { date: string; count: number; closed: boolean }[]
}
