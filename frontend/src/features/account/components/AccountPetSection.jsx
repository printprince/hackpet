import { Link } from 'react-router-dom'
import { ROUTES, PET } from '../../../constants'

export default function AccountPetSection({
  pet,
  petLevel,
  petMood,
  progressToNext,
  petAura,
  unlockedAuras,
  onAuraPreview,
  petName,
  onPetNameChange,
  petNameSaving,
  onPetNameSubmit,
  petNameError,
  petNameMessage,
  petStats,
}) {
  const avatarClassNames = ['pet-avatar', 'pet-avatar-hackpet']
  if (petAura?.id && petAura.id !== 'none') {
    avatarClassNames.push(`pet-avatar-aura-${petAura.id}`)
  }

  return (
    <section className="account-section account-pet-section">
      <h2 className="account-section-title">Мой Hackpet</h2>
      <div className="pet-card card">
        <div className="pet-avatar-wrap">
          <div className={avatarClassNames.join(' ')} aria-hidden="true">🐶</div>
          <span className="pet-level">Ур. {petLevel}</span>
        </div>
        <div className="pet-info">
          <div className="pet-head">
            <h3 className="pet-name">{pet?.name || 'Hackpet'}</h3>
          </div>
          <p className="pet-mood">{petMood}</p>
          {petLevel < PET.LEVEL_MAX && (
            <div className="pet-progress-wrap">
              <div className="account-progress-bar">
                <div className="account-progress-bar-fill" style={{ width: `${progressToNext}%` }} />
              </div>
            </div>
          )}
          <form className="pet-rename-form" onSubmit={onPetNameSubmit}>
            <input
              type="text"
              value={petName}
              onChange={(e) => onPetNameChange(e.target.value)}
              maxLength={24}
              placeholder="Имя питомца"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={petNameSaving}>
              {petNameSaving ? 'Сохранение...' : 'Сохранить имя'}
            </button>
          </form>
          {petNameError ? <p className="form-error pet-form-message">{petNameError}</p> : null}
          {petNameMessage ? <p className="account-edit-success pet-form-message">{petNameMessage}</p> : null}
          {PET.AURAS && PET.AURAS.length > 0 && (
            <div className="pet-auras">
              <span className="pet-auras-label">Подсветка:</span>
              <div className="pet-auras-list">
                {([...PET.AURAS].sort((a, b) => {
                  const aUnlocked = unlockedAuras?.some((u) => u.id === a.id)
                  const bUnlocked = unlockedAuras?.some((u) => u.id === b.id)
                  if (aUnlocked === bUnlocked) return 0
                  return aUnlocked ? -1 : 1
                })).map((aura) => {
                  const isUnlocked = unlockedAuras?.some((u) => u.id === aura.id)
                  const isActive = petAura && petAura.id === aura.id
                  const baseClass = 'pet-aura-pill'
                  const stateClass = isActive
                    ? ' pet-aura-pill-active'
                    : isUnlocked
                      ? ''
                      : ' pet-aura-pill-locked'
                  const className = baseClass + stateClass
                  const handleClick = () => {
                    if (!onAuraPreview) return
                    onAuraPreview(aura)
                  }
                  return (
                    <button
                      key={aura.id}
                      type="button"
                      className={className}
                      onClick={handleClick}
                    >
                      <span className={`pet-aura-preview pet-avatar-aura-${aura.id}`} aria-hidden="true" />
                      <span>{aura.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="pet-actions">
            <Link to={ROUTES.PLAY} className="btn btn-primary btn-sm btn-pet-train">
              Тренировать питомца
            </Link>
          </div>
          <div className="pet-stats">
            {petStats.map((s) => (
              <div key={s.id} className="pet-stat-row">
                <span className="pet-stat-label">{s.label}</span>
                <div className="pet-stat-track">
                  <div className="pet-stat-fill" style={{ width: `${s.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
