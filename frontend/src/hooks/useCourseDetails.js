import { useState, useEffect } from 'react'
import { get } from '../api'
import { COURSE_STATUS } from '../constants'

/**
 * Загружает список курсов и детали по каждому доступному (не coming_soon).
 * Возвращает { courses, courseDetails, loading, error }.
 * courseDetails — массив курсов с полем modules (и progress по модулям).
 */
export function useCourseDetails() {
  const [courses, setCourses] = useState([])
  const [courseDetails, setCourseDetails] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  useEffect(() => {
    setCoursesLoading(true)
    setCoursesError(null)
    get('/courses')
      .then((list) => {
        const arr = Array.isArray(list) ? list : (list?.courses ?? [])
        setCourses(arr)
        return arr
      })
      .catch((e) => {
        setCourses([])
        setCoursesError(e)
      })
      .finally(() => setCoursesLoading(false))
  }, [])

  useEffect(() => {
    const available = courses.filter((c) => (c.status || '') !== COURSE_STATUS.COMING_SOON)
    setDetailsError(null)
    if (available.length === 0) {
      setCourseDetails([])
      setDetailsLoading(false)
      return
    }
    setDetailsLoading(true)
    Promise.all(available.map((c) => get(`/courses/${c.id}`)))
      .then(setCourseDetails)
      .catch((e) => {
        setCourseDetails([])
        setDetailsError(e)
      })
      .finally(() => setDetailsLoading(false))
  }, [courses])

  return {
    courses,
    courseDetails,
    coursesLoading,
    coursesError,
    detailsLoading,
    detailsError,
    loading: coursesLoading || detailsLoading,
    error: coursesError || detailsError,
  }
}
