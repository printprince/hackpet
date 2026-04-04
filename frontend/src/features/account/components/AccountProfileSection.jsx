export default function AccountProfileSection({
  user,
  fileInputRef,
  avatarUploading,
  avatarError,
  onAvatarChange,
  profileForm,
  onProfileChange,
  profileSaving,
  onProfileSubmit,
  onOpenPasswordModal,
  profileError,
  profileMessage,
}) {
  return (
    <section className="account-section">
      <article className="card account-profile-card account-profile-card-wide">
        <h2 className="account-section-title">Профиль</h2>
        <div className="account-profile-head">
          <div className="account-avatar-wrap">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Аватар пользователя" className="account-avatar account-avatar-image" />
            ) : (
              <div className="account-avatar account-avatar-default" aria-hidden="true">👤</div>
            )}
          </div>
          <div className="account-profile-info">
            <h3 className="account-name">{user.name}</h3>
            <p className="account-email">{user.email}</p>
            <span className="account-role">{user.role}</span>
            <div className="account-avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onAvatarChange}
                className="account-avatar-input"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? 'Загрузка...' : 'Сменить аватар'}
              </button>
              {avatarError ? <span className="account-avatar-error">{avatarError}</span> : null}
            </div>
          </div>
        </div>

        <form className="account-edit-form" onSubmit={onProfileSubmit}>
          <label className="account-edit-field">
            <span>Никнейм</span>
            <input
              type="text"
              value={profileForm.nickname}
              onChange={(e) => onProfileChange('nickname', e.target.value)}
              placeholder="Введите никнейм"
            />
          </label>
          <label className="account-edit-field">
            <span>Фамилия</span>
            <input
              type="text"
              value={profileForm.last_name}
              onChange={(e) => onProfileChange('last_name', e.target.value)}
              placeholder="Фамилия"
            />
          </label>
          <label className="account-edit-field">
            <span>Имя</span>
            <input
              type="text"
              value={profileForm.first_name}
              onChange={(e) => onProfileChange('first_name', e.target.value)}
              placeholder="Имя"
            />
          </label>
          <label className="account-edit-field">
            <span>Отчество (необязательно)</span>
            <input
              type="text"
              value={profileForm.patronymic}
              onChange={(e) => onProfileChange('patronymic', e.target.value)}
              placeholder="Отчество"
            />
          </label>
          <label className="account-edit-field">
            <span>Email</span>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => onProfileChange('email', e.target.value)}
              placeholder="Введите email"
            />
          </label>
          <div className="account-edit-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={profileSaving}>
              {profileSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenPasswordModal}>
              Сменить пароль
            </button>
          </div>
          {profileError ? <p className="form-error">{profileError}</p> : null}
          {profileMessage ? <p className="account-edit-success">{profileMessage}</p> : null}
        </form>
      </article>
    </section>
  )
}
