import { Link } from 'react-router-dom'

export default function TrainPage() {
  return (
    <div className="container">
      <div className="card coming-soon-message" style={{ maxWidth: '480px', marginTop: '2rem' }}>
        <span className="course-badge coming-soon">В разработке</span>
        <h1>Train</h1>
        <p className="page-desc">Раздел тренировок пока готовится. Скоро здесь можно будет прокачивать навыки отдельно от курсов.</p>
        <Link to="/" className="btn btn-secondary">На главную</Link>
      </div>
    </div>
  )
}
