import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants'
import ArticleMediaImage from './ArticleMediaImage'

export default function RelatedArticlesSection({ related }) {
  if (related.length === 0) return null

  return (
    <section className="articles-related">
      <h2 className="section-title">Читать дальше</h2>
      <div className="articles-grid">
        {related.map((item) => (
          <article key={item.id} className="article-card card">
            <ArticleMediaImage article={item} variant="card" />
            <div className="article-card-top">
              <span className="article-topic">{item.topic}</span>
              <span className="article-meta">{item.level}</span>
            </div>
            <h3>{item.title}</h3>
            <p className="article-summary">{item.summary}</p>
            <div className="article-card-actions">
              <Link to={ROUTES.ARTICLE(item.id)} className="btn btn-primary btn-sm">
                Читать
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
