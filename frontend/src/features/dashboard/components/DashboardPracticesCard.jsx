export default function DashboardPracticesCard({ practices }) {
  return (
    <article className="card dashboard-practices-window">
      <div className="dashboard-section-head">
        <h2 className="section-title">Best practice</h2>
      </div>
      <ul className="dashboard-practices-list">
        {practices.map((practice) => (
          <li key={practice.id} className="dashboard-practice-item">
            <h3>{practice.title}</h3>
            <p className="muted">{practice.description}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}
