# ─────────────────────────────────────────────
# Stage 1: Build (Gradle + Java 21)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Gradle Wrapper & 의존성 캐시 레이어
COPY gradlew .
COPY gradle ./gradle
RUN chmod +x gradlew

COPY build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon || true

# 소스 복사 및 빌드
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ─────────────────────────────────────────────
# Stage 2: Dev (Gradle bootRun + DevTools 자동 재시작)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS dev

WORKDIR /app

# Gradle 캐시를 위해 의존성 파일만 먼저 복사
COPY gradlew .
COPY gradle ./gradle
RUN chmod +x gradlew

COPY build.gradle settings.gradle ./
# 의존성 미리 다운로드 (이미지 레이어 캐시)
RUN ./gradlew dependencies --no-daemon -q || true

EXPOSE 8080

# 소스는 docker-compose 볼륨으로 마운트됨
# bootRun이 DevTools와 함께 파일 변경을 감지하여 자동 재시작
ENTRYPOINT ["./gradlew", "bootRun", \
  "--no-daemon", \
  "-Pspring.profiles.active=dev"]

# ─────────────────────────────────────────────
# Stage 3: Prod (최적화된 경량 이미지)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS prod

WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring
USER spring

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
  "-Dspring.profiles.active=prod", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
