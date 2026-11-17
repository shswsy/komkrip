import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { SHOP, STAFF, STATUS_LABEL, addDays, fmtMin, serviceById, shopNow, staffById, staffWorks, type Status } from '../../shared/shop'
import { ApiError, api, send, type AdminBooking, type AdminDay } from '../api'
import { baht, dayParts, prettyPhone, thaiLong, timeRange } from '../format'

const ROW = 44 // px per 30 minutes
const HOURS = Array.from({ length: (SHOP.close - SHOP.open) / 60 }, (_, i) => SHOP.open + i * 60)

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await send('/admin/login', 'POST', { password })
      onDone()
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="wrap login">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">สำหรับเจ้าของร้าน</p>
        <h1>หลังร้าน</h1>
        <label>
          <span>รหัสผ่าน</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        <p className="login-demo">
          ทดลองใช้: รหัสผ่าน <code>demo1234</code>
        </p>
      </form>
    </div>
  )
}

function BookingDialog(props: {
  b: AdminBooking | null
  onClose: () => void
  onStatus: (b: AdminBooking, s: Status) => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { b } = props
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (b && !d.open) d.showModal()
    if (!b && d.open) d.close()
  }, [b])
  const service = b ? serviceById(b.service_id) : undefined
  const actions: { s: Status; label: string; cls: string }[] = [
    { s: 'done', label: 'ตัดเสร็จแล้ว', cls: 'btn-primary' },
    { s: 'no_show', label: 'ลูกค้าไม่มา', cls: 'btn-ghost' },
    { s: 'cancelled', label: 'ยกเลิกคิว', cls: 'btn-ghost danger' },
    { s: 'booked', label: 'คืนสถานะเป็น “จองแล้ว”', cls: 'btn-link' },
  ]
  return (
    <dialog ref={ref} className="sheet" onClose={props.onClose} onClick={(e) => e.target === ref.current && props.onClose()}>
      {b && (
        <div className="sheet-in">
          <header>
            <span className={`pill pill-${b.status}`}>{STATUS_LABEL[b.status]}</span>
            <span className="mono">#{b.code}</span>
            <button className="icon-btn" onClick={props.onClose} aria-label="ปิด">
              ×
            </button>
          </header>
          <h2>{b.name}</h2>
          <dl className="sheet-rows">
            <div>
              <dt>เวลา</dt>
              <dd className="mono">{timeRange(b.start_min, b.end_min)}</dd>
            </div>
            <div>
              <dt>บริการ</dt>
              <dd>
                {service?.name} · {baht(b.price)}
              </dd>
            </div>
            <div>
              <dt>ช่าง</dt>
              <dd>{staffById(b.staff_id)?.name}</dd>
            </div>
            <div>
              <dt>โทร</dt>
              <dd>{/^\d+$/.test(b.phone) ? <a href={`tel:${b.phone}`}>{prettyPhone(b.phone)}</a> : b.phone}</dd>
            </div>
            {b.note && (
              <div>
                <dt>ฝากถึงช่าง</dt>
                <dd>{b.note}</dd>
              </div>
            )}
            <div>
              <dt>จองเมื่อ</dt>
              <dd className="muted">{new Date(b.created_at).toLocaleString('th-TH', { timeZone: SHOP.tz, dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
          </dl>
          <div className="sheet-actions">
            {actions
              .filter((a) => a.s !== b.status)
              .map((a) => (
                <button key={a.s} className={`btn ${a.cls}`} onClick={() => props.onStatus(b, a.s)}>
                  {a.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </dialog>
  )
}

function CloseDayForm({ date, onSave }: { date: string; onSave: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open)
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        ปิดรับจองวันนี้
      </button>
    )
  return (
    <form
      className="close-form"
      onSubmit={async (e) => {
        e.preventDefault()
        await onSave(reason)
        setOpen(false)
        setReason('')
      }}
    >
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`เหตุผล เช่น หยุดสงกรานต์ (${dayParts(date).day} ${dayParts(date).mon})`} maxLength={80} autoFocus />
      <button className="btn btn-danger btn-sm">ปิดวันนี้</button>
      <button type="button" className="btn btn-link btn-sm" onClick={() => setOpen(false)}>
        ไม่ปิด
      </button>
    </form>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [date, setDate] = useState(() => shopNow().date)
  const [data, setData] = useState<AdminDay | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [tick, setTick] = useState(0)

  const load = useCallback(
    async (d: string) => {
      try {
        const r = await api<AdminDay>(`/admin/day?date=${d}`)
        setData(r)
        setError('')
      } catch (err) {
        const e = err as ApiError
        if (e.status === 401) onLogout()
        else setError(e.message)
      }
    },
    [onLogout],
  )

  useEffect(() => {
    let live = true
    api<AdminDay>(`/admin/day?date=${date}`)
      .then((r) => live && (setData(r), setError('')))
      .catch((e: ApiError) => live && (e.status === 401 ? onLogout() : setError(e.message)))
    return () => {
      live = false
    }
  }, [date, tick, onLogout])

  // new online bookings show up without a manual refresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const bookings = data?.date === date ? data.bookings : []
  const placed = bookings.filter((b) => b.status !== 'cancelled')
  const cancelled = bookings.filter((b) => b.status === 'cancelled')
  const open = bookings.find((b) => b.id === openId) ?? null
  const isToday = data?.now.date === date
  const nowMin = data?.now.min ?? 0

  const stats = {
    total: placed.length,
    waiting: placed.filter((b) => b.status === 'booked').length,
    done: placed.filter((b) => b.status === 'done').length,
    noShow: placed.filter((b) => b.status === 'no_show').length,
    revenue: placed.filter((b) => b.status === 'done').reduce((s, b) => s + b.price, 0),
    expected: placed.filter((b) => b.status !== 'no_show').reduce((s, b) => s + b.price, 0),
  }
  const next = isToday ? placed.find((b) => b.status === 'booked' && b.end_min > nowMin) : undefined

  async function setStatus(b: AdminBooking, s: Status) {
    try {
      await send(`/admin/bookings/${b.id}`, 'PATCH', { status: s })
      setToast(`${b.name}: ${STATUS_LABEL[s]}`)
      setOpenId(null)
      await load(date)
    } catch (err) {
      setToast((err as ApiError).message)
    }
  }

  async function closeDay(reason: string) {
    await send(`/admin/closed/${date}`, 'PUT', { reason })
    setToast('ปิดรับจองวันนี้แล้ว — ลูกค้าจะจองวันนี้ไม่ได้')
    await load(date)
  }

  async function reopenDay() {
    await send(`/admin/closed/${date}`, 'DELETE')
    setToast('เปิดรับจองแล้ว')
    await load(date)
  }

  async function resetDemo() {
    const r = await send<{ seeded: number }>('/admin/reset-demo', 'POST')
    setToast(`ล้างข้อมูลและใส่คิวตัวอย่าง ${r.seeded} คิว`)
    setDate(shopNow().date)
    await load(shopNow().date)
  }

  async function logout() {
    await send('/admin/logout', 'POST').catch(() => {})
    onLogout()
  }

  const shopClosedWeekday = SHOP.closedWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())

  return (
    <div className="admin wrap-wide">
      <div className="admin-bar">
        <div>
          <p className="eyebrow">หลังร้าน · ตารางคิว</p>
          <h1>{thaiLong(date)}</h1>
        </div>
        <div className="admin-tools">
          <div className="seg">
            <button onClick={() => setDate(addDays(date, -1))} aria-label="วันก่อนหน้า">
              ‹
            </button>
            <button onClick={() => setDate(shopNow().date)} disabled={isToday}>
              วันนี้
            </button>
            <button onClick={() => setDate(addDays(date, 1))} aria-label="วันถัดไป">
              ›
            </button>
          </div>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="เลือกวันที่" />
          <button className="btn btn-link btn-sm" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="week" role="tablist" aria-label="สัปดาห์นี้">
        {(data?.week ?? []).map((w) => {
          const p = dayParts(w.date)
          return (
            <button key={w.date} role="tab" aria-selected={w.date === date} className={`week-day ${w.closed ? 'is-closed' : ''}`} onClick={() => setDate(w.date)}>
              <span>{p.wd}</span>
              <b>{p.day}</b>
              <small>{w.closed ? 'ปิด' : `${w.count} คิว`}</small>
            </button>
          )
        })}
      </div>

      <div className="stats">
        <div>
          <span>คิวทั้งหมด</span>
          <b>{stats.total}</b>
        </div>
        <div>
          <span>รอให้บริการ</span>
          <b>{stats.waiting}</b>
        </div>
        <div>
          <span>เสร็จแล้ว / ไม่มา</span>
          <b>
            {stats.done} <small>/ {stats.noShow}</small>
          </b>
        </div>
        <div>
          <span>รายได้ (คาดการณ์)</span>
          <b>
            {baht(stats.revenue)} <small>/ {baht(stats.expected)}</small>
          </b>
        </div>
        {next && (
          <div className="stats-next">
            <span>คิวถัดไป</span>
            <button className="link-btn" onClick={() => setOpenId(next.id)}>
              {fmtMin(next.start_min)} {next.name} · {staffById(next.staff_id)?.name}
            </button>
          </div>
        )}
      </div>

      <div className="admin-row">
        {data?.date === date && data.closed ? (
          <p className="closed-banner">
            ปิดรับจองวันนี้{data.reason ? ` — ${data.reason}` : ''}
            <button className="btn btn-ghost btn-sm" onClick={reopenDay}>
              เปิดรับจอง
            </button>
          </p>
        ) : shopClosedWeekday ? (
          <p className="closed-banner">วันพุธ ร้านหยุดประจำสัปดาห์</p>
        ) : (
          <CloseDayForm key={date} date={date} onSave={closeDay} />
        )}
        <span className="legend">
          <i className="lg-booked" /> จองแล้ว <i className="lg-done" /> เสร็จ <i className="lg-no_show" /> ไม่มา
        </span>
        <button className="btn btn-link btn-sm" onClick={resetDemo}>
          รีเซ็ตข้อมูลตัวอย่าง
        </button>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="board" style={{ '--row': `${ROW}px`, '--cols': STAFF.length } as CSSProperties}>
        <div className="board-head">
          <span />
          {STAFF.map((s) => (
            <span key={s.id} className="board-staff">
              <i style={{ '--h': s.hue } as CSSProperties} />
              {s.name}
              {!staffWorks(s, date) && <small>หยุด</small>}
            </span>
          ))}
        </div>
        <div className="board-body" style={{ height: ((SHOP.close - SHOP.open) / 30) * ROW }}>
          <div className="board-times" aria-hidden="true">
            {HOURS.map((h) => (
              <span key={h} style={{ top: ((h - SHOP.open) / 30) * ROW }}>
                {fmtMin(h)}
              </span>
            ))}
          </div>
          {STAFF.map((s) => (
            <div key={s.id} className={`board-col ${staffWorks(s, date) ? '' : 'is-off'}`}>
              {placed
                .filter((b) => b.staff_id === s.id)
                .map((b) => (
                  <button
                    key={b.id}
                    className={`appt appt-${b.status} ${isToday && b.status === 'booked' && b.start_min <= nowMin && b.end_min > nowMin ? 'is-now' : ''}`}
                    style={{ top: ((b.start_min - SHOP.open) / 30) * ROW + 2, height: ((b.end_min - b.start_min) / 30) * ROW - 4 }}
                    onClick={() => setOpenId(b.id)}
                  >
                    <b>
                      {fmtMin(b.start_min)} {b.name}
                    </b>
                    <span>{serviceById(b.service_id)?.name}</span>
                  </button>
                ))}
            </div>
          ))}
          {isToday && nowMin > SHOP.open && nowMin < SHOP.close && (
            <div className="now-line" style={{ top: ((nowMin - SHOP.open) / 30) * ROW }}>
              <span>{fmtMin(nowMin)}</span>
            </div>
          )}
        </div>
      </div>

      {cancelled.length > 0 && (
        <details className="cancelled">
          <summary>ยกเลิกแล้ว {cancelled.length} คิว</summary>
          <ul>
            {cancelled.map((b) => (
              <li key={b.id}>
                <button className="link-btn" onClick={() => setOpenId(b.id)}>
                  {fmtMin(b.start_min)} · {b.name} · {serviceById(b.service_id)?.name} · {staffById(b.staff_id)?.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <BookingDialog b={open} onClose={() => setOpenId(null)} onStatus={setStatus} />
      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}
    </div>
  )
}

export default function Admin() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')
  useEffect(() => {
    api<{ in: boolean }>('/admin/session')
      .then((r) => setState(r.in ? 'in' : 'out'))
      .catch(() => setState('out'))
  }, [])
  const onLogout = useCallback(() => setState('out'), [])
  if (state === 'checking') return <p className="wrap muted pad">กำลังโหลด…</p>
  if (state === 'out') return <Login onDone={() => setState('in')} />
  return <Dashboard onLogout={onLogout} />
}
