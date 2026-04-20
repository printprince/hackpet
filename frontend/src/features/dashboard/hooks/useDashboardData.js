import { useEffect, useMemo, useState } from 'react'
import { get } from '../../../api'
import { API, PROGRESS_STATUS } from '../../../constants'
import { WEEKLY_PRACTICES } from '../constants'
import { getProgressStats } from '../../../utils/progress'
import { getPetProgressFromXP } from '../../../utils/pet'

export function useDashboardData(courseDetails) {
  const [pet, setPet] = useState(null)
  const [bestPractices, setBestPractices] = useState([])

  useEffect(() => {
    get('/pet')
      .then((p) => setPet(p))
      .catch(() => setPet(null))
  }, [])

  useEffect(() => {
    get(`${API.BEST_PRACTICES}?limit=6`)
      .then((list) => {
        const normalized = Array.isArray(list) ? list : []
        setBestPractices(
          normalized.map((item, idx) => ({
            id: item.id || `best-${idx + 1}`,
            title: item.title || 'Best practice',
            description: item.description || '',
          }))
        )
      })
      .catch(() => setBestPractices([]))
  }, [])

  const modules = useMemo(
    () => (courseDetails || []).flatMap((course) => course.modules || []),
    [courseDetails]
  )

  const hasStartedLearning = useMemo(
    () => modules.some((m) => m.progress && m.progress !== PROGRESS_STATUS.NOT_STARTED),
    [modules]
  )
  const hasActiveCourse = useMemo(
    () => modules.some((m) => m.progress === PROGRESS_STATUS.IN_PROGRESS),
    [modules]
  )

  const stats = getProgressStats(modules)
  const petLevel = Math.max(1, Number(pet?.level) || 1)
  const petProgress = getPetProgressFromXP(pet?.xp, petLevel)

  const nextModules = useMemo(
    () =>
      !hasStartedLearning
        ? []
        : modules.filter((m) => m.progress !== PROGRESS_STATUS.COMPLETED).slice(0, 3),
    [modules, hasStartedLearning]
  )

  const completedModules = useMemo(
    () => modules.filter((m) => m.progress === PROGRESS_STATUS.COMPLETED).slice(-3).reverse(),
    [modules]
  )
  const petStats = useMemo(
    () => [
      { id: 'intelligence', label: 'Интеллект', value: Math.min(100, stats.completed * 12) },
      { id: 'creativity', label: 'Креативность', value: Math.min(100, stats.inProgress * 18 + stats.completed * 6) },
      { id: 'efficiency', label: 'Эффективность', value: Math.min(100, Math.round(stats.progressPct * 0.7)) },
      { id: 'debugging', label: 'Отладка', value: Math.min(100, stats.totalAttempts * 6) },
    ],
    [stats.completed, stats.inProgress, stats.progressPct, stats.totalAttempts]
  )

  return {
    pet,
    stats,
    petLevel,
    petProgress,
    petStats,
    hasStartedLearning,
    hasActiveCourse,
    nextModules,
    completedModules,
    bestPractices: bestPractices.length > 0 ? bestPractices : WEEKLY_PRACTICES,
  }
}
