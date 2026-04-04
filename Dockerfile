# Stage 1: сборка фронтенда
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: сборка бэкенда
FROM golang:1.21-alpine AS backend-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY backend/ ./backend/
RUN CGO_ENABLED=0 go build -o /backend ./backend

# Stage 3: образ рантайма (бэкенд + статика фронта)
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend-build /backend .
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["./backend"]
