package store

// Pet описывает питомца пользователя, хранящегося в БД.
type Pet struct {
	UserID          string                     `json:"user_id"`
	Name            string                     `json:"name"`
	Level           int                        `json:"level"`
	XP              int                        `json:"xp"`
	MoodType        string                     `json:"mood_type"`
	EquippedAura    string                     `json:"equipped_aura"`
	EquippedVariant string                     `json:"equipped_variant"`
	EquippedFrame   string                     `json:"equipped_frame"`
	Variants        map[string]PetVariantState `json:"variants,omitempty"`
}

type PetVariantState struct {
	Name  string `json:"name"`
	Level int    `json:"level"`
	XP    int    `json:"xp"`
}
