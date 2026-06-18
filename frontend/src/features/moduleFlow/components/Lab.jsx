import Editor from '@monaco-editor/react'
import { MONACO_LANGUAGE } from '../../../constants'

function getMonacoLanguage(labLanguage) {
  const key = (labLanguage || 'go').toLowerCase().replace('c++', 'cpp')
  return MONACO_LANGUAGE[key] || 'plaintext'
}

function getRuleName(r) {
  if (r.name) return r.name
  // message = "Major: описание" или "Minor: описание" — убираем префикс
  if (r.message) {
    const clean = r.message.replace(/^(Blocker|Major|Minor|blocker|major|minor):\s*/i, '')
    if (clean) return clean
  }
  return r.rule_id || ''
}

function getHint(r) {
  // Показываем hint1 (практический совет), fallback на message
  return r.hint1 || r.hint || null
}

function LabFeedback({ result, attempts, maxAttempts, onRetry, exhausted }) {
  if (!result) return null
  const rules = result.rule_results || []
  const passed = rules.filter((r) => r.passed)
  const failed = rules.filter((r) => !r.passed)

  return (
    <div className="lf-wrap">
      {/* Icon + title */}
      <div className="lf-icon-row">
        {exhausted ? '💀' : '⚠️'}
      </div>
      <h3 className={`lf-title ${exhausted ? 'lf-title-exhausted' : 'lf-title-warn'}`}>
        {exhausted ? 'Попытки исчерпаны — начни модуль заново' : 'Есть что улучшить'}
      </h3>
      <p className="lf-subtitle">
        {exhausted
          ? 'Все попытки использованы. Нажми «Начать заново» на странице итогов.'
          : 'Код не прошёл часть проверок. Вот рекомендации по каждому пункту:'}
      </p>

      {/* Failed rules */}
      {failed.length > 0 && (
        <div className="lf-failed-list">
          {failed.map((r, i) => (
            <div key={i} className="lf-failed-item">
              <div className="lf-failed-header">
                <span className="lf-pill">Рекомендация</span>
                <span className="lf-failed-name">{getRuleName(r)}</span>
              </div>
              {getHint(r) && (
                <div className="lf-hint-box">
                  <span className="lf-hint-icon">💡</span>
                  <span className="lf-hint-text">{getHint(r)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Passed rules */}
      {passed.length > 0 && (
        <div className="lf-passed-section">
          <p className="lf-passed-label">Уже правильно:</p>
          <ul className="lf-passed-list">
            {passed.map((r, i) => (
              <li key={i} className="lf-passed-item">
                <span className="lf-check-circle">✓</span>
                <span className="lf-passed-name">{getRuleName(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!exhausted && (
        <button type="button" className="lf-retry-btn" onClick={onRetry}>
          Попробовать снова
        </button>
      )}
    </div>
  )
}

export default function Lab({ lab, fileContents, onContentChange, onReset, onSubmit, locked, labFeedback, labAttempts, labMaxAttempts, onClearFeedback }) {
  const l = lab || {}
  const firstFile = (l.files && l.files[0]) || null
  const content = firstFile ? (fileContents[firstFile.path] ?? firstFile.content) : ''
  const lang = getMonacoLanguage(l.language)
  const maxAttempts = labMaxAttempts ?? 3
  const attempts = labAttempts ?? 0
  const exhausted = attempts >= maxAttempts

  return (
    <div className="card">
      <h3>Практика</h3>
      {l.language && <p className="lab-lang-hint">Язык: {l.language}</p>}
      <p>{l.task || ''}</p>
      <ul>
        {(l.acceptance_criteria || []).map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>

      {labFeedback && (
        <LabFeedback
          result={labFeedback}
          attempts={attempts}
          maxAttempts={maxAttempts}
          exhausted={exhausted}
          onRetry={onClearFeedback}
        />
      )}

      {!exhausted && (
        <>
          <div className="lab-editor-wrap">
            <div className="lab-editor-chrome">
              <span className="lab-editor-dots" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
              <span className="lab-editor-file">{firstFile?.path || 'main'}</span>
              {l.language && <span className="lab-editor-lang">{l.language}</span>}
              {attempts > 0 && !exhausted && (
                <span className="lab-attempt-badge">Попытка {attempts + 1} из {maxAttempts}</span>
              )}
            </div>
            <Editor
              height="420px"
              language={lang}
              value={content}
              onChange={(v) => {
                if (locked) return
                if (firstFile) onContentChange(firstFile.path, v ?? '')
              }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12 },
                readOnly: Boolean(locked),
              }}
              loading={<span className="editor-loading">Загрузка редактора…</span>}
            />
          </div>
          <div className="lab-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={locked ? undefined : onReset}
              disabled={locked}
            >
              Сбросить
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={locked ? undefined : onSubmit}
              disabled={locked}
            >
              Отправить
            </button>
          </div>
        </>
      )}
    </div>
  )
}
