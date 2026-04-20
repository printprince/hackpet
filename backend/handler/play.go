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

const playWinXPReward = 25

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

// Win начисляет опыт питомцу за успешное прохождение сессии.
func (h *PlayHandler) Win(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	pet, err := h.Play.AwardWinXP(u.ID, playWinXPReward)
	if err != nil {
		h.Log.Error("play win reward", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to reward xp")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"xp_reward": playWinXPReward,
		"pet":       pet,
	})
}
