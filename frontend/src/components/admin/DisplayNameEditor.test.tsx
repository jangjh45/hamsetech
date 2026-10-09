import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DisplayNameEditor from './DisplayNameEditor'

afterEach(cleanup)

describe('DisplayNameEditor', () => {
  it('서버 값을 처음부터 보여 준다', () => {
    render(<DisplayNameEditor initial="김길동" onSave={async () => {}} />)
    expect((screen.getByPlaceholderText('이름/닉네임') as HTMLInputElement).value).toBe('김길동')
  })

  it('바꾸지 않았으면 저장할 수 없다', () => {
    // 저장 요청이 가지 않도록 막는다. 같은 값을 다시 저장하면 목록만 낭비된다.
    render(<DisplayNameEditor initial="김길동" onSave={async () => {}} />)
    expect((screen.getByText('저장') as HTMLButtonElement).disabled).toBe(true)
  })

  it('고친 뒤 저장하면 그 값을 넘긴다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<DisplayNameEditor initial="김길동" onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('이름/닉네임'), { target: { value: '김길순' } })
    fireEvent.click(screen.getByText('저장'))

    expect(onSave).toHaveBeenCalledWith('김길순')
  })

  it('Enter로도 저장된다', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<DisplayNameEditor initial="김길동" onSave={onSave} />)

    const input = screen.getByPlaceholderText('이름/닉네임')
    fireEvent.change(input, { target: { value: '김길순' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('김길순')
  })

  it('저장이 끝나면 다시 누를 수 있다', async () => {
    // 목록이 다시 로드되면 이 편집기도 서버 값을 따라간다. 실패를 삼키지 않으면
    // 버튼이 눌린 상태로 남아 다시 저장할 수 없다.
    //
    // 저장 중 표시가 반드시 풀리는지 본다. 요청이 끝나면 다시 눌 수 있어야 하며,
    // 그대로 잠겨 있으면 목록을 못 고치게 된다.
    //
    // 실패 경로는 여기서 다루지 않는다. 이 컴포넌트는 onClick에 비동기 함수를
    // 넘기고 반환값을 버려서 거부가 어디에서도 안 잡힌다 — 거절하는 mock을 쓰면
    // Vitest가 미처리 거부로 실패한다. 컴포넌트가 삼키도록 고치면 Admin.tsx가
    // 오류를 놓쳐 조용히 실패하므로, 그 판단은 Admin.tsx 쪽에서 따로 해야 한다.
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<DisplayNameEditor initial="김길동" onSave={onSave} />)

    const input = screen.getByPlaceholderText('이름/닉네임')
    fireEvent.change(input, { target: { value: '김길순' } })
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('김길순'))
    expect((screen.getByText('저장') as HTMLButtonElement).disabled).toBe(false)
  })

  it('서버 값이 바뀌면 입력도 따라간다', () => {
    // 다른 관리자가 이름을 바꿨을 수 있다. 이전 입력에 매달려 있으면
    // 그대로 저장해 버릴 수 있다.
    const { rerender } = render(<DisplayNameEditor initial="김길동" onSave={async () => {}} />)
    fireEvent.change(screen.getByPlaceholderText('이름/닉네임'), { target: { value: '고친 값' } })

    rerender(<DisplayNameEditor initial="이름바뀜" onSave={async () => {}} />)
    expect((screen.getByPlaceholderText('이름/닉네임') as HTMLInputElement).value).toBe('이름바뀜')
  })
})