# k6 부하 테스트

이 테스트는 앱 안이나 NAS에서 실행하지 않습니다. **별도 PC**에서 k6를 실행해 NAS의 프론트엔드 주소(Nginx 경유)로 요청합니다. 관리자 성능 탭은 테스트 중 함께 열어 두고 서버 측 RPS·응답시간·메모리·DB 연결 풀을 관찰합니다.

## 준비

1. NAS에 성능 화면이 포함된 최신 버전을 먼저 배포합니다.
2. 승인된 **일반 사용자 전용 테스트 계정**을 준비합니다. 관리자 계정이나 실제 직원 계정은 사용하지 않는 것을 권장합니다. 단 `notice-crud`는 별도로 만든 테스트용 ADMIN 계정이 필요합니다.
3. 테스트 PC를 NAS와 같은 내부망에 연결하고 k6를 설치합니다. Windows에서는 다음으로 설치할 수 있습니다.

   ```powershell
   winget install k6
   ```

4. 테스트 데이터와 대상 주소를 확인합니다. `BASE_URL`에는 `/api`를 붙이지 않습니다.

## PowerShell에서 실행

프로젝트 루트에서 아래를 실행합니다. 비밀번호는 입력할 때 화면에 표시되지 않으며, 저장소 파일에 기록되지 않습니다.

```powershell
$env:BASE_URL = 'http://192.168.0.20:8080'
$env:PERF_USERNAME = Read-Host '테스트 계정 아이디'
$securePassword = Read-Host '테스트 계정 비밀번호' -AsSecureString
$env:PERF_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
$env:PROFILE = 'smoke'
$env:WORKLOAD = 'mixed'
$env:MAX_VUS = '5'
$env:ALLOW_HIGH_LOAD = 'false'
$env:ALLOW_WRITE_TESTS = 'false'
$env:STEADY_DURATION = '10m'

New-Item -ItemType Directory -Force performance/k6/results | Out-Null
k6 run `
  -e "BASE_URL=$env:BASE_URL" `
  -e "PERF_USERNAME=$env:PERF_USERNAME" `
  -e "PERF_PASSWORD=$env:PERF_PASSWORD" `
  -e "PROFILE=$env:PROFILE" `
  -e "WORKLOAD=$env:WORKLOAD" `
  -e "MAX_VUS=$env:MAX_VUS" `
  -e "ALLOW_HIGH_LOAD=$env:ALLOW_HIGH_LOAD" `
  -e "ALLOW_WRITE_TESTS=$env:ALLOW_WRITE_TESTS" `
  -e "STEADY_DURATION=$env:STEADY_DURATION" `
  --summary-export="performance/k6/results/$($env:PROFILE)-$($env:WORKLOAD).json" `
  performance/k6/read-api.js
```

테스트가 끝난 뒤 현재 PowerShell 창의 자격 증명 변수를 지웁니다.

```powershell
Remove-Item Env:PERF_PASSWORD, Env:PERF_USERNAME -ErrorAction SilentlyContinue
```

쓰기 workload를 실행할 때는 기본 실행 블록의 환경변수를 바꾼 뒤, 같은 `k6 run` 명령을 사용합니다. 최초 검증은 한 번에 한 workload씩 smoke로 하세요.

```powershell
$env:PROFILE = 'smoke'
$env:WORKLOAD = 'overtime-crud' # 또는 crud-mix-user, crud-mix, business-crud-mix
$env:MAX_VUS = '1'
$env:ALLOW_HIGH_LOAD = 'false'
$env:ALLOW_WRITE_TESTS = 'true'
```

`notice-crud` 또는 `crud-mix`를 선택할 경우에는 `PERF_USERNAME`과 `PERF_PASSWORD`에도 테스트용 관리자 계정 정보를 설정해야 합니다. 스크립트는 ADMIN/SUPER_ADMIN 권한이 없으면 부하를 시작하기 전에 중단합니다.

## 프로필과 요청 조합

| 변수 | 의미 | 기본 부하 |
| --- | --- | --- |
| `PROFILE=smoke` | 연결·인증·응답 확인 | 1 VU, 30초 |
| `PROFILE=baseline` | 낮은 부하 기준선 | 2 VU, 3분 |
| `PROFILE=ramp` | 낮은 단계부터 점진 증가 | `MAX_VUS`까지 1 → 2 → 3 → 5 → 8 → 10 → 15 → 20 단계, 단계별 유지 |
| `PROFILE=steady` | 지정한 VU를 고정 유지 | `MAX_VUS` VU, `STEADY_DURATION` (기본 10분, 1~60분) |
| `PROFILE=soak` | 낮은 부하 장시간 확인 | 2 VU, 20분 |
| `MAX_VUS=3` | ramp 최대 동시 사용자 수 지정 | 5 이하로 낮추거나 기본 상한 유지 |
| `MAX_VUS=8` | ramp를 8 VU까지 올림 | 추가로 `ALLOW_HIGH_LOAD=true` 필요, 테스트 환경 권장 |
| `MAX_VUS=20` | ramp를 최대 20 VU까지 올림 | `ALLOW_HIGH_LOAD=true` 필요, 테스트 환경 전용 |
| `WORKLOAD=notices` | 공지 목록 조회만 | `GET /api/notices?page=0&size=10` |
| `WORKLOAD=overtime` | 내 잔업 기록 조회만 | `GET /api/overtime-records/me` (이번 달) |
| `WORKLOAD=vendors` | 업체 목록 | `GET /api/vendors?page=0&size=20` |
| `WORKLOAD=scenarios` | 내 적재 시나리오 | `GET /api/scenarios` |
| `WORKLOAD=calendar` | 이번 달 일정 | `GET /api/calendar?start=...&end=...` |
| `WORKLOAD=todos` | 이번 달 할 일 | `GET /api/todos?start=...&end=...` |
| `WORKLOAD=mixed` | 공지 70%, 내 잔업 30% | 부작용이 적은 두 조회 혼합 |
| `WORKLOAD=business-mix` | 공지 40%, 잔업 15%, 업체 15%, 시나리오 10%, 일정 10%, 할 일 10% | 실제 화면에 가까운 API 혼합 |
| `WORKLOAD=todo-crud` | 테스트 할 일 생성→수정→삭제 | `ALLOW_WRITE_TESTS=true` 필수 |
| `WORKLOAD=scenario-crud` | 테스트 적재 시나리오 생성→수정→삭제 | `ALLOW_WRITE_TESTS=true` 필수 |
| `WORKLOAD=overtime-crud` | 본인 잔업 기록 생성→수정→삭제 | `ALLOW_WRITE_TESTS=true` 필수 |
| `WORKLOAD=calendar-crud` | 비공개 일정 생성→수정→삭제 | `ALLOW_WRITE_TESTS=true` 필수 |
| `WORKLOAD=notice-crud` | 공지 생성→수정, 댓글 생성→수정→삭제, 공지 삭제 | 관리자 계정과 `ALLOW_WRITE_TESTS=true` 필요 |
| `WORKLOAD=crud-mix-user` | 할 일·시나리오·잔업·비공개 일정 CRUD 중 무작위 선택 | 일반 사용자 계정과 `ALLOW_WRITE_TESTS=true` 필요 |
| `WORKLOAD=crud-mix` | 위 네 가지와 공지·댓글 CRUD 중 무작위 선택 | 관리자 계정과 `ALLOW_WRITE_TESTS=true` 필요 |
| `WORKLOAD=business-crud-mix` | business-mix 조회와 crud-mix 쓰기 작업을 반복마다 50:50으로 선택 | 관리자 계정과 `ALLOW_WRITE_TESTS=true` 필요 |

예를 들어 기준선은 `PROFILE=baseline`, 더 많은 조회 API를 섞으려면 `WORKLOAD=business-mix`로 실행합니다. 조회와 쓰기를 함께 시험하려면 `WORKLOAD=business-crud-mix`를 선택합니다. 이 workload는 반복마다 business-mix 조회(공지 40%, 잔업 15%, 업체 15%, 시나리오 10%, 일정 10%, 할 일 10%) 또는 crud-mix 중 하나를 각각 50% 확률로 실행합니다. CRUD 쪽에는 공지·댓글 CRUD도 포함되므로 관리자 테스트 계정과 `ALLOW_WRITE_TESTS=true`가 필요합니다. `MAX_VUS`는 `ramp`와 `steady`에 적용되고 허용 범위는 1~20입니다. 5 VU 초과는 반드시 `ALLOW_HIGH_LOAD=true`를 전달해야 합니다. 고정 5 VU를 20분 유지하려면 `PROFILE=steady`, `MAX_VUS=5`, `STEADY_DURATION=20m`으로 설정합니다. 쓰기 workload는 별도로 `ALLOW_WRITE_TESTS=true`도 필요합니다. `notice-crud`와 전체 `crud-mix`에서는 관리자 테스트 계정을 사용합니다. `crud-mix-user`는 일반 사용자 계정으로 할 일·시나리오·잔업·비공개 일정 중 하나를 매 반복 무작위 선택합니다. 각 VU는 한 번의 작업 뒤 1~2초 쉬므로 실제 요청률은 VU 수와 서버 응답시간에 따라 달라집니다. 일반 CRUD workload는 반복당 HTTP 요청 세 개(POST·PUT·DELETE), 공지 workload는 공지와 댓글을 포함해 여섯 개 요청을 순서대로 보냅니다.

고정 부하 프로필을 실행할 때는 같은 PowerShell 창에서 아래 값으로 설정한 뒤 기존 `k6 run` 명령을 실행합니다. `STEADY_DURATION`은 1분~60분만 허용됩니다.

```powershell
$env:PROFILE = 'steady'
$env:MAX_VUS = '5'
$env:STEADY_DURATION = '20m'
```

## 안전 및 결과 해석

- 첫 실행은 반드시 `smoke`로 합니다. NAS 상태가 안정적인 것을 확인한 뒤 `baseline`, 이후 필요할 때만 `ramp`를 실행하세요. 처음 운영 NAS에서 `ramp`를 돌릴 때는 `MAX_VUS=3`부터 시작하는 것을 권장합니다. 저사양 NAS에서 부하를 높이는 테스트는 한가한 시간에 수행하고, 관리자 성능 화면과 Docker 상태를 같이 관찰합니다.
- VU를 5보다 크게 할 수는 있지만 운영 NAS에서는 권장하지 않습니다. `MAX_VUS=8`, `ALLOW_HIGH_LOAD=true`부터 복제된 테스트 환경에서 검증하고, ramp/steady 상한은 20 VU입니다. VU는 동시 실행 사용자 수이지 고정 RPS가 아닙니다.
- 5xx가 발생하거나 응답시간이 급증하거나 컨테이너 재시작·메모리 부족·DB 오류가 보이면 테스트를 중단합니다. 기본 종료 기준은 API p95 2초, 실패율 1% 미만이며 `P95_LIMIT_MS`, `FAILURE_RATE_LIMIT` 환경변수로 조정할 수 있습니다. 이 값은 초기 가드레일이지 서비스 목표(SLO)는 아닙니다.
- `business-mix`에서 업체 목록은 일반 사용자의 조회도 감사 로그를 남깁니다. 일정·할 일·시나리오는 `@AdminLoggable`의 기본 설정상 관리자 계정 요청만 감사 로그를 기록합니다. 일반 사용자 테스트 계정을 쓰더라도 이를 고려해 결과를 해석하세요.
- CRUD workload는 매 반복마다 전용 접두사(`__k6_test_`)가 붙은 레코드를 만들고 수정한 다음 그 레코드만 삭제합니다. 기존 업무 데이터는 수정·삭제하지 않습니다. `notice-crud`와 전체 `crud-mix`는 관리자 전용 테스트 공지를 잠시 만들고 테스트 댓글도 추가합니다. 실제 사용자에게 보일 수 있으므로 공지 CRUD는 복제된 테스트 환경에서만 실행하세요.
- 테스트가 강제 종료되거나 DELETE 요청이 실패하면 임시 레코드가 남을 수 있습니다. 전용 테스트 계정만 사용하고 실행 후 `__k6_test_` 레코드가 남았는지 확인하세요. 감사 로그는 데이터 삭제 후에도 남을 수 있으며, 잔업 기록 생성·수정·삭제는 일반 사용자 요청도 감사 로그를 남깁니다.
- 쓰기 부하는 DB를 직접 변경하므로 운영 NAS에서는 `PROFILE=smoke`, 1 VU부터 확인합니다. ramp 또는 5 VU 초과는 복제된 테스트 환경에서만 실행하세요. 쓰기 workload에는 `ALLOW_WRITE_TESTS=true`가 없으면 스크립트가 시작되지 않습니다. 로그인은 테스트 시작 시 한 번만 하며 로그인 반복 부하는 포함하지 않습니다.
- 서버 지표에는 스크립트 시작 시 로그인 1회가 포함됩니다. k6의 `api_duration`·`api_failure_rate`·`api_requests` 사용자 지표는 실제 workload 요청(조회·쓰기)을 집계하고 setup 로그인은 제외합니다.
- k6 `api_duration`은 테스트 PC에서 본 네트워크·Nginx·API 전체 시간이고, 관리자 화면 응답시간은 앱 서버가 관측한 값입니다. 두 값을 함께 비교하세요.
- 요약 JSON은 `performance/k6/results/`에 저장되며 Git에서 제외됩니다. `soak` 및 더 높은 부하는 운영 NAS가 아닌 복제된 테스트 환경에서 수행하세요.
