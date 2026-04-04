package handler

import (
	"net/http"

	"log/slog"

	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
)

type PlayHandler struct {
	Log  *slog.Logger
	Play *service.PlayService
}

// Round возвращает один случайный фрагмент кода для игры "Vulnerable or Safe?".
func (h *PlayHandler) Round(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	lang := r.URL.Query().Get("language")
	sn, err := h.Play.GetRandomSnippet(u.ID, lang)
	if err != nil {
		h.Log.Error("play round", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to load snippet")
		return
	}
	response.JSON(w, http.StatusOK, sn)
}

