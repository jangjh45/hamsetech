# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Dev (Vite 개발 서버, HMR 지원)
# ─────────────────────────────────────────────
FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

# 소스는 볼륨으로 마운트됨 (docker-compose에서 처리)
EXPOSE 5173

CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────
# Stage 3: Prod (Nginx 정적 서빙)
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS prod

# 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
