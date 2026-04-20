import { useEffect, useState } from 'react'
import { PET } from '../../../constants'
import { getEvolutionLevelBand, getPetEvolutionStage } from '../../../utils/pet'
import PetAvatar from '../../../components/PetAvatar'

export default function PetAppearancePicker({
  petLevel,
  equippedVariant,
  petAura,
  onVariantChange,
}) {
  const [selectedVariant, setSelectedVariant] = useState(equippedVariant || 'classic')
  const [pendingVariant, setPendingVariant] = useState('')
  const variant = selectedVariant || 'classic'
  const currentStage = getPetEvolutionStage(petLevel)
  const auraClasses =
    petAura?.id && petAura.id !== 'none' ? [`pet-avatar-aura-${petAura.id}`] : []
  const activeVariant = (PET.VARIANTS || []).find((v) => v.id === variant)
  const nextVariant = (PET.VARIANTS || []).find((v) => v.id === pendingVariant)

  useEffect(() => {
    setSelectedVariant(equippedVariant || 'classic')
  }, [equippedVariant])

  function handleVariantPick(nextVariantId) {
    if (!nextVariantId || nextVariantId === variant) return
    setPendingVariant(nextVariantId)
  }

  function closeSwitchModal() {
    setPendingVariant('')
  }

  function confirmVariantSwitch() {
    if (!pendingVariant) return
    setSelectedVariant(pendingVariant)
    onVariantChange?.(pendingVariant)
    closeSwitchModal()
  }

  return (
    <div className="pet-appearance-picker card">
      <h3 className="pet-appearance-picker-title">Вид питомца</h3>
      <p className="pet-appearance-picker-desc muted">
        У каждого вида своя линейка и собственный прогресс. При переключении внешний вид, имя и уровень у каждого вида
        сохраняются отдельно.
      </p>
      <div className="pet-appearance-variants" role="list">
        {(PET.VARIANTS || []).map((v) => (
          <div
            key={v.id}
            role="listitem"
            className={`pet-appearance-variant ${variant === v.id ? 'pet-appearance-variant-active' : ''}`}
          >
            <span className="pet-appearance-variant-thumb">
              <PetAvatar level={petLevel} variant={v.id} previewStage={currentStage} auraClassNames={[]} />
            </span>
            <span className="pet-appearance-variant-label">{v.label}</span>
            <span className="pet-appearance-variant-hint muted">{v.hint}</span>
            <div className="pet-appearance-variant-actions">
              {variant === v.id ? (
                <span className="pet-appearance-variant-used">Используется</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleVariantPick(v.id)}
                >
                  Выбрать
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h4 className="pet-appearance-subtitle">Эволюция выбранного вида</h4>
      <p className="pet-appearance-evolve-note muted">
        Текущая стадия по уровню: <strong>{currentStage}</strong> из {PET.EVOLUTION_STAGE_MAX} ({getEvolutionLevelBand(currentStage).label}).
      </p>
      <div className="pet-appearance-evolve-strip">
        {Array.from({ length: PET.EVOLUTION_STAGE_MAX }, (_, i) => {
          const st = i + 1
          const band = getEvolutionLevelBand(st)
          return (
            <div
              key={st}
              className={`pet-appearance-evolve-cell ${st === currentStage ? 'pet-appearance-evolve-cell-current' : ''}`}
            >
              <PetAvatar level={1} variant={variant} previewStage={st} auraClassNames={auraClasses} />
              <span className="pet-appearance-evolve-cap">Форма {st}</span>
              <span className="pet-appearance-evolve-band muted">{band.label}</span>
            </div>
          )
        })}
      </div>

      {pendingVariant ? (
        <div
          className="dev-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pet-variant-switch-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeSwitchModal()
            }
          }}
        >
          <div className="dev-modal">
            <button type="button" className="dev-modal-close" onClick={closeSwitchModal} aria-label="Закрыть">
              ×
            </button>
            <h2 id="pet-variant-switch-title">Сменить вид питомца?</h2>
            <p className="muted">
              Переход на <strong>{nextVariant?.label || 'новый вид'}</strong> не удаляет текущие данные. У каждого вида
              ведётся собственная история: отдельные имя, прогресс и развитие.
            </p>
            <p className="muted">
              Ваш текущий вид <strong>{activeVariant?.label || 'питомец'}</strong> останется сохранённым и будет
              доступен при возврате.
            </p>
            <div className="dev-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeSwitchModal}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmVariantSwitch}>
                Переключить вид
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
