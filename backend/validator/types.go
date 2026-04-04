package validator

type File struct {
	Path    string
	Content string
}

type Rule struct {
	ID       string `json:"id"`
	Severity string `json:"severity"` // blocker | major | minor
	Message  string `json:"message"`
	Hint1    string `json:"hint1"`
	Hint2    string `json:"hint2"`
	Hint3    string `json:"hint3"`
	Check    string `json:"check"` // rule identifier for Run()
}

type RuleResult struct {
	RuleID  string `json:"rule_id"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
	Hint1   string `json:"hint1,omitempty"`
	Hint2   string `json:"hint2,omitempty"`
	Hint3   string `json:"hint3,omitempty"`
	Severity string `json:"severity,omitempty"`
}
