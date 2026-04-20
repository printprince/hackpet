package service

import "hackpet/backend/store"

type PlayService struct {
	Pg *store.PgStore
}

func NewPlayService(pg *store.PgStore) *PlayService {
	return &PlayService{Pg: pg}
}

// GetRandomSnippet возвращает случайный активный фрагмент с вариантами фикса.
func (s *PlayService) GetRandomSnippet(userID, language string) (*store.PlaySnippet, error) {
	if s.Pg == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Pg.GetRandomPlaySnippet(language)
}

// AwardWinXP начисляет XP питомцу за победу в мини-игре.
func (s *PlayService) AwardWinXP(userID string, amount int) (*store.Pet, error) {
	if s.Pg == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Pg.AddPetXP(userID, amount)
}
