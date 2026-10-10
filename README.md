# hamsetech

사내용 업무 관리 웹 애플리케이션. 공지사항, 잔업/특근(초과근무) 기록, 일정 관리, 할 일 목록, 적재 시나리오 계산 등 사내 운영에 필요한 기능을 하나의 서비스로 제공합니다.

## 기술 스택

- **백엔드**: Java 25 (LTS), Spring Boot 4.1, Spring Security (JWT + OAuth2 Client), Spring Data JPA / JDBC, PostgreSQL, Flyway
- **프론트엔드**: React 19, TypeScript, Vite, React Router, Vitest
- **인프라**: Docker / Docker Compose, GitHub Actions (CI, Docker 빌드, Trivy 이미지 스캔)

> Redis 의존성(`spring-boot-starter-data-redis`)이 빌드에 들어 있지만 아직 실제로 쓰지 않습니다. Compose에 컨테이너가 없고 Actuator 헬스체크에서도 제외돼 있으며, 로그인 시도 제한은 인메모리로 동작합니다. 백엔드를 여러 인스턴스로 늘릴 때 Redis 도입이 선결 과제입니다.

## 주요 기능

| 모듈 | 설명 |
| --- | --- |
| `notice` | 공지사항 CRUD, 리치 텍스트(HTML) 콘텐츠, 첨부파일, 댓글, 조회수 |
| `work` | 잔업/특근 기록 관리, 기본 근무시간 설정, 엑셀(xlsx) 내보내기 |
| `vendor` | 업체 주소록, 여러 담당자 연락처, 관리자 분류 관리 |
| `calendar` | 캘린더 일정 관리 |
| `todo` | 할 일 목록 |
| `scenario` | 적재(패킹) 시나리오 계산 |
| `user` | 회원 계정, 권한(Role), 상태, 탈퇴 처리 |
| `admin` | 관리자 로그, 조회 로그, 보관 정책(retention) |
| `auth` / `security` | JWT 기반 인증, 로그인/검증 |

## 시작하기

### 사전 요구사항

- JDK 25 (LTS)
- Node.js (프론트엔드 빌드용)
- Docker / Docker Compose (권장)

### 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 DB 접속 정보, 32자 이상의 JWT 시크릿, 관리자 초기 계정 등을 채워주세요. `.env` 파일은 Git에 커밋하지 않습니다. 운영 환경에서는 `ADMIN_BOOTSTRAP_ENABLED=true`을 최초 기동 때만 사용하고, 계정 생성 뒤에는 `false`로 바꾸세요.

비밀번호를 잊은 사용자는 관리자 화면에서 초기화합니다. 관리자 → 사용자 목록 → **비밀번호 초기화**를 누르면 임시 비밀번호가 한 번 표시되며, 그 계정의 기존 로그인은 모두 해제됩니다. 임시 비밀번호는 다시 볼 수 없으므로 그 자리에서 본인에게 전달하세요.

#### 시크릿이 코드에 들어가지 않게 하기

실제 시크릿은 전부 `.env`에서 옵니다. `.env`는 `.gitignore`에 있고 저장소에 커밋되지 않습니다. `.env.example`은 값이 비어 있는 **양식**이므로, 채운 실제 값을 이 파일에 복사하지 마세요.

테스트에 실제처럼 보이는 값이 필요하면 재사용되는 상수에 두세요.

- 백엔드 JWT 서명 키: `src/test/java/com/hamsetech/hamsetech/TestJwtSecrets.java`
- 프론트 비밀번호: 각 `*.test.tsx` 파일 안의 상수

이렇게 하면 시크릿 스캐너(GitGuardian 등)가 실제 키로 오인하는 일이 줄어듭니다. 다만 **스캐너는 값의 형태만 보고 "테스트 중"이라는 사실을 알 수 없으므로**, 이러한 값이 있다는 사실 자체를 대시보드에서 **false positive로 마킹**해야 경고가 사라집니다. 마킹할 주장은 "Test fixture value — production secret comes from `JWT_SECRET` env var, never committed" 입니다.

한 가지 주의할 것은, 서로 다른 테스트가 같은 문자열을 각자 상수로 복사해 두면 스캐너는 "한 키를 두 코드가 공유"한 것처럼 봅니다. 같은 값이 두 곳에 필요하면 한 곳에 두고 import 하세요.

### 데이터베이스 스키마

스키마는 Flyway가 관리합니다. `src/main/resources/db/migration/` 아래의 `V*.sql`이
버전 순서대로 적용되고, 적용 이력은 `flyway_schema_history` 테이블에 남습니다.
Hibernate는 스키마를 건드리지 않고 엔티티와 맞는지 확인만 합니다(`ddl-auto=validate`).
어긋나면 기동이 멈추므로, 반쯤 마이그레이션된 채로 서비스가 뜨는 일이 없습니다.

- **기존 데이터베이스**: `baseline-on-migrate`가 켜져 있어 `V1__baseline.sql`은
  실행되지 않고 적용된 것으로 표시만 됩니다. V2부터 실제로 돕니다.
- **새 데이터베이스**: V1이 스키마를 만들고 이후 버전이 차례로 적용됩니다.

스키마를 바꿀 때는 **기존 파일을 고치지 말고** 새 번호의 파일을 더하세요.
이미 적용된 파일을 고치면 checksum이 어긋나 기동이 막힙니다.

운영에 처음 배포할 때, `ddl-auto=update`가 남긴 드리프트 때문에 `validate`가
걸릴 수 있습니다. 그럴 때는 `HIBERNATE_DDL_AUTO=none`으로 한 번 띄워 마이그레이션만
적용한 뒤, 로그에 찍힌 차이를 새 마이그레이션으로 정리하고 `validate`로 되돌리세요.

### Docker로 실행 (권장)

```bash
docker compose up --build
```

- 백엔드: http://localhost:8080
- 프론트엔드(Vite dev 서버, HMR): http://localhost:5173
- PostgreSQL: localhost:5432

프로덕션용 구성은 `docker-compose.prod.yml`을 사용합니다.

### NAS(Synology) 배포

DS218+ 같은 2GB 저사양 NAS에서는 `docker-compose.nas.yml` 오버레이를 반드시 함께
얹습니다. `prod` 단독은 메모리 한도 합계가 3.25GB라, 컨테이너 한도에 닿기 전에
호스트 OOM 킬러가 프로세스를 먼저 죽입니다.

**NAS에서는 빌드하지 않습니다.** 2코어/2GB에서 Gradle 컴파일과 Vite 번들링은
20~40분이 걸리고 중간에 죽습니다. 이미지는 PC에서 만들어 tar로 옮깁니다.

#### 공통 — PC에서 이미지 만들기

```bash
docker pull postgres:16-alpine
docker compose -f docker-compose.prod.yml -f docker-compose.nas.yml build
docker save -o hamsetech-nas.tar hamsetech-backend:nas hamsetech-frontend:nas postgres:16-alpine
```

`postgres:16-alpine`은 빌드 대상이 아니라서 미리 `pull` 해두어야 save에 들어갑니다.
NAS에 이미 같은 이미지가 있는 업데이트라면 인자에서 빼도 됩니다(tar가 200MB쯤 줄어듭니다).
`docker save -o`는 셸을 거치지 않으므로 Windows cmd/PowerShell에서도 그대로 동작합니다.

#### 첫 기동 (최초 1회)

1. `/volume1/docker/hamsetech/`에 네 개를 넣습니다 — `hamsetech-nas.tar`,
   `docker-compose.prod.yml`, `docker-compose.nas.yml`, `.env`.
   `.env`는 NAS용으로 새로 씁니다. 저장소의 개발용 기본값을 그대로 올리면 안 됩니다.
   `DB_PASSWORD`, `JWT_SECRET`(64자 이상), `ADMIN_PASSWORD`를 실제 값으로 채우고
   `FRONTEND_HOST_PORT=8080`, `ADMIN_BOOTSTRAP_ENABLED=true`를 둡니다.

2. SSH로 접속해 이미지를 적재하고, 태그가 다 들어왔는지 확인합니다.

```bash
cd /volume1/docker/hamsetech
sudo docker load -i hamsetech-nas.tar
sudo docker images | grep -E "hamsetech|postgres"
```

   세 줄이 다 보여야 합니다. 태그가 없으면 다음 단계가 NAS에서 빌드를 시작합니다.

3. 기동합니다.

```bash
sudo docker compose -f docker-compose.prod.yml -f docker-compose.nas.yml up -d --no-build
```

4. 로그로 기동을 확인합니다. J3355에서 `Started HamsetechApplication`까지 60~120초,
   Flyway가 스키마를 처음 만드는 기동은 그보다 더 걸립니다. frontend는 backend가
   healthy가 되어야 뜨므로 그전까지 접속이 안 되는 것이 정상입니다.

```bash
sudo docker compose -f docker-compose.prod.yml -f docker-compose.nas.yml logs -f backend
```

5. `http://<나스IP>:8080`으로 접속해 관리자로 로그인한 뒤, `.env`의
   `ADMIN_BOOTSTRAP_ENABLED`를 `false`로 내리고 backend를 재기동합니다.

#### 업데이트 기동 (2회차 이후)

컨테이너와 볼륨은 그대로 두고 이미지만 갈아끼웁니다. compose 프로젝트 이름이
`docker-compose.prod.yml`에 `name: hamsetech-prod`로 박혀 있어, 실행 디렉터리가
달라져도 기존 볼륨을 그대로 이어받습니다.

1. 새 tar를 `/volume1/docker/hamsetech/`에 덮어씁니다. compose 파일이나 `.env`가
   이번 배포에서 바뀌었다면 그것도 함께 갱신합니다.

2. DB를 백업합니다. 마이그레이션이 포함된 배포라면 특히 건너뛰지 마세요.

```bash
cd /volume1/docker/hamsetech
sudo docker exec hamsetech-postgres pg_dump -U hamsetech hamsetech | gzip > backup-$(date +%F).sql.gz
```

**외래 키를 걸고 있는 마이그레이션은 백업 전에 정합성을 먼저 확인하세요.**
`V4`(잔업 `user_id` 외래 키)는 `overtime_records`의 `user_id`가 실제 `users` 행을
가리키지 않는 행이 하나라도 있으면 **적용에 실패하고, Flyway + `ddl-auto=validate`
조합상 기동이 멈춥니다.** 아래가 0인 것을 확인한 뒤 올리세요.

```bash
sudo docker exec hamsetech-postgres psql -U hamsetech -d hamsetech -t -c \
  "SELECT count(*) FROM overtime_records o \
   LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL;"
```

3. 이미지를 적재합니다. 같은 태그가 이미 있으면 태그가 새 이미지로 옮겨가고 옛
   이미지는 태그 없이(dangling) 남습니다. 돌고 있는 컨테이너는 영향받지 않습니다.

```bash
sudo docker load -i hamsetech-nas.tar
```

4. 재기동합니다. 이미지가 바뀐 서비스만 재생성되고 볼륨은 유지됩니다.

```bash
sudo docker compose -f docker-compose.prod.yml -f docker-compose.nas.yml up -d --no-build
```

5. 상태를 확인한 뒤 옛 이미지를 정리합니다. `up -d` 전에 돌리면 실행 중인 컨테이너가
   붙들고 있어 지워지지 않으므로 순서를 지킵니다.

```bash
sudo docker compose -f docker-compose.prod.yml -f docker-compose.nas.yml ps
sudo docker image prune -f
```

#### 두 경로의 차이

| | 첫 기동 | 업데이트 기동 |
| --- | --- | --- |
| `.env` | NAS용으로 새로 작성 | 바뀐 값만 갱신 |
| `ADMIN_BOOTSTRAP_ENABLED` | `true`로 시작해 완료 후 `false` | `false` 유지 |
| DB 백업 | 불필요 (데이터 없음) | 필수 |
| Flyway | V1부터 전체 적용 | 새 버전만 적용 |
| 기동 시간 | 스키마 생성까지 2분 이상 | 대개 1~2분 |
| 옛 이미지 정리 | 불필요 | `docker image prune -f` |

DSM 버전이 낮아 `docker compose`가 없으면 `docker-compose`(v1)로 대체합니다. 단 v1에는
`--no-build`가 없고 `deploy:` 블록을 조용히 무시하므로, DSM 7.2의 Container Manager를
쓰는 편이 안전합니다.

### 로컬에서 직접 실행

**백엔드**

```bash
# 개발 전용 기본값을 사용
SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun
```

**프론트엔드**

```bash
cd frontend
npm install
npm run dev
```

## 빌드 & 테스트

```bash
# 백엔드
./gradlew build
./gradlew test

# 프론트엔드
cd frontend
npm run build
npm run lint
npm run test        # Vitest. 도메인 로직과 인증 가드
npm run test:watch  # 파일을 고치면 자동으로 다시 돌린다
```

프론트엔드 테스트는 두 갈래다. 하나는 도메인 로직 — `packing`(적재 알고리즘),
`homeLayout`(위젯 배치), `overtime`(서버 `OvertimeRecordService`의 미러),
`noticeHtml`, `api/client`(만료·권한 거부 분기). 다른 하나는 DOM을 그리는
최소한의 컴포넌트 — `routes/routeGuards`(인증·관리자 가드),
`components/NoticeHtmlView`(첨부 이미지 blob 처리와 링크 rel).

`overtime` 테스트의 기대값은 서버 `work/OvertimeRecordServiceTest`와 같은
입력을 쓴다. 휴게시간 상수를 한쪽만 고치면 양쪽 테스트가 같이 깨진다.

## 프로젝트 구조

```
src/main/java/com/hamsetech/hamsetech/
├── admin/      # 관리자 로그 및 조회 이력
├── api/        # 관리자용 API 엔드포인트
├── auth/       # 로그인/인증
├── calendar/   # 캘린더 일정
├── config/     # 보안·CORS 등 공통 설정
├── notice/     # 공지사항
├── scenario/   # 적재 시나리오
├── security/   # JWT 발급/검증
├── todo/       # 할 일 목록
├── user/       # 회원 계정
├── vendor/     # 업체 주소록 및 분류
└── work/       # 잔업/특근 기록

frontend/       # React + TypeScript + Vite 프론트엔드
docker/         # Docker 관련 부가 설정
```

## CI/CD

`.github/workflows/ci.yml`에서 빌드·테스트를, `docker-build.yml`에서 Docker 이미지 빌드를 수행합니다.
