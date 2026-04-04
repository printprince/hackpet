export default function AccountSidebarNav({ sections, activeSection, onSectionChange }) {
  return (
    <aside className="card account-sidebar">
      <nav className="account-sidebar-nav" aria-label="Разделы профиля">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`account-sidebar-link ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
