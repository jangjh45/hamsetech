import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listTodos, createTodo, updateTodo, deleteTodo, type Todo } from '../api/todos'
import { isAuthenticated } from '../auth/token'

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
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated())

  // 인증 상태 변경 감시
  useEffect(() => {
    const handleAuthChange = () => setAuthenticated(isAuthenticated())
    window.addEventListener('auth-changed', handleAuthChange)
    return () => window.removeEventListener('auth-changed', handleAuthChange)
  }, [])

  // 월별 todo 로드 (인증된 경우만)
  useEffect(() => {
    if (!authenticated) return
    listTodos(monthStart, monthEnd)
      .then((data) => setTodos(data))
      .catch(() => {})
  }, [monthStart, monthEnd, authenticated])

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
      onTodosChanged?.()
    } catch {}
  }

  async function toggleTodo(todo: Todo) {
    try {
      const updated = await updateTodo(todo.id, { completed: !todo.completed })
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)))
      onTodosChanged?.()
    } catch {}
  }

  async function removeTodo(id: number | string) {
    try {
      await deleteTodo(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
      onTodosChanged?.()
    } catch {}
  }

  if (!authenticated) {
    return (
      <>
        <div className="fl-card-head">
          <span className="fl-card-title">할 일</span>
          <span className="fl-card-count">로그인 필요</span>
        </div>
        <div className="fl-card-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="fl-empty">로그인하면 개인 할 일을 저장하고 관리할 수 있습니다.</div>
          <Link to="/login" className="fl-btn fl-btn-primary" style={{ textDecoration: 'none' }}>
            로그인하기
          </Link>
        </div>
      </>
    )
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

        {visibleTodos.length === 0 ? (
          <div className="fl-empty">
            {filter === 'remaining' ? '남은 할 일이 없습니다.' : '할 일이 없습니다.'}
          </div>
        ) : (
          <div className="fl-list">
            {visibleTodos.map((todo) => (
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
            ))}
          </div>
        )}
      </div>
    </>
  )
}
