package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"log/slog"

	"hackpet/backend/auth"
	"hackpet/backend/pkg/request"
	"hackpet/backend/pkg/response"
	"hackpet/backend/store"
)

type AuthHandler struct {
	Log        *slog.Logger
	UserStore  store.UserStore
	JWTSecret  string
	UploadsDir string
}

// Register создаёт пользователя и возвращает JWT.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email      string `json:"email"`
		Nickname   string `json:"nickname"`
		Password   string `json:"password"`
		LastName   string `json:"last_name"`
		FirstName  string `json:"first_name"`
		Patronymic string `json:"patronymic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nickname = strings.TrimSpace(req.Nickname)
	req.LastName = strings.TrimSpace(req.LastName)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.Patronymic = strings.TrimSpace(req.Patronymic)
	if req.Email == "" || req.Nickname == "" || len(req.Password) < 6 {
		response.Error(w, http.StatusBadRequest, "email, nickname and password (min 6 chars) required")
		return
	}
	if req.LastName == "" || req.FirstName == "" {
		response.Error(w, http.StatusBadRequest, "last_name and first_name are required")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		h.Log.Error("hash password", "error", err)
		response.Error(w, http.StatusInternalServerError, "registration failed")
		return
	}
	user, err := h.UserStore.CreateUser(req.Email, req.Nickname, hash, req.LastName, req.FirstName, req.Patronymic)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			response.Error(w, http.StatusConflict, "email or nickname already taken")
			return
		}
		h.Log.Error("create user", "error", err)
		response.Error(w, http.StatusInternalServerError, "registration failed")
		return
	}
	token, err := auth.IssueToken(h.JWTSecret, user.ID, user.Email, user.Nickname, user.Role, 0)
	if err != nil {
		h.Log.Error("issue token", "error", err)
		response.Error(w, http.StatusInternalServerError, "registration failed")
		return
	}
	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"token": token,
		"user":  userResponse(user),
	})
}

// Login проверяет email+пароль и возвращает JWT.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "email and password required")
		return
	}
	user, err := h.UserStore.GetByEmail(req.Email)
	if err != nil || user == nil {
		response.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		response.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	token, err := auth.IssueToken(h.JWTSecret, user.ID, user.Email, user.Nickname, user.Role, 0)
	if err != nil {
		h.Log.Error("issue token", "error", err)
		response.Error(w, http.StatusInternalServerError, "login failed")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  userResponse(user),
	})
}

// userResponse — общий формат ответа с данными пользователя.
func userResponse(u *store.User) map[string]interface{} {
	return map[string]interface{}{
		"id":          u.ID,
		"email":       u.Email,
		"nickname":    u.Nickname,
		"last_name":   u.LastName,
		"first_name":  u.FirstName,
		"patronymic":  u.Patronymic,
		"role":        u.Role,
		"avatar_url":  u.AvatarURL,
	}
}

// Me возвращает текущего пользователя из JWT (для проверки токена).
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	fullUser, err := h.UserStore.GetByID(u.ID)
	if err == nil && fullUser != nil {
		response.JSON(w, http.StatusOK, userResponse(fullUser))
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"id":         u.ID,
		"email":      u.Email,
		"nickname":   u.Nickname,
		"last_name":  "", "first_name": "", "patronymic": "",
		"role":       u.Role,
		"avatar_url": "",
	})
}

// UpdateProfile обновляет email, nickname и ФИО текущего пользователя.
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Email      string `json:"email"`
		Nickname   string `json:"nickname"`
		LastName   string `json:"last_name"`
		FirstName  string `json:"first_name"`
		Patronymic string `json:"patronymic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nickname = strings.TrimSpace(req.Nickname)
	req.LastName = strings.TrimSpace(req.LastName)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.Patronymic = strings.TrimSpace(req.Patronymic)
	if req.Email == "" || req.Nickname == "" {
		response.Error(w, http.StatusBadRequest, "email and nickname are required")
		return
	}
	if req.LastName == "" || req.FirstName == "" {
		response.Error(w, http.StatusBadRequest, "last_name and first_name are required")
		return
	}

	updated, err := h.UserStore.UpdateProfile(u.ID, req.Email, req.Nickname, req.LastName, req.FirstName, req.Patronymic)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			response.Error(w, http.StatusConflict, "email or nickname already taken")
			return
		}
		h.Log.Error("update profile", "error", err)
		response.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"user": userResponse(updated),
	})
}

// UploadAvatar сохраняет аватар пользователя и обновляет avatar_url.
func (h *AuthHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	u := request.UserFromContext(r.Context())
	if u == nil {
		response.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if h.UploadsDir == "" {
		response.Error(w, http.StatusInternalServerError, "uploads path is not configured")
		return
	}

	if err := r.ParseMultipartForm(3 << 20); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid multipart form")
		return
	}
	file, _, err := r.FormFile("avatar")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "avatar file is required")
		return
	}
	defer file.Close()

	const maxBytes = 2 << 20
	raw, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "failed to read avatar")
		return
	}
	if len(raw) == 0 {
		response.Error(w, http.StatusBadRequest, "empty avatar file")
		return
	}
	if len(raw) > maxBytes {
		response.Error(w, http.StatusBadRequest, "avatar is too large (max 2MB)")
		return
	}

	contentType := http.DetectContentType(raw)
	ext := ""
	switch contentType {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	case "image/webp":
		ext = ".webp"
	default:
		response.Error(w, http.StatusBadRequest, "unsupported avatar format (jpg, png, webp)")
		return
	}

	avatarsDir := filepath.Join(h.UploadsDir, "avatars")
	if err := os.MkdirAll(avatarsDir, 0o755); err != nil {
		h.Log.Error("avatar: create avatars dir", "path", avatarsDir, "error", err)
		response.Error(w, http.StatusInternalServerError, "Не удалось создать папку для аватаров. Проверьте логи сервера.")
		return
	}

	filename := fmt.Sprintf("%s-%d%s", u.ID, time.Now().UnixNano(), ext)
	fullPath := filepath.Join(avatarsDir, filename)
	if err := os.WriteFile(fullPath, raw, 0o644); err != nil {
		h.Log.Error("avatar: write file", "path", fullPath, "error", err)
		response.Error(w, http.StatusInternalServerError, "Не удалось сохранить файл. Проверьте права на папку uploads.")
		return
	}

	avatarURL := "/api/uploads/avatars/" + filename
	user, err := h.UserStore.UpdateAvatar(u.ID, avatarURL)
	if err != nil {
		h.Log.Error("avatar: update db", "error", err)
		_ = os.Remove(fullPath)
		response.Error(w, http.StatusInternalServerError, "Аватар сохранён, но не удалось обновить профиль. Попробуйте ещё раз.")
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"user": userResponse(user),
	})
}
