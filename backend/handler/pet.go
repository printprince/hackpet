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

var allowedPetVariants = map[string]bool{
	"classic": true,
	"neon":    true,
	"ember":   true,
}

var allowedPetFrames = map[string]bool{
	"ring":   true,
	"chrome": true,
	"soft":   true,
}

// UpdateVariant сохраняет визуальный вид питомца (набор эволюции).
func (h *PetHandler) UpdateVariant(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req struct {
		Variant string `json:"variant"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Variant = strings.TrimSpace(req.Variant)
	if req.Variant == "" || !allowedPetVariants[req.Variant] {
		response.Error(w, http.StatusBadRequest, "invalid variant")
		return
	}
	p, err := h.Pet.UpdateVariant(u.ID, req.Variant)
	if err != nil {
		h.Log.Error("update pet variant", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to update pet variant")
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// UpdateFrame сохраняет стиль рамки аватара.
func (h *PetHandler) UpdateFrame(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req struct {
		Frame string `json:"frame"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Frame = strings.TrimSpace(req.Frame)
	if req.Frame == "" || !allowedPetFrames[req.Frame] {
		response.Error(w, http.StatusBadRequest, "invalid frame")
		return
	}
	p, err := h.Pet.UpdateFrame(u.ID, req.Frame)
	if err != nil {
		h.Log.Error("update pet frame", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to update pet frame")
		return
	}
	response.JSON(w, http.StatusOK, p)
}
