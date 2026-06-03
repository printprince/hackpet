export const PANEL_ORDER = ['theory', 'quiz', 'lab', 'results', 'final-quiz', 'summary']

/** Маппинг устаревших шагов прогресса (до удаления «Разбор»). */
export function normalizeFlowPanel(step) {
  if (step === 'fix') return 'final-quiz'
  return PANEL_ORDER.includes(step) ? step : null
}

export const SEVERITY_LABELS = {
  blocker: 'Критично (блокер)',
  major: 'Важно',
  minor: 'Рекомендация',
}
