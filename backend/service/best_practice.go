package service

import "hackpet/backend/store"

type BestPracticeService struct {
	Store *store.PgStore
}

func NewBestPracticeService(st *store.PgStore) *BestPracticeService {
	return &BestPracticeService{Store: st}
}

func (s *BestPracticeService) List(userID string, limit int) ([]store.BestPractice, error) {
	if s.Store == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Store.ListBestPractices(userID, limit)
}
