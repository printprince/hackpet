export default function FixExplanation({ fix, onNext }) {
  const fx = fix || {}
  return (
    <div className="card">
      <h3>Разбор фикса</h3>
      <p>{fx.why_fix || ''}</p>
      <h4>Анти-паттерны</h4>
      <ul>{(fx.anti_patterns || []).map((a, i) => <li key={i}>{a}</li>)}</ul>
      <h4>Чек-лист для PR</h4>
      <ul>{(fx.checklist || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
      <div className="card-actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>Дальше →</button>
      </div>
    </div>
  )
}
