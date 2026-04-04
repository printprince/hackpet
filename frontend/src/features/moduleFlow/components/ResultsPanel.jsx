import { useState } from 'react'

export default function ResultsPanel({ result, labRules, onNext, nextLabel = 'Дальше →' }) {
  const [openHints, setOpenHints] = useState({})
  if (!result) return null

  const toggleHint = (ruleId) => setOpenHints((prev) => ({ ...prev, [ruleId]: !prev[ruleId] }))
  const getRuleName = (ruleId) => (labRules || []).find((r) => r.id === ruleId)?.message || ruleId
  const failed = (result.rule_results || []).filter((r) => !r.passed)
  const passed = (result.rule_results || []).filter((r) => r.passed)
  const isPassed = result.status === 'passed'

  return (
    <div className="card">
      <h3>Результат проверки</h3>
      <div className={`status ${isPassed ? 'passed' : 'failed'}`}>
        {isPassed ? 'Все проверки пройдены' : 'Есть проблемы — нужно исправить код'}
      </div>

      {failed.length > 0 && (
        <div className="results-section results-problems">
          <h4>Что нужно исправить</h4>
          {failed.map((rr) => (
            <div key={rr.rule_id} className="rule failed">
              <div className="rule-head">
                <span className="rule-name">{getRuleName(rr.rule_id)}</span>
              </div>
              <div className="msg">{rr.message}</div>
              {(rr.hint1 || rr.hint2 || rr.hint3) && (
                <>
                  <div
                    className="hint-toggle"
                    onClick={() => toggleHint(rr.rule_id)}
                    role="button"
                    tabIndex={0}
                  >
                    {openHints[rr.rule_id] ? 'Скрыть подсказки' : 'Показать подсказки'}
                  </div>
                  {openHints[rr.rule_id] && (
                    <div className="hint-body open">
                      {rr.hint1 && <div className="hint">Подсказка 1: {rr.hint1}</div>}
                      {rr.hint2 && <div className="hint">Подсказка 2: {rr.hint2}</div>}
                      {rr.hint3 && <div className="hint">Подсказка 3: {rr.hint3}</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {passed.length > 0 && (
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
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
