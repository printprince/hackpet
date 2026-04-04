package service

import "hackpet/backend/store"

// PetService инкапсулирует доступ к питомцу пользователя.
// Пока используется только Postgres-хранилище (PgStore).
type PetService struct {
	Pets *store.PgStore
}

func NewPetService(pets *store.PgStore) *PetService {
	return &PetService{Pets: pets}
}

func (s *PetService) Get(userID string) (*store.Pet, error) {
	if s.Pets == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Pets.GetPet(userID)
}

func (s *PetService) UpdateName(userID, name string) (*store.Pet, error) {
	if s.Pets == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Pets.UpdatePetName(userID, name)
}

func (s *PetService) UpdateAura(userID, aura string) (*store.Pet, error) {
	if s.Pets == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Pets.UpdatePetAura(userID, aura)
}
