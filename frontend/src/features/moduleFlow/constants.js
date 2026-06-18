export const PANEL_ORDER = ['theory', 'quiz', 'lab', 'final-quiz', 'summary']

/** Маппинг устаревших шагов прогресса. */
export function normalizeFlowPanel(step) {
  if (step === 'fix') return 'final-quiz'
  if (step === 'results') return 'final-quiz'
  return PANEL_ORDER.includes(step) ? step : null
}

export const SEVERITY_LABELS = {
  blocker: 'Критично (блокер)',
  major: 'Важно',
  minor: 'Рекомендация',
}
