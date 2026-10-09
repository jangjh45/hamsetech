import { describe, expect, it } from 'vitest'
import type { OvertimeDefaults } from '../api/overtimeRecords'
import { defaultTimesFor, durationOf } from './overtime'

// 이 계산은 서버 OvertimeRecordService.resolveTotalMinutes의 클라이언트 미러다.
// 서버 쪽 테스트(work/OvertimeRecordServiceTest)와 같은 규칙이어야 미리보기
// 값과 저장값이 일치한다. 서버 상수를 바꾸면 여기도 같이 바꿔야 한다.
//
//   LUNCH_BREAK_MINUTES            = 60
//   LUNCH_DEDUCTION_THRESHOLD_MIN  = 6 * 60
//   DINNER_BREAK_START             = 17:00
//   DINNER_BREAK_END               = 17:30

describe('durationOf — 기본 계산', () => {
  it('겹치지 않는 시간은 그대로 분으로 준다', () => {
    expect(durationOf('OVERTIME', '18:00', '19:30')).toBe(90)
  })

  it('시작과 종료가 같으면 0이다', () => {
    expect(durationOf('OVERTIME', '18:00', '18:00')).toBe(0)
  })

  it('자정을 넘긴 근무는 다음 날까지 센다', () => {
    expect(durationOf('OVERTIME', '23:00', '01:00')).toBe(120)
  })

  it('시간이 비면 null이다', () => {
    expect(durationOf('OVERTIME', '', '19:00')).toBeNull()
    expect(durationOf('OVERTIME', '18:00', '')).toBeNull()
    expect(durationOf('OVERTIME', '', '')).toBeNull()
  })

  it('형식이 틀리면 null이다', () => {
    expect(durationOf('OVERTIME', 'aa:bb', '19:00')).toBeNull()
    expect(durationOf('OVERTIME', '18:00', 'cc:dd')).toBeNull()
  })

  it('결과는 음수가 되지 않는다', () => {
    // 휴게 차감이 경과 시간을 넘겨도 0으로 떨어진다.
    expect(durationOf('SPECIAL', '16:30', '17:30')).toBeGreaterThanOrEqual(0)
  })
})

describe('durationOf — 점심 휴게 (특근만)', () => {
  it('특근은 6시간 이상이면 60분을 뺀다', () => {
    // 09:00~18:00 = 540분, 점심 60분 차감, 저녁 17:00~17:30 겹침 30분
    // 540 - 60 - 30 = 450
    expect(durationOf('SPECIAL', '09:00', '18:00')).toBe(450)
  })

  it('특근도 정확히 6시간이면 뺀다 (경계 포함)', () => {
    // 09:00~15:00 = 360분 → 300분. 저녁 구간과 겹치지 않는다.
    expect(durationOf('SPECIAL', '09:00', '15:00')).toBe(300)
  })

  it('특근이라도 6시간 미만이면 점심을 빼지 않는다', () => {
    // 09:00~14:59 = 359분 < 360분
    expect(durationOf('SPECIAL', '09:00', '14:59')).toBe(359)
  })

  it('잔업은 점심을 빼지 않는다', () => {
    // 같은 구간이라도 잔업이면 540분 그대로에서 저녁만 뺀다.
    expect(durationOf('OVERTIME', '09:00', '18:00')).toBe(510)
  })
})

describe('durationOf — 저녁 휴게 (구분과 무관)', () => {
  it('17:00~17:30을 정확히 덮으면 30분을 뺀다', () => {
    expect(durationOf('OVERTIME', '17:00', '17:30')).toBe(0)
    // 저녁 구간의 앞 15분만 겹친다. 남은 15분은 근무로 센다.
    expect(durationOf('OVERTIME', '16:45', '17:15')).toBe(15)
  })

  it('저녁 구간과 겹친 만큼만 뺀다', () => {
    // 16:50~17:10 = 20분, 겹침 10분 → 10분
    expect(durationOf('OVERTIME', '16:50', '17:10')).toBe(10)
  })

  it('저녁 구간 밖이면 아무것도 빼지 않는다', () => {
    expect(durationOf('OVERTIME', '18:00', '19:00')).toBe(60)
    expect(durationOf('OVERTIME', '16:00', '16:30')).toBe(30)
  })

  it('특근이면 점심과 저녁을 둘 다 뺀다', () => {
    // 11:00~17:30 = 390분. 특근은 6시간 이상이라 점심 60분을 뺀다.
    // 390 - 60(점심) - 30(저녁) = 300분
    expect(durationOf('SPECIAL', '11:00', '17:30')).toBe(300)
  })

  it('자정을 넘긴 근무는 다음 날 저녁 구간과도 겹칠 수 있다', () => {
    // 입력이 '시:분'뿐이라 날짜가 없다. 자정을 넘는 근무는 종료 시각이 시작보다
    // 작을 때뿐이다. 20:00 → 익일 18:00: gross = 1320분.
    // 1/1 저녁(17:00~17:30)은 이미 지났으니 겹치지 않고, 1/2 저녁과 30분 겹친다.
    // 잔업: 1320 - 30 = 1290
    expect(durationOf('OVERTIME', '20:00', '18:00')).toBe(1290)
  })

  it('특근이 자정을 넘기면 점심도 뺀다', () => {
    // 20:00 → 익일 18:00 = 1320분.
    // 특근: 1320 - 60(점심) - 30(1/2 저녁) = 1230
    expect(durationOf('SPECIAL', '20:00', '18:00')).toBe(1230)
  })

  it('종료가 시작보다 빠르면 자정을 넘긴 것으로 본다', () => {
    // 23:00 → 익일 01:00 = 120분. 저녁 구간과는 겹치지 않는다.
    expect(durationOf('OVERTIME', '23:00', '01:00')).toBe(120)
    // 22:00 → 익일 06:00 = 480분. 저녁 구간과는 겹치지 않는다.
    expect(durationOf('OVERTIME', '22:00', '06:00')).toBe(480)
  })
})

describe('durationOf — 서버 미러 규칙', () => {
  // 미러는 서버와 어긋나면 조용히 틀린다. 아래 케이스는 서버 테스트와 같은
  // 입력을 쓴다. 서버 상수를 바꾸면 여기서 함께 실패해야 한다.
  it('서버 resolveTotalMinutes와 같은 결과를 낸다', () => {
    const cases: Array<[ 'OVERTIME' | 'SPECIAL', string, string, number ]> = [
      ['OVERTIME', '09:00', '18:00', 510],
      ['SPECIAL', '09:00', '18:00', 450],
      ['OVERTIME', '17:00', '17:30', 0],
      ['SPECIAL', '09:00', '14:59', 359],
      ['SPECIAL', '09:00', '15:00', 300],
      ['OVERTIME', '23:00', '01:00', 120],
    ]

    for (const [type, start, end, expected] of cases) {
      expect(durationOf(type, start, end), `${type} ${start}~${end}`).toBe(expected)
    }
  })
})

describe('defaultTimesFor', () => {
  const defaults: OvertimeDefaults = {
    overtimeStart: '19:00',
    overtimeEnd: '22:00',
    specialStart: '09:00',
    specialEnd: '18:00',
    payrollStartDay: 1,
  }

  it('구분에 맞는 기본 시간을 준다', () => {
    expect(defaultTimesFor('OVERTIME', defaults)).toEqual(['19:00', '22:00'])
    expect(defaultTimesFor('SPECIAL', defaults)).toEqual(['09:00', '18:00'])
  })

  it('설정을 아직 못 읽었으면 빈 값을 준다', () => {
    expect(defaultTimesFor('OVERTIME', null)).toEqual(['', ''])
    expect(defaultTimesFor('SPECIAL', null)).toEqual(['', ''])
  })

  it('기본 시간에 자정을 넘는 종료 시각도 표현한다', () => {
    const overnight: OvertimeDefaults = {
      overtimeStart: '22:00',
      overtimeEnd: '06:00',
      specialStart: '09:00',
      specialEnd: '18:00',
      payrollStartDay: 1,
    }
    expect(defaultTimesFor('OVERTIME', overnight)).toEqual(['22:00', '06:00'])
  })
})
