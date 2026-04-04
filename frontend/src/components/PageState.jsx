import { Link } from 'react-router-dom'
import { ROUTES } from '../constants'

export default function PageState({ type, title, description, actionLabel, actionTo }) {
  if (!type) return null

  const defaultTitle = type === 'error' ? 'Что-то пошло не так' : 'Пока пусто'
  const defaultDescription =
    type === 'error'
      ? 'Не удалось загрузить данные. Попробуйте снова позже.'
      : 'Данные пока отсутствуют.'

  return (
    <div className={`card page-state page-state-${type}`}>
      <h3 className="page-state-title">{title || defaultTitle}</h3>
      <p className="muted">{description || defaultDescription}</p>
      {actionLabel && (
        <Link to={actionTo || ROUTES.COURSES} className="btn btn-secondary page-state-action">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
