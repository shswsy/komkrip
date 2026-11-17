// One source of truth for the shop: used by the React UI and the Worker API.
// The business is fictional (portfolio demo).

export const SHOP = {
  name: 'คมกริบ บาร์เบอร์',
  nameEn: 'Komkrip Barber',
  area: 'ถ.ศรีภูมิ เชียงใหม่',
  phone: '053-000-111',
  /** opening hours, minutes from midnight */
  open: 10 * 60,
  close: 20 * 60,
  /** 0 = Sunday … 6 = Saturday. Thai barbers traditionally rest on Wednesday. */
  closedWeekdays: [3] as readonly number[],
  /** slot grid in minutes */
  step: 30,
  /** how many days ahead customers can book (today included) */
  daysAhead: 14,
  /** earliest start = now + leadMin */
  leadMin: 30,
  /** max upcoming bookings per phone number */
  maxActivePerPhone: 3,
  tz: 'Asia/Bangkok',
} as const

export interface Service {
  id: string
  name: string
  desc: string
  duration: number
  price: number
}

export const SERVICES: Service[] = [
  { id: 'cut', name: 'ตัดผมชาย', desc: 'ตัด เซ็ตทรง กันขอบ', duration: 30, price: 250 },
  { id: 'cutwash', name: 'ตัด + สระ + นวดหัว', desc: 'สระก่อนตัด นวดหนังศีรษะ 10 นาที', duration: 60, price: 350 },
  { id: 'beard', name: 'แต่งหนวด / โกนหนวด', desc: 'ผ้าร้อน มีดโกน บาล์มบำรุง', duration: 30, price: 180 },
  { id: 'combo', name: 'ตัดผม + แต่งหนวด', desc: 'ครบในคิวเดียว ประหยัดกว่า', duration: 60, price: 390 },
  { id: 'color', name: 'ทำสีผม', desc: 'รวมตัดแต่งทรง ปรึกษาสีก่อนทำ', duration: 90, price: 950 },
  { id: 'kids', name: 'ตัดผมเด็ก', desc: 'อายุไม่เกิน 12 ปี', duration: 30, price: 180 },
]

export interface Staff {
  id: string
  name: string
  role: string
  /** weekdays this barber is off (on top of shop closed days) */
  offDays: number[]
  hue: number
}

export const STAFF: Staff[] = [
  { id: 'ton', name: 'ช่างต้น', role: 'เจ้าของร้าน · ทรงคลาสสิก', offDays: [], hue: 8 },
  { id: 'beer', name: 'ช่างเบียร์', role: 'เฟด / อันเดอร์คัต', offDays: [0], hue: 212 },
  { id: 'mew', name: 'ช่างมิว', role: 'ทำสี / ผมยาว', offDays: [2], hue: 38 },
]

export type Status = 'booked' | 'done' | 'no_show' | 'cancelled'
/** statuses that occupy a slot */
export const ACTIVE_STATUSES: Status[] = ['booked', 'done']

export const STATUS_LABEL: Record<Status, string> = {
  booked: 'จองแล้ว',
  done: 'เสร็จแล้ว',
  no_show: 'ไม่มา',
  cancelled: 'ยกเลิก',
}

export const serviceById = (id: string) => SERVICES.find((s) => s.id === id)
export const staffById = (id: string) => STAFF.find((s) => s.id === id)

// ---------- time helpers (dates are 'YYYY-MM-DD' strings in shop time) ----------

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function fmtMin(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

export function parseTime(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** current date + minute-of-day in Bangkok (UTC+7, no DST) */
export function shopNow(nowMs: number = Date.now()): { date: string; min: number } {
  const d = new Date(nowMs + 7 * 3600_000)
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

export function staffWorks(staff: Staff, iso: string): boolean {
  const wd = weekday(iso)
  return !SHOP.closedWeekdays.includes(wd) && !staff.offDays.includes(wd)
}

export function phoneDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export function isThaiMobile(s: string): boolean {
  return /^0[689]\d{8}$/.test(phoneDigits(s))
}

// ---------- slot engine ----------

export interface Busy {
  staff_id: string
  start_min: number
  end_min: number
}

export interface Slot {
  min: number
  time: string
  /** staff ids who can take this slot */
  free: string[]
}

export interface SlotQuery {
  date: string
  duration: number
  /** candidate staff ids ('any' expanded by the caller) */
  staffIds: string[]
  busy: Busy[]
  closed: boolean
  now: { date: string; min: number }
}

/**
 * All start times of the day for the given service length.
 * Past starts (and starts inside the lead time) are dropped; full ones stay with free = [].
 */
export function computeSlots(q: SlotQuery): Slot[] {
  if (q.closed || SHOP.closedWeekdays.includes(weekday(q.date)) || q.date < q.now.date) return []
  const working = q.staffIds
    .map((id) => staffById(id))
    .filter((s): s is Staff => !!s && staffWorks(s, q.date))
  if (working.length === 0) return []

  const earliest = q.date === q.now.date ? q.now.min + SHOP.leadMin : -1
  const slots: Slot[] = []
  for (let t = SHOP.open; t + q.duration <= SHOP.close; t += SHOP.step) {
    if (t < earliest) continue
    const end = t + q.duration
    const free = working
      .filter((s) => !q.busy.some((b) => b.staff_id === s.id && b.start_min < end && b.end_min > t))
      .map((s) => s.id)
    slots.push({ min: t, time: fmtMin(t), free })
  }
  return slots
}

/** dates customers may pick from */
export function bookableDates(now: { date: string }): string[] {
  return Array.from({ length: SHOP.daysAhead }, (_, i) => addDays(now.date, i))
}

/** staff ids for a query param: 'any' → everyone */
export function expandStaff(id: string): string[] {
  return id === 'any' ? STAFF.map((s) => s.id) : staffById(id) ? [id] : []
}
