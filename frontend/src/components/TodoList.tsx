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

      {/* 새 할 일 추가 - 개선된 디자인 */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(109, 139, 255, 0.08) 0%, rgba(109, 139, 255, 0.04) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          display: 'grid',
          gap: isMobile ? '10px' : '12px',
          marginBottom: isMobile ? 12 : 16,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <div style={{
          fontSize: isMobile ? '13px' : '14px',
          fontWeight: '600',
          color: 'var(--primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          opacity: 0.9
        }}>
          ✓ 새 할 일 추가
        </div>
        
        <input
          className="input input-event"
          placeholder="새로운 할 일을 입력하세요"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          style={{
            flex: 1,
            width: '100%',
            fontSize: isMobile ? '15px' : '16px',
            padding: isMobile ? '10px 14px' : '12px 16px',
            maxWidth: '100%',
            boxSizing: 'border-box',
            fontWeight: '500'
          }}
        />
        
        <div
          style={{
            display: 'flex',
            gap: isMobile ? '10px' : '12px',
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%',
            minWidth: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: isMobile ? 'none' : '0 0 auto'
          }}>
            <span style={{
              fontSize: isMobile ? '14px' : '14px',
              opacity: 0.7,
              whiteSpace: 'nowrap'
            }}>
              ⚡ 중요도
            </span>
            <div style={{
              display: 'inline-flex',
              gap: '6px',
              padding: '6px',
              backgroundColor: 'rgba(109, 139, 255, 0.08)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              flexWrap: 'nowrap'
            }}>
              {[0, 1, 2].map((priority) => (
                <button
                  key={priority}
                  onClick={() => setNewPriority(priority)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `2px solid ${newPriority === priority ? getPriorityColor(priority) : 'transparent'}`,
                    backgroundColor: newPriority === priority ? getPriorityBgColor(priority) : 'transparent',
                    color: getPriorityColor(priority),
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: newPriority === priority ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    if (newPriority !== priority) {
                      e.currentTarget.style.backgroundColor = 'rgba(109, 139, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (newPriority !== priority) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {priority === 0 && '📊'}
                  {priority === 1 && '⚙️'}
                  {priority === 2 && '🔥'}
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
          </div>
          
          {!isMobile && <div style={{ flex: 1 }} />}
          
          <button
            className="btn btn-add-event"
            onClick={addTodo}
            style={{
              flex: isMobile ? '1' : '0 0 auto',
              fontSize: isMobile ? '15px' : '16px',
              padding: isMobile ? '10px 16px' : '12px 24px',
              minWidth: isMobile ? 'auto' : '100px',
              flexShrink: 0,
              fontWeight: '600',
              letterSpacing: '0.3px'
            }}
          >
            추가
          </button>
        </div>
      </div>

      {/* 할 일 목록 */}
      <div className="card" style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 8 : 10,
        maxHeight: isMobile ? '400px' : '600px',
        overflow: 'hidden'
      }}>
        {selectedTodos.length === 0 && (
          <div
            style={{
              opacity: 0.6,
              textAlign: 'center',
              fontSize: isMobile ? 12 : 14,
              padding: isMobile ? '20px 0' : '24px 0',
            }}
          >
            할 일이 없습니다.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 8 : 10,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: isMobile ? '4px' : '6px',
            minWidth: 0
          }}
        >
          {selectedTodos.map((todo) => (
            <div
              key={todo.id}
              className="todo-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 10 : 12,
                background: 'rgba(109, 139, 255, 0.05)',
                border: '1px solid rgba(109, 139, 255, 0.15)',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '14px',
                flexDirection: 'row',
                width: '100%',
                minWidth: 0,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                opacity: todo.completed ? 0.7 : 1,
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              {/* 완료 체크박스 */}





              <div 
                onClick={() => toggleTodo(todo)}
                style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '20px' : '24px',
                height: isMobile ? '20px' : '24px',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: todo.completed ? 'var(--primary)' : 'var(--border)',
                background: todo.completed ? 'var(--primary)' : 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    accentColor: 'var(--primary)'
                  }}
                />
                {todo.completed && (
                  <span style={{
                    position: 'absolute',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    pointerEvents: 'none'
                  }}>
                    ✓
                  </span>
                )}
              </div>

              {/* 제목과 우선순위 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 8 : 10,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: todo.completed ? 400 : 500,
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    opacity: todo.completed ? 0.6 : 1,
                    flex: 1,
                    wordBreak: 'break-word',
                    minWidth: 0,
                    color: 'var(--text)'
                  }}
                >
                  {todo.title}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '4px 8px' : '6px 12px',
                    borderRadius: '6px',
                    fontSize: isMobile ? '11px' : '12px',
                    backgroundColor: getPriorityBgColor(todo.priority),
                    color: getPriorityColor(todo.priority),
                    fontWeight: '600',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    border: `1px solid ${getPriorityColor(todo.priority)}33`
                  }}
                >
                  {PRIORITY_LABELS[todo.priority]}
                </span>
              </div>

              {/* 삭제 버튼 */}
              <button
                className="btn-delete-event"
                onClick={() => removeTodo(todo.id)}
                style={{
                  fontSize: isMobile ? '14px' : '14px',
                  padding: isMobile ? '6px 10px' : '8px 14px',
                  flexShrink: 0,
                  minWidth: isMobile ? '32px' : '60px',
                  height: isMobile ? '32px' : 'auto',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isMobile ? '×' : '삭제'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 