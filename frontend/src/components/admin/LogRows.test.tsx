import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import LogRows from './LogRows'
import type { AdminLog } from './adminShared'

afterEach(cleanup)

function log(over: Partial<AdminLog> = {}): AdminLog {
  return {
    id: 1,
    timestamp: '2026-10-09 12:00:00',
    adminUsername: 'admin',
    action: 'UPDATE',
    entityType: 'NOTICE',
    entityId: 3,
    details: '제목을 바꿨다',
    ipAddress: '10.0.0.1',
    ...over,
  }
}

describe('LogRows', () => {
  it('불러오는 중에는 안내만 보여 준다', () => {
    render(<LogRows logs={[]} loading />)
    expect(screen.getByText('불러오는 중...')).toBeTruthy()
  })

  it('비어 있으면 빈 상태 문구를 보여 준다', () => {
    // 감사 로그가 없다는 것과 아직 안 읽은 것을 구분해야 운영자가 알아본다.
    render(<LogRows logs={[]} loading={false} />)
    expect(screen.getByText('로그가 없습니다.')).toBeTruthy()
  })

  it('관리자·작업·대상을 함께 보여 준다', () => {
    render(<LogRows logs={[log()]} loading={false} />)
    expect(screen.getByText('admin')).toBeTruthy()
    expect(screen.getByText('UPDATE')).toBeTruthy()
    expect(screen.getByText(/NOTICE \(ID: 3\)/)).toBeTruthy()
  })

  it('IP가 없으면 대시로 채운다', () => {
    // 프록시 설정이 틀리면 전부 비어 있다. 빈 칸으로 두면 "기록이 없다"와
    // 헷갈리므로 자리를 아는 값을 넣는다.
    render(<LogRows logs={[log({ ipAddress: null })]} loading={false} />)
    expect(screen.getByText('-')).toBeTruthy()
  })

  it('상세가 없으면 상세를 그리지 않는다', () => {
    const { container } = render(<LogRows logs={[log({ details: null })]} loading={false} />)
    expect(container.querySelector('.ad-log-text')).toBeNull()
  })

  it('id가 없으면 ID 표기를 덧붙이지 않는다', () => {
    // 엔티티가 만들어지기 전 로그라 대상 id가 비어 있을 수 있다.
    render(<LogRows logs={[log({ entityId: null })]} loading={false} />)
    expect(screen.getByText(/^NOTICE$/)).toBeTruthy()
  })

  it('여러 건을 모두 그린다', () => {
    const logs = [
      log({ id: 1, adminUsername: 'a' }),
      log({ id: 2, adminUsername: 'b' }),
    ]
    render(<LogRows logs={logs} loading={false} />)
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
  })
})