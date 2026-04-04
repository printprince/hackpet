package handler

import (
	"net/http"
	"strconv"

	"log/slog"

	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
)

type BestPracticeHandler struct {
	Log   *slog.Logger
	Best  *service.BestPracticeService
}

// List возвращает best practices с daily-random выборкой.
func (h *BestPracticeHandler) List(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	limit := 4
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}

	list, err := h.Best.List(u.ID, limit)
	if err != nil {
		h.Log.Error("list best practices", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to load best practices")
		return
	}
	response.JSON(w, http.StatusOK, list)
}
