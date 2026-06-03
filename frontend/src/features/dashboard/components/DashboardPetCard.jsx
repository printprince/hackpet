import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants'
import { PET } from '../../../constants'
import { getEvolutionLevelBand, getPetAura, getPetDisplayName, getPetActivityStatus, getPetEvolutionStage } from '../../../utils/pet'
import PetAvatar from '../../../components/PetAvatar'

export default function DashboardPetCard({ pet, petLevel, petStats = [], hasActiveCourse = false }) {
  const baseAura = getPetAura(petLevel)
  const equippedId = pet?.equipped_aura
  const aura = equippedId ? { ...baseAura, id: equippedId } : baseAura
  const petStatus = getPetActivityStatus({ hasActiveCourse })
  const currentStage = getPetEvolutionStage(petLevel)
  const nextStage = currentStage < PET.EVOLUTION_STAGE_MAX ? currentStage + 1 : null
  const nextStageBand = nextStage ? getEvolutionLevelBand(nextStage) : null
  const levelsToNextStage = nextStageBand ? Math.max(0, nextStageBand.lo - petLevel) : 0
  const nextLevelAura = [...(PET.AURAS || [])]
    .filter((auraDef) => !auraDef.unlockBy || auraDef.unlockBy === 'level')
    .sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1))
    .find((auraDef) => (auraDef.minLevel || 1) > petLevel)
  const levelsToNextAura = nextLevelAura ? Math.max(0, (nextLevelAura.minLevel || 1) - petLevel) : 0

  return (
    <article className="card dashboard-pet-card">
      <div className="dashboard-pet-card-tools">
        <Link
          to={ROUTES.ACCOUNT_PET}
          className="dashboard-pet-card-settings-btn"
          title="Настройки питомца"
          aria-label="Перейти к настройкам питомца"
        >
          <svg
            className="dashboard-pet-card-settings-icon"
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.281z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <div className="dashboard-pet-card-info-wrap">
          <button
            type="button"
            className="dashboard-pet-card-info-btn"
            aria-label="Как развивать питомца"
          >
            i
          </button>
          <div className="dashboard-pet-card-info-tooltip" role="note">
            <p>Как прокачивать питомца:</p>
            <p>— Проходите модули и тесты: это развивает питомца.</p>
            <p>— Победы в Play дают XP активному виду питомца.</p>
            <p>— У каждого вида отдельные имя, уровень и история.</p>
          </div>
        </div>
      </div>
      <div className="pet-avatar-wrap">
        <PetAvatar
          level={petLevel}
          variant={pet?.equipped_variant || 'classic'}
          auraClassNames={aura?.id && aura.id !== 'none' ? [`pet-avatar-aura-${aura.id}`] : []}
        />
        <span className="pet-level">Ур. {petLevel}</span>
      </div>
      <div className="pet-info">
        <h2 className="pet-name">{getPetDisplayName(pet)}</h2>
        <p className={`pet-mood ${petStatus.className}`}>{petStatus.label}</p>
        <div className="dashboard-pet-plan">
          <h3 className="dashboard-pet-plan-title">Следующий этап</h3>
          <div className="dashboard-pet-plan-list">
            <p className="dashboard-pet-plan-item">
              <span>Форма:</span>
              {nextStage ? (
                <strong>
                  {nextStage}-я через {levelsToNextStage} ур.
                </strong>
              ) : (
                <strong>максимальная форма</strong>
              )}
            </p>
            <p className="dashboard-pet-plan-item">
              <span>Аура:</span>
              {nextLevelAura ? (
                <strong>
                  {nextLevelAura.label} через {levelsToNextAura} ур.
                </strong>
              ) : (
                <strong>все уровневые ауры открыты</strong>
              )}
            </p>
          </div>
        </div>
        {petStats.length > 0 && (
          <div className="dashboard-pet-meta-note">
            Метрики курсов и лабораторных доступны в блоке «Прогресс обучения».
          </div>
        )}
      </div>
    </article>
  )
}
