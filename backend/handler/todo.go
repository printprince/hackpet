package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"log/slog"

	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"

	"github.com/go-chi/chi/v5"
)

type TodoHandler struct {
	Log  *slog.Logger
	Todo *service.TodoService
}

func normalizeText(s string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func tooManyWords(s string, max int) bool {
	if s == "" {
		return false
	}
	return len(strings.Fields(s)) > max
}

func (h *TodoHandler) List(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	limit := 30
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	list, err := h.Todo.List(u.ID, limit)
	if err != nil {
		h.Log.Error("list user todos", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to load todos")
		return
	}
	response.JSON(w, http.StatusOK, list)
}

func (h *TodoHandler) Create(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Priority    int    `json:"priority"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	title := normalizeText(req.Title)
	description := normalizeText(req.Description)
	if req.Priority < 1 || req.Priority > 3 {
		req.Priority = 2
	}
	if title == "" {
		response.Error(w, http.StatusBadRequest, "заголовок задачи обязателен")
		return
	}
	if utf8.RuneCountInString(title) > 90 || tooManyWords(title, 14) {
		response.Error(w, http.StatusBadRequest, "заголовок слишком длинный")
		return
	}
	if utf8.RuneCountInString(description) > 220 || tooManyWords(description, 40) {
		response.Error(w, http.StatusBadRequest, "описание слишком длинное")
		return
	}
	item, err := h.Todo.Create(u.ID, title, description, req.Priority)
	if err != nil {
		h.Log.Error("create todo", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to create todo")
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *TodoHandler) Update(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	todoID := chi.URLParam(r, "todoId")
	if strings.TrimSpace(todoID) == "" {
		response.Error(w, http.StatusBadRequest, "todoId required")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Priority    int    `json:"priority"`
		Done        bool   `json:"done"`
		Position    int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	title := normalizeText(req.Title)
	description := normalizeText(req.Description)
	if req.Priority < 1 || req.Priority > 3 {
		req.Priority = 2
	}
	if title == "" {
		response.Error(w, http.StatusBadRequest, "заголовок задачи обязателен")
		return
	}
	if utf8.RuneCountInString(title) > 90 || tooManyWords(title, 14) {
		response.Error(w, http.StatusBadRequest, "заголовок слишком длинный")
		return
	}
	if utf8.RuneCountInString(description) > 220 || tooManyWords(description, 40) {
		response.Error(w, http.StatusBadRequest, "описание слишком длинное")
		return
	}
	item, err := h.Todo.Update(u.ID, todoID, title, description, req.Priority, req.Done, req.Position)
	if err != nil {
		h.Log.Error("update todo", "error", err, "user_id", u.ID, "todo_id", todoID)
		response.Error(w, http.StatusInternalServerError, "failed to update todo")
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *TodoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	todoID := chi.URLParam(r, "todoId")
	if strings.TrimSpace(todoID) == "" {
		response.Error(w, http.StatusBadRequest, "todoId required")
		return
	}
	if err := h.Todo.Delete(u.ID, todoID); err != nil {
		h.Log.Error("delete todo", "error", err, "user_id", u.ID, "todo_id", todoID)
		response.Error(w, http.StatusInternalServerError, "failed to delete todo")
		return
	}
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
