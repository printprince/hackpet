import { useEffect, useMemo, useState } from 'react'
import { get } from '../../../api'
import { API, PET, PROGRESS_STATUS } from '../../../constants'
import { WEEKLY_PRACTICES } from '../constants'
import { getProgressStats } from '../../../utils/progress'
import { getPetLevel, getPetProgressToNext } from '../../../utils/pet'

export function useDashboardData(courseDetails) {
  const [pet, setPet] = useState(null)
  const [focusChecklist, setFocusChecklist] = useState([])
  const [bestPractices, setBestPractices] = useState([])

  useEffect(() => {
    get('/pet')
      .then((p) => setPet(p))
      .catch(() => setPet(null))
  }, [])

  useEffect(() => {
    get(`${API.FOCUS}?limit=7`)
      .then((list) => {
        const normalized = Array.isArray(list) ? list : []
        setFocusChecklist(normalized.map((item, idx) => ({
          id: item.id || `focus-${idx + 1}`,
          text: item.title || 'Фокус',
          description: item.description || '',
          done: Boolean(item.done),
        })))
      })
      .catch(() => setFocusChecklist([]))
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

  const stats = getProgressStats(modules)
  const petLevel = getPetLevel(stats.completed)
  const petProgress = getPetProgressToNext(stats.completed, petLevel)

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

  const fallbackChecklist = useMemo(
    () => [
      {
        id: 'finish-active',
        text: 'Закрой хотя бы один модуль, который уже в процессе',
        done: stats.inProgress === 0 && stats.completed > 0,
      },
      {
        id: 'raise-pet',
        text: 'Подними Hackpet на следующий уровень',
        done: petLevel >= PET.LEVEL_MAX,
      },
      {
        id: 'practice',
        text: 'Примени бест практис в текущем PR',
        done: false,
      },
    ],
    [stats.inProgress, stats.completed, petLevel]
  )

  return {
    pet,
    stats,
    petLevel,
    petProgress,
    hasStartedLearning,
    nextModules,
    completedModules,
    bestPractices: bestPractices.length > 0 ? bestPractices : WEEKLY_PRACTICES,
    focusChecklist: focusChecklist.length > 0 ? focusChecklist : fallbackChecklist,
  }
}
