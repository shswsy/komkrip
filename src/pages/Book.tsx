import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { SERVICES, SHOP, STAFF, fmtMin, isThaiMobile, phoneDigits, serviceById, staffById, type Slot } from '../../shared/shop'
import { ApiError, api, send, toTicket, type CalendarDay, type RawBooking, type SlotsResponse, type TicketData } from '../api'
import { Link, Pole } from '../router'
import Ticket from '../components/Ticket'
import { baht, dayParts, downloadIcs, thaiMedium } from '../format'
import { readLocal, writeLocal } from '../storage'

function Step(props: { n: number; title: string; hint?: string; locked?: boolean; id: string; children: ReactNode }) {
  return (
    <section className={`step ${props.locked ? 'is-locked' : ''}`} id={props.id} aria-labelledby={`${props.id}-h`}>
      <h2 id={`${props.id}-h`}>
        <span className="step-n">{props.n}</span>
        {props.title}
        {props.hint && <small>{props.hint}</small>}
      </h2>
      {props.children}
    </section>
  )
}

function Avatar({ id }: { id: string }) {
  const s = staffById(id)
  if (!s)
    return (
      <span className="avatar avatar-any" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
        </svg>
      </span>
    )
  return (
    <span className="avatar" style={{ '--h': s.hue } as CSSProperties} aria-hidden="true">
      {s.name.replace('ช่าง', '').replace(/^[เแโใไ]/, '').slice(0, 1)}
    </span>
  )
}

function dayStatus(d: CalendarDay): string {
  if (d.closed) return d.reason ? 'ปิด' : 'หยุด'
  if (d.off) return 'ช่างหยุด'
  if (d.free === 0) return 'เต็ม'
  return `ว่าง ${d.free}`
}

const PERIODS: { label: string; test: (s: Slot) => boolean }[] = [
  { label: 'ช่วงเช้า', test: (s) => s.min < 12 * 60 },
  { label: 'ช่วงบ่าย', test: (s) => s.min >= 12 * 60 && s.min < 17 * 60 },
  { label: 'ช่วงเย็น', test: (s) => s.min >= 17 * 60 },
]

export default function Book() {
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState('any')
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)
  const [name, setName] = useState(() => readLocal('kk:name'))
  const [phone, setPhone] = useState(() => readLocal('kk:phone'))
  const [note, setNote] = useState('')
  const [days, setDays] = useState<CalendarDay[] | null>(null)
  const [slots, setSlots] = useState<SlotsResponse | null>(null)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<TicketData | null>(null)

  const service = serviceId ? serviceById(serviceId) : undefined

  // 14-day availability strip
  useEffect(() => {
    if (!serviceId) return
    let live = true
    api<{ days: CalendarDay[] }>(`/calendar?service=${serviceId}&staff=${staffId}`)
      .then((r) => {
        if (!live) return
        setDays(r.days)
        setDate((cur) => (cur && r.days.some((d) => d.date === cur && d.free > 0) ? cur : (r.days.find((d) => d.free > 0)?.date ?? null)))
      })
      .catch((e: ApiError) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [serviceId, staffId, reload])

  // start times for the chosen day
  useEffect(() => {
    if (!serviceId || !date) return
    let live = true
    api<SlotsResponse>(`/slots?date=${date}&service=${serviceId}&staff=${staffId}`)
      .then((r) => {
        if (!live) return
        setSlots(r)
        setTime((cur) => (cur !== null && r.slots.some((s) => s.min === cur && s.free.length > 0) ? cur : null))
      })
      .catch((e: ApiError) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [serviceId, staffId, date, reload])

  const phoneOk = isThaiMobile(phone)
  const ready = !!service && !!date && time !== null && name.trim().length >= 2 && phoneOk
  const nextTarget = !service ? 'step-service' : !date || time === null ? 'step-time' : 'step-contact'

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || sending) return
    setSending(true)
    setError('')
    try {
      const r = await send<{ code: string; service: string; staff: string; date: string; start: number; end: number; name: string; price: number }>(
        '/bookings',
        'POST',
        { service: serviceId, staff: staffId, date, time: fmtMin(time), name, phone, note },
      )
      const ticket = toTicket({ ...r, service_id: r.service, staff_id: r.staff, start_min: r.start, end_min: r.end, status: 'booked' } as RawBooking)
      writeLocal('kk:name', name.trim())
      writeLocal('kk:phone', phoneDigits(phone))
      writeLocal('kk:last', JSON.stringify({ code: r.code, phone: phoneDigits(phone) }))
      setDone(ticket)
      window.scrollTo({ top: 0 })
    } catch (err) {
      const e = err as ApiError
      setError(e.message)
      if (e.status === 409) {
        setTime(null)
        setReload((n) => n + 1)
      }
    } finally {
      setSending(false)
    }
  }

  function again() {
    setDone(null)
    setTime(null)
    setNote('')
    setReload((n) => n + 1)
  }

  if (done) {
    return (
      <div className="done wrap">
        <div className="done-copy">
          <p className="eyebrow">จองสำเร็จ</p>
          <h1>แล้วเจอกันที่ร้านครับ</h1>
          <p>
            เก็บ<b>รหัสคิว</b>ไว้ ใช้เช็กหรือยกเลิกคิวได้เองที่เมนู “คิวของฉัน” · แคปหน้าจอบัตรนี้ไว้ก็ได้
          </p>
          <div className="done-actions">
            <button className="btn btn-primary" onClick={() => downloadIcs(done)}>
              บันทึกลงปฏิทิน
            </button>
            <Link to="/my" className="btn btn-ghost">
              ดู / ยกเลิกคิว
            </Link>
            <button className="btn btn-link" onClick={again}>
              จองอีกคิว
            </button>
          </div>
        </div>
        <div className="printer">
          <span className="printer-slot" aria-hidden="true" />
          <Ticket t={done} fresh />
        </div>
      </div>
    )
  }

  const day = days?.find((d) => d.date === date)

  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div>
            <p className="eyebrow">ร้านตัดผมชาย · {SHOP.area}</p>
            <h1>
              จองคิวก่อน
              <br />
              <em>ไม่ต้องนั่งรอ</em>
            </h1>
            <p className="hero-sub">เลือกบริการ เลือกช่าง เลือกเวลาที่ว่าง แล้วรับบัตรคิวทันที — ใช้เวลาไม่ถึงนาที</p>
            <ul className="hero-facts">
              <li>
                <b>10:00–20:00</b> เปิดทุกวัน
              </li>
              <li>
                <b>หยุดวันพุธ</b> ตามธรรมเนียมช่างตัดผม
              </li>
              <li>
                <b>{SHOP.daysAhead} วัน</b> จองล่วงหน้าได้
              </li>
            </ul>
          </div>
          <Pole className="pole-lg" />
        </div>
      </section>

      <form id="book-form" className="wrap book" onSubmit={submit} noValidate>
        <div className="steps">
          <Step n={1} id="step-service" title="เลือกบริการ">
            <div className="services">
              {SERVICES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="svc"
                  aria-pressed={serviceId === s.id}
                  onClick={() => {
                    setServiceId(s.id)
                    setError('')
                    if (!serviceId) setTimeout(() => jump('step-staff'), 60)
                  }}
                >
                  <span className="svc-name">{s.name}</span>
                  <span className="svc-desc">{s.desc}</span>
                  <span className="svc-meta">
                    <span>{s.duration} นาที</span>
                    <b>{baht(s.price)}</b>
                  </span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={2} id="step-staff" title="เลือกช่าง" hint="หรือให้ร้านจัดช่างที่ว่างให้">
            <div className="staff">
              {[{ id: 'any', name: 'ช่างคนไหนก็ได้', role: 'ได้เวลาที่ว่างมากที่สุด' }, ...STAFF].map((s) => (
                <button type="button" key={s.id} className="barber" aria-pressed={staffId === s.id} onClick={() => setStaffId(s.id)}>
                  <Avatar id={s.id} />
                  <span>
                    <b>{s.name}</b>
                    <small>{s.role}</small>
                  </span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={3} id="step-time" title="เลือกวันและเวลา" locked={!service} hint={service ? `ใช้เวลา ${service.duration} นาที` : 'เลือกบริการก่อน'}>
            {service && (
              <>
                <div className="days" role="listbox" aria-label="เลือกวัน">
                  {(days ?? []).map((d, i) => {
                    const p = dayParts(d.date)
                    return (
                      <button
                        type="button"
                        role="option"
                        key={d.date}
                        className={`day ${d.closed ? 'is-closed' : ''}`}
                        aria-selected={date === d.date}
                        disabled={d.free === 0}
                        onClick={() => setDate(d.date)}
                      >
                        <span className="day-wd">{i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : p.wd}</span>
                        <span className="day-n">{p.day}</span>
                        <span className="day-mon">{p.mon}</span>
                        <span className="day-free">{dayStatus(d)}</span>
                      </button>
                    )
                  })}
                  {!days && <p className="muted">กำลังโหลด…</p>}
                </div>

                {date && slots?.date === date && (
                  <div className="slots">
                    {slots.slots.length === 0 && (
                      <p className="empty">{slots.closed ? `ร้านปิดวันนี้${slots.reason ? ` — ${slots.reason}` : ''}` : 'วันนี้ไม่มีเวลาว่างแล้ว ลองวันอื่นนะครับ'}</p>
                    )}
                    {PERIODS.map((p) => {
                      const list = slots.slots.filter(p.test)
                      if (list.length === 0) return null
                      return (
                        <div className="period" key={p.label}>
                          <h3>{p.label}</h3>
                          <div className="slot-grid">
                            {list.map((s) => (
                              <button
                                type="button"
                                key={s.min}
                                className="slot"
                                aria-pressed={time === s.min}
                                disabled={s.free.length === 0}
                                onClick={() => {
                                  setTime(s.min)
                                  setError('')
                                }}
                                aria-label={s.free.length === 0 ? `${s.time} เต็ม` : `${s.time} ว่าง`}
                              >
                                {s.time}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {day && day.free > 0 && time === null && <p className="muted small">ปุ่มที่ขีดฆ่า = มีคนจองแล้ว</p>}
              </>
            )}
          </Step>

          <Step n={4} id="step-contact" title="ข้อมูลติดต่อ" locked={time === null} hint="ร้านจะโทรหาเฉพาะกรณีจำเป็น">
            <div className="fields">
              <label>
                <span>ชื่อเล่น / ชื่อ</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" placeholder="เช่น คุณเอ" required />
              </label>
              <label>
                <span>เบอร์มือถือ</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08x-xxx-xxxx"
                  aria-invalid={phone.length >= 10 && !phoneOk}
                  required
                />
                {phone.length >= 10 && !phoneOk && <em className="field-err">เบอร์มือถือ 10 หลัก ขึ้นต้น 06 / 08 / 09</em>}
              </label>
              <label className="wide">
                <span>
                  ฝากถึงช่าง <small>(ไม่บังคับ)</small>
                </span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="เช่น อยากได้ทรงเดิม / มากัน 2 คน" />
              </label>
            </div>
          </Step>
        </div>

        <aside className="summary" aria-label="สรุปการจอง">
          <div className="summary-card">
            <p className="summary-title">ใบจองของคุณ</p>
            <dl>
              <div>
                <dt>บริการ</dt>
                <dd>{service ? service.name : '—'}</dd>
              </div>
              <div>
                <dt>ช่าง</dt>
                <dd>{staffId === 'any' ? 'ร้านจัดให้' : staffById(staffId)?.name}</dd>
              </div>
              <div>
                <dt>วัน</dt>
                <dd>{date ? thaiMedium(date) : '—'}</dd>
              </div>
              <div>
                <dt>เวลา</dt>
                <dd className="mono">{time !== null && service ? `${fmtMin(time)}–${fmtMin(time + service.duration)}` : '—'}</dd>
              </div>
            </dl>
            <p className="summary-total">
              <span>ราคา</span>
              <b>{service ? baht(service.price) : '฿0'}</b>
            </p>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={!ready || sending}>
              {sending ? 'กำลังจอง…' : 'ยืนยันการจอง'}
            </button>
            <p className="muted small center">ไม่ต้องมัดจำ · ชำระที่ร้าน</p>
          </div>
        </aside>

        <div className="mbar">
          <div className="mbar-info">
            <b>{service ? service.name : 'ยังไม่ได้เลือกบริการ'}</b>
            <span>
              {date ? thaiMedium(date) : ''}
              {time !== null ? ` · ${fmtMin(time)} น.` : ''}
              {service ? ` · ${baht(service.price)}` : ''}
            </span>
            {error && <em role="alert">{error}</em>}
          </div>
          {ready ? (
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'กำลังจอง…' : 'ยืนยันจอง'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => jump(nextTarget)}>
              ถัดไป
            </button>
          )}
        </div>
      </form>
    </>
  )
}
