import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TempPasswordModal from './TempPasswordModal'

afterEach(cleanup)

describe('TempPasswordModal', () => {
  it('비밀번호를 한 번만 보여 준다', () => {
    render(<TempPasswordModal username="kim" password="Xk3!pQ" onClose={() => {}} />)
    expect(screen.getByText('Xk3!pQ')).toBeTruthy()
    expect(screen.getByText(/kim 계정의 비밀번호가 초기화되었습니다/)).toBeTruthy()
  })

  it('다시 볼 수 없다는 경고를 함께 보여 준다', () => {
    // 관리자가 이 창을 닫으면 값이 사라지고 다시 발급해야 한다. 그 사실을
    // 안내하지 않으면 본인에게 전달하기 전에 닫아 버리는 일이 생긴다.
    render(<TempPasswordModal username="kim" password="Xk3!pQ" onClose={() => {}} />)
    expect(screen.getByText(/지금만 볼 수 있습니다/)).toBeTruthy()
  })

  it('옮겨 적었다고 닫는다', () => {
    const onClose = vi.fn()
    render(<TempPasswordModal username="kim" password="Xk3!pQ" onClose={onClose} />)
    fireEvent.click(screen.getByText('옮겨 적었습니다'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('복사하면 복사됨이라고 말한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<TempPasswordModal username="kim" password="Xk3!pQ" onClose={() => {}} />)

    fireEvent.click(screen.getByText('복사'))
    expect(writeText).toHaveBeenCalledWith('Xk3!pQ')
    expect(await screen.findByText('복사됨')).toBeTruthy()
  })

  it('클립보드를 못 써도 값은 그대로 보여 준다', async () => {
    // 비 HTTPS 등 권한이 없을 때다. 이때 창을 닫아 버리면 임시 비밀번호를
    // 다시 발급해야 하는데, 안내 없이 조용히 실패하면 관리자가 이유를 모른다.
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    render(<TempPasswordModal username="kim" password="Xk3!pQ" onClose={() => {}} />)

    fireEvent.click(screen.getByText('복사'))
    expect(screen.getByText('Xk3!pQ')).toBeTruthy()
    expect(screen.queryByText('복사됨')).toBeNull()
  })
})