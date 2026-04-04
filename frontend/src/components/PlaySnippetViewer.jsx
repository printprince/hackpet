import { useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { normalizePlaySnippetCode, playSnippetMonacoLanguage } from '../utils/playSnippet'

export default function PlaySnippetViewer({ code, language }) {
  const normalized = useMemo(() => normalizePlaySnippetCode(code), [code])
  const monacoLang = playSnippetMonacoLanguage(language)
  const lineCount = useMemo(() => Math.max(1, normalized.split('\n').length), [normalized])
  const height = Math.min(400, Math.max(120, lineCount * 20 + 44))

  return (
    <div className="play-snippet-monaco-wrap">
      <Editor
        height={`${height}px`}
        language={monacoLang}
        value={normalized}
        theme="vs-dark"
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          padding: { top: 10, bottom: 10 },
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 8,
          lineNumbersMinChars: 3,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: { vertical: 'auto', horizontal: 'auto', useShadows: false },
          contextmenu: false,
          links: false,
          renderLineHighlight: 'none',
          selectionHighlight: false,
          occurrencesHighlight: 'off',
          matchBrackets: 'never',
          cursorStyle: 'line-thin',
          cursorBlinking: 'solid',
        }}
        loading={<div className="play-snippet-monaco-loading muted">Подсветка синтаксиса…</div>}
      />
    </div>
  )
}
