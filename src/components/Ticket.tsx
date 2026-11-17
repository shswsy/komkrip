import { SHOP, STATUS_LABEL, serviceById, staffById } from '../../shared/shop'
import type { TicketData } from '../api'
import { baht, thaiLong, timeRange } from '../format'

/** decorative barcode derived from the booking code */
function Barcode({ code }: { code: string }) {
  const bars: number[] = []
  for (const ch of `*${code}*`) {
    const n = ch.charCodeAt(0)
    for (let i = 0; i < 5; i++) bars.push(((n >> i) & 1) + 1 + ((n + i) % 2))
  }
  let x = 0
  const rects = bars.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={36} /> : null
    x += w
    return r
  })
  return (
    <svg className="barcode" viewBox={`0 0 ${x} 36`} preserveAspectRatio="none" aria-hidden="true">
      {rects}
    </svg>
  )
}

export default function Ticket({ t, fresh = false }: { t: TicketData; fresh?: boolean }) {
  const service = serviceById(t.serviceId)
  const staff = staffById(t.staffId)
  return (
    <article className={`ticket ${fresh ? 'is-fresh' : ''} status-${t.status}`} aria-label={`บัตรคิว ${t.code}`}>
      <header className="ticket-head">
        <span>บัตรคิว · QUEUE TICKET</span>
        <span>{SHOP.nameEn.toUpperCase()}</span>
      </header>
      <div className="ticket-body">
        <p className="ticket-label">รหัสคิว</p>
        <p className="ticket-code">{t.code}</p>
        <dl className="ticket-rows">
          <div>
            <dt>ชื่อ</dt>
            <dd>{t.name}</dd>
          </div>
          <div>
            <dt>บริการ</dt>
            <dd>{service?.name}</dd>
          </div>
          <div>
            <dt>ช่าง</dt>
            <dd>{staff?.name}</dd>
          </div>
          <div>
            <dt>วัน</dt>
            <dd>{thaiLong(t.date)}</dd>
          </div>
          <div className="ticket-time">
            <dt>เวลา</dt>
            <dd>{timeRange(t.start, t.end)} น.</dd>
          </div>
          <div>
            <dt>ราคา</dt>
            <dd>{baht(t.price)} · ชำระที่ร้าน</dd>
          </div>
        </dl>
        {t.status !== 'booked' && <p className={`stamp stamp-${t.status}`}>{STATUS_LABEL[t.status]}</p>}
      </div>
      <div className="ticket-perf" aria-hidden="true" />
      <footer className="ticket-stub">
        <Barcode code={t.code} />
        <p>แสดงบัตรนี้ที่ร้าน · มาก่อนเวลา 5 นาที</p>
      </footer>
    </article>
  )
}
