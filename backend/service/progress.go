package service

import (
	"hackpet/backend/repository"
	"hackpet/backend/store"
	"hackpet/backend/validator"
)

type ProgressService struct {
	Progress repository.ProgressRepo
}

func NewProgressService(progress repository.ProgressRepo) *ProgressService {
	return &ProgressService{Progress: progress}
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
		// Финальное состояние модуля определяется на шаге summary.
		// ВАЖНО: once-completed — однажды пройденный модуль не должен становиться "не пройден".
		// Поэтому completed=false на summary не снимает уже установленный флаг.
		if lastStep == "summary" {
			if completed {
				p.Completed = true
			}
		} else if completed {
			// Для остальных шагов разрешаем только установку completed=true,
			// чтобы не сбрасывать статус случайными промежуточными запросами.
			p.Completed = true
		}
	}
	return s.Progress.SetProgress(userID, moduleId, p)
}

func (s *ProgressService) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	return s.Progress.RecordTelemetry(userID, moduleId, step, payload)
}

func (s *ProgressService) RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error {
	return s.Progress.RecordQuizAnswer(userID, quizId, questionId, answer, correct)
}

// GetQuizStats агрегирует результаты по квизу для отображения Итога.
func (s *ProgressService) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	return s.Progress.GetQuizStats(userID, quizId)
}
