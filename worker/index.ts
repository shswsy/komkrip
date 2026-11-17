import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import {
  ACTIVE_STATUSES,
  SHOP,
  addDays,
  bookableDates,
  computeSlots,
  expandStaff,
  isIsoDate,
  isThaiMobile,
  parseTime,
  phoneDigits,
  serviceById,
  shopNow,
  staffById,
  staffWorks,
  weekday,
  type Busy,
  type Status,
} from '../shared/shop'
import { COOKIE, SESSION_MS, makeToken, safeEqual, verifyToken } from './auth'
import { resetDemo } from './demo'

type App = { Bindings: Env }
type Ctx = Context<App>

const app = new Hono<App>().basePath('/api')

const ACTIVE_SQL = `status IN (${ACTIVE_STATUSES.map((s) => `'${s}'`).join(',')})`
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

async function readJson<T extends object>(c: Ctx): Promise<T> {
  try {
    const v: unknown = await c.req.json()
    return (v && typeof v === 'object' ? v : {}) as T
  } catch {
    return {} as T
  }
}

const err = (c: Ctx, status: 400 | 401 | 403 | 404 | 409 | 429, message: string) => c.json({ error: message }, status)

async function limited(limiter: RateLimit, c: Ctx): Promise<boolean> {
  const ip = c.req.header('cf-connecting-ip') ?? 'local'
  const { success } = await limiter.limit({ key: ip })
  return !success
}

async function busyFor(db: D1Database, from: string, to: string): Promise<(Busy & { date: string })[]> {
  const { results } = await db
    .prepare(`SELECT date, staff_id, start_min, end_min FROM bookings WHERE date BETWEEN ? AND ? AND ${ACTIVE_SQL}`)
    .bind(from, to)
    .all<Busy & { date: string }>()
  return results
}

async function closedMap(db: D1Database, from: string, to: string): Promise<Map<string, string>> {
  const { results } = await db
    .prepare('SELECT date, reason FROM closed_dates WHERE date BETWEEN ? AND ?')
    .bind(from, to)
    .all<{ date: string; reason: string }>()
  return new Map(results.map((r) => [r.date, r.reason]))
}

// ---------- public ----------

/** 14-day strip: how many start times are still free per day */
app.get('/calendar', async (c) => {
  const service = serviceById(c.req.query('service') ?? '')
  const staffIds = expandStaff(c.req.query('staff') ?? 'any')
  if (!service || staffIds.length === 0) return err(c, 400, 'service/staff ไม่ถูกต้อง')
  const now = shopNow()
  const dates = bookableDates(now)
  const from = dates[0]
  const to = dates[dates.length - 1]
  const [busy, closed] = await Promise.all([busyFor(c.env.DB, from, to), closedMap(c.env.DB, from, to)])
  return c.json({
    today: now.date,
    days: dates.map((date) => {
      const reason = closed.get(date)
      const slots = computeSlots({
        date,
        duration: service.duration,
        staffIds,
        busy: busy.filter((b) => b.date === date),
        closed: reason !== undefined,
        now,
      })
      return {
        date,
        closed: reason !== undefined || SHOP.closedWeekdays.includes(weekday(date)),
        off: !staffIds.some((id) => { const s = staffById(id); return !!s && staffWorks(s, date) }),
        reason: reason ?? '',
        free: slots.filter((s) => s.free.length > 0).length,
      }
    }),
  })
})

app.get('/slots', async (c) => {
  const date = c.req.query('date') ?? ''
  const service = serviceById(c.req.query('service') ?? '')
  const staffIds = expandStaff(c.req.query('staff') ?? 'any')
  if (!isIsoDate(date) || !service || staffIds.length === 0) return err(c, 400, 'คำขอไม่ถูกต้อง')
  const now = shopNow()
  const [busy, closed] = await Promise.all([busyFor(c.env.DB, date, date), closedMap(c.env.DB, date, date)])
  const slots = computeSlots({ date, duration: service.duration, staffIds, busy, closed: closed.has(date), now })
  return c.json({ date, closed: closed.has(date), reason: closed.get(date) ?? '', slots })
})

interface BookingBody {
  service?: string
  staff?: string
  date?: string
  time?: string
  name?: string
  phone?: string
  note?: string
}

app.post('/bookings', async (c) => {
  if (await limited(c.env.BOOK_LIMITER, c)) return err(c, 429, 'ส่งคำขอถี่เกินไป ลองใหม่ในอีกสักครู่')
  const body = await readJson<BookingBody>(c)
  const service = serviceById(body.service ?? '')
  const staffIds = expandStaff(body.staff ?? '')
  const date = body.date ?? ''
  const start = parseTime(body.time ?? '')
  const name = (body.name ?? '').trim().slice(0, 60)
  const phone = phoneDigits(body.phone ?? '')
  const note = (body.note ?? '').trim().slice(0, 200)

  if (!service || staffIds.length === 0) return err(c, 400, 'กรุณาเลือกบริการและช่าง')
  if (!isIsoDate(date) || start === null) return err(c, 400, 'กรุณาเลือกวันและเวลา')
  if (name.length < 2) return err(c, 400, 'กรุณากรอกชื่อ')
  if (!isThaiMobile(phone)) return err(c, 400, 'เบอร์มือถือไม่ถูกต้อง (10 หลัก ขึ้นต้น 06/08/09)')

  const now = shopNow()
  if (!bookableDates(now).includes(date)) return err(c, 400, `จองล่วงหน้าได้ไม่เกิน ${SHOP.daysAhead} วัน`)

  const { n } = (await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE phone = ? AND status = 'booked' AND date >= ?`,
  )
    .bind(phone, now.date)
    .first<{ n: number }>()) ?? { n: 0 }
  if (n >= SHOP.maxActivePerPhone) return err(c, 409, `เบอร์นี้มีคิวที่ยังไม่ถึงเวลา ${n} คิวแล้ว`)

  const [busy, closed] = await Promise.all([busyFor(c.env.DB, date, date), closedMap(c.env.DB, date, date)])
  const slot = computeSlots({ date, duration: service.duration, staffIds, busy, closed: closed.has(date), now }).find(
    (s) => s.min === start,
  )
  if (!slot) return err(c, 400, 'เวลานี้ไม่เปิดให้จอง')
  if (slot.free.length === 0) return err(c, 409, 'ขออภัย คิวนี้เพิ่งถูกจองไป กรุณาเลือกเวลาอื่น')

  const end = start + service.duration
  // Atomic guard: the insert only happens if no overlapping active booking exists at write time,
  // so two customers racing for the same chair cannot both win.
  const insert = c.env.DB.prepare(
    `INSERT INTO bookings (code, service_id, staff_id, date, start_min, end_min, name, phone, note, price)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
     WHERE NOT EXISTS (
       SELECT 1 FROM bookings
       WHERE staff_id = ?3 AND date = ?4 AND ${ACTIVE_SQL} AND start_min < ?6 AND end_min > ?5
     ) AND NOT EXISTS (SELECT 1 FROM closed_dates WHERE date = ?4)`,
  )
  for (const staffId of slot.free) {
    const code = newCode()
    const res = await insert
      .bind(code, service.id, staffId, date, start, end, name, phone, note, service.price)
      .run()
      .catch(() => null) // UNIQUE(code) collision → try next
    if (res && res.meta.changes === 1) {
      return c.json({ code, service: service.id, staff: staffId, date, start, end, name, price: service.price, status: 'booked' }, 201)
    }
  }
  return err(c, 409, 'ขออภัย คิวนี้เพิ่งถูกจองไป กรุณาเลือกเวลาอื่น')
})

interface PublicBooking {
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

async function findOwn(db: D1Database, code: string, phone: string): Promise<PublicBooking | null> {
  return db
    .prepare(
      `SELECT code, service_id, staff_id, date, start_min, end_min, name, price, status
       FROM bookings WHERE code = ? AND phone = ?`,
    )
    .bind(code.trim().toUpperCase(), phoneDigits(phone))
    .first<PublicBooking>()
}

app.post('/bookings/lookup', async (c) => {
  if (await limited(c.env.LOOKUP_LIMITER, c)) return err(c, 429, 'ลองบ่อยเกินไป รอสักครู่')
  const { code = '', phone = '' } = await readJson<{ code?: string; phone?: string }>(c)
  const b = await findOwn(c.env.DB, code, phone)
  return b ? c.json(b) : err(c, 404, 'ไม่พบคิว ตรวจสอบรหัสคิวและเบอร์โทรอีกครั้ง')
})

app.post('/bookings/cancel', async (c) => {
  if (await limited(c.env.LOOKUP_LIMITER, c)) return err(c, 429, 'ลองบ่อยเกินไป รอสักครู่')
  const { code = '', phone = '' } = await readJson<{ code?: string; phone?: string }>(c)
  const b = await findOwn(c.env.DB, code, phone)
  if (!b) return err(c, 404, 'ไม่พบคิว')
  if (b.status !== 'booked') return err(c, 409, 'คิวนี้ยกเลิกไม่ได้แล้ว')
  const now = shopNow()
  if (b.date < now.date || (b.date === now.date && b.start_min <= now.min)) return err(c, 409, 'เลยเวลานัดแล้ว')
  await c.env.DB.prepare(`UPDATE bookings SET status = 'cancelled' WHERE code = ?`).bind(b.code).run()
  return c.json({ ...b, status: 'cancelled' })
})

// ---------- admin ----------

app.post('/admin/login', async (c) => {
  if (await limited(c.env.LOGIN_LIMITER, c)) return err(c, 429, 'ลองรหัสผ่านบ่อยเกินไป รอ 1 นาที')
  const { password = '' } = await readJson<{ password?: string }>(c)
  if (!(await safeEqual(password, c.env.ADMIN_PASSWORD))) return err(c, 401, 'รหัสผ่านไม่ถูกต้อง')
  setCookie(c, COOKIE, await makeToken(c.env.SESSION_SECRET), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/api',
    maxAge: SESSION_MS / 1000,
  })
  return c.json({ ok: true })
})

app.post('/admin/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/api' })
  return c.json({ ok: true })
})

/** session probe for the UI: always 200 so a logged-out visit is not an error */
app.get('/admin/session', async (c) =>
  c.json({ in: await verifyToken(c.env.SESSION_SECRET, getCookie(c, COOKIE)), demo: c.env.DEMO === '1' }),
)

app.use('/admin/*', async (c, next) => {
  if (!(await verifyToken(c.env.SESSION_SECRET, getCookie(c, COOKIE)))) return err(c, 401, 'กรุณาเข้าสู่ระบบ')
  await next()
})

interface AdminBooking extends PublicBooking {
  id: number
  phone: string
  note: string
  created_at: string
}

/** demo is public, so phone numbers people type there are masked */
const maskPhone = (p: string) => `${p.slice(0, 2)}x-xxx-${p.slice(-4)}`

app.get('/admin/day', async (c) => {
  const date = c.req.query('date') ?? shopNow().date
  if (!isIsoDate(date)) return err(c, 400, 'วันที่ไม่ถูกต้อง')
  const weekFrom = addDays(date, -3)
  const weekTo = addDays(date, 3)
  const [{ results }, closed, week] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, code, service_id, staff_id, date, start_min, end_min, name, phone, note, price, status, created_at
       FROM bookings WHERE date = ? ORDER BY start_min, staff_id`,
    )
      .bind(date)
      .all<AdminBooking>(),
    closedMap(c.env.DB, weekFrom, weekTo),
    c.env.DB.prepare(
      `SELECT date, COUNT(*) AS n FROM bookings WHERE date BETWEEN ? AND ? AND ${ACTIVE_SQL} GROUP BY date`,
    )
      .bind(weekFrom, weekTo)
      .all<{ date: string; n: number }>(),
  ])
  const counts = new Map(week.results.map((r) => [r.date, r.n]))
  const demo = c.env.DEMO === '1'
  return c.json({
    date,
    now: shopNow(),
    closed: closed.has(date),
    reason: closed.get(date) ?? '',
    bookings: results.map((b) => (demo ? { ...b, phone: maskPhone(b.phone) } : b)),
    week: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekFrom, i)
      return { date: d, count: counts.get(d) ?? 0, closed: closed.has(d) }
    }),
  })
})

const STATUSES: Status[] = ['booked', 'done', 'no_show', 'cancelled']

app.patch('/admin/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { status } = await readJson<{ status?: Status }>(c)
  if (!Number.isInteger(id) || !status || !STATUSES.includes(status)) return err(c, 400, 'คำขอไม่ถูกต้อง')
  const b = await c.env.DB.prepare('SELECT staff_id, date, start_min, end_min FROM bookings WHERE id = ?')
    .bind(id)
    .first<Busy & { date: string }>()
  if (!b) return err(c, 404, 'ไม่พบคิว')
  // re-activating a cancelled booking must not collide with whoever took the slot since
  const res = await c.env.DB.prepare(
    `UPDATE bookings SET status = ?1 WHERE id = ?2 AND (?1 NOT IN ('booked','done') OR NOT EXISTS (
       SELECT 1 FROM bookings o WHERE o.id != ?2 AND o.staff_id = ?3 AND o.date = ?4
         AND o.${ACTIVE_SQL} AND o.start_min < ?6 AND o.end_min > ?5))`,
  )
    .bind(status, id, b.staff_id, b.date, b.start_min, b.end_min)
    .run()
  if (res.meta.changes !== 1) return err(c, 409, 'ช่วงเวลานี้มีคิวอื่นแล้ว')
  return c.json({ ok: true, id, status })
})

app.put('/admin/closed/:date', async (c) => {
  const date = c.req.param('date')
  if (!isIsoDate(date)) return err(c, 400, 'วันที่ไม่ถูกต้อง')
  const { reason = '' } = await readJson<{ reason?: string }>(c)
  await c.env.DB.prepare('INSERT INTO closed_dates (date, reason) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason')
    .bind(date, reason.trim().slice(0, 80))
    .run()
  return c.json({ ok: true })
})

app.delete('/admin/closed/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM closed_dates WHERE date = ?').bind(c.req.param('date')).run()
  return c.json({ ok: true })
})

app.post('/admin/reset-demo', async (c) => {
  if (c.env.DEMO !== '1') return err(c, 403, 'ปิดใช้งาน')
  return c.json({ ok: true, seeded: await resetDemo(c.env.DB) })
})

app.notFound((c) => err(c, 404, 'not found'))
app.onError((e, c) => {
  console.error(e)
  return c.json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' }, 500)
})

export default {
  fetch: app.fetch,
  async scheduled(_event, env) {
    if (env.DEMO === '1') await resetDemo(env.DB)
  },
} satisfies ExportedHandler<Env>
