import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { packIntoTrucks, type PackResult } from '../utils/packing'
import { TRUCK_PAGE, toInt, type ItemRow } from '../components/delivery/deliveryShared'

/**
 * 적재 계산과 그 표시 상태.
 *
 * 이 화면의 본체다. 입력(치수·마진·회전·순서·물품)이 바뀌면 300ms 뒤에 한 번만
 * 다시 계산한다 — 물품을 한 줄씩 넣을 때마다 계산이 도면 단위로 무거운 것을
 * 막는 것이 디바운스의 이유다.
 *
 * 계산은 동기라 한 틱 미뤄야 "계산 중" 표시가 실제로 그려진다. 미루지 않으면
 * setIsCalculating(true)와 결과 갱신이 같은 프레임에 들어가 표시가 깜빡인다.
 */
export function usePackingCalc(input: {
  binWStr: string
  binHStr: string
  marginStr: string
  allowRotate: boolean
  preserveOrder: boolean
  items: ItemRow[]
}) {
  const { binWStr, binHStr, marginStr, allowRotate, preserveOrder, items } = input

  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<PackResult | null>(null)
  // 접힌 트럭 목록과 화면에 몇 대까지 보여줄지
  const [collapsedTrucks, setCollapsedTrucks] = useState<Set<number>>(new Set())
  const [visibleTrucks, setVisibleTrucks] = useState<number>(TRUCK_PAGE)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const binW = toInt(binWStr)
  const binH = toInt(binHStr)
  const margin = toInt(marginStr)

  const debouncedCalculation = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const w = toInt(binWStr)
      const h = toInt(binHStr)
      const m = toInt(marginStr)
      const rects = items.map((i) => ({ id: i.id, w: toInt(i.w), h: toInt(i.h), qty: toInt(i.qty) }))

      if (rects.length === 0 || w <= 0 || h <= 0) {
        setResult(null)
        setIsCalculating(false)
        return
      }

      setIsCalculating(true)

      // 계산 자체는 동기라 한 틱 미뤄야 "계산 중" 표시가 실제로 그려진다
      setTimeout(() => {
        try {
          setResult(packIntoTrucks(rects, w, h, { allowRotate, margin: m, preserveOrder }))
        } catch (e: any) {
          console.error('Packing calculation error:', e)
          setResult(null)
        } finally {
          setIsCalculating(false)
        }
      }, 0)
    }, 300) // 300ms 디바운스
  }, [binWStr, binHStr, marginStr, items, allowRotate, preserveOrder])

  useEffect(() => {
    debouncedCalculation()
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [debouncedCalculation])

  // 결과가 새로 나오면 다시 앞에서부터 보여준다
  useEffect(() => {
    setVisibleTrucks(TRUCK_PAGE)
  }, [result])

  return {
    isCalculating,
    result,
    collapsedTrucks,
    setCollapsedTrucks,
    visibleTrucks,
    setVisibleTrucks,
    binW,
    binH,
    margin,
  }
}

/**
 * 화면 아래쪽 요약 숫자.
 *
 * 적재율은 "전체 트럭 면적 대비 물품이 차지한 면적"이다. 모양 때문에 실제로는 이보다
 * 적게 실리므로 하한치일 뿐이고, 화면에도 그렇게 적혀 있다.
 */
export function usePackingStats(input: {
  items: ItemRow[]
  result: PackResult | null
  binW: number
  binH: number
}) {
  const { items, result, binW, binH } = input
  return useMemo(() => {
    const totalQty = items.reduce((sum, i) => sum + toInt(i.qty), 0)
    const usedArea = result
      ? result.trucks.reduce((sum, t) => sum + t.reduce((s, it) => s + it.w * it.h, 0), 0)
      : 0
    const totalArea = result ? result.count * binW * binH : 0
    const binArea = binW * binH
    // 면적만 따진 하한. 실제로는 모양 때문에 이보다 적게 실린다.
    const idealCount = binArea > 0 && usedArea > 0 ? Math.ceil(usedArea / binArea) : 0
    return {
      truckCount: result?.count ?? 0,
      utilization: totalArea > 0 ? Math.round((usedArea / totalArea) * 100) : 0,
      kinds: items.length,
      totalQty,
      usedArea,
      totalArea,
      idealCount,
    }
  }, [result, items, binW, binH])
}