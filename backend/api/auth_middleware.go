package api

import (
	"context"
	"net/http"
	"strings"

	"hackpet/backend/auth"
	"hackpet/backend/pkg/request"
)

// AuthMiddleware опционально парсит Bearer JWT и кладёт UserInfo в контекст.
// Если токена нет или он невалиден — запрос идёт дальше без пользователя.
func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				if userID, claims, err := auth.ParseToken(secret, token); err == nil && claims != nil {
					ctx = context.WithValue(ctx, request.UserContextKey, &request.UserInfo{
						ID:       userID,
						Email:    claims.Email,
						Nickname: claims.Nickname,
						Role:     claims.Role,
					})
				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole возвращает 403, если у пользователя нет нужной роли.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := request.UserFromContext(r.Context())
			if u == nil {
				http.Error(w, `{"message":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if u.Role != role {
				http.Error(w, `{"message":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth возвращает 401, если в контексте нет пользователя.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if request.UserFromContext(r.Context()) == nil {
			http.Error(w, `{"message":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
