package logger

import (
	"log/slog"
	"os"
)

// New создаёт *slog.Logger с уровнем по env (APP_ENV).
// В dev — LevelDebug, иначе LevelInfo. Переопределить уровень можно через LOG_LEVEL=debug|info|warn|error.
func New(env string) *slog.Logger {
	level := slog.LevelInfo
	if env == "dev" || env == "test" {
		level = slog.LevelDebug
	}
	if lvl := os.Getenv("LOG_LEVEL"); lvl != "" {
		switch lvl {
		case "debug":
			level = slog.LevelDebug
		case "info":
			level = slog.LevelInfo
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		}
	}
	opts := &slog.HandlerOptions{Level: level}
	var handler slog.Handler = slog.NewJSONHandler(os.Stdout, opts)
	if env == "dev" {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}
