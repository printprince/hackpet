import { PANEL_ORDER } from './constants'
import { allQuizQuestionsAnswered } from '../../utils/modulePersistence'

function labResultPassed(result) {
  return result?.status === 'passed'
}

function meetsStepEntryRequirements(panel, ctx) {
  switch (panel) {
    case 'theory':
    case 'quiz':
      return true
    case 'lab':
      return (
        ctx.quizRevealed &&
        allQuizQuestionsAnswered(ctx.checkpointQuiz, ctx.quizAnswers)
      )
    case 'results':
      return Boolean(ctx.effectiveLabResult)
    case 'final-quiz':
      return labResultPassed(ctx.effectiveLabResult)
    case 'summary':
      return allQuizQuestionsAnswered(ctx.finalQuiz, ctx.finalQuizAnswers)
    default:
      return false
  }
}

/** Можно ли открыть этап из текущего (степпер / сайдбар / showPanel). */
export function canNavigateToPanel(targetPanel, currentPanel, ctx) {
  const {
    lockMode,
    maxReachedIndex,
    quizRevealed,
    quizAnswers,
    checkpointQuiz,
    finalQuizAnswers,
    finalQuiz,
    effectiveLabResult,
    completed,
  } = ctx

  if (completed || lockMode === 'review') return true

  const targetIdx = PANEL_ORDER.indexOf(targetPanel)
  const currentIdx = PANEL_ORDER.indexOf(currentPanel)
  if (targetIdx < 0 || currentIdx < 0) return false

  // Назад — только к уже достигнутым этапам.
  if (targetIdx < currentIdx) {
    return targetIdx <= maxReachedIndex
  }

  // Текущий этап.
  if (targetIdx === currentIdx) return true

  // Вперёд — строго на один шаг и с выполнением требований этапа.
  if (targetIdx !== currentIdx + 1) return false

  return meetsStepEntryRequirements(targetPanel, {
    quizRevealed,
    quizAnswers,
    checkpointQuiz,
    finalQuizAnswers,
    finalQuiz,
    effectiveLabResult,
  })
}
