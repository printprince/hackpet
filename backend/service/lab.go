package service

import (
	"hackpet/backend/repository"
	"hackpet/backend/validator"
)

type LabService struct {
	Module   repository.ModuleRepo
	Progress repository.ProgressRepo
}

func NewLabService(module repository.ModuleRepo, progress repository.ProgressRepo) *LabService {
	return &LabService{Module: module, Progress: progress}
}

func (s *LabService) Submit(userID, labId, submissionId, language string, files []struct{ Path, Content string }) (status string, results []validator.RuleResult, err error) {
	lab, err := s.Module.GetLab(labId)
	if err != nil {
		return "", nil, err
	}
	lang := language
	if lang == "" {
		lang = lab.Language
	}
	if lang == "" {
		lang = "go"
	}
	fs := make([]validator.File, len(files))
	for i, f := range files {
		fs[i] = validator.File{Path: f.Path, Content: f.Content}
	}
	results = validator.RunByLanguage(lang, lab.Rules, fs)
	status = "passed"
	for _, r := range results {
		if !r.Passed {
			status = "failed"
			break
		}
	}
	if submissionId != "" {
		_ = s.Progress.SaveAttempt(userID, labId, submissionId, status, results)
	}
	return status, results, nil
}
