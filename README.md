# hamsetech

사내용 업무 관리 웹 애플리케이션. 공지사항, 잔업/특근(초과근무) 기록, 일정 관리, 할 일 목록, 적재 시나리오 계산 등 사내 운영에 필요한 기능을 하나의 서비스로 제공합니다.

## 기술 스택

- **백엔드**: Java 21, Spring Boot 3.5, Spring Security (JWT + OAuth2 Client), Spring Data JPA / JDBC, MyBatis, PostgreSQL, Redis
- **프론트엔드**: React 19, TypeScript, Vite, React Router
- **인프라**: Docker / Docker Compose, GitHub Actions (CI, Docker 빌드)

## 주요 기능

| 모듈 | 설명 |
| --- | --- |
| `notice` | 공지사항 CRUD, 리치 텍스트(HTML) 콘텐츠, 첨부파일, 댓글, 조회수 |
| `work` | 잔업/특근 기록 관리, 기본 근무시간 설정, 엑셀(xlsx) 내보내기 |
| `calendar` | 캘린더 일정 관리 |
| `todo` | 할 일 목록 |
| `scenario` | 적재(패킹) 시나리오 계산 |
| `user` | 회원 계정, 권한(Role), 상태, 탈퇴 처리 |
| `admin` | 관리자 로그, 조회 로그, 보관 정책(retention) |
| `auth` / `security` | JWT 기반 인증, 로그인/검증 |

## 시작하기

### 사전 요구사항

- JDK 21
- Node.js (프론트엔드 빌드용)
- Docker / Docker Compose (권장)

### 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 DB 접속 정보, 32자 이상의 JWT 시크릿, 관리자 초기 계정 등을 채워주세요. `.env` 파일은 Git에 커밋하지 않습니다. 운영 환경에서는 `ADMIN_BOOTSTRAP_ENABLED=true`을 최초 기동 때만 사용하고, 계정 생성 뒤에는 `false`로 바꾸세요.

### Docker로 실행 (권장)

```bash
docker compose up --build
```

- 백엔드: http://localhost:8080
- 프론트엔드(Vite dev 서버, HMR): http://localhost:5173
- PostgreSQL: localhost:5432

프로덕션용 구성은 `docker-compose.prod.yml`을 사용합니다.

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
```

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
└── work/       # 잔업/특근 기록

frontend/       # React + TypeScript + Vite 프론트엔드
docker/         # Docker 관련 부가 설정
```

## CI/CD

`.github/workflows/ci.yml`에서 빌드·테스트를, `docker-build.yml`에서 Docker 이미지 빌드를 수행합니다.
