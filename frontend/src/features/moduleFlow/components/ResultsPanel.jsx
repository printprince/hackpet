export default function ResultsPanel({
  result,
  labRules,
  onNext,
  onStartOver,
  nextLabel = 'Дальше →',
  startOverLabel = 'Начать заново',
}) {
  if (!result) return null

  const getRuleName = (ruleId) => (labRules || []).find((r) => r.id === ruleId)?.message || ruleId
  const passed = (result.rule_results || []).filter((r) => r.passed)
  const isPassed = result.status === 'passed'

  return (
    <div className="card">
      <h3>Результат проверки</h3>
      {isPassed && (
        <div className="status passed">
          Все проверки пройдены
        </div>
      )}

      {isPassed && passed.length > 0 && (
        <div className="results-section results-ok">
          {passed.map((rr) => (
            <div key={rr.rule_id} className="rule passed">
              <div className="rule-head">
                <span className="rule-name">{getRuleName(rr.rule_id)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-actions">
        {isPassed ? (
          <button type="button" className="btn btn-primary" onClick={onNext}>
            {nextLabel}
          </button>
        ) : (
          typeof onStartOver === 'function' && (
            <button type="button" className="btn btn-primary" onClick={onStartOver}>
              {startOverLabel}
            </button>
          )
        )}
      </div>
    </div>
  )
}
