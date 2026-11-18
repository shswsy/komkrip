import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SERVICES, SHOP, STAFF, fmtMin, isThaiMobile, phoneDigits, serviceById, staffById, type Slot } from '../../shared/shop'
import { ApiError, api, send, toTicket, type CalendarDay, type RawBooking, type SlotsResponse, type TicketData } from '../api'
import { Link } from '../router'
import Avatar from '../components/Avatar'
import Icon, { type IconName } from '../components/Icon'
import Ticket from '../components/Ticket'
import { baht, dayParts, downloadIcs, thaiLong, thaiMedium } from '../format'
import { readLocal, writeLocal } from '../storage'

const STEPS = ['บริการ', 'ช่าง', 'วันเวลา', 'ข้อมูล', 'ยืนยัน'] as const
const STEP_TITLE = ['เลือกบริการ', 'เลือกช่าง', 'เลือกวันและเวลา', 'กรอกข้อมูลติดต่อ', 'ตรวจสอบและยืนยัน']

const SERVICE_ICON: Record<string, IconName> = {
  cut: 'scissors',
  cutwash: 'wash',
  beard: 'razor',
  combo: 'combo',
  color: 'color',
  kids: 'kids',
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

function Stepper({ step, maxStep, onGo }: { step: number; maxStep: number; onGo: (i: number) => void }) {
  return (
    <nav className="stepper" aria-label="ขั้นตอนการจอง">
      <ol>
        {STEPS.map((label, i) => {
          const state = i === step ? 'is-current' : i < step ? 'is-done' : i <= maxStep ? 'is-open' : ''
          return (
            <li key={label} className={state}>
              <button type="button" onClick={() => onGo(i)} disabled={i > maxStep} aria-current={i === step ? 'step' : undefined}>
                <span className="stepper-dot">{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
                <span className="stepper-label">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Panel({ step, children, aside }: { step: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel" aria-labelledby="panel-h">
      <header className="panel-head">
        <span className="tag">ขั้นที่ {step + 1}</span>
        <h2 id="panel-h" tabIndex={-1}>
          {STEP_TITLE[step]}
        </h2>
        {aside && <p className="panel-hint">{aside}</p>}
      </header>
      {children}
    </section>
  )
}

export default function Book() {
  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState('any')
  const [staffPicked, setStaffPicked] = useState(false)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<number | null>(null)
  const [name, setName] = useState(() => readLocal('kk:name'))
  const [phone, setPhone] = useState(() => readLocal('kk:phone'))
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [days, setDays] = useState<CalendarDay[] | null>(null)
  const [slots, setSlots] = useState<SlotsResponse | null>(null)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<TicketData | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const shownStep = useRef('0')

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

  // keep the step header in view when moving between steps
  useEffect(() => {
    const key = `${step}${done ? 'd' : ''}`
    if (shownStep.current === key) return
    shownStep.current = key
    const el = flowRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    if (top < 60 || top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById('panel-h')?.focus({ preventScroll: true })
  }, [step, done])

  const phoneOk = isThaiMobile(phone)
  const nameOk = name.trim().length >= 2
  const timeOk = !!date && time !== null
  const ready = !!service && timeOk && nameOk && phoneOk
  const canLeave = [!!service, true, timeOk, nameOk && phoneOk, ready]
  // furthest step reachable from the current choices
  const reachable = !service ? 0 : !staffPicked ? 1 : !timeOk ? 2 : !(nameOk && phoneOk) ? 3 : 4

  function go(i: number) {
    setError('')
    setStep(Math.max(0, Math.min(i, reachable)))
  }

  function next() {
    if (step === 3 && !(nameOk && phoneOk)) {
      setTouched(true)
      return
    }
    if (!canLeave[step]) return
    if (step === 1) setStaffPicked(true)
    setError('')
    setStep(step + 1)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (step < 4) {
      next()
      return
    }
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
        setStep(2)
      }
    } finally {
      setSending(false)
    }
  }

  function again() {
    setDone(null)
    setTime(null)
    setNote('')
    setStep(0)
    setReload((n) => n + 1)
  }

  if (done) {
    return (
      <div className="done wrap">
        <div className="done-copy">
          <span className="done-check" aria-hidden="true">
            <Icon name="check" size={40} />
          </span>
          <span className="tag">จองสำเร็จ</span>
          <h1>แล้วเจอกันที่ร้านครับ</h1>
          <p className="done-when">
            <b>{thaiLong(done.date)}</b>
            <br />
            เวลา <b className="code">{fmtMin(done.start)}</b> น. กับ{staffById(done.staffId)?.name}
          </p>
          <ul className="done-tips">
            <li>
              <Icon name="ticket" />
              <span>
                เก็บ<b>รหัสคิว {done.code}</b> ไว้ ใช้เช็กหรือยกเลิกได้เองที่เมนู “คิวของฉัน”
              </span>
            </li>
            <li>
              <Icon name="clock" />
              <span>มาก่อนเวลา 5 นาที · ชำระเงินที่ร้าน ไม่ต้องมัดจำ</span>
            </li>
            <li>
              <Icon name="phone" />
              <span>ติดต่อร้าน โทร {SHOP.phone}</span>
            </li>
          </ul>
          <div className="done-actions">
            <button className="btn btn-primary btn-lg" onClick={() => downloadIcs(done)}>
              <Icon name="calendar" /> บันทึกลงปฏิทิน
            </button>
            <Link to="/my" className="btn btn-ghost btn-lg">
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
  const staffLabel = staffId === 'any' ? 'ร้านจัดช่างที่ว่างให้' : staffById(staffId)?.name
  const nextLabel = ['ถัดไป: เลือกช่าง', 'ถัดไป: เลือกเวลา', 'ถัดไป: ข้อมูลติดต่อ', 'ตรวจสอบการจอง', 'ยืนยันการจอง'][step]
  const nextDisabled = step === 4 ? !ready || sending : step === 3 ? false : !canLeave[step]
  const nextHint = !service
    ? 'แตะเลือกบริการที่ต้องการ'
    : step === 2 && !timeOk
      ? 'แตะเลือกเวลาที่ว่าง'
      : step === 3 && !(nameOk && phoneOk)
        ? 'กรอกชื่อและเบอร์มือถือ'
        : ''

  const summaryRows: { k: string; v: ReactNode; to: number }[] = [
    { k: 'บริการ', v: service ? `${service.name} · ${service.duration} นาที` : '—', to: 0 },
    { k: 'ช่าง', v: service ? staffLabel : '—', to: 1 },
    { k: 'วัน', v: date && service ? thaiMedium(date) : '—', to: 2 },
    { k: 'เวลา', v: time !== null && service ? <span className="code">{`${fmtMin(time)}–${fmtMin(time + service.duration)}`}</span> : '—', to: 2 },
  ]

  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <span className="tag">ร้านตัดผมชาย · {SHOP.area}</span>
            <h1>
              จองคิวก่อน <mark>ไม่ต้องนั่งรอ</mark>
            </h1>
            <p className="hero-sub">เลือกบริการ เลือกช่าง เลือกเวลาที่ว่าง แล้วรับบัตรคิวทันที — ใช้เวลาไม่ถึงนาที</p>
          </div>
          <ul className="hero-facts">
            <li>
              <Icon name="clock" />
              <span>
                <b>10:00–20:00</b> เปิดทุกวัน
              </span>
            </li>
            <li>
              <Icon name="calendar" />
              <span>
                <b>หยุดวันพุธ</b> ตามธรรมเนียมช่าง
              </span>
            </li>
            <li>
              <Icon name="ticket" />
              <span>
                <b>{SHOP.daysAhead} วัน</b> จองล่วงหน้าได้
              </span>
            </li>
          </ul>
        </div>
      </section>

      <form id="book-form" className="wrap book" onSubmit={submit} noValidate>
        <div className="flow" ref={flowRef}>
          <Stepper step={step} maxStep={reachable} onGo={go} />

          {step === 0 && (
            <Panel step={0} aside="ราคารวมค่าบริการแล้ว ชำระที่ร้าน">
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
                      setStep(1)
                    }}
                  >
                    <span className="svc-ico">
                      <Icon name={SERVICE_ICON[s.id] ?? 'scissors'} size={24} />
                    </span>
                    <span className="svc-text">
                      <span className="svc-name">{s.name}</span>
                      <span className="svc-desc">{s.desc}</span>
                    </span>
                    <span className="svc-meta">
                      <b>{baht(s.price)}</b>
                      <span>{s.duration} นาที</span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {step === 1 && (
            <Panel step={1} aside="ไม่มีช่างประจำ? ให้ร้านจัดช่างที่ว่างให้ ได้เวลาให้เลือกมากที่สุด">
              <div className="staff">
                {[{ id: 'any', name: 'ช่างคนไหนก็ได้', role: 'ได้เวลาว่างให้เลือกมากที่สุด' }, ...STAFF].map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`barber ${s.id === 'any' ? 'barber-any' : ''}`}
                    aria-pressed={staffId === s.id}
                    onClick={() => {
                      setStaffId(s.id)
                      setStaffPicked(true)
                      setStep(2)
                    }}
                  >
                    <Avatar id={s.id} />
                    <span className="barber-text">
                      <b>{s.name}</b>
                      <small>{s.role}</small>
                    </span>
                    {s.id === 'any' && <span className="chip chip-accent">แนะนำ</span>}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {step === 2 && service && (
            <Panel step={2} aside={`${service.name} ใช้เวลา ${service.duration} นาที · ${staffLabel}`}>
              <h3 className="sub-h">วันที่</h3>
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
                      onClick={() => {
                        setDate(d.date)
                        setError('')
                      }}
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
                        <h3 className="sub-h">
                          {p.label} <small>ว่าง {list.filter((s) => s.free.length > 0).length} เวลา</small>
                        </h3>
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
              {day && day.free > 0 && <p className="muted small">ช่องที่ขีดฆ่า = มีคนจองแล้ว</p>}
            </Panel>
          )}

          {step === 3 && (
            <Panel step={3} aside="ร้านจะโทรหาเฉพาะกรณีจำเป็นเท่านั้น">
              <div className="fields">
                <label>
                  <span>ชื่อเล่น / ชื่อ</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    autoComplete="given-name"
                    placeholder="เช่น คุณเอ"
                    aria-invalid={touched && !nameOk}
                    required
                  />
                  {touched && !nameOk && <em className="field-err">กรอกชื่ออย่างน้อย 2 ตัวอักษร</em>}
                </label>
                <label>
                  <span>เบอร์มือถือ</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="08x-xxx-xxxx"
                    aria-invalid={(touched || phone.length >= 10) && !phoneOk}
                    required
                  />
                  {(touched || phone.length >= 10) && !phoneOk && <em className="field-err">เบอร์มือถือ 10 หลัก ขึ้นต้น 06 / 08 / 09</em>}
                </label>
                <label className="wide">
                  <span>
                    ฝากถึงช่าง <small>(ไม่บังคับ)</small>
                  </span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="เช่น อยากได้ทรงเดิม / มากัน 2 คน" />
                </label>
              </div>
            </Panel>
          )}

          {step === 4 && service && date && time !== null && (
            <Panel step={4} aside="ตรวจดูอีกครั้ง แก้ไขได้โดยแตะ “แก้ไข”">
              <div className="review">
                <div className="review-when">
                  <span className="review-date">{thaiLong(date)}</span>
                  <span className="review-time code">
                    {fmtMin(time)}–{fmtMin(time + service.duration)}
                  </span>
                  <button type="button" className="edit-btn on-dark" onClick={() => go(2)}>
                    แก้ไข
                  </button>
                </div>
                <dl className="review-rows">
                  <div>
                    <dt>บริการ</dt>
                    <dd>
                      {service.name} <small>{service.duration} นาที</small>
                    </dd>
                    <button type="button" className="edit-btn" onClick={() => go(0)}>
                      แก้ไข
                    </button>
                  </div>
                  <div>
                    <dt>ช่าง</dt>
                    <dd>{staffLabel}</dd>
                    <button type="button" className="edit-btn" onClick={() => go(1)}>
                      แก้ไข
                    </button>
                  </div>
                  <div>
                    <dt>ผู้จอง</dt>
                    <dd>
                      {name.trim()} <small className="code">{phone}</small>
                      {note && <small className="review-note">“{note}”</small>}
                    </dd>
                    <button type="button" className="edit-btn" onClick={() => go(3)}>
                      แก้ไข
                    </button>
                  </div>
                  <div className="review-total">
                    <dt>ราคา</dt>
                    <dd>{baht(service.price)}</dd>
                    <span>ชำระที่ร้าน</span>
                  </div>
                </dl>
              </div>
            </Panel>
          )}

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          <div className="flow-nav">
            {step > 0 && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => go(step - 1)}>
                <Icon name="back" /> ย้อนกลับ
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={nextDisabled}>
              {sending ? 'กำลังจอง…' : nextLabel} {step < 4 && <Icon name="arrow" />}
            </button>
            {nextHint && <span className="muted small">{nextHint}</span>}
          </div>
        </div>

        <aside className="summary" aria-label="สรุปการจอง">
          <div className="summary-card">
            <p className="summary-title">
              <Icon name="ticket" /> ใบจองของคุณ
            </p>
            <dl>
              {summaryRows.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
            </dl>
            <p className="summary-total">
              <span>ราคา</span>
              <b>{service ? baht(service.price) : '฿0'}</b>
            </p>
            <p className="summary-note">ไม่ต้องมัดจำ · ชำระที่ร้าน · ยกเลิกเองได้</p>
          </div>
          <div className="help-card">
            <b>อยากคุยกับร้านก่อน?</b>
            <a href={`tel:${SHOP.phone.replace(/-/g, '')}`} className="btn btn-ghost btn-block">
              <Icon name="phone" /> โทร {SHOP.phone}
            </a>
          </div>
        </aside>

        <div className="mbar">
          <div className="mbar-info">
            <b>{service ? `${baht(service.price)} · ${service.name}` : 'ยังไม่ได้เลือกบริการ'}</b>
            <span>
              {[date && timeOk ? thaiMedium(date) : '', time !== null ? `${fmtMin(time)} น.` : '', nextHint]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          {step > 0 && (
            <button type="button" className="btn btn-ghost mbar-back" onClick={() => go(step - 1)} aria-label="ย้อนกลับ">
              <Icon name="back" />
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={nextDisabled}>
            {sending ? 'กำลังจอง…' : step === 4 ? 'ยืนยันจอง' : 'ถัดไป'}
            {step < 4 && <Icon name="arrow" />}
          </button>
        </div>
      </form>
    </>
  )
}
