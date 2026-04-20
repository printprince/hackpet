package store

// UserTodo — персональная задача пользователя для дашборда.
type UserTodo struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    int    `json:"priority"` // 1=high, 2=medium, 3=low
	Done        bool   `json:"done"`
	Position    int    `json:"position"`
}
