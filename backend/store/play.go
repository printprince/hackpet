package store

// PlaySnippet — фрагмент кода для мини‑игры "Vulnerable or Safe?".
type PlaySnippet struct {
	ID                   string          `json:"id"`
	Language             string          `json:"language"`
	Topic                string          `json:"topic"`
	Code                 string          `json:"code"`
	IsVulnerable         bool            `json:"is_vulnerable"`
	VulnerabilityType    string          `json:"vulnerability_type"`
	ExplanationVulnerable string         `json:"explanation_vulnerable"`
	ExplanationSafe      string          `json:"explanation_safe"`
	FixOptions           []PlayFixOption `json:"fix_options"`
}

// PlayFixOption — вариант быстрого фикса для уязвимого фрагмента.
type PlayFixOption struct {
	ID        string `json:"id"`
	SnippetID string `json:"snippet_id"`
	Text      string `json:"text"`
	Correct   bool   `json:"correct"`
}

