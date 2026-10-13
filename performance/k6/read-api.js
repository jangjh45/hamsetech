import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const profileName = __ENV.PROFILE || 'smoke'
const workloadName = __ENV.WORKLOAD || 'mixed'
const maxVUs = Number(__ENV.MAX_VUS || 5)
const allowHighLoad = __ENV.ALLOW_HIGH_LOAD === 'true'
const steadyDuration = __ENV.STEADY_DURATION || '10m'
const writeWorkloads = new Set([
  'todo-crud',
  'scenario-crud',
  'overtime-crud',
  'calendar-crud',
  'notice-crud',
  'crud-mix-user',
  'crud-mix',
])
const adminWorkloads = new Set(['notice-crud', 'crud-mix'])

if (!Number.isInteger(maxVUs) || maxVUs < 1 || maxVUs > 20) {
  throw new Error('MAX_VUS는 1~20 사이의 정수여야 합니다.')
}
if ((profileName === 'ramp' || profileName === 'steady') && maxVUs > 5 && !allowHighLoad) {
  throw new Error('MAX_VUS를 5보다 높이려면 ALLOW_HIGH_LOAD=true를 명시하세요. 테스트 환경에서만 권장합니다.')
}
if (writeWorkloads.has(workloadName) && __ENV.ALLOW_WRITE_TESTS !== 'true') {
  throw new Error('쓰기 시나리오에는 ALLOW_WRITE_TESTS=true가 필요합니다. 전용 테스트 계정으로만 실행하세요.')
}

function rampStages(targetVUs) {
  const levels = [1, 2, 3, 5, 8, 10, 15, 20].filter((level) => level < targetVUs)
  levels.push(targetVUs)
  const stages = []
  levels.forEach((target) => {
    stages.push({ duration: '1m', target })
    stages.push({ duration: '2m', target })
  })
  stages.push({ duration: '30s', target: 0 })
  return stages
}

function durationMilliseconds(duration) {
  const match = /^(\d+)(s|m|h)$/.exec(duration)
  if (!match) return null
  const amount = Number(match[1])
  const multiplier = match[2] === 's' ? 1_000 : match[2] === 'm' ? 60_000 : 3_600_000
  return amount * multiplier
}

if (profileName === 'steady') {
  const durationMs = durationMilliseconds(steadyDuration)
  if (durationMs == null || durationMs < 60_000 || durationMs > 3_600_000) {
    throw new Error('STEADY_DURATION은 1m~60m 사이의 초·분·시간 형식이어야 합니다. 예: 20m')
  }
}

const profiles = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  baseline: {
    executor: 'constant-vus',
    vus: 2,
    duration: '3m',
  },
  ramp: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: rampStages(maxVUs),
    gracefulRampDown: '15s',
  },
  steady: {
    executor: 'constant-vus',
    vus: maxVUs,
    duration: steadyDuration,
  },
  soak: {
    executor: 'constant-vus',
    vus: 2,
    duration: '20m',
  },
}

const workloadRoutes = {
  notices: { endpoint: 'notice_list', path: '/api/notices?page=0&size=10' },
  overtime: { endpoint: 'my_overtime', path: null },
  vendors: { endpoint: 'vendor_list', path: '/api/vendors?page=0&size=20' },
  scenarios: { endpoint: 'scenario_list', path: '/api/scenarios' },
  calendar: { endpoint: 'calendar_range', path: null },
  todos: { endpoint: 'todo_range', path: null },
}
const workloads = new Set([...Object.keys(workloadRoutes), 'mixed', 'business-mix', ...writeWorkloads])
const p95LimitMs = Number(__ENV.P95_LIMIT_MS || 2000)
const failureRateLimit = Number(__ENV.FAILURE_RATE_LIMIT || 0.01)
if (!Number.isFinite(p95LimitMs) || p95LimitMs <= 0) {
  throw new Error('P95_LIMIT_MS는 0보다 큰 숫자여야 합니다.')
}
if (!Number.isFinite(failureRateLimit) || failureRateLimit < 0 || failureRateLimit > 1) {
  throw new Error('FAILURE_RATE_LIMIT은 0과 1 사이의 숫자여야 합니다.')
}

if (!Object.prototype.hasOwnProperty.call(profiles, profileName)) {
  throw new Error(`알 수 없는 PROFILE: ${profileName}. smoke, baseline, ramp, steady, soak 중 선택하세요.`)
}
if (!workloads.has(workloadName)) {
  throw new Error(`알 수 없는 WORKLOAD: ${workloadName}. ${[...workloads].join(', ')} 중 선택하세요.`)
}

const apiDuration = new Trend('api_duration', true)
const apiFailureRate = new Rate('api_failure_rate')
const apiRequests = new Counter('api_requests')

export const options = {
  scenarios: {
    selected_profile: profiles[profileName],
  },
  thresholds: {
    api_duration: [`p(95)<${p95LimitMs}`],
    api_failure_rate: [`rate<${failureRateLimit}`],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
}

const baseUrl = (__ENV.BASE_URL || '').replace(/\/+$/, '')
const currentMonth = new Date()
const monthStart = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1))
const monthEnd = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0))
const dateString = (date) => date.toISOString().slice(0, 10)
const overtimePath = `/api/overtime-records/me?from=${dateString(monthStart)}&to=${dateString(monthEnd)}`
workloadRoutes.overtime.path = overtimePath
workloadRoutes.calendar.path = `/api/calendar?start=${dateString(monthStart)}&end=${dateString(monthEnd)}`
workloadRoutes.todos.path = `/api/todos?start=${dateString(monthStart)}&end=${dateString(monthEnd)}`

export function setup() {
  if (!/^https?:\/\//i.test(baseUrl)) {
    fail('BASE_URL에 NAS 웹 주소를 지정하세요. 예: http://192.168.0.20:8080')
  }

  const username = __ENV.PERF_USERNAME
  const password = __ENV.PERF_PASSWORD
  if (!username || !password) {
    fail('PERF_USERNAME과 PERF_PASSWORD 환경변수를 지정하세요.')
  }

  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ username, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
      tags: { request_type: 'setup_login' },
    },
  )

  const token = response.status === 200 ? response.json('token') : null
  const loginSucceeded = check(response, {
    'setup login returned a token': (res) => res.status === 200 && typeof token === 'string' && token.length > 0,
  })
  if (!loginSucceeded) {
    fail(`로그인 실패(status=${response.status}). 테스트 계정의 승인 상태와 자격 증명을 확인하세요.`)
  }

  if (adminWorkloads.has(workloadName)) {
    const roles = response.json('roles') || []
    const isAdmin = Array.isArray(roles) && roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN')
    if (!isAdmin) {
      fail(`${workloadName}은 관리자 권한이 필요합니다. 테스트용 ADMIN 계정으로 실행하세요.`)
    }
  }

  return { token }
}

function getApi(path, endpoint, token) {
  const response = http.get(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: '15s',
    tags: { endpoint },
  })
  recordApiResult(response, endpoint)
  return response
}

function writeApi(method, path, endpoint, token, body) {
  const response = http.request(method, `${baseUrl}${path}`, body == null ? null : JSON.stringify(body), {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    timeout: '15s',
    tags: { endpoint },
  })
  recordApiResult(response, endpoint)
  return response
}

function recordApiResult(response, endpoint) {
  const failed = response.status < 200 || response.status >= 300

  apiRequests.add(1, { endpoint })
  apiDuration.add(response.timings.duration, { endpoint })
  apiFailureRate.add(failed, { endpoint })
  check(response, {
    [`${endpoint} returned 2xx`]: () => !failed,
  })
}

function responseId(response, endpoint) {
  let id = null
  try {
    id = response.json('id')
  } catch {
    // 아래 check에 실패로 남기고, id가 없으면 후속 요청을 보내지 않는다.
  }
  check(response, { [`${endpoint} returned a record id`]: () => id != null && id !== '' })
  return id
}

function runTodoCrud(token) {
  const title = `__k6_test_todo_${Date.now()}_${__VU}_${__ITER}`
  const created = writeApi('POST', '/api/todos', 'todo_create', token, {
    date: dateString(new Date()),
    title,
    description: 'Temporary k6 test record; should be deleted in the same iteration.',
    priority: 1,
  })
  const id = responseId(created, 'todo_create')
  if (id == null || created.status < 200 || created.status >= 300) return

  try {
    writeApi('PUT', `/api/todos/${id}`, 'todo_update', token, {
      title: `${title}_updated`,
      completed: true,
      priority: 2,
    })
  } finally {
    writeApi('DELETE', `/api/todos/${id}`, 'todo_delete', token)
  }
}

function scenarioPayload(name) {
  return {
    name,
    description: 'Temporary k6 test scenario; should be deleted in the same iteration.',
    truckWidth: 1000,
    truckHeight: 1000,
    allowRotate: true,
    margin: 0,
    preserveOrder: false,
    items: [{ name: 'k6-test-box', width: 100, height: 100, quantity: 1 }],
  }
}

function runScenarioCrud(token) {
  const name = `__k6_test_scenario_${Date.now()}_${__VU}_${__ITER}`
  const created = writeApi('POST', '/api/scenarios', 'scenario_create', token, scenarioPayload(name))
  const id = responseId(created, 'scenario_create')
  if (id == null || created.status < 200 || created.status >= 300) return

  try {
    writeApi('PUT', `/api/scenarios/${id}`, 'scenario_update', token, scenarioPayload(`${name}_updated`))
  } finally {
    writeApi('DELETE', `/api/scenarios/${id}`, 'scenario_delete', token)
  }
}

function runOvertimeCrud(token) {
  const reason = `__k6_test_overtime_${Date.now()}_${__VU}_${__ITER}`
  const payload = {
    workDate: dateString(new Date()),
    type: 'OVERTIME',
    startTime: '16:00',
    endTime: '17:00',
    reason,
  }
  const created = writeApi('POST', '/api/overtime-records', 'overtime_create', token, payload)
  const id = responseId(created, 'overtime_create')
  if (id == null || created.status < 200 || created.status >= 300) return

  try {
    writeApi('PUT', `/api/overtime-records/${id}`, 'overtime_update', token, {
      ...payload,
      reason: `${reason}_updated`,
    })
  } finally {
    writeApi('DELETE', `/api/overtime-records/${id}`, 'overtime_delete', token)
  }
}

function runCalendarCrud(token) {
  const title = `__k6_test_calendar_${Date.now()}_${__VU}_${__ITER}`
  const payload = {
    date: dateString(new Date()),
    time: '12:00',
    title,
    scope: 'PRIVATE',
  }
  const created = writeApi('POST', '/api/calendar', 'calendar_create', token, payload)
  const id = responseId(created, 'calendar_create')
  if (id == null || created.status < 200 || created.status >= 300) return

  try {
    writeApi('PUT', `/api/calendar/${id}`, 'calendar_update', token, {
      ...payload,
      title: `${title}_updated`,
    })
  } finally {
    writeApi('DELETE', `/api/calendar/${id}`, 'calendar_delete', token)
  }
}

function noticePayload(title, content) {
  return {
    title,
    content: `<p>${content}</p>`,
    category: 'GENERAL',
    pinned: false,
    attachmentIds: [],
  }
}

function runNoticeCrud(token) {
  const title = `__k6_test_notice_${Date.now()}_${__VU}_${__ITER}`
  const created = writeApi(
    'POST',
    '/api/notices',
    'notice_create',
    token,
    noticePayload(title, 'Temporary k6 notice.'),
  )
  const noticeId = responseId(created, 'notice_create')
  if (noticeId == null || created.status < 200 || created.status >= 300) return

  try {
    writeApi(
      'PUT',
      `/api/notices/${noticeId}`,
      'notice_update',
      token,
      noticePayload(`${title}_updated`, 'Updated temporary k6 notice.'),
    )

    const commentText = `__k6_test_comment_${Date.now()}_${__VU}_${__ITER}`
    const comment = writeApi('POST', `/api/notices/${noticeId}/comments`, 'notice_comment_create', token, {
      content: commentText,
      parentId: null,
    })
    const commentId = responseId(comment, 'notice_comment_create')

    if (commentId != null && comment.status >= 200 && comment.status < 300) {
      try {
        writeApi(
          'PUT',
          `/api/notices/${noticeId}/comments/${commentId}`,
          'notice_comment_update',
          token,
          { content: `${commentText}_updated` },
        )
      } finally {
        writeApi(
          'DELETE',
          `/api/notices/${noticeId}/comments/${commentId}`,
          'notice_comment_delete',
          token,
        )
      }
    }
  } finally {
    writeApi('DELETE', `/api/notices/${noticeId}`, 'notice_delete', token)
  }
}

function runCrudMix(token, includeNotice) {
  const actions = [runTodoCrud, runScenarioCrud, runOvertimeCrud, runCalendarCrud]
  if (includeNotice) actions.push(runNoticeCrud)
  const selectedAction = actions[Math.floor(Math.random() * actions.length)]
  selectedAction(token)
}

export default function ({ token }) {
  if (workloadName === 'notices') {
    getApi(workloadRoutes.notices.path, workloadRoutes.notices.endpoint, token)
  } else if (workloadName === 'overtime') {
    getApi(workloadRoutes.overtime.path, workloadRoutes.overtime.endpoint, token)
  } else if (workloadName === 'mixed') {
    const route = Math.random() < 0.7 ? workloadRoutes.notices : workloadRoutes.overtime
    getApi(route.path, route.endpoint, token)
  } else if (workloadName === 'business-mix') {
    // 비율: 공지 40%, 잔업 15%, 업체 15%, 시나리오 10%, 일정 10%, 할 일 10%.
    const sample = Math.random()
    const route = sample < 0.4
      ? workloadRoutes.notices
      : sample < 0.55
        ? workloadRoutes.overtime
        : sample < 0.7
          ? workloadRoutes.vendors
          : sample < 0.8
            ? workloadRoutes.scenarios
            : sample < 0.9
              ? workloadRoutes.calendar
              : workloadRoutes.todos
    getApi(route.path, route.endpoint, token)
  } else if (workloadName === 'todo-crud') {
    runTodoCrud(token)
  } else if (workloadName === 'scenario-crud') {
    runScenarioCrud(token)
  } else if (workloadName === 'overtime-crud') {
    runOvertimeCrud(token)
  } else if (workloadName === 'calendar-crud') {
    runCalendarCrud(token)
  } else if (workloadName === 'notice-crud') {
    runNoticeCrud(token)
  } else if (workloadName === 'crud-mix-user') {
    runCrudMix(token, false)
  } else if (workloadName === 'crud-mix') {
    runCrudMix(token, true)
  } else {
    const route = workloadRoutes[workloadName]
    getApi(route.path, route.endpoint, token)
  }

  // VU마다 실제 사용자의 간격을 흉내 내고 NAS로 순간 요청이 몰리지 않게 한다.
  sleep(1 + Math.random())
}
