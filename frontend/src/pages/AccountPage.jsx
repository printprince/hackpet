import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth, useUser } from '../context/UserContext'
import { useCourseDetails } from '../hooks/useCourseDetails'
import { groupModulesByCourse, getProgressStats } from '../utils/progress'
import { getPetAura, getUnlockedPetAuras, getPetActivityStatus } from '../utils/pet'
import { API, PET, PROGRESS_STATUS } from '../constants'
import { get, post } from '../api'
import {
  ACCOUNT_SECTIONS,
  AccountSidebarNav,
  AccountProfileSection,
  AccountPetSection,
  AccountCertificatesSection,
  AccountAnalyticsSection,
  AccountPasswordDevModal,
} from '../features/account'
import PetAvatar from '../components/PetAvatar'

function getCompletedCourses(courseDetails) {
  return (courseDetails || []).filter((c) => {
    if (typeof c.completed === 'boolean') {
      return c.completed
    }
    const modules = c.modules || []
    return modules.length > 0 && modules.every((m) => m.progress === PROGRESS_STATUS.COMPLETED)
  })
}

const ACCOUNT_SECTION_IDS = new Set(ACCOUNT_SECTIONS.map((s) => s.id))

export default function AccountPage() {
  const [searchParams] = useSearchParams()
  const { uploadAvatar, updateProfile } = useAuth()
  const user = useUser()
  const { courseDetails, loading, error } = useCourseDetails()
  const [pet, setPet] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileForm, setProfileForm] = useState({ nickname: '', email: '', last_name: '', first_name: '', patronymic: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [petName, setPetName] = useState('')
  const [petNameSaving, setPetNameSaving] = useState(false)
  const [petNameMessage, setPetNameMessage] = useState('')
  const [petNameError, setPetNameError] = useState('')
  const [activeSection, setActiveSection] = useState('profile')
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [auraPreview, setAuraPreview] = useState(null)
  const [isAuraModalOpen, setIsAuraModalOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    get(API.PET.GET)
      .then((p) => {
        setPet(p)
        setPetName(p?.name || '')
      })
      .catch(() => {
        setPet(null)
        setPetName('')
      })
  }, [])

  const sectionFromUrl = searchParams.get('section')
  useEffect(() => {
    if (sectionFromUrl && ACCOUNT_SECTION_IDS.has(sectionFromUrl)) {
      setActiveSection(sectionFromUrl)
    }
  }, [sectionFromUrl])

  useEffect(() => {
    setProfileForm({
      nickname: user.nickname || '',
      email: user.email || '',
      last_name: user.lastName || '',
      first_name: user.firstName || '',
      patronymic: user.patronymic || '',
    })
  }, [user.nickname, user.email, user.lastName, user.firstName, user.patronymic])

  const progress = useMemo(() => {
    return (courseDetails || []).flatMap((c) =>
      (c.modules || []).map((m) => ({ ...m, courseTitle: c.title, courseId: c.id }))
    )
  }, [courseDetails])

  const { completed, inProgress, totalAttempts, total: totalModules, progressPct } = getProgressStats(progress)
  const hasStartedLearning = useMemo(
    () => progress.some((m) => m.progress && m.progress !== PROGRESS_STATUS.NOT_STARTED),
    [progress]
  )
  const courseProgressList = useMemo(
    () =>
      groupModulesByCourse(progress).filter(
        (c) => c.modules.some((m) => m.progress && m.progress !== PROGRESS_STATUS.NOT_STARTED)
      ),
    [progress]
  )
  const learningMinutes = useMemo(
    () =>
      progress.reduce((acc, m) => {
        const minutes = Number(m.minutes) || 0
        if (m.progress === PROGRESS_STATUS.COMPLETED) return acc + minutes
        if (m.progress === PROGRESS_STATUS.IN_PROGRESS) return acc + Math.round(minutes * 0.5)
        return acc
      }, 0),
    [progress]
  )
  const learningHours = (learningMinutes / 60).toFixed(1)
  const certificates = useMemo(() => getCompletedCourses(courseDetails), [courseDetails])
  const petLevel = Math.max(1, Number(pet?.level) || 1)
  const petStatus = getPetActivityStatus({ hasActiveCourse: inProgress > 0 })
  const autoAura = getPetAura(petLevel)
  const unlockedAuras = getUnlockedPetAuras(petLevel, {
    completedCourses: certificates.length,
  })
  const equippedAuraId = pet?.equipped_aura
  const petAura =
    (unlockedAuras && unlockedAuras.find((a) => a.id === equippedAuraId)) || autoAura
  const petStats = [
    { id: 'intelligence', label: 'Интеллект', value: Math.min(100, completed * 12) },
    { id: 'creativity', label: 'Креативность', value: Math.min(100, inProgress * 18 + completed * 6) },
    { id: 'efficiency', label: 'Эффективность', value: Math.min(100, Math.round(progressPct * 0.7)) },
    { id: 'debugging', label: 'Отладка', value: Math.min(100, totalAttempts * 6) },
  ]

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setAvatarError('Поддерживаются только png, jpg, webp.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Максимальный размер аватара — 2MB.')
      return
    }
    setAvatarError('')
    setAvatarUploading(true)
    try {
      await uploadAvatar(file)
    } catch (err) {
      setAvatarError(err?.message || 'Не удалось загрузить аватар.')
    } finally {
      setAvatarUploading(false)
      if (event.target) event.target.value = ''
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    const nickname = profileForm.nickname.trim()
    const email = profileForm.email.trim().toLowerCase()
    const last_name = profileForm.last_name.trim()
    const first_name = profileForm.first_name.trim()
    const patronymic = profileForm.patronymic.trim()
    if (!nickname || !email) {
      setProfileError('Никнейм и email обязательны.')
      setProfileMessage('')
      return
    }
    if (!last_name || !first_name) {
      setProfileError('Фамилия и имя обязательны.')
      setProfileMessage('')
      return
    }
    setProfileSaving(true)
    setProfileError('')
    setProfileMessage('')
    try {
      await updateProfile({ nickname, email, last_name, first_name, patronymic })
      setProfileMessage('Профиль успешно обновлен.')
    } catch (err) {
      setProfileError(err?.message || 'Не удалось обновить профиль.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePetNameSubmit(event) {
    event.preventDefault()
    const nextName = petName.trim()
    if (!nextName) {
      setPetNameError('Введите имя питомца.')
      setPetNameMessage('')
      return
    }
    if (nextName.length > 24) {
      setPetNameError('Имя питомца не должно превышать 24 символа.')
      setPetNameMessage('')
      return
    }
    setPetNameSaving(true)
    setPetNameError('')
    setPetNameMessage('')
    try {
      const updatedPet = await post(API.PET.UPDATE_NAME, { name: nextName })
      setPet(updatedPet)
      setPetName(updatedPet?.name || nextName)
      setPetNameMessage('Имя питомца обновлено.')
    } catch (err) {
      setPetNameError(err?.message || 'Не удалось обновить имя питомца.')
    } finally {
      setPetNameSaving(false)
    }
  }

  async function handlePetVariantChange(variantId) {
    if (!variantId) return
    try {
      const updatedPet = await post(API.PET.UPDATE_VARIANT, { variant: variantId })
      setPet(updatedPet)
      setPetName(updatedPet?.name || '')
      setPetNameError('')
      setPetNameMessage('')
    } catch (err) {
      console.error(err)
    }
  }

  async function handlePetAuraChange(auraId) {
    if (!auraId) return
    // Не даём выбрать ауру, которая ещё не разблокирована по уровню.
    if (!unlockedAuras.some((a) => a.id === auraId)) {
      return
    }
    try {
      const updatedPet = await post(API.PET.UPDATE_AURA, { aura: auraId })
      setPet(updatedPet)
    } catch (err) {
      // Тихо игнорируем, визуально ничего не ломаем.
      // Можно будет добавить тост, если понадобится.
      console.error(err)
    }
  }

  function handleOpenAuraPreview(aura) {
    if (!aura) return
    const isUnlocked = unlockedAuras.some((a) => a.id === aura.id)
    setAuraPreview({
      aura,
      isUnlocked,
    })
    setIsAuraModalOpen(true)
  }

  function handleCloseAuraPreview() {
    setIsAuraModalOpen(false)
    setAuraPreview(null)
  }

  return (
    <div className="account-page">
      <div className="container account-content">
        <h1 className="account-page-title">Профиль</h1>
        <p className="page-desc">Управление аккаунтом, питомцем и вашим обучением.</p>

        <div className="account-layout">
          <AccountSidebarNav
            sections={ACCOUNT_SECTIONS}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <div className="account-panel">
            {activeSection === 'profile' && (
              <AccountProfileSection
                user={user}
                fileInputRef={fileInputRef}
                avatarUploading={avatarUploading}
                avatarError={avatarError}
                onAvatarChange={handleAvatarChange}
                profileForm={profileForm}
                onProfileChange={(field, value) =>
                  setProfileForm((prev) => ({ ...prev, [field]: value }))
                }
                profileSaving={profileSaving}
                onProfileSubmit={handleProfileSubmit}
                onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
                profileError={profileError}
                profileMessage={profileMessage}
              />
            )}

            {activeSection === 'pet' && (
              <AccountPetSection
                pet={pet}
                petLevel={petLevel}
                petStatus={petStatus}
                petAura={petAura}
                unlockedAuras={unlockedAuras}
                onAuraPreview={handleOpenAuraPreview}
                petName={petName}
                onPetNameChange={setPetName}
                petNameSaving={petNameSaving}
                onPetNameSubmit={handlePetNameSubmit}
                petNameError={petNameError}
                petNameMessage={petNameMessage}
                petStats={petStats}
                onPetVariantChange={handlePetVariantChange}
              />
            )}

            {activeSection === 'certificates' && (
              <AccountCertificatesSection certificates={certificates} />
            )}

            {activeSection === 'analytics' && (
              <AccountAnalyticsSection
                loading={loading}
                error={error}
                hasStartedLearning={hasStartedLearning}
                courseProgressList={courseProgressList}
                totalModules={totalModules}
                progressPct={progressPct}
                completed={completed}
                inProgress={inProgress}
                totalAttempts={totalAttempts}
                learningHours={learningHours}
              />
            )}
          </div>
        </div>

      </div>

      <AccountPasswordDevModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
      <PetAuraModal
        isOpen={isAuraModalOpen}
        petName={pet?.name || 'Hackpet'}
        petLevel={petLevel}
        equippedVariant={pet?.equipped_variant || 'classic'}
        petAura={petAura}
        preview={auraPreview}
        onClose={handleCloseAuraPreview}
        onApply={(id) => {
          handlePetAuraChange(id)
          handleCloseAuraPreview()
        }}
      />
    </div>
  )
}

function PetAuraModal({
  isOpen,
  petName,
  petLevel,
  equippedVariant,
  petAura,
  preview,
  onClose,
  onApply,
}) {
  if (!isOpen || !preview) return null

  const { aura, isUnlocked } = preview
  const isActive = petAura && petAura.id === aura.id
  const canApply = isUnlocked && !isActive

  return (
    <div className="dev-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="dev-modal dev-modal-aura"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="dev-modal-close"
          aria-label="Закрыть модалку"
          onClick={onClose}
        >
          ×
        </button>
        <h2>Подсветка для питомца</h2>
        <p className="muted">
          Примерка ауры <strong>{aura.label}</strong> для питомца {petName}.
        </p>
        <div className="pet-aura-modal-preview">
          <div className="pet-avatar-wrap">
            <PetAvatar
              level={petLevel}
              variant={equippedVariant}
              auraClassNames={aura?.id && aura.id !== 'none' ? [`pet-avatar-aura-${aura.id}`] : []}
            />
            <span className="pet-level">Аура</span>
          </div>
        </div>
        {!isUnlocked && (
          <p className="muted">
            Эта подсветка станет доступна позже. Продолжайте тренировать Хакпета, чтобы открыть её.
          </p>
        )}
        {isUnlocked && isActive && (
          <p className="muted">Эта подсветка уже активна для вашего питомца.</p>
        )}
        <div className="dev-modal-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Закрыть
          </button>
          {canApply && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApply && onApply(aura.id)}
            >
              Применить подсветку
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
