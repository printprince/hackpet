package store

// Pet описывает питомца пользователя, хранящегося в БД.
type Pet struct {
	UserID       string `json:"user_id"`
	Name         string `json:"name"`
	Level        int    `json:"level"`
	XP           int    `json:"xp"`
	MoodType     string `json:"mood_type"`
	EquippedAura string `json:"equipped_aura"`
}

