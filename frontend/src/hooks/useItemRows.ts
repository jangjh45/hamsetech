import { useRef, useState } from 'react'
import type { ItemRow } from '../components/delivery/deliveryShared'

/**
 * 적재 시뮬레이터의 물품 목록.
 *
 * 373줄짜리 잔업특근 탭을 세 번 못 건 뒤에 여기 came — 이 화면은 작아서 그냥
 * 옮겼다. 목록 편집과 드래그 정렬이 같은 items 하나를 두 가지 방식으로 만지므로
 * 한 묶음이어야 한다. 따로 떼면 두 훅이 같은 상태를 나눠 갖게 된다.
 *
 * 되돌리기는 행 하나만 기억한다. 스택을 두지 않은 것은 의도다 — 한 번 더 눌러서
 * 되돌릴 수 있는 게 보통 충분하고, 스택을 두면 "몇 개나 지웠는지"가 화면에 안 보인다.
 *
 * 새 행 id는 현재 최댓값 + 1이다. 지운 뒤에는 되돌리기로 되살릴 때 id가 재사용될 수
 * 있다. 그래서 nameMap이 아니라 id로 물품을 찾는다.
 */
export function useItemRows(initialItems: ItemRow[] = []) {
  const [items, setItems] = useState<ItemRow[]>(initialItems)
  // 방금 지운 행 (되돌리기용)
  const [lastRemoved, setLastRemoved] = useState<{ index: number; row: ItemRow } | null>(null)
  // 행을 추가·복제한 직후 그 행의 이름 칸으로 포커스를 옮기기 위한 표시
  const focusItemIdRef = useRef<number | null>(null)

  const nextItemId = () => (items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1)

  function addItem() {
    const id = nextItemId()
    focusItemIdRef.current = id
    setItems([...items, { id, name: '', w: '200', h: '200', qty: '1' }])
    setLastRemoved(null)
  }

  function duplicateItem(idx: number) {
    const src = items[idx]
    const id = nextItemId()
    focusItemIdRef.current = id
    const next = [...items]
    next.splice(idx + 1, 0, { ...src, id, name: src.name ? `${src.name} 사본` : '' })
    setItems(next)
    setLastRemoved(null)
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    setItems(next)
  }

  function removeItem(idx: number) {
    setLastRemoved({ index: idx, row: items[idx] })
    const next = [...items]
    next.splice(idx, 1)
    setItems(next)
  }

  function undoRemove() {
    if (!lastRemoved) return
    const next = [...items]
    next.splice(Math.min(lastRemoved.index, next.length), 0, lastRemoved.row)
    setItems(next)
    setLastRemoved(null)
  }

  /** 입력값을 전부 비운다. 치수 설정까지 같이 초기화한다. */
  function clearItems() {
    setItems([])
    setLastRemoved(null)
    focusItemIdRef.current = null
  }

  // ── 드래그 정렬 ────────────────────────────────────────────

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== idx) {
      setDragOverIndex(idx)
    }
  }

  function handleDrop(idx: number) {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const next = [...items]
    const [dragged] = next.splice(dragIndex, 1)
    next.splice(idx, 0, dragged)
    setItems(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return {
    items,
    setItems,
    lastRemoved,
    setLastRemoved,
    focusItemIdRef,
    addItem,
    duplicateItem,
    updateItem,
    removeItem,
    undoRemove,
    clearItems,
    dragIndex,
    setDragIndex,
    dragOverIndex,
    setDragOverIndex,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  }
}