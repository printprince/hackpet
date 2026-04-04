package response

import (
	"encoding/json"
	"net/http"
)

// JSON пишет v как application/json с кодом status.
func JSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}

// Error пишет JSON-ошибку {"message": "..."} с кодом status.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"message": message})
}

// NoContent отправляет 204.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
