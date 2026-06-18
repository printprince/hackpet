import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/UserContext'
import { ThemeProvider } from './context/ThemeContext'
import PublicLayout from './PublicLayout'
import Layout from './Layout'
import LandingPage from './pages/LandingPage'
import MainPage from './pages/MainPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'
import AchievementsPage from './pages/AchievementsPage'
import PlayPage from './pages/PlayPage'
import ArticlesPage from './pages/ArticlesPage'
import ArticleDetailPage from './pages/ArticleDetailPage'
import CoursesListPage from './pages/CoursesListPage'
import CourseDetailPage from './pages/CourseDetailPage'
import ModuleFlowPage from './pages/ModuleFlowPage'
import PremiumPage from './pages/PremiumPage'
import { ROUTES } from './constants'
import RequireAuth from './RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
          </Route>
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path={ROUTES.DASHBOARD} element={<MainPage />} />
            <Route
              path="account"
              element={
                <AccountPage />
              }
            />
            <Route
              path="achievements"
              element={
                <AchievementsPage />
              }
            />
            <Route path={ROUTES.PLAY} element={<PlayPage />} />
            <Route path="articles" element={<ArticlesPage />} />
            <Route path="articles/:articleId" element={<ArticleDetailPage />} />
            <Route path="courses" element={<CoursesListPage />} />
            <Route path="premium" element={<PremiumPage />} />
            <Route path="courses/:courseId" element={<CourseDetailPage />} />
            <Route
              path="courses/:courseId/module/:moduleId"
              element={
                <ModuleFlowPage />
              }
            />
          </Route>
        </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
