export default function FinalQuiz({ quiz, answers, onAnswer, onNext, locked }) {
  const q = quiz || {}
  const questions = q.questions || []
  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i] != null)
  return (
    <div className="card">
      <h3>Финальный тест</h3>
      {questions.map((quest, i) => (
        <div key={quest.id || i} className="card quiz-question-card">
          <p><strong>{quest.text}</strong></p>
          <div className="radio-group">
            {(quest.options || []).map((opt, j) => (
              <label key={j}>
                <input
                  type="radio"
                  name={`fq_${i}`}
                  value={j}
                  checked={answers[i] === j}
                  onChange={() => onAnswer(i, j)}
                  disabled={locked}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || !allAnswered}
          onClick={locked ? undefined : onNext}
          title={locked ? 'Результат уже зафиксирован' : undefined}
        >
          Итог
        </button>
      </div>
    </div>
  )
}
