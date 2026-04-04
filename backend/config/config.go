package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config описывает базовые настройки backend-сервиса.
// Значения берутся из переменных окружения с разумными дефолтами.
type Config struct {
	Addr        string // адрес HTTP-сервера, например ":8080"
	DataPath    string // путь к данным модулей/курсов (пока файловое хранилище)
	UploadsPath string // путь к загружаемым пользовательским файлам
	DBDSN       string // строка подключения к Postgres (пока может быть пустой)
	JWTSecret   string // секрет для подписи JWT-токенов
	Env         string // окружение: dev / prod / test
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// loadDotEnv загружает переменные из .env-файла, если он существует.
// Значения из уже установленных переменных окружения НЕ перезаписываются.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if key == "" {
			continue
		}
		// убираем кавычки вокруг значения, если есть
		if len(val) >= 2 {
			if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
				(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
				val = val[1 : len(val)-1]
			}
		}
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

// Load загружает конфигурацию из окружения.
//
// PORT       — порт HTTP-сервера (по умолчанию 8080)
// DATA_PATH  — путь к данным модулей (по умолчанию "data/modules")
// UPLOADS_PATH — путь к пользовательским загрузкам (по умолчанию "uploads")
// DB_DSN     — DSN Postgres (на будущее, может быть пустым)
// JWT_SECRET — секрет для JWT (на будущее, может быть пустым)
// APP_ENV    — имя окружения: dev / prod / test (по умолчанию dev)
func Load() Config {
	// В dev-окружении пытаемся автоматически загрузить .env из корня проекта.
	// Если файл отсутствует — просто игнорируем.
	loadDotEnv(".env")

	env := getenv("APP_ENV", "dev")
	port := getenv("PORT", "8080")

	return Config{
		Addr:        fmt.Sprintf(":%s", port),
		DataPath:    getenv("DATA_PATH", "data/modules"),
		UploadsPath: getenv("UPLOADS_PATH", "uploads"),
		DBDSN:       os.Getenv("DB_DSN"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		Env:         env,
	}
}
