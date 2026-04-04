export default function CheckpointQuiz({ quiz, answers, onAnswer, revealed, onReveal, onNextToLab }) {
  const q = quiz || {}
  const questions = q.questions || []
  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i] != null)
  return (
    <div className="card">
      <h3>Чекпоинт-квиз</h3>
      {questions.map((quest, i) => (
        <div key={quest.id || i} className="card quiz-question-card">
          <p><strong>{quest.text}</strong></p>
          <div className="radio-group">
            {(quest.options || []).map((opt, j) => (
              <label key={j}>
                <input type="radio" name={`cq_${i}`} value={j} checked={answers[i] === j} onChange={() => onAnswer(i, j)} disabled={revealed} />
                {opt}
              </label>
            ))}
          </div>
          {revealed && (
            <div className={`quiz-explanation ${answers[i] === quest.correct ? 'correct' : 'incorrect'}`}>
              {quest.explanation || (answers[i] === quest.correct ? 'Верно.' : 'Правильный ответ отмечен в квизе.')}
            </div>
          )}
        </div>
      ))}
      <div className="card-actions">
        {!revealed ? (
          <button type="button" className="btn btn-primary" disabled={!allAnswered} onClick={onReveal}>Дальше</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNextToLab}>Дальше →</button>
        )}
      </div>
    </div>
  )
}
