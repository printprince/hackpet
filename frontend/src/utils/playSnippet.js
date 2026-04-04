import { MONACO_LANGUAGE } from '../constants'

/** Раскрывает escape-последовательности, если код пришёл одной строкой из БД/JSON. */
export function normalizePlaySnippetCode(code) {
  if (code == null || code === '') return ''
  let s = String(code)
  if (s.includes('\\n') || s.includes('\\r') || s.includes('\\t')) {
    s = s
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
  }
  return s
}

export function playSnippetMonacoLanguage(lang) {
  const key = String(lang || 'python').toLowerCase()
  return MONACO_LANGUAGE[key] || 'plaintext'
}
