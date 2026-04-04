import { PROGRESS_STATUS, DEFAULT_COURSE_ID } from '../constants'

/**
 * Группирует плоский список модулей с прогрессом по курсам.
 * @param {Array<{ courseId?: string, courseTitle?: string, ... }>} modules
 * @returns {Array<{ courseId: string, courseTitle: string, modules: Array, completed: number, total: number }>}
 */
export function groupModulesByCourse(modules) {
  const byCourse = modules.reduce((acc, m) => {
    const id = m.courseId || DEFAULT_COURSE_ID
    if (!acc[id]) {
      acc[id] = { courseId: id, courseTitle: m.courseTitle, modules: [] }
    }
    acc[id].modules.push(m)
    return acc
  }, {})
  return Object.values(byCourse).map((c) => ({
    ...c,
    completed: c.modules.filter((m) => m.progress === PROGRESS_STATUS.COMPLETED).length,
    total: c.modules.length,
  }))
}

/**
 * Агрегаты по списку модулей с прогрессом.
 */
export function getProgressStats(modules) {
  const list = modules || []
  const completed = list.filter((m) => m.progress === PROGRESS_STATUS.COMPLETED).length
  const inProgress = list.filter((m) => m.progress === PROGRESS_STATUS.IN_PROGRESS).length
  const totalAttempts = list.reduce((acc, m) => acc + (m.attempt_count || 0), 0)
  const total = list.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, inProgress, totalAttempts, total, progressPct }
}

export function getProgressLabel(status) {
  const labels = {
    [PROGRESS_STATUS.NOT_STARTED]: 'Не начат',
    [PROGRESS_STATUS.IN_PROGRESS]: 'В процессе',
    [PROGRESS_STATUS.COMPLETED]: 'Пройден',
  }
  return labels[status] ?? status
}
