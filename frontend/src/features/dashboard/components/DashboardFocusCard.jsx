export default function DashboardFocusCard({ practices = [] }) {
  return (
    <article className="card dashboard-focus-card">
      <h2>Лучшие практики</h2>
      <ul className="dashboard-checklist">
        {practices.length === 0 && <li className="dashboard-checklist-empty">Пока нет практик</li>}
        {practices.map((item) => (
          <li key={item.id}>
            <span className="dashboard-check-copy">
              <strong>{item.title}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
