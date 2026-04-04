package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"log/slog"

	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/service"
)

type PetHandler struct {
	Log *slog.Logger
	Pet *service.PetService
}

// Get возвращает питомца текущего пользователя.
func (h *PetHandler) Get(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	p, err := h.Pet.Get(u.ID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "pet not found")
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// UpdateName обновляет имя питомца текущего пользователя.
func (h *PetHandler) UpdateName(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		response.Error(w, http.StatusBadRequest, "pet name is required")
		return
	}
	if len([]rune(req.Name)) > 24 {
		response.Error(w, http.StatusBadRequest, "pet name is too long")
		return
	}

	p, err := h.Pet.UpdateName(u.ID, req.Name)
	if err != nil {
		h.Log.Error("update pet name", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to update pet name")
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// UpdateAura обновляет экипированную ауру питомца текущего пользователя.
func (h *PetHandler) UpdateAura(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Aura string `json:"aura"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Aura = strings.TrimSpace(req.Aura)
	if req.Aura == "" {
		response.Error(w, http.StatusBadRequest, "aura is required")
		return
	}
	if len([]rune(req.Aura)) > 32 {
		response.Error(w, http.StatusBadRequest, "aura is too long")
		return
	}

	p, err := h.Pet.UpdateAura(u.ID, req.Aura)
	if err != nil {
		h.Log.Error("update pet aura", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to update pet aura")
		return
	}
	response.JSON(w, http.StatusOK, p)
}
