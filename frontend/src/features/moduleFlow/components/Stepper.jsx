import { MODULE_STEP_LABELS } from '../../../constants'
import { PANEL_ORDER } from '../constants'

export default function Stepper({ current, onStepClick, maxReachableStepIndex, lockMode }) {
  // В режиме summary-only показываем только Итог (не перечисляем недоступные этапы).
  const stepsToShow = lockMode === 'summary-only' ? ['summary'] : PANEL_ORDER
  const currentIndex = PANEL_ORDER.indexOf(current)
  const reachable =
    maxReachableStepIndex != null ? maxReachableStepIndex : PANEL_ORDER.length - 1

  return (
    <nav className="stepper" aria-label="Шаги модуля">
      {stepsToShow.map((p, i) => {
        const idxInFull = PANEL_ORDER.indexOf(p)
        const done =
          idxInFull < currentIndex || (current === 'summary' && idxInFull <= currentIndex)
        let isLocked = lockMode === 'summary-only' ? p !== 'summary' : idxInFull > reachable
        const isCurrent = p === current
        const label = MODULE_STEP_LABELS[p] || p
        const canClick = onStepClick && !isLocked
        return canClick ? (
          <button
            key={p}
            type="button"
            className={`stepper-item ${done ? 'done' : ''} ${
              isCurrent ? 'current' : ''
            } ${isLocked ? 'locked' : ''}`}
            onClick={() => onStepClick(p)}
            disabled={isLocked}
            aria-current={isCurrent ? 'step' : undefined}
            title={isLocked ? 'Сначала пройдите предыдущий этап' : undefined}
          >
            {label}
          </button>
        ) : (
          <span
            key={p}
            className={`stepper-item ${done ? 'done' : ''} ${
              isCurrent ? 'current' : ''
            } ${isLocked ? 'locked' : ''}`}
          >
            {label}
          </span>
        )
      })}
    </nav>
  )
}
