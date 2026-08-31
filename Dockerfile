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
# bootJar만 부르므로 build/libs에 산출물이 하나뿐이라 glob이 안전하다.
# build/assemble로 바꾸면 -plain.jar이 같이 생겨 cp가 깨진다.
#
# extract --layers는 fat jar을 의존성/로더/스냅샷/애플리케이션 레이어로 쪼갠다.
# 통짜 jar을 그대로 COPY하면 코드 한 줄만 고쳐도 ~50MB 레이어가 전부 무효화된다.
# 결과는 loader가 없는 평범한 jar이다: app.jar(Main-Class + Class-Path: lib/*)와
# 의존성이 든 lib/. 그래서 실행은 JarLauncher가 아니라 java -jar app.jar이다.
RUN ./gradlew bootJar --no-daemon -x test \
 && cp build/libs/*.jar /app/app.jar \
 && java -Djarmode=tools -jar /app/app.jar extract --layers --destination /app/extracted

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

COPY docker/backend-dev-entrypoint.sh ./docker/backend-dev-entrypoint.sh
RUN chmod +x ./docker/backend-dev-entrypoint.sh

EXPOSE 8080

# 소스는 docker-compose 볼륨으로 마운트됨
# 백그라운드에서 주기적으로 재컴파일하고, DevTools가 변경된 클래스를 감지해 자동 재시작
ENTRYPOINT ["./docker/backend-dev-entrypoint.sh"]

# ─────────────────────────────────────────────
# Stage 3: Prod (최적화된 경량 이미지)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS prod

WORKDIR /app

# 업로드 디렉터리를 root 권한일 때 미리 만들고 소유권을 넘긴다.
# 도커는 이미지에 이미 있는 경로에 볼륨을 처음 붙일 때만 그 소유권을 볼륨에 복사한다.
# 이 mkdir/chown 없이 볼륨을 붙이면 볼륨이 root 소유로 만들어져,
# 비root(spring)로 뜬 앱이 파일을 쓰지 못한다.
RUN addgroup -S spring && adduser -S spring -G spring \
 && mkdir -p /app/uploads \
 && chown -R spring:spring /app/uploads

# 변경 빈도가 낮은 순서로 복사해야 레이어 캐시가 산다.
# dependencies는 build.gradle이 바뀔 때만, application은 코드가 바뀔 때마다 갱신된다.
COPY --from=builder --chown=spring:spring /app/extracted/dependencies/ ./
COPY --from=builder --chown=spring:spring /app/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=spring:spring /app/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=spring:spring /app/extracted/application/ ./

# COPY 뒤에 둬야 위 파일들이 spring 소유로 들어온다
USER spring

EXPOSE 8080

# MaxRAMPercentage는 compose의 메모리 한도(deploy.resources.limits)와 한 쌍이다.
# 한도가 없으면 호스트 전체 RAM의 75%를 잡는다.
# ExitOnOutOfMemoryError: 힙이 마르면 좀비로 버티지 말고 죽어야 restart: always가 살린다.
# UseContainerSupport는 JDK 10부터 기본값이라 적지 않는다.
ENTRYPOINT ["java", \
  "-Dspring.profiles.active=prod", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "app.jar"]
