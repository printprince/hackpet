package service

import (
	"hackpet/backend/repository"
	"hackpet/backend/store"
)

type ModuleService struct {
	Module   repository.ModuleRepo
	Progress repository.ProgressRepo
}

func NewModuleService(module repository.ModuleRepo, progress repository.ProgressRepo) *ModuleService {
	return &ModuleService{Module: module, Progress: progress}
}

func (s *ModuleService) List(userID string) ([]store.ModuleSummary, error) {
	return s.Module.ListModules(userID)
}

func (s *ModuleService) GetWithProgress(moduleId, userID string) (*store.Module, *store.ModuleProgress, error) {
	return s.Module.GetModuleWithProgress(moduleId, userID)
}
