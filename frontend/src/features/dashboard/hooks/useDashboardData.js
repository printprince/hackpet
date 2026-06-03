import { useEffect, useMemo, useState } from 'react'
import { get } from '../../../api'
import { API, PROGRESS_STATUS } from '../../../constants'
import { WEEKLY_PRACTICES } from '../constants'
import { getProgressStats } from '../../../utils/progress'
import { getPetProgressFromXP, getPracticalPetStats } from '../../../utils/pet'

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
  const recommendedCourses = useMemo(() => {
    const list = Array.isArray(courseDetails) ? courseDetails : []
    const ranked = list
      .map((course) => {
        const courseModules = course.modules || []
        const total = courseModules.length
        const completed = courseModules.filter((m) => m.progress === PROGRESS_STATUS.COMPLETED).length
        const inProgress = courseModules.some((m) => m.progress === PROGRESS_STATUS.IN_PROGRESS)
        const isCompleted = Boolean(course.completed) || (total > 0 && completed === total)
        return {
          id: course.id,
          title: course.title || 'Курс',
          total,
          completed,
          inProgress,
          isCompleted,
          score: (inProgress ? 100 : 0) + (total > 0 ? Math.round((completed / total) * 100) : 0),
        }
      })
      .filter((course) => !course.isCompleted)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    return ranked
  }, [courseDetails])
  const petStats = useMemo(
    () =>
      getPracticalPetStats({
        completedModules: stats.completed,
        inProgressModules: stats.inProgress,
        totalLabAttempts: stats.totalAttempts,
        totalProgressPct: stats.progressPct,
        petXP: pet?.xp,
      }),
    [stats.completed, stats.inProgress, stats.progressPct, stats.totalAttempts, pet?.xp]
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
    recommendedCourses,
    bestPractices: bestPractices.length > 0 ? bestPractices : WEEKLY_PRACTICES,
  }
}
