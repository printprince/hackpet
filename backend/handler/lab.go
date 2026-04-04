package handler

import (
	"encoding/json"
	"net/http"

	"log/slog"

	"hackpet/backend/pkg/response"
	"hackpet/backend/service"

	"github.com/go-chi/chi/v5"
)

type LabHandler struct {
	Log *slog.Logger
	Lab *service.LabService
}

func (h *LabHandler) Submit(w http.ResponseWriter, r *http.Request) {
	labId := chi.URLParam(r, "labId")
	if labId == "" {
		response.Error(w, http.StatusBadRequest, "labId required")
		return
	}
	var req struct {
		SubmissionID string `json:"submission_id"`
		Language     string `json:"language"`
		Files        []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if len(req.Files) == 0 {
		response.Error(w, http.StatusBadRequest, "files required")
		return
	}
	files := make([]struct{ Path, Content string }, len(req.Files))
	for i, f := range req.Files {
		files[i] = struct{ Path, Content string }{Path: f.Path, Content: f.Content}
	}
	userID := UserIDFromRequest(r)
	status, results, err := h.Lab.Submit(userID, labId, req.SubmissionID, req.Language, files)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"status":       status,
		"rule_results": results,
	})
}
