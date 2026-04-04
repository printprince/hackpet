import Editor from '@monaco-editor/react'
import { MONACO_LANGUAGE } from '../../../constants'

function getMonacoLanguage(labLanguage) {
  const key = (labLanguage || 'go').toLowerCase().replace('c++', 'cpp')
  return MONACO_LANGUAGE[key] || 'plaintext'
}

export default function Lab({ lab, fileContents, onContentChange, onReset, onSubmit, locked }) {
  const l = lab || {}
  const firstFile = (l.files && l.files[0]) || null
  const content = firstFile ? (fileContents[firstFile.path] ?? firstFile.content) : ''
  const lang = getMonacoLanguage(l.language)
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
      <div className="lab-editor-wrap">
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
          Submit
        </button>
      </div>
    </div>
  )
}
