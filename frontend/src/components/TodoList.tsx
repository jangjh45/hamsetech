import { useState, useEffect } from 'react'
import { listTodos, createTodo, updateTodo, deleteTodo, type Todo } from '../api/todos'
import { isAuthenticated } from '../auth/token'

interface TodoListProps {
  selectedDate: string
  monthStart: string
  monthEnd: string
}

const PRIORITY_LABELS = ['낮음', '중간', '높음']
const PRIORITY_COLORS_RGB = [
  { r: 136, g: 136, b: 136 },  // 낮음: 회색
  { r: 255, g: 152, b: 0 },    // 중간: 주황색
  { r: 244, g: 67, b: 54 }     // 높음: 빨강
]

function getPriorityBgColor(priority: number): string {
  const color = PRIORITY_COLORS_RGB[priority] || PRIORITY_COLORS_RGB[0]
  return `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`
}

function getPriorityColor(priority: number): string {
  const color = PRIORITY_COLORS_RGB[priority] || PRIORITY_COLORS_RGB[0]
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

export default function TodoList({ selectedDate, monthStart, monthEnd }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState(1)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated())

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 인증 상태 변경 감시
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthenticated(isAuthenticated())
    }
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
  const remainingTodos = selectedTodos.filter((t) => !t.completed).length

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
    } catch {}
  }

  async function toggleTodo(todo: Todo) {
    try {
      const updated = await updateTodo(todo.id, {
        completed: !todo.completed,
      })
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? updated : t))
      )
    } catch {}
  }

  async function removeTodo(id: number | string) {
    try {
      await deleteTodo(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch {}
  }

  if (!authenticated) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: isMobile ? 14 : 16,
            marginBottom: isMobile ? 8 : 12,
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          할 일 <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 400, opacity: 0.7 }}>로그인 필요</span>
        </div>
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '32px 16px' : '48px 32px',
            textAlign: 'center',
            gap: isMobile ? 12 : 16,
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 14 : 16,
              opacity: 0.7,
              lineHeight: 1.5,
            }}
          >
            로그인하면 개인 할 일을 저장하고 관리할 수 있습니다.
          </div>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              padding: isMobile ? '8px 20px' : '10px 24px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: isMobile ? 14 : 16,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            로그인하기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: isMobile ? 14 : 16,
          marginBottom: isMobile ? 8 : 12,
          textAlign: isMobile ? 'center' : 'left',
        }}
      >
        할 일 <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 400, opacity: 0.7 }}>({selectedTodos.length}, 남음: {remainingTodos})</span>
      </div>

      {/* 새 할 일 추가 */}
      <div
        style={{
          display: 'flex',
          gap: isMobile ? 8 : 10,
          alignItems: 'stretch',
          flexDirection: isMobile ? 'column' : 'row',
          marginBottom: isMobile ? 12 : 16,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <input
          className="input"
          placeholder="새로운 할 일"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          style={{
            flex: 1,
            width: isMobile ? '100%' : 'auto',
            fontSize: isMobile ? 14 : 16,
            padding: isMobile ? '8px 12px' : '10px 16px',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: isMobile ? 8 : 8,
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? '100%' : 'auto',
            flexShrink: 0,
          }}
        >
          <select
            className="input"
            value={newPriority}
            onChange={(e) => setNewPriority(Number(e.target.value))}
            style={{
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '100%' : '90px',
              fontSize: isMobile ? 14 : 16,
              padding: isMobile ? '8px 12px' : '10px 16px',
              boxSizing: 'border-box',
            }}
          >
            <option value={0}>낮음</option>
            <option value={1}>중간</option>
            <option value={2}>높음</option>
          </select>
          <button
            className="btn ghost"
            onClick={addTodo}
            style={{
              width: isMobile ? '100%' : 'auto',
              fontSize: isMobile ? 14 : 16,
              padding: isMobile ? '8px 16px' : '10px 20px',
              minWidth: isMobile ? 'auto' : 60,
              flexShrink: 0,
            }}
          >
            추가
          </button>
        </div>
      </div>

      {/* 할 일 목록 */}
      <div className="card" style={{ display: 'grid', gap: isMobile ? 6 : 8 }}>
        {selectedTodos.length === 0 && (
          <div
            style={{
              opacity: 0.6,
              textAlign: 'center',
              fontSize: isMobile ? 12 : 14,
              padding: isMobile ? '12px' : '16px',
            }}
          >
            할 일이 없습니다.
          </div>
        )}
        <div
          style={{
            maxHeight: isMobile ? '300px' : '500px',
            overflowY: 'auto',
            display: 'grid',
            gap: isMobile ? 6 : 8,
            paddingRight: isMobile ? '4px' : '8px',
          }}
        >
          {selectedTodos.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 8 : 12,
                borderBottom: '1px dashed var(--border)',
                paddingBottom: isMobile ? 8 : 10,
                flexDirection: 'row',
                width: '100%',
                minWidth: 0,
              }}
            >
              {/* 완료 체크박스 */}
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo)}
                style={{
                  width: isMobile ? 16 : 20,
                  height: isMobile ? 16 : 20,
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: isMobile ? 2 : 0,
                }}
              />

              {/* 제목과 우선순위 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 6 : 10,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: isMobile ? 13 : 16,
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    opacity: todo.completed ? 0.5 : 1,
                    flex: 1,
                    wordBreak: 'break-word',
                    minWidth: 0,
                  }}
                >
                  {todo.title}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '2px 6px' : '5px 10px',
                    borderRadius: 4,
                    fontSize: isMobile ? 11 : 13,
                    backgroundColor: getPriorityBgColor(todo.priority),
                    color: getPriorityColor(todo.priority),
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                  }}
                >
                  {PRIORITY_LABELS[todo.priority]}
                </span>
              </div>

              {/* 삭제 버튼 */}
              <button
                className="btn ghost"
                onClick={() => removeTodo(todo.id)}
                style={{
                  width: isMobile ? 'auto' : 'auto',
                  fontSize: isMobile ? 12 : 14,
                  padding: isMobile ? '4px 8px' : '8px 16px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 