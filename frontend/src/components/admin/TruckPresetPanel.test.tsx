import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmProvider } from '../ConfirmDialog'
import TruckPresetPanel from './TruckPresetPanel'

/**
 * 관리자 적재함 프리셋 편집.
 *
 * 잘못된 입력을 서버까지 보내지 않는지, 새 프리셋의 정렬 순서가 맨 뒤로 가는지를 고정한다.
 */

const truckPresetApi = vi.hoisted(() => ({
  getTruckPresets: vi.fn(),
  createTruckPreset: vi.fn(),
  updateTruckPreset: vi.fn(),
  deleteTruckPreset: vi.fn(),
}))

vi.mock('../../api/truckPresets', () => truckPresetApi)

beforeEach(() => {
  truckPresetApi.getTruckPresets.mockResolvedValue([
    { id: 1, label: '1톤 카고', width: 2830, height: 1630, sortOrder: 0 },
  ])
  truckPresetApi.createTruckPreset.mockResolvedValue({ id: 2 })
})

afterEach(() => {
  cleanup()
})

function renderPanel(onError = vi.fn(), onNotice = vi.fn()) {
  render(
    <ConfirmProvider>
      <TruckPresetPanel onError={onError} onNotice={onNotice} />
    </ConfirmProvider>,
  )
  return { onError, onNotice }
}

describe('TruckPresetPanel', () => {
  it('저장된 프리셋을 목록으로 보여준다', async () => {
    renderPanel()

    expect(await screen.findByText('1톤 카고')).toBeTruthy()
  })

  it('이름이 비어 있으면 서버에 보내지 않고 안내한다', async () => {
    renderPanel()
    await screen.findByText('1톤 카고')

    fireEvent.click(screen.getByRole('button', { name: '프리셋 추가' }))

    expect(await screen.findByText('프리셋 이름을 입력해주세요.')).toBeTruthy()
    expect(truckPresetApi.createTruckPreset).not.toHaveBeenCalled()
  })

  it('새 프리셋은 정렬 순서를 비우면 맨 뒤에 붙는다', async () => {
    const { onNotice } = renderPanel()
    await screen.findByText('1톤 카고')

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: ' 3톤 카고 ' } })
    fireEvent.change(screen.getByLabelText('가로 (mm)'), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('세로 (mm)'), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: '프리셋 추가' }))

    await waitFor(() => {
      expect(truckPresetApi.createTruckPreset).toHaveBeenCalledWith({
        label: '3톤 카고',
        width: 3500,
        height: 1800,
        sortOrder: 1,
      })
    })
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('프리셋을 추가했습니다.'))
  })
})
