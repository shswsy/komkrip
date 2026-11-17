import { useState, type FormEvent } from 'react'
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

  async function lookup(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setConfirming(false)
    try {
      setTicket(toTicket(await send<RawBooking>('/bookings/lookup', 'POST', { code, phone })))
    } catch (err) {
      setTicket(null)
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
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
        <p className="eyebrow">คิวของฉัน</p>
        <h1>เช็กหรือยกเลิกคิว</h1>
        <p>ใช้รหัสคิว 6 ตัวบนบัตรคิว กับเบอร์มือถือที่ใช้จอง ถ้าเปลี่ยนเวลา ให้ยกเลิกแล้วจองใหม่ได้เลย</p>
        <form className="lookup" onSubmit={lookup}>
          <label>
            <span>รหัสคิว</span>
            <input
              value={code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="เช่น K7F2QX"
              className="mono"
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
          <button className="btn btn-primary" disabled={busy}>
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

      <div className="my-ticket">
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
          <div className="ticket-ghost" aria-hidden="true">
            <span>บัตรคิวจะแสดงที่นี่</span>
          </div>
        )}
      </div>
    </div>
  )
}
