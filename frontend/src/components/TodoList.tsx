import { useState, useEffect } from 'react'
import { listTodos, createTodo, updateTodo, deleteTodo, type Todo } from '../api/todos'

interface TodoListProps {
  selectedDate: string
  monthStart: string
  monthEnd: string
  /** 할 일 추가/토글/삭제 후 타이틀 밴드 갱신용 */
  onTodosChanged?: () => void
}

const PRIORITY_LABELS = ['낮음', '중간', '높음']
// 중요도 → 배지/세그먼트 톤 (색상 리터럴 대신 dashboard.css의 토큰 클래스를 쓴다)
const PRIORITY_TONES = ['', 'fl-tone-warn', 'fl-tone-danger']

type Filter = 'all' | 'remaining'

export default function TodoList({
  selectedDate,
  monthStart,
  monthEnd,
  onTodosChanged,
}: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState(1)
  const [error, setError] = useState('')

  // 월별 todo 로드
  useEffect(() => {
    listTodos(monthStart, monthEnd)
      .then((data) => setTodos(data))
      .catch((e) => setError(e instanceof Error ? e.message : '할 일을 불러오지 못했습니다.'))
  }, [monthStart, monthEnd])

  // 다른 날짜를 고르면 편집 중이던 행이 화면에서 사라지므로 편집 상태를 정리한다
  useEffect(() => {
    setEditingId(null)
    setError('')
  }, [selectedDate])

  // 선택된 날짜의 todos 필터링
  const selectedTodos = todos.filter((t) => t.date === selectedDate)
  const remainingTodos = selectedTodos.filter((t) => !t.completed)
  const visibleTodos = filter === 'remaining' ? remainingTodos : selectedTodos

  async function addTodo() {
    if (!newTitle.trim()) return
    try {
      const created = await createTodo({
        date: selectedDate,
        title: newTitle.trim(),
        priority: newPriority,
      })
      setTodos((prev) => [...prev, created])
      setNewTitle('')
      setNewPriority(1)
      setError('')
      onTodosChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '할 일을 추가하지 못했습니다.')
    }
  }

  async function toggleTodo(todo: Todo) {
    try {
      const updated = await updateTodo(todo.id, { completed: !todo.completed })
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)))
      setError('')
      onTodosChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '할 일을 수정하지 못했습니다.')
    }
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditTitle(todo.title)
    setEditPriority(todo.priority)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditPriority(1)
  }

  async function saveEdit(todo: Todo) {
    const title = editTitle.trim()
    if (!title) return
    try {
      const updated = await updateTodo(todo.id, { title, priority: editPriority })
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)))
      cancelEdit()
      setError('')
      onTodosChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '할 일을 수정하지 못했습니다.')
    }
  }

  async function removeTodo(id: number | string) {
    try {
      await deleteTodo(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
      if (editingId === id) cancelEdit()
      setError('')
      onTodosChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '할 일을 삭제하지 못했습니다.')
    }
  }

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">
          할 일 <span className="fl-card-count">남음 {remainingTodos.length}</span>
        </span>
        <div className="fl-seg">
          <button
            className={`fl-seg-btn${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
          <button
            className={`fl-seg-btn${filter === 'remaining' ? ' is-active' : ''}`}
            onClick={() => setFilter('remaining')}
          >
            남은 일
          </button>
        </div>
      </div>

      <div className="fl-card-body">
        <div className="fl-form-row">
          <input
            className="fl-input"
            placeholder="할 일 추가"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          />
          <div className="fl-seg">
            {PRIORITY_LABELS.map((label, priority) => (
              <button
                key={label}
                className={`fl-seg-btn${
                  newPriority === priority ? ` is-active ${PRIORITY_TONES[priority]}` : ''
                }`}
                style={{ height: 32 }}
                onClick={() => setNewPriority(priority)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="fl-btn fl-btn-primary" onClick={addTodo} disabled={!newTitle.trim()}>
            추가
          </button>
        </div>

        {error && <div className="fl-error">{error}</div>}

        {visibleTodos.length === 0 ? (
          <div className="fl-empty">
            {filter === 'remaining' ? '남은 할 일이 없습니다.' : '할 일이 없습니다.'}
          </div>
        ) : (
          <div className="fl-list">
            {visibleTodos.map((todo) =>
              editingId === todo.id ? (
                // 편집 중에는 label을 쓰지 않는다. label 안에서는 입력 클릭이 체크박스 토글로 새어 나간다.
                <div key={todo.id} className="fl-row is-editing" style={{ padding: 12 }}>
                  <input
                    className="fl-input fl-row-edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(todo)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    aria-label="할 일 제목"
                    autoFocus
                  />
                  <div className="fl-seg">
                    {PRIORITY_LABELS.map((label, priority) => (
                      <button
                        key={label}
                        className={`fl-seg-btn${
                          editPriority === priority ? ` is-active ${PRIORITY_TONES[priority]}` : ''
                        }`}
                        onClick={() => setEditPriority(priority)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="fl-btn fl-btn-primary fl-btn-sm"
                    onClick={() => saveEdit(todo)}
                    disabled={!editTitle.trim()}
                  >
                    저장
                  </button>
                  <button className="fl-btn fl-btn-sm" onClick={cancelEdit}>
                    취소
                  </button>
                </div>
              ) : (
                <label key={todo.id} className="fl-row" style={{ padding: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="fl-check"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                  />
                  <span className={`fl-todo-title${todo.completed ? ' is-done' : ''}`}>
                    {todo.title}
                  </span>
                  <span
                    className={`fl-badge fl-badge-square ${PRIORITY_TONES[todo.priority] || ''}`}
                  >
                    {PRIORITY_LABELS[todo.priority] || PRIORITY_LABELS[0]}
                  </span>
                  <button
                    className="fl-btn-e"
                    onClick={(e) => {
                      e.preventDefault()
                      startEdit(todo)
                    }}
                    title="수정"
                    aria-label="할 일 수정"
                  >
                    ✎
                  </button>
                  <button
                    className="fl-btn-x"
                    onClick={(e) => {
                      e.preventDefault()
                      removeTodo(todo.id)
                    }}
                    title="삭제"
                    aria-label="할 일 삭제"
                  >
                    ×
                  </button>
                </label>
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}
