package api

import (
	"fmt"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"log/slog"

	"hackpet/backend/handler"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// CTF-стенд: библиотечный каталог. Книги — статичный список, строка «По запросу «…»» отражает q без экранирования (XSS).
var ctfStandBooks = []struct{ Title, Author, Description string }{
	{"Введение в Python", "Марк Лутц", "Классическое руководство по языку Python: синтаксис, типы данных, ООП и стандартная библиотека."},
	{"Безопасность веб-приложений", "Дэф Стоун", "Обзор уязвимостей веб-приложений и способов защиты: OWASP Top 10, безопасная разработка."},
	{"SQL и реляционные базы данных", "Мартин Клеппман", "Основы реляционных СУБД, транзакции, индексы и проектирование схемы."},
	{"Чистый код", "Роберт Мартин", "Практики написания читаемого и поддерживаемого кода: именование, функции, рефакторинг."},
	{"Современный JavaScript", "Николас Закас", "ES6+, асинхронность, модули и типичные паттерны фронтенд-разработки."},
	{"Защита от SQL-инъекций", "Джастин Кларк", "Причины SQLi, параметризованные запросы, ORM и аудит кода на уязвимости."},
	{"Ошибки и логирование в приложениях", "Леннарт Поттеринг", "Структурированные логи, уровни логирования и безопасная обработка ошибок без утечек данных."},
	{"XSS и защита фронтенда", "Крис Вебер", "Reflected, stored и DOM-based XSS; экранирование, CSP и безопасный вывод данных."},
	{"DevSecOps: практика", "Джулиан Элви", "Встраивание безопасности в CI/CD, автоматизированное тестирование и безопасная поставка."},
	{"Путь программиста", "Джон Сонмез", "Карьера в разработке: резюме, собеседования, переговоры и продуктивность."},
}

const ctfStandHTMLTop = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Каталог — Библиотека учебного центра</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; background: #f5f0e8; color: #2c2416; }
    .header { padding-bottom: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #8b7355; }
    .header h1 { margin: 0; font-size: 1.5rem; font-weight: 600; color: #4a3728; }
    .header p { margin: 0.35rem 0 0; font-size: 0.9rem; color: #5c5244; }
    form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    input[type="text"] { flex: 1; padding: 0.6rem 0.75rem; border: 1px solid #b8a88a; border-radius: 4px; font-size: 1rem; background: #fff; }
    button[type="submit"] { padding: 0.6rem 1.25rem; background: #6b5344; color: #f5f0e8; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button[type="submit"]:hover { background: #5a4538; }
    .results { background: #fff; border: 1px solid #d4c4a8; border-radius: 4px; padding: 1.25rem; }
    .results-head { font-size: 0.95rem; color: #5c5244; margin-bottom: 1rem; }
    .book { padding: 0.6rem 0; border-bottom: 1px solid #ebe5dc; font-size: 0.95rem; }
    .book:last-child { border-bottom: none; }
    .book-title { font-weight: 600; color: #4a3728; }
    .book-title a { color: inherit; text-decoration: none; }
    .book-title a:hover { text-decoration: underline; }
    .book-author { font-size: 0.85rem; color: #6b5b4f; margin-top: 0.15rem; }
    .no-results { color: #8b7355; font-style: italic; }
    .back-link { display: inline-block; margin-bottom: 1rem; font-size: 0.9rem; color: #6b5344; }
    .back-link:hover { text-decoration: underline; }
    .detail-desc { margin-top: 1rem; line-height: 1.5; color: #4a3728; }
    footer { margin-top: 2rem; font-size: 0.8rem; color: #8b7355; }
  </style>
</head>
<body>
  <div id="secret-flag" style="display:none">HACKPET{python_xss_dom_flag}</div>
  <header class="header">
    <h1>Библиотека учебного центра</h1>
    <p>Поиск по каталогу: название книги или фамилия автора.</p>
  </header>
  <form method="get" action="">
    <input type="text" name="q" placeholder="Например: Python, безопасность, SQL…" value="`

const ctfStandHTMLFormEnd = `" autocomplete="off">
    <button type="submit">Искать</button>
  </form>
  <div class="results">`

const ctfStandHTMLEnd = `</div>
  <footer>Библиотека учебного центра</footer>
</body>
</html>`

// RouterConfig передаёт хендлеры и логгер для сборки роутера.
type RouterConfig struct {
	Log        *slog.Logger
	Auth       *handler.AuthHandler
	Course     *handler.CourseHandler
	Module     *handler.ModuleHandler
	Progress   *handler.ProgressHandler
	Lab        *handler.LabHandler
	Pet        *handler.PetHandler
	Focus      *handler.FocusHandler
	Best       *handler.BestPracticeHandler
	Play       *handler.PlayHandler
	UploadsDir string
}

func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)
	r.Use(requestLogger(cfg.Log))
	if cfg.Auth != nil && cfg.Auth.JWTSecret != "" {
		r.Use(AuthMiddleware(cfg.Auth.JWTSecret))
	}

	// API: авторизация
	if cfg.Auth != nil {
		r.Post("/api/auth/register", cfg.Auth.Register)
		r.Post("/api/auth/login", cfg.Auth.Login)
		r.Get("/api/auth/me", cfg.Auth.Me)
		r.With(RequireAuth).Post("/api/auth/profile", cfg.Auth.UpdateProfile)
		r.With(RequireAuth).Post("/api/auth/avatar", cfg.Auth.UploadAvatar)
	}

	// API: питомец (только для аутентифицированных пользователей)
	if cfg.Pet != nil {
		r.Group(func(r chi.Router) {
			r.With(RequireAuth).Get("/api/pet", cfg.Pet.Get)
			r.With(RequireAuth).Post("/api/pet/name", cfg.Pet.UpdateName)
			r.With(RequireAuth).Post("/api/pet/aura", cfg.Pet.UpdateAura)
		})
	}

	// API: рекомендации "Фокус на сегодня" (персональные, только для auth-пользователей)
	if cfg.Focus != nil {
		r.With(RequireAuth).Get("/api/focus", cfg.Focus.List)
	}
	if cfg.Best != nil {
		r.With(RequireAuth).Get("/api/best-practices", cfg.Best.List)
	}
	if cfg.Play != nil {
		r.With(RequireAuth).Get("/api/play/v1/round", cfg.Play.Round)
	}

	// API: курсы
	r.Route("/api/courses", func(r chi.Router) {
		r.Get("/", cfg.Course.List)
		r.Get("/{courseId}", cfg.Course.Get)
		r.With(RequireAuth).Get("/{courseId}/certificate", cfg.Course.Certificate)
		r.With(RequireAuth).Post("/{courseId}/ctf/submit", cfg.Course.SubmitCTF)
	})

	// API: модули
	r.Route("/api/modules", func(r chi.Router) {
		r.Get("/", cfg.Module.List)
		r.Get("/{moduleId}", cfg.Module.Get)
		r.With(RequireAuth).Post("/{moduleId}/progress", cfg.Progress.Update)
	})

	// API: лабы, телеметрия, квизы
	r.With(RequireAuth).Post("/api/labs/{labId}/submit", cfg.Lab.Submit)
	r.With(RequireAuth).Post("/api/telemetry", cfg.Progress.Telemetry)
	r.With(RequireAuth).Post("/api/quizzes/{quizId}/answer", cfg.Progress.QuizAnswer)

	// Статическая раздача загруженных пользовательских файлов (например, аватары).
	if cfg.UploadsDir != "" {
		uploadsFS := http.StripPrefix("/api/uploads/", http.FileServer(http.Dir(cfg.UploadsDir)))
		r.Handle("/api/uploads/*", uploadsFS)
	}

	// CTF-стенд: каталог библиотеки. Строка «По запросу «…»» отражает q без экранирования (отражённый XSS).
	r.Get("/ctf-stand", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		bookParam := r.URL.Query().Get("book")
		if bookParam != "" {
			var idx int
			if _, err := fmt.Sscanf(bookParam, "%d", &idx); err == nil && idx >= 0 && idx < len(ctfStandBooks) {
				b := ctfStandBooks[idx]
				detail := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>%s</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:2rem 1.5rem;background:#f5f0e8;color:#2c2416;}
.back-link{color:#6b5344;text-decoration:none;font-size:0.9rem;}.back-link:hover{text-decoration:underline;}
h1{font-size:1.35rem;color:#4a3728;} .author{color:#6b5b4f;margin-top:0.25rem;}
.detail-desc{margin-top:1.25rem;line-height:1.6;}</style></head>
<body><a class="back-link" href="/ctf-stand">← К каталогу</a>
<h1>%s</h1><div class="author">%s</div><p class="detail-desc">%s</p></body></html>`,
					html.EscapeString(b.Title), html.EscapeString(b.Title), html.EscapeString(b.Author), html.EscapeString(b.Description))
				w.Write([]byte(detail))
				return
			}
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		qLower := strings.ToLower(q)
		var matches []struct{ Idx int; Title, Author string }
		for i, b := range ctfStandBooks {
			if q == "" || strings.Contains(strings.ToLower(b.Title), qLower) || strings.Contains(strings.ToLower(b.Author), qLower) {
				matches = append(matches, struct{ Idx int; Title, Author string }{Idx: i, Title: b.Title, Author: b.Author})
			}
		}
		w.Write([]byte(ctfStandHTMLTop))
		w.Write([]byte(html.EscapeString(q)))
		w.Write([]byte(ctfStandHTMLFormEnd))
		w.Write([]byte(`<div style="display:none">`))
		w.Write([]byte(q)) // намеренно без экранирования — уязвимость (скрипт выполнится, флаг уже в DOM выше)
		w.Write([]byte(`</div>`))
		for _, m := range matches {
			w.Write([]byte(fmt.Sprintf(`<div class="book"><div class="book-title"><a href="/ctf-stand?book=%d">`, m.Idx)))
			w.Write([]byte(html.EscapeString(m.Title)))
			w.Write([]byte(`</a></div><div class="book-author">`))
			w.Write([]byte(html.EscapeString(m.Author)))
			w.Write([]byte(`</div></div>`))
		}
		w.Write([]byte(ctfStandHTMLEnd))
	})

	// SPA: раздача frontend/dist или static
	distDir := "frontend/dist"
	if _, err := os.Stat(distDir); err != nil {
		distDir = "static"
	}
	fs := http.FileServer(http.Dir(distDir))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" || path == "index.html" {
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
			return
		}
		fullPath := filepath.Join(distDir, path)
		if _, err := os.Stat(fullPath); err == nil {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
	})
	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requestLogger(log *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.Info("request", "method", r.Method, "path", r.URL.Path)
			next.ServeHTTP(w, r)
		})
	}
}
