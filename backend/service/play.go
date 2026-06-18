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

// SaveBugSmashScore сохраняет счёт партии и начисляет XP питомцу (score/2 XP).
func (s *PlayService) SaveBugSmashScore(userID string, score int) (*store.Pet, error) {
	if s.Pg == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	if err := s.Pg.SaveBugSmashScore(userID, score); err != nil {
		return nil, err
	}
	xp := score / 2 // 10 очков = 5 XP, 100 очков = 50 XP
	if xp <= 0 {
		return nil, nil
	}
	return s.Pg.AddPetXP(userID, xp)
}

// GetBugSmashTopScores возвращает топ-10 глобальной таблицы лидеров.
func (s *PlayService) GetBugSmashTopScores() ([]store.BugSmashScore, error) {
	if s.Pg == nil {
		return nil, nil
	}
	return s.Pg.GetBugSmashTopScores(10)
}
