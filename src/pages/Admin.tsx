import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { SHOP, STAFF, STATUS_LABEL, addDays, fmtMin, serviceById, shopNow, staffById, staffWorks, type Status } from '../../shared/shop'
import { ApiError, api, send, type AdminBooking, type AdminDay } from '../api'
import Icon, { type IconName } from '../components/Icon'
import { baht, dayParts, prettyPhone, thaiLong, timeRange } from '../format'
import { Link, Pole } from '../router'
import Avatar from '../components/Avatar'

const ROW = 48 // px per 30 minutes
const HOURS = Array.from({ length: (SHOP.close - SHOP.open) / 60 }, (_, i) => SHOP.open + i * 60)

function Brand() {
  return (
    <Link to="/" className="brand">
      <Pole className="pole-sm" />
      <span>
        <b>คมกริบ</b>
        <small>BARBER · CHIANG MAI</small>
      </span>
    </Link>
  )
}

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
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <span className="tag">สำหรับเจ้าของร้าน</span>
        <h1>เข้าสู่หลังร้าน</h1>
        <p className="muted">ดูตารางคิวของช่างทุกคน อัปเดตสถานะ และปิดรับจองรายวัน</p>
        <label>
          <span>รหัสผ่าน</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          <Icon name="lock" /> {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        <p className="login-demo">
          ทดลองใช้: รหัสผ่าน <code>demo1234</code>
        </p>
        <Link to="/" className="login-back">
          <Icon name="back" size={16} /> กลับหน้าจองคิว
        </Link>
      </form>
    </div>
  )
}

function Chip({ s }: { s: Status }) {
  return <span className={`chip chip-${s}`}>{STATUS_LABEL[s]}</span>
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
    <dialog ref={ref} className="sheet" aria-labelledby="sheet-name" onClose={props.onClose} onClick={(e) => e.target === ref.current && props.onClose()}>
      {b && (
        <div className="sheet-in">
          <header>
            <Chip s={b.status} />
            <span className="code">#{b.code}</span>
            <button className="icon-btn" onClick={props.onClose} aria-label="ปิด">
              <Icon name="x" />
            </button>
          </header>
          <h2 id="sheet-name">{b.name}</h2>
          <p className="sheet-time code">{timeRange(b.start_min, b.end_min)}</p>
          <dl className="sheet-rows">
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
      <button className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>
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
      <input aria-label="เหตุผลที่ปิดรับจอง" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`เหตุผล เช่น หยุดสงกรานต์ (${dayParts(date).day} ${dayParts(date).mon})`} maxLength={80} autoFocus />
      <div>
        <button className="btn btn-danger btn-sm">ปิดวันนี้</button>
        <button type="button" className="btn btn-link btn-sm" onClick={() => setOpen(false)}>
          ไม่ปิด
        </button>
      </div>
    </form>
  )
}

function Kpi({ icon, label, value, sub, tone = '' }: { icon: IconName; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <span className="kpi-ico">
        <Icon name={icon} size={22} />
      </span>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [date, setDate] = useState(() => shopNow().date)
  const [data, setData] = useState<AdminDay | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [tick, setTick] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)

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
  const isNow = (b: AdminBooking) => isToday && b.status === 'booked' && b.start_min <= nowMin && b.end_min > nowMin

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
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    setConfirmReset(false)
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
  const working = STAFF.filter((s) => staffWorks(s, date))

  return (
    <div className="adm">
      <aside className="adm-side">
        <Brand />
        <nav className="adm-nav" aria-label="เมนูหลังร้าน">
          <span className="adm-nav-h">หลังร้าน</span>
          <a href="/admin" aria-current="page">
            <Icon name="grid" /> ตารางคิว
          </a>
          <span className="adm-nav-h">หน้าร้าน</span>
          <Link to="/">
            <Icon name="store" /> หน้าจองคิว
          </Link>
          <Link to="/my">
            <Icon name="search" /> เช็กคิวลูกค้า
          </Link>
        </nav>
        <div className="adm-side-foot">
          <div className="adm-side-card">
            <b>ข้อมูลตัวอย่าง</b>
            <span>ล้างและใส่คิวใหม่ทุกคืน 03:00</span>
            <button className={`btn btn-sm ${confirmReset ? 'btn-danger' : 'btn-accent'}`} onClick={resetDemo}>
              <Icon name="refresh" size={16} /> {confirmReset ? 'กดอีกครั้งเพื่อล้างทั้งหมด' : 'รีเซ็ตตอนนี้'}
            </button>
            {confirmReset && (
              <button className="btn-link adm-cancel" onClick={() => setConfirmReset(false)}>
                ไม่ล้าง
              </button>
            )}
          </div>
          <button className="adm-logout" onClick={logout}>
            <Icon name="logout" /> ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <div>
            <p className="adm-crumb">หลังร้าน / ตารางคิว</p>
            <h1>
              {isToday ? 'คิววันนี้' : 'ตารางคิว'} <span>{thaiLong(date)}</span>
            </h1>
          </div>
          <div className="adm-tools">
            <div className="seg">
              <button onClick={() => setDate(addDays(date, -1))} aria-label="วันก่อนหน้า">
                <Icon name="back" size={18} />
              </button>
              <button onClick={() => setDate(shopNow().date)} disabled={isToday}>
                วันนี้
              </button>
              <button onClick={() => setDate(addDays(date, 1))} aria-label="วันถัดไป">
                <Icon name="arrow" size={18} />
              </button>
            </div>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="เลือกวันที่" />
          </div>
        </header>

        <div className="week" role="group" aria-label="สัปดาห์นี้">
          {(data?.week ?? []).map((w) => {
            const p = dayParts(w.date)
            return (
              <button key={w.date} aria-pressed={w.date === date} className={`week-day ${w.closed ? 'is-closed' : ''}`} onClick={() => setDate(w.date)}>
                <span>{p.wd}</span>
                <b>{p.day}</b>
                <small>{w.closed ? 'ปิด' : `${w.count} คิว`}</small>
              </button>
            )
          })}
        </div>

        <div className="kpis">
          <Kpi icon="ticket" label="คิวทั้งหมด" value={stats.total} sub={`ช่างเข้างาน ${working.length}/${STAFF.length} คน`} tone="kpi-dark" />
          <Kpi icon="hourglass" label="รอให้บริการ" value={stats.waiting} sub={isToday && next ? `ถัดไป ${fmtMin(next.start_min)}` : 'ยังไม่ถึงเวลา'} tone="kpi-accent" />
          <Kpi icon="check" label="เสร็จแล้ว / ไม่มา" value={`${stats.done} / ${stats.noShow}`} sub="อัปเดตจากการกดสถานะ" />
          <Kpi icon="money" label="รายได้จริง" value={baht(stats.revenue)} sub={`คาดการณ์ทั้งวัน ${baht(stats.expected)}`} />
        </div>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <div className="adm-grid">
          <section className="card board-card" aria-label="ตารางช่าง">
            <header className="card-head">
              <h2>ตารางช่าง</h2>
              <span className="legend">
                <i className="lg-booked" /> จองแล้ว <i className="lg-done" /> เสร็จ <i className="lg-no_show" /> ไม่มา
              </span>
            </header>
            <div className="board" style={{ '--row': `${ROW}px`, '--cols': STAFF.length } as CSSProperties}>
              <div className="board-head">
                <span />
                {STAFF.map((s) => (
                  <span key={s.id} className="board-staff">
                    <Avatar id={s.id} size="sm" />
                    <span>
                      {s.name}
                      <small>{staffWorks(s, date) ? `${placed.filter((b) => b.staff_id === s.id).length} คิว` : 'หยุด'}</small>
                    </span>
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
                          className={`appt appt-${b.status} ${b.end_min - b.start_min <= 30 ? 'appt-short' : ''} ${isNow(b) ? 'is-now' : ''}`}
                          style={{ top: ((b.start_min - SHOP.open) / 30) * ROW + 2, height: ((b.end_min - b.start_min) / 30) * ROW - 4 }}
                          onClick={() => setOpenId(b.id)}
                        >
                          <b>
                            <span className="code">{fmtMin(b.start_min)}</span> {b.name}
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
          </section>

          <div className="adm-rail">
            {next && (
              <button className="next-card" onClick={() => setOpenId(next.id)}>
                <span className="next-label">{isNow(next) ? 'กำลังให้บริการ' : 'คิวถัดไป'}</span>
                <span className="next-time code">{fmtMin(next.start_min)}</span>
                <b>{next.name}</b>
                <span>
                  {serviceById(next.service_id)?.name} · {staffById(next.staff_id)?.name}
                </span>
                <span className="next-go">
                  ดูรายละเอียด <Icon name="arrow" size={16} />
                </span>
              </button>
            )}

            <section className="card agenda" aria-label="รายการคิว">
              <header className="card-head">
                <h2>รายการคิว</h2>
                <span className="muted small">{placed.length} คิว</span>
              </header>
              {placed.length === 0 ? (
                <p className="empty">{shopClosedWeekday || data?.closed ? 'ร้านปิดวันนี้' : 'ยังไม่มีคิวในวันนี้'}</p>
              ) : (
                <ul>
                  {placed.map((b) => (
                    <li key={b.id}>
                      <button className={`agenda-row ${isNow(b) ? 'is-now' : ''}`} onClick={() => setOpenId(b.id)}>
                        <span className="agenda-time code">{fmtMin(b.start_min)}</span>
                        <span className="agenda-who">
                          <b>{b.name}</b>
                          <small>
                            {serviceById(b.service_id)?.name} · {staffById(b.staff_id)?.name}
                          </small>
                        </span>
                        <Chip s={b.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
            </section>

            <section className="card day-card" aria-label="การรับจองวันนี้">
              <header className="card-head">
                <h2>การรับจอง</h2>
                {data?.date === date && (data.closed || shopClosedWeekday ? <span className="chip chip-cancelled">ปิด</span> : <span className="chip chip-done">เปิดรับ</span>)}
              </header>
              {data?.date === date && data.closed ? (
                <div className="closed-banner">
                  <p>ปิดรับจองวันนี้{data.reason ? ` — ${data.reason}` : ''}</p>
                  <button className="btn btn-ghost btn-sm" onClick={reopenDay}>
                    เปิดรับจอง
                  </button>
                </div>
              ) : shopClosedWeekday ? (
                <p className="muted">วันพุธ ร้านหยุดประจำสัปดาห์</p>
              ) : (
                <>
                  <p className="muted small">ปิดวันพิเศษ เช่น หยุดสงกรานต์ ลูกค้าจะจองวันนั้นไม่ได้ทันที</p>
                  <CloseDayForm key={date} date={date} onSave={closeDay} />
                </>
              )}
            </section>
          </div>
        </div>
      </div>

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
