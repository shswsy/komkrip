import { SHOP, fmtMin, serviceById, staffById } from '../shared/shop'
import type { TicketData } from './api'

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const long = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const wdShort = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', weekday: 'short' })
const monShort = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', month: 'short' })
const medium = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

export const thaiLong = (iso: string) => long.format(utc(iso))
export const thaiMedium = (iso: string) => medium.format(utc(iso))
export const dayParts = (iso: string) => ({
  wd: wdShort.format(utc(iso)),
  day: utc(iso).getUTCDate(),
  mon: monShort.format(utc(iso)),
})

export const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`
export const timeRange = (start: number, end: number) => `${fmtMin(start)}–${fmtMin(end)}`

export function prettyPhone(p: string): string {
  return /^\d{10}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p
}

function icsStamp(iso: string, min: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  // shop time is UTC+7
  return new Date(Date.UTC(y, m - 1, d, 0, min) - 7 * 3600_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const icsText = (s: string) => s.replace(/[\\,;]/g, (c) => '\\' + c)

export function downloadIcs(t: TicketData) {
  const service = serviceById(t.serviceId)?.name ?? ''
  const staff = staffById(t.staffId)?.name ?? ''
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Komkrip Barber//Booking//TH',
    'BEGIN:VEVENT',
    `UID:${t.code}@komkrip`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${icsStamp(t.date, t.start)}`,
    `DTEND:${icsStamp(t.date, t.end)}`,
    `SUMMARY:${icsText(`${service} · ${SHOP.name}`)}`,
    `LOCATION:${icsText(`${SHOP.name} ${SHOP.area}`)}`,
    `DESCRIPTION:${icsText(`รหัสคิว ${t.code} · ${staff} · โทร ${SHOP.phone}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:อีก 1 ชั่วโมงถึงคิวตัดผม',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `komkrip-${t.code}.ics` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
