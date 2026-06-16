package repository

import (
	"hackpet/backend/store"
	"hackpet/backend/validator"
)

// CourseRepo — доступ к курсам. userID пустой = аноним.
type CourseRepo interface {
	ListCourses(userID string) ([]store.CourseSummary, error)
	GetCourse(id, userID string) (*store.Course, error)
	IsCourseCompleted(courseId, userID string) (bool, error)
	VerifyCourseCTFFlag(courseId, flag string) (bool, error)
}

// ModuleRepo — доступ к модулям и лабам (контент).
type ModuleRepo interface {
	ListModules(userID string) ([]store.ModuleSummary, error)
	GetModule(id string) (*store.Module, error)
	GetModuleWithProgress(moduleId, userID string) (*store.Module, *store.ModuleProgress, error)
	GetLab(labId string) (*store.LabDef, error)
	GetModuleIDByLabID(labId string) (string, error)
	GetModuleIDByQuizID(quizId string) (string, error)
}

// ProgressRepo — прогресс, попытки, телеметрия. userID пустой = аноним (file store).
type ProgressRepo interface {
	GetProgress(userID, moduleId string) (*store.ModuleProgress, error)
	SetProgress(userID, moduleId string, p store.ModuleProgress) error
	SaveAttempt(userID, labId, submissionId, status string, results []validator.RuleResult) error
	GetLastLabAttempt(userID, moduleId string) (status string, ruleResults []validator.RuleResult, err error)
	RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error
	RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error
	GetQuizStats(userID, quizId string) (correct int, total int, err error)
	GetQuizAnswers(userID, quizId string) (map[string]int, error)
}
