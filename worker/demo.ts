// Public demo data: wiped and re-seeded nightly by the cron trigger (and from the admin screen).
import { addDays, serviceById, shopNow, staffById, staffWorks, parseTime } from '../shared/shop'

type Row = [dayOffset: number, staff: string, time: string, service: string, name: string]

const PLAN: Row[] = [
  [0, 'ton', '10:00', 'cut', 'คุณโอ๊ต'],
  [0, 'ton', '11:00', 'combo', 'คุณบอส'],
  [0, 'beer', '10:30', 'cutwash', 'คุณนนท์'],
  [0, 'mew', '11:00', 'color', 'คุณแพร'],
  [0, 'ton', '13:30', 'beard', 'คุณเจมส์'],
  [0, 'beer', '14:00', 'cut', 'คุณกาย'],
  [0, 'mew', '15:00', 'kids', 'น้องภูมิ'],
  [0, 'ton', '17:00', 'cutwash', 'คุณฟลุ๊ค'],
  [0, 'beer', '18:30', 'combo', 'คุณต้า'],
  [1, 'ton', '10:30', 'cut', 'คุณมาร์ค'],
  [1, 'beer', '12:00', 'combo', 'คุณวิน'],
  [1, 'mew', '13:00', 'color', 'คุณเฟิร์น'],
  [1, 'ton', '16:00', 'cutwash', 'คุณเก่ง'],
  [2, 'beer', '11:00', 'cut', 'คุณปอนด์'],
  [2, 'ton', '18:00', 'combo', 'คุณบีม'],
  [3, 'mew', '10:00', 'cutwash', 'คุณอาร์ม'],
]

export async function resetDemo(db: D1Database, nowMs = Date.now()): Promise<number> {
  const now = shopNow(nowMs)
  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM bookings'), db.prepare('DELETE FROM closed_dates')]
  const insert = db.prepare(
    `INSERT INTO bookings (code, service_id, staff_id, date, start_min, end_min, name, phone, note, price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
  )
  let n = 0
  PLAN.forEach(([offset, staffId, time, serviceId, name], i) => {
    const date = addDays(now.date, offset)
    const staff = staffById(staffId)
    const service = serviceById(serviceId)
    const start = parseTime(time)
    if (!staff || !service || start === null || !staffWorks(staff, date)) return
    const end = start + service.duration
    const past = offset === 0 && end <= now.min
    // one past customer did not show up, the rest are done
    const status = past ? (i === 4 ? 'no_show' : 'done') : 'booked'
    const code = `DM${String(i + 1).padStart(3, '0')}`
    const phone = `08000001${String(i).padStart(2, '0')}`
    stmts.push(insert.bind(code, serviceId, staffId, date, start, end, name, phone, service.price, status))
    n++
  })
  await db.batch(stmts)
  return n
}
