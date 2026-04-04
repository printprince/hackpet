import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROGRESS_STATUS, MODULE_STEP_LABELS, ROUTES } from '../../../constants'
import { PANEL_ORDER } from '../../moduleFlow/constants'

export default function CourseSidebarNav({
  courseId,
  title,
  modules,
  ctf,
  selectedModuleId,
  ctfSelected,
  courseStarted,
  onSelectOverview,
  onSelectModule,
  onSelectCTF,
  activeModuleMaxStepIndex,
  lockMode,
  currentPanel,
}) {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState(selectedModuleId || null)

  useEffect(() => {
    if (selectedModuleId) setExpandedId(selectedModuleId)
  }, [selectedModuleId])

  const handleStepClick = (moduleId, stepId) => {
    navigate(ROUTES.COURSE_MODULE(courseId, moduleId), { state: { initialPanel: stepId } })
  }

  return (
    <aside className="course-sidebar">
      <h2 className="course-sidebar-title">{title}</h2>
      <nav className="course-nav">
        <button
          type="button"
          className={`course-nav-item ${!selectedModuleId ? 'active' : ''}`}
          onClick={onSelectOverview}
        >
          О курсе
        </button>

        {modules.map((m, idx) => {
          const prog = m.progress || PROGRESS_STATUS.NOT_STARTED
          const prevCompleted = idx === 0 || modules[idx - 1]?.progress === PROGRESS_STATUS.COMPLETED
          const isLocked = !courseStarted || !prevCompleted
          const isExpanded = expandedId === m.id
          const isCompletedModule = prog === PROGRESS_STATUS.COMPLETED
          const isActiveModule = selectedModuleId === m.id
          const storedLastIndex = PANEL_ORDER.indexOf(m.last_step || '')
          const moduleLockTitle = !courseStarted
            ? 'Сначала нажмите «Начать курс»'
            : !prevCompleted
              ? 'Сначала пройдите предыдущий модуль'
              : m.title

          return (
            <div key={m.id} className={`course-nav-module-block ${isLocked ? 'locked' : ''}`}>
              <div className="course-nav-module-row">
                <button
                  type="button"
                  className={`course-nav-item course-nav-module-trigger ${
                    isActiveModule && !currentPanel ? 'active current-module' : ''
                  }`}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    if (isLocked) return
                    setExpandedId(isExpanded ? null : m.id)
                    onSelectModule(isExpanded ? null : m.id)
                  }}
                  disabled={isLocked}
                  title={moduleLockTitle}
                >
                  <button
                    type="button"
                    className="course-nav-tree-chevron"
                    aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isLocked) setExpandedId(isExpanded ? null : m.id)
                    }}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <span className="course-nav-num">{idx + 1}</span>
                  <span className="course-nav-label">{m.title}</span>
                </button>
              </div>

              {isExpanded && (
                <ul className="course-nav-steps">
                  {(function () {
                    // Если пользователь уже дошёл до итога — показываем только Итог (активный модуль — по lockMode, остальные — по данным курса).
                    const hasReachedSummary = isCompletedModule || m.last_step === 'summary'
                    const isOverviewContext = !currentPanel
                    const showOnlySummary =
                      (isActiveModule && lockMode === 'summary-only') ||
                      (!isActiveModule && hasReachedSummary) ||
                      (isOverviewContext && hasReachedSummary)
                    const stepsToShow = showOnlySummary ? ['summary'] : PANEL_ORDER
                    return stepsToShow.map((stepId, stepIdx) => {
                      const label = MODULE_STEP_LABELS[stepId] || stepId
                      const fullIdx = PANEL_ORDER.indexOf(stepId)
                      let stepReachable
                      if (showOnlySummary) {
                        stepReachable = true // только Итог, он всегда доступен
                      } else if (isActiveModule && typeof activeModuleMaxStepIndex === 'number') {
                        stepReachable = fullIdx <= activeModuleMaxStepIndex
                      } else {
                        stepReachable = fullIdx === 0 || storedLastIndex >= fullIdx
                      }
                      const disabled = !stepReachable
                      return (
                        <li key={stepId}>
                          <button
                            type="button"
                            className={`course-nav-step ${disabled ? 'disabled' : ''} ${isActiveModule && currentPanel === stepId ? 'current' : ''}`}
                            onClick={disabled ? undefined : () => handleStepClick(m.id, stepId)}
                            disabled={disabled}
                            aria-current={isActiveModule && currentPanel === stepId ? 'step' : undefined}
                            title={disabled ? 'Сначала пройдите предыдущий этап' : undefined}
                          >
                            <span className="course-nav-step-label">{label}</span>
                          </button>
                        </li>
                      )
                    })
                  })()}
                </ul>
              )}
            </div>
          )
        })}

        {ctf ? (
          <button
            type="button"
            className={`course-nav-item ${ctfSelected ? 'active' : ''} ${ctf.locked ? 'locked' : ''}`}
            onClick={ctf.locked ? undefined : onSelectCTF}
            disabled={ctf.locked}
            title={ctf.locked ? 'Сначала пройдите все модули курса' : ctf.title}
          >
            <span className="course-nav-label">{ctf.title || 'CTF-челлендж'}</span>
          </button>
        ) : null}
      </nav>
    </aside>
  )
}
