import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SHOP, shopNow } from '../../shared/shop'
import { ApiError, send, toTicket, type RawBooking, type TicketData } from '../api'
import { Link } from '../router'
import Ticket from '../components/Ticket'
import { downloadIcs } from '../format'
import { readLocal } from '../storage'

function lastBooking(): { code: string; phone: string } {
  try {
    const v = JSON.parse(readLocal('kk:last') || '{}') as { code?: string; phone?: string }
    return { code: v.code ?? '', phone: v.phone ?? readLocal('kk:phone') }
  } catch {
    return { code: '', phone: readLocal('kk:phone') }
  }
}

export default function MyBooking() {
  const [{ code, phone }, setForm] = useState(lastBooking)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // true while the booking saved on this device is being fetched on arrival
  const [auto, setAuto] = useState(() => !!(code && phone))
  const started = useRef(false)
  const ticketBox = useRef<HTMLDivElement>(null)
  // polite announcement for lookup / cancel results (the ticket renders in another column)
  const [said, setSaid] = useState('')

  // a typed lookup or a cancel: bring the ticket into view (it sits below the form on phones) and focus it
  const reveal = () =>
    requestAnimationFrame(() => {
      const el = ticketBox.current
      if (!el) return
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
      el.focus({ preventScroll: true })
    })

  async function find(c: string, p: string, quiet = false) {
    setBusy(true)
    setError('')
    setConfirming(false)
    try {
      setTicket(toTicket(await send<RawBooking>('/bookings/lookup', 'POST', { code: c, phone: p })))
      setSaid(`พบคิว ${c}`)
      if (!quiet) reveal()
    } catch (err) {
      setTicket(null)
      // a stale saved booking (demo reset, another device) just leaves the form filled in, no red alert
      if (!quiet) setError((err as ApiError).message)
    } finally {
      setBusy(false)
      setAuto(false)
    }
  }

  // arriving from the booking confirmation, or coming back later: open the latest ticket straight away
  useEffect(() => {
    if (started.current || !auto) return
    started.current = true
    void find(code, phone, true)
    // run once on mount with the saved booking
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lookup(e: FormEvent) {
    e.preventDefault()
    void find(code, phone)
  }

  async function cancel() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      setTicket(toTicket(await send<RawBooking>('/bookings/cancel', 'POST', { code, phone })))
      setSaid(`ยกเลิกคิว ${code} แล้ว`)
      reveal()
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const now = shopNow()
  const upcoming =
    ticket?.status === 'booked' && (ticket.date > now.date || (ticket.date === now.date && ticket.start > now.min))

  return (
    <div className="wrap my">
      <div className="my-copy">
        <span className="tag">คิวของฉัน</span>
        <h1>เช็กหรือยกเลิกคิว</h1>
        <p className="my-lead">ใช้รหัสคิว 6 ตัวบนบัตรคิว กับเบอร์มือถือที่ใช้จอง ถ้าเปลี่ยนเวลา ให้ยกเลิกแล้วจองใหม่ได้เลย</p>
        <form className="lookup" onSubmit={lookup}>
          <label>
            <span>รหัสคิว</span>
            <input
              value={code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="เช่น K7F2QX"
              className="code"
              required
            />
          </label>
          <label>
            <span>เบอร์มือถือ</span>
            <input
              value={phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              inputMode="tel"
              placeholder="08x-xxx-xxxx"
              required
            />
          </label>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy && !ticket ? 'กำลังค้นหา…' : 'ค้นหาคิว'}
          </button>
        </form>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">
          ติดต่อร้านโดยตรง โทร {SHOP.phone} · <Link to="/">จองคิวใหม่</Link>
        </p>
      </div>

      <p className="sr-only" role="status">
        {said}
      </p>
      <div className={`my-ticket ${ticket ? 'has-ticket' : ''}`} ref={ticketBox} tabIndex={-1} aria-label={ticket ? `บัตรคิว ${ticket.code}` : undefined}>
        {ticket ? (
          <>
            <Ticket t={ticket} />
            {upcoming && (
              <div className="my-actions">
                <button className="btn btn-ghost" onClick={() => downloadIcs(ticket)}>
                  บันทึกลงปฏิทิน
                </button>
                <button className={`btn ${confirming ? 'btn-danger' : 'btn-ghost danger'}`} onClick={cancel} disabled={busy}>
                  {confirming ? 'กดอีกครั้งเพื่อยืนยันยกเลิก' : 'ยกเลิกคิวนี้'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={`ticket-ghost ${auto ? 'is-loading' : ''}`} aria-hidden={!auto} role={auto ? 'status' : undefined}>
            {auto ? (
              <>
                <span>กำลังเปิดคิวล่าสุดของคุณ…</span>
                <small>รหัส {code}</small>
              </>
            ) : (
              <>
                <span>บัตรคิวจะแสดงที่นี่</span>
                <small>กรอกรหัสคิวและเบอร์มือถือ แล้วกด “ค้นหาคิว”</small>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
