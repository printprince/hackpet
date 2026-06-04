import { useUser } from '../context/UserContext'
import { useCourseDetails } from '../hooks/useCourseDetails'
import {
  useDashboardData,
  DashboardPetCard,
  DashboardProgressCard,
  DashboardFocusCard,
  DashboardActivityCard,
} from '../features/dashboard'

export default function MainPage() {
  const user = useUser()
  const firstName = user.firstName || user.nickname?.split(/\s+/)[0] || 'друг'
  const { courseDetails } = useCourseDetails()
  const dashboard = useDashboardData(courseDetails)

  return (
    <div className="main-page dashboard-page">
      <section className="section dashboard-header">
        <div className="container">
          <span className="page-eyebrow dashboard-eyebrow">dashboard · home</span>
          <h1>Привет, {firstName}! Продолжаем прокачку безопасности</h1>
          <p className="page-desc">
            Здесь твой текущий прогресс, состояние Hackpet и бест практис по secure coding.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="dashboard-main-column">
            <div className="dashboard-grid">
              <DashboardPetCard
                pet={dashboard.pet}
                petLevel={dashboard.petLevel}
                petProgress={dashboard.petProgress}
                petStats={dashboard.petStats}
                hasActiveCourse={dashboard.hasActiveCourse}
              />

              <DashboardProgressCard
                stats={dashboard.stats}
                hasStartedLearning={dashboard.hasStartedLearning}
                recommendedCourses={dashboard.recommendedCourses}
              />
            </div>

            <div className="dashboard-layout-grid">
              <DashboardFocusCard practices={dashboard.bestPractices} />

              <DashboardActivityCard
                hasStartedLearning={dashboard.hasStartedLearning}
                completedModules={dashboard.completedModules}
                nextModules={dashboard.nextModules}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
