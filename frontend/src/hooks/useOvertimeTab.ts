import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listAllOvertimeRecords,
  approveOvertimeRecord,
  rejectOvertimeRecord,
  deleteOvertimeRecord,
  getOvertimeSummary,
  getOvertimeDefaults,
  updateOvertimeDefaults,
  downloadOvertimeExcel,
  type OvertimeRecord,
  type OvertimeSummary,
  type OvertimeDefaults,
} from '../api/overtimeRecords'
import { payrollCycle } from '../utils/formatDate'
import { useConfirm } from '../components/ConfirmDialog'

/**
 * 관리자 화면의 '잔업특근' 탭.
 *
 * 탭 여섯 개 중 상태가 가장 많다. 이 탭만 따로 둬도 상위 화면은 250줄 남짓으로
 * 줄고, "필터를 왜 여기서 바꾸는지"를 이 파일 한 곳에서 볼 수 있게 된다.
 *
 * 로딩은 세 갈래다. 원래 코드 그대로다.
 *   - 탭을 열면 목록·집계·기본값
 *   - 필터가 바뀌면 목록(첫 페이지로)
 *   - 월이 바뀌면 집계
 *
 * 기본값을 읽을 때 엑셀 내보내기 기간을 급여 주기에 맞춰 채운다. 이 연결이 사라지면
 * 내보내기 기간이 빈 상태로 떠서 관리자가 날짜를 직접 넣어야 한다.
 *
 * 오류는 상위 배너로 보낸다. 배너가 화면 전체 하나뿐이라, 여기서 따로 들고 있으면
 * 어느 탭에서 났는지 알기 어렵다.
 */
export function useOvertimeTab(active: boolean, opts: { onError: (m: string) => void }) {
  const { confirm } = useConfirm()
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([])
  const [overtimeLoading, setOvertimeLoading] = useState(false)
  const [overtimeSummary, setOvertimeSummary] = useState<OvertimeSummary[]>([])
  const [overtimeFilters, setOvertimeFilters] = useState({ username: '', type: '', status: '' })
  const [overtimePagination, setOvertimePagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    size: 20,
  })
  const [overtimeMonth, setOvertimeMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7),
  )
  // 반려 사유를 받는 행. 한 행만 펼쳐 두고 나머지는 접는다.
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [overtimeDefaults, setOvertimeDefaults] = useState<OvertimeDefaults | null>(null)
  const [defaultsSaving, setDefaultsSaving] = useState(false)
  const [defaultsMsg, setDefaultsMsg] = useState('')
  // 엑셀 내보내기 기간. 급여 주기 설정으로 채워지지만 관리자가 자유롭게 고칠 수 있다.
  const [exportRange, setExportRange] = useState({ from: '', to: '' })
  const [overtimeExporting, setOvertimeExporting] = useState(false)

  // 목록 크기는 ref로 읽는다. 상태 의존성에 넣으면 loadRecords가 매번 새로 만들어져
  // 필터 효과와 겹쳐 요청이 두 번 나간다. 원래 loadOvertimeRecords는 클로저로 읽었다.
  const sizeRef = useRef(overtimePagination.size)
  sizeRef.current = overtimePagination.size

  const loadRecords = useCallback(
    async (page = 0) => {
      try {
        setOvertimeLoading(true)
        const result = await listAllOvertimeRecords({
          username: overtimeFilters.username || undefined,
          type: (overtimeFilters.type || undefined) as any,
          status: (overtimeFilters.status || undefined) as any,
          page,
          size: sizeRef.current,
        })
        setOvertimeRecords(result.content)
        setOvertimePagination((prev) => ({
          ...prev,
          currentPage: result.number ?? 0,
          totalPages: result.totalPages ?? 0,
          totalElements: result.totalElements ?? 0,
          size: result.size ?? prev.size,
        }))
      } catch (e: any) {
        opts.onError(e.message || '잔업/특근 기록 로드 실패')
      } finally {
        setOvertimeLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overtimeFilters],
  )

  const loadSummary = useCallback(async () => {
    try {
      setOvertimeSummary(await getOvertimeSummary(overtimeMonth))
    } catch (e: any) {
      opts.onError(e.message || '월별 집계 로드 실패')
    }
  }, [overtimeMonth])

  const loadDefaults = useCallback(async () => {
    try {
      const d = await getOvertimeDefaults()
      setOvertimeDefaults(d)
      setExportRange(payrollCycle(d.payrollStartDay))
    } catch (e: any) {
      opts.onError(e.message || '기본 근무시간 로드 실패')
    }
  }, [])

  // 탭을 열면 세 가지를 함께 읽는다. 하나라도 빠지면 탭이 반쯤 열린 상태가 된다.
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) {
      void loadRecords(0)
      void loadSummary()
      void loadDefaults()
    }
    wasActive.current = active
    // 탭을 떠나면 모달을 닫는다. 남겨두면 다시 들어올 때 폼이 열린 채로 뜬다.
    if (!active) setBulkOpen(false)
  }, [active, loadRecords, loadSummary, loadDefaults])

  useEffect(() => {
    if (active) void loadRecords(0) // 필터 변경 시 첫 페이지로
  }, [overtimeFilters, active, loadRecords])

  useEffect(() => {
    if (active) void loadSummary()
  }, [overtimeMonth, active, loadSummary])

  async function saveOvertimeDefaults() {
    if (!overtimeDefaults) return
    setDefaultsSaving(true)
    setDefaultsMsg('')
    try {
      const saved = await updateOvertimeDefaults(overtimeDefaults)
      setOvertimeDefaults(saved)
      // 주기가 바뀌면 내보내기 기간도 새 주기로 다시 맞춰준다.
      setExportRange(payrollCycle(saved.payrollStartDay))
      setDefaultsMsg('저장되었습니다.')
    } catch (e: any) {
      opts.onError(e.message || '기본 근무시간 저장 실패')
    } finally {
      setDefaultsSaving(false)
    }
  }

  async function exportOvertimeExcel() {
    if (!exportRange.from || !exportRange.to) return
    setOvertimeExporting(true)
    try {
      const blob = await downloadOvertimeExcel(exportRange.from, exportRange.to)
      // 개발 환경은 교차 출처라 서버가 준 Content-Disposition을 읽을 수 없어 파일명을
      // 여기서 만든다.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `잔업특근_${exportRange.from}_${exportRange.to}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      opts.onError(e.message || '엑셀 다운로드 실패')
    } finally {
      setOvertimeExporting(false)
    }
  }

  /** 승인·거절은 목록과 월별 집계를 동시에 바꾼다. */
  async function approveOvertime(id: number) {
    try {
      await approveOvertimeRecord(id)
      await Promise.all([loadRecords(overtimePagination.currentPage), loadSummary()])
    } catch (e: any) {
      opts.onError(e.message || '승인 실패')
    }
  }

  async function rejectOvertime(id: number) {
    try {
      await rejectOvertimeRecord(id, rejectReason)
      setRejectingId(null)
      setRejectReason('')
      await loadRecords(overtimePagination.currentPage)
    } catch (e: any) {
      opts.onError(e.message || '반려 실패')
    }
  }

  async function deleteOvertime(id: number) {
    const ok = await confirm({
      title: '잔업·특근 기록 삭제',
      message: '이 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteOvertimeRecord(id)
      // 마지막 페이지의 마지막 항목을 지우면 빈 페이지가 되므로, 필요 시 이전 페이지로 이동
      const isLastItemOnPage = overtimeRecords.length === 1 && overtimePagination.currentPage > 0
      const target = isLastItemOnPage ? overtimePagination.currentPage - 1 : overtimePagination.currentPage
      await Promise.all([loadRecords(target), loadSummary()])
    } catch (e: any) {
      opts.onError(e.message || '삭제 실패')
    }
  }

  return {
    overtimeRecords,
    setOvertimeRecords,
    overtimeLoading,
    setOvertimeLoading,
    overtimeSummary,
    setOvertimeSummary,
    overtimeFilters,
    setOvertimeFilters,
    overtimePagination,
    setOvertimePagination,
    overtimeMonth,
    setOvertimeMonth,
    rejectingId,
    setRejectingId,
    rejectReason,
    setRejectReason,
    bulkOpen,
    setBulkOpen,
    overtimeDefaults,
    setOvertimeDefaults,
    defaultsSaving,
    setDefaultsSaving,
    defaultsMsg,
    setDefaultsMsg,
    exportRange,
    setExportRange,
    overtimeExporting,
    setOvertimeExporting,
    loadRecords,
    loadSummary,
    loadDefaults,
    saveOvertimeDefaults,
    exportOvertimeExcel,
    approveOvertime,
    rejectOvertime,
    deleteOvertime,
  }
}
