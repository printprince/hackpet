package service

import "hackpet/backend/store"

type FocusService struct {
	Focus *store.PgStore
}

func NewFocusService(focus *store.PgStore) *FocusService {
	return &FocusService{Focus: focus}
}

func (s *FocusService) List(userID string, limit int) ([]store.FocusSuggestion, error) {
	if s.Focus == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Focus.ListFocusSuggestions(userID, limit)
}
