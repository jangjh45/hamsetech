import { useState } from 'react'
import { createTodo, updateTodo, deleteTodo, type Todo } from '../api/todos'

interface TodoListProps {
  selectedDate: string
  resetVersion: number
  todos: Todo[] | null
  todosLoading: boolean
  todosError: string
  onRetry: () => void
  onTodosChange: (update: (previous: Todo[]) => Todo[]) => void
  /** 할 일 추가/토글/삭제 후 타이틀 밴드 갱신용 */
  onTodosChanged?: () => void
}

const PRIORITY_LABELS = ['낮음', '중간', '높음']
// 중요도 → 배지/세그먼트 톤 (색상 리터럴 대신 dashboard.css의 토큰 클래스를 쓴다)
const PRIORITY_TONES = ['', 'fl-tone-warn', 'fl-tone-danger']

type Filter = 'all' | 'remaining'

export default function TodoList({
  selectedDate,
  resetVersion,
  todos: monthTodos,
  todosLoading,
  todosError,
  onRetry,
  onTodosChange,
  onTodosChanged,
}: TodoListProps) {
  const todos = monthTodos ?? []
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ id: number | string; resetVersion: number } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState(1)
  const [actionError, setActionError] = useState<{ message: string; resetVersion: number } | null>(null)
  const editingId = editing?.resetVersion === resetVersion ? editing.id : null
  const error = actionError?.resetVersion === resetVersion ? actionError.message : ''

  function setError(message: string) {
    if (!message) {
      setActionError((current) => current?.resetVersion === resetVersion ? null : current)
      return
    }
    setActionError({ message, resetVersion })
  }

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
      onTodosChange((previous) => [...previous, created])
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
      onTodosChange((previous) => previous.map((t) => (t.id === todo.id ? updated : t)))
      setError('')
      onTodosChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '할 일을 수정하지 못했습니다.')
    }
  }

  function startEdit(todo: Todo) {
    setEditing({ id: todo.id, resetVersion })
    setEditTitle(todo.title)
    setEditPriority(todo.priority)
    setError('')
  }

  function cancelEdit() {
    setEditing(null)
    setEditTitle('')
    setEditPriority(1)
  }

  async function saveEdit(todo: Todo) {
    const title = editTitle.trim()
    if (!title) return
    try {
      const updated = await updateTodo(todo.id, { title, priority: editPriority })
      onTodosChange((previous) => previous.map((t) => (t.id === todo.id ? updated : t)))
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
      onTodosChange((previous) => previous.filter((t) => t.id !== id))
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

        {todosError && (
          <div className="fl-error" role="alert">
            <span>{todosError}</span>
            <button className="fl-btn fl-btn-sm" onClick={onRetry} disabled={todosLoading}>
              다시 시도
            </button>
          </div>
        )}
        {error && <div className="fl-error" role="alert">{error}</div>}

        {todosLoading || monthTodos === null ? null : visibleTodos.length === 0 ? (
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
