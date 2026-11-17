import { describe, expect, it } from 'vitest'
import { addDays, computeSlots, expandStaff, fmtMin, isIsoDate, isThaiMobile, parseTime, shopNow, weekday } from './shop'

// 2026-11-17 is a Tuesday (ช่างมิว off), 2026-11-18 Wednesday (shop closed), 2026-11-19 Thursday
const THU = '2026-11-19'
const before = { date: '2026-11-16', min: 600 }

describe('time helpers', () => {
  it('formats and parses minutes', () => {
    expect(fmtMin(630)).toBe('10:30')
    expect(parseTime('09:05')).toBe(545)
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('9:00')).toBeNull()
  })
  it('validates dates and weekdays', () => {
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(weekday('2026-11-18')).toBe(3)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('converts UTC to Bangkok time', () => {
    // 2026-11-17 18:30 UTC = 2026-11-18 01:30 in Bangkok
    expect(shopNow(Date.UTC(2026, 10, 17, 18, 30))).toEqual({ date: '2026-11-18', min: 90 })
  })
  it('accepts Thai mobile numbers only', () => {
    expect(isThaiMobile('081-234-5678')).toBe(true)
    expect(isThaiMobile('0212345678')).toBe(false)
    expect(isThaiMobile('08123456')).toBe(false)
  })
})

describe('computeSlots', () => {
  const base = { date: THU, duration: 30, staffIds: ['ton'], busy: [], closed: false, now: before }

  it('lists every start that fits before closing', () => {
    const slots = computeSlots({ ...base, duration: 90 })
    expect(slots[0].time).toBe('10:00')
    expect(slots.at(-1)!.time).toBe('18:30') // 18:30 + 90 = 20:00
    expect(slots).toHaveLength(18)
  })

  it('blocks overlaps but allows back-to-back', () => {
    const busy = [{ staff_id: 'ton', start_min: 660, end_min: 720 }] // 11:00–12:00
    const slots = computeSlots({ ...base, duration: 60, busy })
    const at = (t: string) => slots.find((s) => s.time === t)!.free
    expect(at('10:00')).toEqual(['ton']) // ends exactly 11:00
    expect(at('10:30')).toEqual([]) // runs into 11:00
    expect(at('11:30')).toEqual([])
    expect(at('12:00')).toEqual(['ton'])
  })

  it('"any" keeps a slot open while one barber is free', () => {
    const busy = [{ staff_id: 'ton', start_min: 600, end_min: 630 }]
    const slots = computeSlots({ ...base, staffIds: expandStaff('any'), busy })
    expect(slots[0].free).toEqual(['beer', 'mew'])
  })

  it('returns nothing on shop holidays and closed dates', () => {
    expect(computeSlots({ ...base, date: '2026-11-18' })).toEqual([])
    expect(computeSlots({ ...base, closed: true })).toEqual([])
  })

  it("skips a barber's day off", () => {
    expect(computeSlots({ ...base, date: '2026-11-17', staffIds: ['mew'] })).toEqual([])
    expect(computeSlots({ ...base, date: '2026-11-17', staffIds: expandStaff('any') })[0].free).toEqual(['ton', 'beer'])
  })

  it('hides past starts today, honouring lead time', () => {
    const slots = computeSlots({ ...base, now: { date: THU, min: 14 * 60 + 10 } }) // 14:10
    expect(slots[0].time).toBe('15:00') // 14:30 < 14:40
  })

  it('rejects past dates and unknown staff', () => {
    expect(computeSlots({ ...base, now: { date: '2026-11-20', min: 0 } })).toEqual([])
    expect(expandStaff('nobody')).toEqual([])
  })
})
