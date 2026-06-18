import { MODULE_STEP_LABELS } from '../../../constants'
import { PANEL_ORDER } from '../constants'

export default function Stepper({ current, onStepClick, maxReachableStepIndex, lockMode, canOpenStep }) {
  const stepsToShow = PANEL_ORDER
  const currentIndex = PANEL_ORDER.indexOf(current)
  const reachable =
    maxReachableStepIndex != null ? maxReachableStepIndex : PANEL_ORDER.length - 1

  return (
    <nav className="stepper" aria-label="Шаги модуля">
      {stepsToShow.map((p) => {
        const idxInFull = PANEL_ORDER.indexOf(p)
            const isCurrent = p === current
        const done = !isCurrent && idxInFull <= reachable
        const isLocked = lockMode === 'review'
          ? false
          : typeof canOpenStep === 'function'
            ? !canOpenStep(p)
            : idxInFull > reachable
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
            title={lockMode === 'review' ? 'Режим просмотра: редактирование отключено' : isLocked ? 'Сначала пройдите предыдущий этап' : undefined}
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
