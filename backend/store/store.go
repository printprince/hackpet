package store

import "hackpet/backend/validator"

type ModuleSummary struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Summary      string `json:"summary,omitempty"`
	Difficulty   string `json:"difficulty"`
	Minutes      int    `json:"minutes"`
	Topic        string `json:"topic"`
	Progress     string `json:"progress"`     // "not_started" | "in_progress" | "completed"
	AttemptCount int    `json:"attempt_count"`
	LastStep     string `json:"last_step,omitempty"`
}

type ModuleProgress struct {
	LastStep     string `json:"last_step"`
	Completed    bool   `json:"completed"`
	AttemptCount int    `json:"attempt_count"`
}

type Module struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Summary    string   `json:"summary,omitempty"`
	Difficulty string   `json:"difficulty"`
	Minutes    int      `json:"minutes"`
	Topic      string   `json:"topic"`
	Steps      []string `json:"steps"`
	Theory     struct {
		Intro         string   `json:"intro,omitempty"`
		Bullets       []string `json:"bullets,omitempty"`
		Paragraphs    []string `json:"paragraphs,omitempty"`
		Consequences  string   `json:"consequences,omitempty"`
		BadExample    string   `json:"bad_example"`
		GoodExample   string   `json:"good_example"`
	} `json:"theory"`
	CheckpointQuiz struct {
		ID         string `json:"id"`
		Questions  []QuizQuestion `json:"questions"`
	} `json:"checkpoint_quiz"`
	Lab struct {
		ID                 string           `json:"id"`
		Language           string           `json:"language"` // go, python, java, javascript, cpp
		Task               string           `json:"task"`
		AcceptanceCriteria []string         `json:"acceptance_criteria"`
		Files              []LabFile        `json:"files"`
		Rules              []validator.Rule `json:"rules"`
	} `json:"lab"`
	FixExplanation struct {
		WhyFix      string   `json:"why_fix"`
		AntiPatterns []string `json:"anti_patterns"`
		Checklist   []string `json:"checklist"`
	} `json:"fix_explanation"`
	FinalQuiz struct {
		ID        string         `json:"id"`
		Questions []QuizQuestion `json:"questions"`
	} `json:"final_quiz"`
}

type QuizQuestion struct {
	ID          string   `json:"id"`
	Text        string   `json:"text"`
	Options     []string `json:"options"`
	Correct     int      `json:"correct"`
	Explanation string   `json:"explanation"`
}

type LabFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type LabDef struct {
	ID                 string             `json:"id"`
	Language           string             `json:"language"`
	Task               string             `json:"task"`
	AcceptanceCriteria []string           `json:"acceptance_criteria"`
	Files              []LabFile          `json:"files"`
	Rules              []validator.Rule   `json:"rules"`
}

type CourseSummary struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Status        string `json:"status"` // "available" | "coming_soon"
	Difficulty    string `json:"difficulty,omitempty"`    // easy, medium, hard
	TotalMinutes  int    `json:"total_minutes,omitempty"`
}

type Course struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Status      string          `json:"status"`
	Modules     []ModuleSummary `json:"modules"`
	CTF         *CourseCTF      `json:"ctf,omitempty"`
	Completed   bool            `json:"completed"`
}

type CourseCTF struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	StandURL    string `json:"stand_url,omitempty"`
	Locked      bool   `json:"locked"`
	Completed   bool   `json:"completed"`
}

type coursesFile struct {
	Courses []struct {
		ID            string   `json:"id"`
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Status        string   `json:"status"`
		Difficulty    string   `json:"difficulty"`
		TotalMinutes  int      `json:"total_minutes"`
		ModuleIDs     []string `json:"module_ids"`
		CTF           *struct {
			ID           string `json:"id"`
			Title        string `json:"title"`
			Description  string `json:"description"`
			StandURL     string `json:"stand_url"`
			ExpectedFlag string `json:"expected_flag"`
		} `json:"ctf,omitempty"`
	} `json:"courses"`
}

// Store — каталог (курсы, модули, лабы) и прогресс. userID пустой = аноним (только file store).
type Store interface {
	ListCourses(userID string) ([]CourseSummary, error)
	GetCourse(id, userID string) (*Course, error)
	IsCourseCompleted(courseId, userID string) (bool, error)
	VerifyCourseCTFFlag(courseId, flag string) (bool, error)
	ListModules(userID string) ([]ModuleSummary, error)
	GetModule(id string) (*Module, error)
	GetModuleWithProgress(id, userID string) (*Module, *ModuleProgress, error)
	GetLab(labId string) (*LabDef, error)
	GetModuleIDByLabID(labId string) (string, error)
	GetModuleIDByQuizID(quizId string) (string, error)
	GetProgress(moduleId, userID string) (*ModuleProgress, error)
	SetProgress(moduleId, userID string, p ModuleProgress) error
	SaveAttempt(userID, moduleId, labId, submissionId, status string, results []validator.RuleResult) error
	GetLastLabAttempt(userID, moduleId string) (status string, ruleResults []validator.RuleResult, err error)
	RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error
	RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error
	// GetQuizStats возвращает агрегированную статистику по квизу (кол-во правильных ответов и всего ответов).
	// Используется для отображения Итога модуля, когда пользователь возвращается позже.
	GetQuizStats(userID, quizId string) (correct int, total int, err error)
	// GetQuizAnswers — последний ответ пользователя на каждый вопрос квиза (question_id → индекс варианта).
	GetQuizAnswers(userID, quizId string) (map[string]int, error)
}
