export default function Theory({ theory, onNext }) {
  const t = theory || {}
  const hasParagraphs = Array.isArray(t.paragraphs) && t.paragraphs.length > 0
  return (
    <div className="card theory-card">
      <h3>Теория</h3>
      {t.intro && <p className="theory-intro">{t.intro}</p>}
      {hasParagraphs ? (
        <div className="theory-body">
          {(t.paragraphs || []).map((para, i) => (
            <p key={i} className="theory-paragraph">{para}</p>
          ))}
        </div>
      ) : (
        <>
          <h4 className="theory-subtitle">Суть</h4>
          <ul className="bullets theory-bullets">
            {(t.bullets || []).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </>
      )}
      {t.consequences && (
        <>
          <h4 className="theory-subtitle">К чему это может привести</h4>
          <p className="theory-consequences">{t.consequences}</p>
        </>
      )}
      <h4 className="theory-subtitle">Примеры кода</h4>
      <div className="theory-examples">
        <div className="theory-example-block">
          <span className="bad">Плохо</span>
          <pre className="theory-pre">{t.bad_example || ''}</pre>
        </div>
        <div className="theory-example-block">
          <span className="good">Хорошо</span>
          <pre className="theory-pre">{t.good_example || ''}</pre>
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Дальше →
        </button>
      </div>
    </div>
  )
}
