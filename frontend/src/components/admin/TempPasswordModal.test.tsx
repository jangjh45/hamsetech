import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TempPasswordModal from './TempPasswordModal'

/**
 * 실제 발급되는 임시 비밀번호처럼 보이는 가짜 값. 문자열을 여기 한 곳에만 둔다.
 *
 * 의미가 분명해 보이는 값이 여러 테스트에 박혀 있으면 스캐너가 실제 값과
 * 구분하지 못한다. 여기서 고친다고 경고가 닫히는 건 아니지만, 값을 바꿀 때
 * 파일을 여럿 만지지 않게 하려는 것이다.
 */
const TEST_PASSWORD = 'Xk3!pQ'

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

afterEach(() => {
  cleanup()
  if (originalExecCommand) {
    Object.defineProperty(document, 'execCommand', originalExecCommand)
  } else {
    Reflect.deleteProperty(document, 'execCommand')
  }
})

describe('TempPasswordModal', () => {
  it('비밀번호를 한 번만 보여 준다', () => {
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)
    expect(screen.getByText(TEST_PASSWORD)).toBeTruthy()
    expect(screen.getByText(/kim 계정의 비밀번호가 초기화되었습니다/)).toBeTruthy()
  })

  it('다시 볼 수 없다는 경고를 함께 보여 준다', () => {
    // 관리자가 이 창을 닫으면 값이 사라지고 다시 발급해야 한다. 그 사실을
    // 안내하지 않으면 본인에게 전달하기 전에 닫아 버리는 일이 생긴다.
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)
    expect(screen.getByText(/지금만 볼 수 있습니다/)).toBeTruthy()
  })

  it('옮겨 적었다고 닫는다', () => {
    const onClose = vi.fn()
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={onClose} />)
    fireEvent.click(screen.getByText('옮겨 적었습니다'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('임시 비밀번호 발급 시 로그인 잠금도 해제됨을 안내한다', () => {
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)
    expect(screen.getByText(/로그인 잠금이 해제되었습니다/)).toBeTruthy()
  })

  it('복사하면 복사됨이라고 말한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)

    fireEvent.click(screen.getByText('복사'))
    expect(writeText).toHaveBeenCalledWith(TEST_PASSWORD)
    expect(await screen.findByText('복사됨')).toBeTruthy()
  })

  it('Clipboard API가 거부되면 레거시 복사를 시도한다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)

    fireEvent.click(screen.getByText('복사'))
    expect(await screen.findByText('복사됨')).toBeTruthy()
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('두 복사 방식이 모두 실패하면 직접 복사 안내를 보여 준다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    })
    render(<TempPasswordModal username="kim" password={TEST_PASSWORD} onClose={() => {}} />)

    fireEvent.click(screen.getByText('복사'))
    expect(screen.getByText(TEST_PASSWORD)).toBeTruthy()
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('직접 선택해 복사해 주세요')
  })
})
