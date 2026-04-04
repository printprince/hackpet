package store

// FocusSuggestion — рекомендация для блока "Фокус на сегодня" на дашборде.
type FocusSuggestion struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}
