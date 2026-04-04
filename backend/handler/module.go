package handler

import (
	"net/http"

	"log/slog"

	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
	"hackpet/backend/store"

	"github.com/go-chi/chi/v5"
)

type ModuleHandler struct {
	Log      *slog.Logger
	Module   *service.ModuleService
	Progress *service.ProgressService
}

func (h *ModuleHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromRequest(r)
	list, err := h.Module.List(userID)
	if err != nil {
		h.Log.Error("module list", "error", err)
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, list)
}

func (h *ModuleHandler) Get(w http.ResponseWriter, r *http.Request) {
	moduleId := chi.URLParam(r, "moduleId")
	if moduleId == "" {
		response.Error(w, http.StatusBadRequest, "moduleId required")
		return
	}
	userID := UserIDFromRequest(r)
	m, prog, err := h.Module.GetWithProgress(moduleId, userID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if prog == nil {
		prog = &store.ModuleProgress{}
	}
	quizStats := map[string]map[string]int{}
	// Агрегированная статистика по квизам (по сохранённым ответам в БД).
	if userID != "" && h.Progress != nil {
		if m.CheckpointQuiz.ID != "" {
			if correct, total, err := h.Progress.GetQuizStats(userID, m.CheckpointQuiz.ID); err == nil && total > 0 {
				quizStats["checkpoint"] = map[string]int{"correct": correct, "total": total}
			}
		}
		if m.FinalQuiz.ID != "" {
			if correct, total, err := h.Progress.GetQuizStats(userID, m.FinalQuiz.ID); err == nil && total > 0 {
				quizStats["final"] = map[string]int{"correct": correct, "total": total}
			}
		}
	}
	out := map[string]interface{}{
		"id":               m.ID,
		"title":            m.Title,
		"difficulty":       m.Difficulty,
		"minutes":          m.Minutes,
		"topic":            m.Topic,
		"steps":            m.Steps,
		"theory":           m.Theory,
		"checkpoint_quiz":  m.CheckpointQuiz,
		"lab":              m.Lab,
		"fix_explanation":  m.FixExplanation,
		"final_quiz":       m.FinalQuiz,
		"progress":         prog,
		"quiz_stats":       quizStats,
	}
	if userID != "" && h.Progress != nil {
		if status, ruleResults, err := h.Progress.GetLastLabAttempt(userID, moduleId); err == nil && (status != "" || len(ruleResults) > 0) {
			out["last_lab_attempt"] = map[string]interface{}{
				"status":       status,
				"rule_results": ruleResults,
			}
		}
	}
	response.JSON(w, http.StatusOK, out)
}
