package handler

import (
	"net/http"
	"strconv"

	"log/slog"

	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
)

type FocusHandler struct {
	Log   *slog.Logger
	Focus *service.FocusService
}

// List возвращает персональные рекомендации для блока "Фокус на сегодня".
func (h *FocusHandler) List(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	limit := 6
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}

	list, err := h.Focus.List(u.ID, limit)
	if err != nil {
		h.Log.Error("list focus suggestions", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to load focus suggestions")
		return
	}
	response.JSON(w, http.StatusOK, list)
}
