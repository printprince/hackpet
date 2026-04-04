import { useEffect, useMemo, useState } from 'react'

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
  hasNextModule,
  hasCTFNext = false,
  onTryAgain,
}) {
  const attempts = progress?.attempt_count ?? 0
  const labPassed = lastSubmitResult?.status === 'passed'
  const labRules = lab?.rules || []
  const ruleResults = lastSubmitResult?.rule_results || []
  const passedRules = ruleResults.filter((r) => r.passed)
  const failedRules = ruleResults.filter((r) => !r.passed)
  const getRuleName = (ruleId) => labRules.find((r) => r.id === ruleId)?.message || ruleId
  const checkpointQuestions = checkpointQuiz?.questions || []
  const finalQuestions = finalQuiz?.questions || []

  const checkpointCorrect = checkpointQuestions.filter(
    (q, i) => checkpointQuizAnswers?.[i] === q.correct
  ).length
  const finalCorrect = finalQuestions.filter(
    (q, i) => finalQuizAnswers?.[i] === q.correct
  ).length

  const completedFromBackend = progress?.completed === true

  const checkpointSaved = quizStats?.checkpoint
  const finalSaved = quizStats?.final

  const effCheckpointTotal =
    (checkpointQuestions.length || checkpointSaved?.total || 0)
  const effFinalTotal =
    (finalQuestions.length || finalSaved?.total || 0)

  let effCheckpointCorrect =
    completedFromBackend &&
    checkpointSaved &&
    effCheckpointTotal > 0 &&
    checkpointCorrect === 0
      ? checkpointSaved.correct
      : checkpointCorrect

  let effFinalCorrect =
    completedFromBackend &&
    finalSaved &&
    effFinalTotal > 0 &&
    finalCorrect === 0
      ? finalSaved.correct
      : finalCorrect

  // Защита от неконсистентных данных: число верных не может превышать количество вопросов.
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
  const passedChecksCount = hasLabResult
    ? passedRules.length
    : completedFromBackend && labRules.length > 0
      ? labRules.length
      : 0

  const labPct = labRules.length > 0
    ? (passedChecksCount / labRules.length) * 100
    : 0

  const checkpointWeighted = (checkpointPct / 100) * WEIGHTS.CHECKPOINT
  const finalWeighted = (finalPct / 100) * WEIGHTS.FINAL
  const labWeighted = (labPct / 100) * WEIGHTS.LAB

  const score = Math.round(checkpointWeighted + finalWeighted + labWeighted)
  const threshold = 80
  const overallPassed = completedFromBackend || (score >= threshold && labPassed && labPct > 0)
  const statusText = overallPassed ? 'Пройден' : 'Не пройден'
  const pointsPerRule = useMemo(
    () => (labRules.length > 0 ? WEIGHTS.LAB / labRules.length : 0),
    [labRules.length]
  )

  const [expandedSection, setExpandedSection] = useState(null)
  const toggleSection = (key) => {
    setExpandedSection((prev) => (prev === key ? null : key))
  }

  useEffect(() => {
    if (typeof onApplyResult === 'function') {
      onApplyResult(overallPassed)
    }
  }, [overallPassed, onApplyResult])

  return (
    <div className="card">
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
      {/* Блок «Почему» убран, чтобы не дублировать информацию из разбивки по баллам */}
      <div className="summary-what-correct">
        <h4>Разбивка по баллам</h4>
        <ul className="summary-breakdown">
          <li>
            {/** Лаба: строка можно раскрыть, поэтому помечаем её визуально */}
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
        {completedFromBackend && checkpointCorrect === 0 && finalCorrect === 0 && (checkpointQuestions.length > 0 || finalQuestions.length > 0) && (
          <p className="summary-muted-note">
            Детали по тестам отображаются только в сессии прохождения. Результат модуля сохранён.
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
        <button
          type="button"
          className={overallPassed ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={onNextModule}
        >
          {overallPassed && hasNextModule
            ? 'К следующему модулю'
            : overallPassed && hasCTFNext
              ? 'Дальше'
              : 'К курсу'}
        </button>
      </div>
    </div>
  )
}
