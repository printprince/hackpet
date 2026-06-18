import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function XPToast({ xp, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="xp-toast" role="status" aria-live="polite">
      +{xp} XP питомцу 🐾
    </div>
  )
}

const WEIGHTS = {
  LAB: 60,
  CHECKPOINT: 20,
  FINAL: 20,
}

export default function Summary({
  progress,
  lastSubmitResult,
  checkpointQuiz,
  checkpointQuizAnswers,
  finalQuizAnswers,
  quizStats,
  lab,
  finalQuiz,
  onApplyResult,
  onNextModule,
  onGoToCourse,
  hasNextModule,
  hasCTFNext = false,
  onTryAgain,
}) {
  const labPassed = lastSubmitResult?.status === 'passed'
  const labRules = lab?.rules || []
  const ruleResults = lastSubmitResult?.rule_results || []
  const passedRules = ruleResults.filter((r) => r.passed)
  const getRuleName = (ruleId) => labRules.find((r) => r.id === ruleId)?.message || ruleId
  const checkpointQuestions = checkpointQuiz?.questions || []
  const finalQuestions = finalQuiz?.questions || []

  const checkpointCorrectSession = checkpointQuestions.filter(
    (q, i) => checkpointQuizAnswers?.[i] === q.correct
  ).length
  const finalCorrectSession = finalQuestions.filter(
    (q, i) => finalQuizAnswers?.[i] === q.correct
  ).length

  const checkpointSaved = quizStats?.checkpoint
  const finalSaved = quizStats?.final
  const hasSessionCheckpoint = Object.keys(checkpointQuizAnswers || {}).length > 0
  const hasSessionFinal = Object.keys(finalQuizAnswers || {}).length > 0

  const effCheckpointTotal =
    checkpointQuestions.length || checkpointSaved?.total || 0
  const effFinalTotal =
    finalQuestions.length || finalSaved?.total || 0

  let effCheckpointCorrect = hasSessionCheckpoint
    ? checkpointCorrectSession
    : (checkpointSaved?.correct ?? checkpointCorrectSession)
  let effFinalCorrect = hasSessionFinal
    ? finalCorrectSession
    : (finalSaved?.correct ?? finalCorrectSession)

  if (effCheckpointTotal > 0) {
    effCheckpointCorrect = Math.min(effCheckpointCorrect, effCheckpointTotal)
  }
  if (effFinalTotal > 0) {
    effFinalCorrect = Math.min(effFinalCorrect, effFinalTotal)
  }

  const checkpointPct = effCheckpointTotal > 0
    ? (effCheckpointCorrect / effCheckpointTotal) * 100
    : 0
  const finalPct = effFinalTotal > 0
    ? (effFinalCorrect / effFinalTotal) * 100
    : 0
  const hasLabResult = ruleResults.length > 0
  const passedChecksCount = hasLabResult ? passedRules.length : 0
  const attemptsFromProgress = progress?.attempt_count ?? 0
  const attemptsFromLab = hasLabResult ? 1 : 0
  const attempts = Math.max(attemptsFromProgress, attemptsFromLab)

  const labPct = labRules.length > 0
    ? (passedChecksCount / labRules.length) * 100
    : 0

  const checkpointWeighted = (checkpointPct / 100) * WEIGHTS.CHECKPOINT
  const finalWeighted = (finalPct / 100) * WEIGHTS.FINAL
  const labWeighted = (labPct / 100) * WEIGHTS.LAB

  const score = Math.round(checkpointWeighted + finalWeighted + labWeighted)
  const threshold = 80
  const overallPassed = score >= threshold && labPassed && labPct > 0
  const statusText = overallPassed ? 'Пройден' : 'Не пройден'
  const showSavedQuizNote =
    !hasSessionCheckpoint &&
    !hasSessionFinal &&
    progress?.completed === true &&
    (checkpointQuestions.length > 0 || finalQuestions.length > 0) &&
    (checkpointSaved?.total > 0 || finalSaved?.total > 0)

  const pointsPerRule = useMemo(
    () => (labRules.length > 0 ? WEIGHTS.LAB / labRules.length : 0),
    [labRules.length]
  )

  const [expandedSection, setExpandedSection] = useState(null)
  const toggleSection = (key) => {
    setExpandedSection((prev) => (prev === key ? null : key))
  }

  const [xpToast, setXpToast] = useState(null)
  const hideToast = useCallback(() => setXpToast(null), [])
  useEffect(() => {
    const handler = (e) => setXpToast(e.detail?.xp || null)
    window.addEventListener('pet:xp_gained', handler)
    return () => window.removeEventListener('pet:xp_gained', handler)
  }, [])

  // Only apply result once per mount — prevents re-firing when user navigates back here
  // or when state updates cause a re-render.
  const resultAppliedRef = useRef(false)
  useEffect(() => {
    if (resultAppliedRef.current) return
    if (typeof onApplyResult === 'function' && progress?.completed !== true) {
      resultAppliedRef.current = true
      onApplyResult(overallPassed)
    }
  // overallPassed is a computed value that stabilizes on first render — safe to include.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onApplyResult, progress?.completed])

  return (
    <div className="card">
      {xpToast && <XPToast xp={xpToast} onDone={hideToast} />}
      <h3>Итог</h3>
      <div className={`summary-status summary-status-${overallPassed ? 'passed' : 'failed'}`}>
        {overallPassed ? 'Модуль пройден' : 'Модуль не пройден'}
      </div>
      <div className="summary-score-row">
        <div className="summary-score-main">
          <span>Успешность</span>
          <strong>{score}%</strong>
        </div>
        <span className="summary-score-threshold">Порог прохождения: {threshold}%</span>
      </div>
      <div className="summary-what-correct">
        <h4>Разбивка по баллам</h4>
        <ul className="summary-breakdown">
          <li>
            <div
              className={`summary-breakdown-row ${ruleResults.length ? 'is-clickable' : ''}`}
              onClick={ruleResults.length ? () => toggleSection('lab') : undefined}
              role={ruleResults.length ? 'button' : undefined}
            >
              <div className="summary-breakdown-text">
                <span className="summary-breakdown-title">Лаба</span>
                <span className="summary-breakdown-sub">
                  {labRules.length
                    ? `${passedChecksCount} из ${labRules.length} проверок`
                    : 'Нет проверок'}
                  {ruleResults.length > 0 && (
                    <span className="summary-breakdown-expand">
                      {expandedSection === 'lab' ? '▾ детали' : '▸ детали'}
                    </span>
                  )}
                </span>
              </div>
              <strong>
                {labWeighted.toFixed(1)}% из {WEIGHTS.LAB}%
              </strong>
            </div>
            {expandedSection === 'lab' && ruleResults.length > 0 && (
              <ul className="summary-rules">
                {ruleResults.map((rr) => (
                  <li key={rr.rule_id}>
                    <span>{rr.passed ? '✓' : '✕'} {getRuleName(rr.rule_id)}</span>
                    <strong>{rr.passed ? `+${pointsPerRule.toFixed(1)}%` : '+0%'}</strong>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li>
            <div className="summary-breakdown-row">
              <div className="summary-breakdown-text">
                <span className="summary-breakdown-title">Чекпоинт-тест</span>
                <span className="summary-breakdown-sub">
                  {effCheckpointTotal
                    ? `${effCheckpointCorrect} из ${effCheckpointTotal} вопросов`
                    : 'Нет вопросов'}
                </span>
              </div>
              <strong>
                {checkpointWeighted.toFixed(1)}% из {WEIGHTS.CHECKPOINT}%
              </strong>
            </div>
          </li>
          <li>
            <div className="summary-breakdown-row">
              <div className="summary-breakdown-text">
                <span className="summary-breakdown-title">Финальный тест</span>
                <span className="summary-breakdown-sub">
                  {effFinalTotal
                    ? `${effFinalCorrect} из ${effFinalTotal} вопросов`
                    : 'Нет вопросов'}
                </span>
              </div>
              <strong>
                {finalWeighted.toFixed(1)}% из {WEIGHTS.FINAL}%
              </strong>
            </div>
          </li>
        </ul>
        {showSavedQuizNote && (
          <p className="summary-muted-note">
            Статистика тестов восстановлена из сохранённых ответов.
          </p>
        )}
      </div>
      <div className="summary-stats">
        <div className="stat"><div className="label">Попыток (лаба)</div><div className="value">{attempts}</div></div>
        <div className="stat"><div className="label">Статус</div><div className="value">{statusText}</div></div>
      </div>
      <div className="card-actions summary-actions">
        {!overallPassed && typeof onTryAgain === 'function' && (
          <button type="button" className="btn btn-primary" onClick={onTryAgain}>
            Попробовать снова
          </button>
        )}
        {overallPassed ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNextModule}
          >
            {hasNextModule ? 'К следующему модулю' : hasCTFNext ? 'Дальше' : 'К курсу'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onGoToCourse || onNextModule}
          >
            К курсу
          </button>
        )}
      </div>
    </div>
  )
}
