package repository

import (
	"hackpet/backend/store"
	"hackpet/backend/validator"
)

// StoreAdapter реализует CourseRepo, ModuleRepo, ProgressRepo поверх store.Store.
type StoreAdapter struct{ St store.Store }

func NewStoreAdapter(st store.Store) *StoreAdapter {
	return &StoreAdapter{St: st}
}

func (a *StoreAdapter) ListCourses(userID string) ([]store.CourseSummary, error) {
	return a.St.ListCourses(userID)
}
func (a *StoreAdapter) GetCourse(id, userID string) (*store.Course, error) {
	return a.St.GetCourse(id, userID)
}
func (a *StoreAdapter) IsCourseCompleted(courseId, userID string) (bool, error) {
	return a.St.IsCourseCompleted(courseId, userID)
}
func (a *StoreAdapter) VerifyCourseCTFFlag(courseId, flag string) (bool, error) {
	return a.St.VerifyCourseCTFFlag(courseId, flag)
}
func (a *StoreAdapter) ListModules(userID string) ([]store.ModuleSummary, error) {
	return a.St.ListModules(userID)
}
func (a *StoreAdapter) GetModule(id string) (*store.Module, error) {
	return a.St.GetModule(id)
}
func (a *StoreAdapter) GetModuleWithProgress(moduleId, userID string) (*store.Module, *store.ModuleProgress, error) {
	return a.St.GetModuleWithProgress(moduleId, userID)
}
func (a *StoreAdapter) GetLab(labId string) (*store.LabDef, error) {
	return a.St.GetLab(labId)
}
func (a *StoreAdapter) GetModuleIDByLabID(labId string) (string, error) {
	return a.St.GetModuleIDByLabID(labId)
}
func (a *StoreAdapter) GetProgress(userID, moduleId string) (*store.ModuleProgress, error) {
	return a.St.GetProgress(moduleId, userID)
}
func (a *StoreAdapter) SetProgress(userID, moduleId string, p store.ModuleProgress) error {
	return a.St.SetProgress(moduleId, userID, p)
}
func (a *StoreAdapter) SaveAttempt(userID, labId, submissionId, status string, results []validator.RuleResult) error {
	return a.St.SaveAttempt(userID, labId, submissionId, status, results)
}
func (a *StoreAdapter) GetLastLabAttempt(userID, moduleId string) (string, []validator.RuleResult, error) {
	return a.St.GetLastLabAttempt(userID, moduleId)
}
func (a *StoreAdapter) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	return a.St.RecordTelemetry(userID, moduleId, step, payload)
}
func (a *StoreAdapter) RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error {
	return a.St.RecordQuizAnswer(userID, quizId, questionId, answer, correct)
}

func (a *StoreAdapter) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	return a.St.GetQuizStats(userID, quizId)
}
