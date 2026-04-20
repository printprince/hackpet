import { getPetEvolutionStage, getPetSpriteUrl } from '../utils/pet'

/**
 * Аватар Hackpet: вид + стадия эволюции по уровню и аура (свечение).
 * @param {number} [previewStage] — принудительная стадия (превью сетки), иначе из level.
 */
export default function PetAvatar({
  level,
  variant = 'classic',
  previewStage,
  auraClassNames = [],
  className = '',
}) {
  const stage = previewStage != null ? previewStage : getPetEvolutionStage(level)
  const src = getPetSpriteUrl(variant, stage)
  const innerClasses = ['pet-avatar', 'pet-avatar-hackpet', ...auraClassNames.filter(Boolean), className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={innerClasses}>
      <img className="pet-avatar-img" src={src} alt="" width={64} height={64} loading="lazy" decoding="async" />
    </div>
  )
}
