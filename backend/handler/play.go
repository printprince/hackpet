package handler

import (
	"encoding/json"
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

// BugSmashScore сохраняет результат партии Bug Smash и начисляет XP питомцу.
func (h *PlayHandler) BugSmashScore(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Score < 0 {
		response.Error(w, http.StatusBadRequest, "invalid score")
		return
	}
	pet, err := h.Play.SaveBugSmashScore(u.ID, body.Score)
	if err != nil {
		h.Log.Error("bugsmash save score", "error", err, "user_id", u.ID)
		response.Error(w, http.StatusInternalServerError, "failed to save score")
		return
	}
	scores, _ := h.Play.GetBugSmashTopScores()
	xpReward := body.Score / 2
	response.JSON(w, http.StatusOK, map[string]any{
		"xp_reward": xpReward,
		"pet":       pet,
		"scores":    scores,
	})
}

// BugSmashScores возвращает топ-10 таблицы лидеров.
func (h *PlayHandler) BugSmashScores(w http.ResponseWriter, r *http.Request) {
	scores, err := h.Play.GetBugSmashTopScores()
	if err != nil {
		h.Log.Error("bugsmash get scores", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to load scores")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"scores": scores})
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
