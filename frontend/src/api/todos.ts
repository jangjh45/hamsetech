import { apiFetch } from './client'

export interface Todo {
  id: number | string
  date: string
  title: string
  description?: string
  completed: boolean
  priority: number // 0: low, 1: medium, 2: high
  createdAt: string
  updatedAt: string
}

export interface CreateTodoRequest {
  date: string
  title: string
  description?: string
  priority?: number
}

export interface UpdateTodoRequest {
  date?: string
  title?: string
  description?: string
  completed?: boolean
  priority?: number
}

export async function listTodos(start: string, end: string): Promise<Todo[]> {
  return apiFetch(`/api/todos?start=${start}&end=${end}`)
}

export async function getTodosByDate(date: string): Promise<Todo[]> {
  return apiFetch(`/api/todos/date/${date}`)
}

export async function createTodo(payload: CreateTodoRequest): Promise<Todo> {
  return apiFetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTodo(id: number | string, payload: UpdateTodoRequest): Promise<Todo> {
  return apiFetch(`/api/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteTodo(id: number | string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/todos/${id}`, {
    method: 'DELETE',
  })
} 