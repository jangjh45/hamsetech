import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import type { AdminLog } from '../components/admin/adminShared'
import type { LogFilters, Pagination } from './useChangeLogsTab'

/**
 * 관리자 화면의 '조회 이력' 탭이 들고 있는 상태와 로딩.
 *
 * 변경 이력 탭과 모양이 거의 같아(필터 다섯 개 + 페이지네이션 + 행 목록) 같은
 * 모양으로 다시 짰다. 로딩 조건과 크기 처리도 그쪽과 동일하다.
 *
 * 경로만 다르다 — /api/admin/logs/read 다. 조회 로그는 변경 로그와 달리
 * 별도 테이블에 쌓이고 보존기간이 지나면 새벽에 지워진다(AdminReadLogRetention).
 *
 * LogFilters에 action이 들어 있지만 이 탭은 쓰지 않는다. 조회는 동작 종류가 없어
 * 화면에 필터를 둘 이유가 없다. 타입을 공유하므로 값은 항상 빈 문자열이고, 로더가
 * 빈 값은 쿼리에서 빼므로 서버에도 영향이 없다.
 *
 * 오류는 여기서 조용히 넘긴다. 배너가 상위 한 곳에만 있으므로, 탭마다 따로 두면
 * 어디에 났는지 알기 어렵다.
 */
const EMPTY_FILTERS: LogFilters = {
  adminUsername: '',
  entityType: '',
  action: '',
  startDate: '',
  endDate: '',
}

const initialPagination: Pagination = { currentPage: 0, totalPages: 0, totalElements: 0, size: 20 }

export function useReadLogsTab(active: boolean) {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState<Pagination>(initialPagination)
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS)

  // 크기는 ref로 읽어 load의 정체성을 지킨다. 상태 의존성에 넣으면 페이지를 넘길 때
  //마다 필터 효과까지 겹쳐 요청이 두 번 나간다.
  const sizeRef = useRef(pagination.size)
  sizeRef.current = pagination.size

  const load = useCallback(async (page = 0, customSize?: number) => {
    try {
      setLoading(true)
      const pageSize = customSize !== undefined ? customSize : sizeRef.current
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value && value.trim() !== ''),
        ),
      })
      const result = await apiFetch(`/api/admin/logs/read?${params}`)
      setLogs(result.content || [])
      setPagination({
        currentPage: result.number || 0,
        totalPages: result.totalPages || 0,
        totalElements: result.totalElements || 0,
        size: result.size || 20,
      })
    } catch {
      // 오류 표시는 상위가 한다
    } finally {
      setLoading(false)
    }
  }, [filters])

  // 탭을 열면 첫 페이지로
  const wasActive = useRef(false)
  useEffect(() => {
    if (active && !wasActive.current) void load(0)
    wasActive.current = active
  }, [active, load])

  // 필터가 바뀌면 첫 페이지로
  useEffect(() => {
    if (active) void load(0)
  }, [filters, active, load])

  function patchFilter(patch: Partial<LogFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function changePageSize(size: number) {
    setPagination((prev) => ({ ...prev, size, currentPage: 0 }))
    sizeRef.current = size
    void load(0, size)
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
  }

  return { logs, loading, pagination, filters, load, patchFilter, changePageSize, resetFilters }
}