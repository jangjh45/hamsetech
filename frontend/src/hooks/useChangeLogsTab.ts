import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import type { AdminLog } from '../components/admin/adminShared'

/**
 * 관리자 화면의 '변경 이력' 탭이 들고 있는 상태와 로딩.
 *
 * 탭이 여섯 개인데 로더가 스무 개라, 전부 메인 컴포넌트에 펼쳐 놓으면 탭 하나를
 * 고칠 때 다른 탭까지 읽어야 했다. 탭마다 훅으로 모으는 중 이 탭이 첫 piled다.
 *
 * 로딩 조건은 원래 코드 그대로 세 갈래다.
 *   - 탭을 열면 첫 페이지로
 *   - 필터가 바뀌면 첫 페이지로
 *   - 페이지 크기를 바꾸면 그 크기로
 *
 * load가 최신 크기를 읽도록 ref를 쓴다. 크기를 상태 의존성에 넣으면 load의 정체성이
 * 매번 바뀌어, 페이지를 넘길 때마다 필터 효과까지 겹쳐 요청이 두 번 나간다.
 * 원래 코드는 loadLogs가 logPagination.size를 클로저로 읽었기 때문에 이 문제가 없었다.
 *
 * 오류는 여기서 조용히 넘긴다. 배너가 상위 한 곳에만 있으므로, 탭마다 따로 두면
 * 어디에 났는지 알기 어렵다.
 */
export interface LogFilters {
  adminUsername: string
  entityType: string
  action: string
  startDate: string
  endDate: string
}

const EMPTY_FILTERS: LogFilters = {
  adminUsername: '',
  entityType: '',
  action: '',
  startDate: '',
  endDate: '',
}

export interface Pagination {
  currentPage: number
  totalPages: number
  totalElements: number
  size: number
}

const initialPagination: Pagination = { currentPage: 0, totalPages: 0, totalElements: 0, size: 20 }

export function useChangeLogsTab(active: boolean) {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState<Pagination>(initialPagination)
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS)

  // load는 filters만 의존한다. 크기는 ref로 읽어 load의 정체성을 지킨다.
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
      const result = await apiFetch(`/api/admin/logs?${params}`)

      // 페이징 정보와 로그 데이터 분리
      if (result.content) {
        setLogs(result.content)
        setPagination({
          currentPage: result.number || 0,
          totalPages: result.totalPages || 0,
          totalElements: result.totalElements || 0,
          size: result.size || 20,
        })
      } else {
        // 페이징이 없는 경우 (하위 호환성)
        setLogs(result)
        setPagination({
          currentPage: 0,
          totalPages: 1,
          totalElements: result.length,
          size: 20,
        })
      }
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

  // 필터가 바뀌면 첫 페이지로. 사용자가 3페이지에 있다가 조건을 좁히면 3페이지가
  // 비어 보일 수 있기 때문이다.
  useEffect(() => {
    if (active) void load(0)
  }, [filters, active, load])

  /** 한 필터만 고친다. 전부 다시 쓰면 안 된다 — 날짜를 고치는데 관리자명이 지워진다. */
  function patchFilter(patch: Partial<LogFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  /** 페이지 크기를 바꾸면 그 크기로 첫 페이지부터 다시 부른다. */
  function changePageSize(size: number) {
    setPagination((prev) => ({ ...prev, size, currentPage: 0 }))
    sizeRef.current = size
    void load(0, size)
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
  }

  return {
    logs,
    loading,
    pagination,
    filters,
    load,
    patchFilter,
    changePageSize,
    resetFilters,
  }
}