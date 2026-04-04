package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"log/slog"

	"hackpet/backend/pkg/certificate"
	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
	"hackpet/backend/store"

	"github.com/go-chi/chi/v5"
)

type CourseHandler struct {
	Log       *slog.Logger
	Course    *service.CourseService
	Progress  *service.ProgressService
	UserStore store.UserStore
}

func (h *CourseHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromRequest(r)
	list, err := h.Course.List(userID)
	if err != nil {
		h.Log.Error("course list", "error", err)
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, list)
}

func (h *CourseHandler) Get(w http.ResponseWriter, r *http.Request) {
	courseId := chi.URLParam(r, "courseId")
	if courseId == "" {
		response.Error(w, http.StatusBadRequest, "courseId required")
		return
	}
	userID := UserIDFromRequest(r)
	c, err := h.Course.GetByID(courseId, userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *CourseHandler) Certificate(w http.ResponseWriter, r *http.Request) {
	courseId := chi.URLParam(r, "courseId")
	if courseId == "" {
		response.Error(w, http.StatusBadRequest, "courseId required")
		return
	}
	userID := UserIDFromRequest(r)
	c, err := h.Course.GetByID(courseId, userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	// Курс считается завершённым только если выполнены все требования (включая CTF, если он есть).
	if !c.Completed {
		response.Error(w, http.StatusForbidden, "course not completed")
		return
	}

	// Для анонимного контекста сертификат не выдаём.
	if userID == "" {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Собираем ФИО слушателя (если есть авторизованный пользователь и UserStore).
	studentName := ""
	if userID != "" && h.UserStore != nil {
		if u, err := h.UserStore.GetByID(userID); err == nil && u != nil {
			parts := []string{}
			if strings.TrimSpace(u.LastName) != "" {
				parts = append(parts, strings.TrimSpace(u.LastName))
			}
			if strings.TrimSpace(u.FirstName) != "" {
				parts = append(parts, strings.TrimSpace(u.FirstName))
			}
			if strings.TrimSpace(u.Patronymic) != "" {
				parts = append(parts, strings.TrimSpace(u.Patronymic))
			}
			studentName = strings.TrimSpace(strings.Join(parts, " "))
			if studentName == "" {
				studentName = strings.TrimSpace(u.Nickname)
			}
		}
	}

	date := time.Now().Format("02.01.2006")
	pdfBytes, err := certificate.Generate(c.Title, date, studentName)
	if err != nil {
		h.Log.Warn("certificate PDF generation failed, serving HTML fallback", "error", err)
		serveCertificateHTML(w, courseId, c.Title, studentName, date)
		return
	}

	filename := fmt.Sprintf("Hackpet-%s-certificate.pdf", courseId)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	_, _ = w.Write(pdfBytes)
}

func (h *CourseHandler) SubmitCTF(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	courseId := chi.URLParam(r, "courseId")
	if courseId == "" {
		response.Error(w, http.StatusBadRequest, "courseId required")
		return
	}
	course, err := h.Course.GetByID(courseId, u.ID)
	if err != nil || course == nil {
		response.Error(w, http.StatusNotFound, "course not found")
		return
	}
	if course.CTF == nil {
		response.Error(w, http.StatusBadRequest, "CTF-челлендж не настроен для этого курса")
		return
	}
	if course.CTF.Locked {
		// Повторная загрузка на случай гонки: прогресс последнего модуля только что сохранился
		if fresh, err := h.Course.GetByID(courseId, u.ID); err == nil && fresh != nil && fresh.CTF != nil && !fresh.CTF.Locked {
			course = fresh
		} else {
			response.Error(w, http.StatusForbidden, "сначала пройдите все модули курса")
			return
		}
	}
	if h.Progress == nil {
		response.Error(w, http.StatusInternalServerError, "progress service unavailable")
		return
	}

	var req struct {
		Flag string `json:"flag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Flag = strings.TrimSpace(req.Flag)
	if req.Flag == "" {
		response.Error(w, http.StatusBadRequest, "введите флаг")
		return
	}

	ok, err := h.Course.VerifyCTFFlag(courseId, req.Flag)
	if err != nil {
		h.Log.Error("verify ctf flag", "courseId", courseId, "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to verify flag")
		return
	}
	if !ok {
		response.Error(w, http.StatusBadRequest, "неверный флаг")
		return
	}

	if err := h.Progress.Update(u.ID, course.CTF.ID, "summary", true, false); err != nil {
		h.Log.Error("save ctf progress", "courseId", courseId, "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to save CTF progress")
		return
	}

	updatedCourse, err := h.Course.GetByID(courseId, u.ID)
	if err != nil || updatedCourse == nil {
		response.Error(w, http.StatusInternalServerError, "failed to reload course")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "CTF-челлендж пройден",
		"course":  updatedCourse,
	})
}

func serveCertificateHTML(w http.ResponseWriter, courseId, title, studentName, date string) {
	filename := fmt.Sprintf("Hackpet-%s-certificate.html", courseId)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Сертификат Hackpet</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f3f4ff; margin: 0; padding: 40px; }
    .cert-wrap { max-width: 800px; margin: 0 auto; padding: 40px 48px; border-radius: 16px; border: 2px solid #a5b4fc; background: #fff; }
    .cert-title { font-size: 26px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .cert-body { font-size: 16px; line-height: 1.6; color: #111827; margin-top: 24px; }
    .cert-name { font-size: 18px; margin: 12px 0 4px; font-weight: 600; }
    .cert-course { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
    .cert-footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 14px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="cert-wrap">
    <h1 class="cert-title">Сертификат о прохождении курса</h1>
    <div class="cert-body">
      <p>Настоящим подтверждается, что%s</p>
      %s
      <p>успешно прошёл курс:</p>
      <p class="cert-course">%s</p>
      <p>Дата выдачи: %s. Hackpet.</p>
    </div>
    <div class="cert-footer"><span>Дата: %s</span><span>Hackpet</span></div>
  </div>
</body>
</html>
`, formatNameIntro(studentName), formatNameBlock(studentName), title, date, date)
	_, _ = w.Write([]byte(body))
}

func formatNameIntro(name string) string {
	if strings.TrimSpace(name) == "" {
		return " курс"
	}
	return ""
}

func formatNameBlock(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	return fmt.Sprintf(`<p class="cert-name">%s</p>`, name)
}
