package service

import (
	"hackpet/backend/repository"
	"hackpet/backend/store"
	"hackpet/backend/validator"
)

const (
	progressScoreThreshold = 80
	weightLab              = 60
	weightCheckpoint       = 20
	weightFinal            = 20
)

type ProgressService struct {
	Progress repository.ProgressRepo
	Modules  repository.ModuleRepo
}

func NewProgressService(progress repository.ProgressRepo, modules repository.ModuleRepo) *ProgressService {
	return &ProgressService{Progress: progress, Modules: modules}
}

func (s *ProgressService) Get(userID, moduleId string) (*store.ModuleProgress, error) {
	return s.Progress.GetProgress(userID, moduleId)
}

func (s *ProgressService) GetLastLabAttempt(userID, moduleId string) (status string, ruleResults []validator.RuleResult, err error) {
	return s.Progress.GetLastLabAttempt(userID, moduleId)
}

func (s *ProgressService) Update(userID, moduleId string, lastStep string, completed, reset bool) error {
	var p store.ModuleProgress
	if reset {
		p = store.ModuleProgress{}
	} else {
		cur, _ := s.Progress.GetProgress(userID, moduleId)
		if cur != nil {
			p = *cur
		}
		if lastStep != "" {
			p.LastStep = lastStep
		}
		if lastStep == "summary" {
			if completed {
				if s.CanMarkCompleted(userID, moduleId) {
					p.Completed = true
				}
			} else if p.Completed && !s.CanMarkCompleted(userID, moduleId) {
				// Снимаем ошибочно выставленный completed (например, через API-обход).
				p.Completed = false
			}
		}
		// completed на промежуточных шагах игнорируем — завершение только через summary.
	}
	return s.Progress.SetProgress(userID, moduleId, p)
}

// CanMarkCompleted проверяет порог баллов (80%), успешную лабу и ответы на квизы.
func (s *ProgressService) CanMarkCompleted(userID, moduleId string) bool {
	if userID == "" || moduleId == "" {
		return false
	}
	score, labOK := s.moduleScore(userID, moduleId)
	return labOK && score >= progressScoreThreshold
}

func (s *ProgressService) moduleScore(userID, moduleId string) (score int, labOK bool) {
	m, err := s.Modules.GetModule(moduleId)
	if err != nil || m == nil {
		return 0, false
	}

	status, ruleResults, err := s.Progress.GetLastLabAttempt(userID, moduleId)
	if err != nil || status != "passed" {
		return 0, false
	}
	labRules := len(m.Lab.Rules)
	if labRules == 0 {
		return 0, false
	}
	passedRules := 0
	if len(ruleResults) > 0 {
		for _, r := range ruleResults {
			if r.Passed {
				passedRules++
			}
		}
	} else {
		return 0, false
	}
	if passedRules != labRules {
		return 0, false
	}
	labOK = true
	labPct := float64(passedRules) / float64(labRules) * 100

	cpPct := s.quizPercent(userID, m.CheckpointQuiz.ID, len(m.CheckpointQuiz.Questions))
	finPct := s.quizPercent(userID, m.FinalQuiz.ID, len(m.FinalQuiz.Questions))

	if len(m.CheckpointQuiz.Questions) > 0 && cpPct < 0 {
		return 0, false
	}
	if len(m.FinalQuiz.Questions) > 0 && finPct < 0 {
		return 0, false
	}

	total := (labPct/100)*weightLab + (cpPct/100)*weightCheckpoint + (finPct/100)*weightFinal
	return int(total + 0.5), labOK
}

// quizPercent возвращает % правильных от числа вопросов в модуле, или -1 если не все вопросы отвечены.
func (s *ProgressService) quizPercent(userID, quizID string, questionCount int) float64 {
	if questionCount == 0 || quizID == "" {
		return 100
	}
	correct, answered, err := s.Progress.GetQuizStats(userID, quizID)
	if err != nil || answered < questionCount {
		return -1
	}
	return float64(correct) / float64(questionCount) * 100
}

func (s *ProgressService) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	return s.Progress.RecordTelemetry(userID, moduleId, step, payload)
}

func (s *ProgressService) RecordQuizAnswer(userID, quizId, questionId string, answer int, _ bool) error {
	correct := s.isQuizAnswerCorrect(quizId, questionId, answer)
	return s.Progress.RecordQuizAnswer(userID, quizId, questionId, answer, correct)
}

func (s *ProgressService) isQuizAnswerCorrect(quizId, questionId string, answer int) bool {
	moduleID, err := s.Modules.GetModuleIDByQuizID(quizId)
	if err != nil {
		return false
	}
	m, err := s.Modules.GetModule(moduleID)
	if err != nil || m == nil {
		return false
	}
	for _, q := range m.CheckpointQuiz.Questions {
		if q.ID == questionId {
			return answer == q.Correct
		}
	}
	for _, q := range m.FinalQuiz.Questions {
		if q.ID == questionId {
			return answer == q.Correct
		}
	}
	return false
}

func (s *ProgressService) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	return s.Progress.GetQuizStats(userID, quizId)
}

func (s *ProgressService) GetQuizAnswers(userID, quizId string) (map[string]int, error) {
	return s.Progress.GetQuizAnswers(userID, quizId)
}
