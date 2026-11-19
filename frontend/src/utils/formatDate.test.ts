import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMonthDay } from './formatDate'

describe('Korea-time formatters', () => {
  const instant = '2026-10-13T15:00:00Z' // 2026-10-14 00:00 in Seoul

  it('formats date-only displays using the Seoul calendar date', () => {
    expect(formatDate(instant)).toContain('14')
    expect(formatMonthDay(instant)).toBe('10.14')
  })

  it('formats timestamps using Seoul time, independent of the browser timezone', () => {
    expect(formatDateTime(instant, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })).toBe('00:00')
  })

  it('keeps invalid values visible instead of rendering "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(formatMonthDay('not-a-date')).toBe('')
  })
})
