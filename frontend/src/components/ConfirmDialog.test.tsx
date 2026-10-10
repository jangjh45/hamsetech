import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { ConfirmProvider, useConfirm } from './ConfirmDialog'

afterEach(cleanup)

function Harness() {
  const { confirm, prompt } = useConfirm()
  const [result, setResult] = useState('')

  return (
    <div>
      <button
        onClick={() => void confirm({
          title: '기록 삭제',
          message: '되돌릴 수 없습니다.',
          confirmText: '삭제',
          variant: 'danger',
        }).then((value) => setResult(`confirm:${value}`))}
      >
        확인 열기
      </button>
      <button
        onClick={() => void prompt({
          title: '탈퇴 처리',
          inputLabel: '처리 사유',
          defaultValue: '기존 사유',
          confirmText: '처리',
          variant: 'danger',
        }).then((value) => setResult(`prompt:${value ?? '취소'}`))}
      >
        사유 입력 열기
      </button>
      <output>{result}</output>
    </div>
  )
}

function renderHarness() {
  return render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>,
  )
}

describe('ConfirmProvider', () => {
  it('확인 결과를 Promise로 돌려준다', async () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '확인 열기' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('되돌릴 수 없습니다.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('confirm:true')).toBeTruthy()
  })

  it('취소하면 false를 돌려준다', async () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '확인 열기' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }))

    expect(await screen.findByText('confirm:false')).toBeTruthy()
  })

  it('입력 모달의 값을 호출부에 돌려준다', async () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '사유 입력 열기' }))

    const dialog = screen.getByRole('alertdialog')
    const input = within(dialog).getByRole('textbox') as HTMLTextAreaElement
    expect(input.value).toBe('기존 사유')
    fireEvent.change(input, { target: { value: '요청에 따른 탈퇴' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '처리' }))

    expect(await screen.findByText('prompt:요청에 따른 탈퇴')).toBeTruthy()
  })

  it('사유 입력 모달을 취소하면 null을 돌려준다', async () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '사유 입력 열기' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }))

    expect(await screen.findByText('prompt:취소')).toBeTruthy()
  })
})
