package handler

import (
	"encoding/json"
	"net/http"

	"log/slog"

	"hackpet/backend/pkg/response"
	"hackpet/backend/service"

	"github.com/go-chi/chi/v5"
)

type ProgressHandler struct {
	Log     *slog.Logger
	Progress *service.ProgressService
}

func (h *ProgressHandler) Update(w http.ResponseWriter, r *http.Request) {
	moduleId := chi.URLParam(r, "moduleId")
	if moduleId == "" {
		response.Error(w, http.StatusBadRequest, "moduleId required")
		return
	}
	var req struct {
		LastStep  string `json:"last_step"`
		Completed bool   `json:"completed"`
		Reset     bool   `json:"reset"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	userID := UserIDFromRequest(r)
	if err := h.Progress.Update(userID, moduleId, req.LastStep, req.Completed, req.Reset); err != nil {
		h.Log.Error("progress update", "module_id", moduleId, "error", err)
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ProgressHandler) Telemetry(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ModuleID string                 `json:"module_id"`
		Step     string                 `json:"step"`
		Payload  map[string]interface{} `json:"payload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.NoContent(w)
		return
	}
	userID := UserIDFromRequest(r)
	_ = h.Progress.RecordTelemetry(userID, req.ModuleID, req.Step, req.Payload)
	response.NoContent(w)
}

func (h *ProgressHandler) QuizAnswer(w http.ResponseWriter, r *http.Request) {
	quizId := chi.URLParam(r, "quizId")
	if quizId == "" {
		response.Error(w, http.StatusBadRequest, "quizId required")
		return
	}
	var req struct {
		QuestionID string `json:"question_id"`
		Answer     int    `json:"answer"`
		Correct    bool   `json:"correct"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.NoContent(w)
		return
	}
	userID := UserIDFromRequest(r)
	_ = h.Progress.RecordQuizAnswer(userID, quizId, req.QuestionID, req.Answer, req.Correct)
	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
