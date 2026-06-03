import { useEffect } from 'react'
import DemoCarousel from './DemoCarousel'

/**
 * Полноэкранная модалка демо-тура.
 * Содержимое (карусель шагов) переиспользуется из DemoCarousel.
 * Размонтируется при закрытии — поэтому при каждом открытии стартует с первого шага.
 */
export default function DemoTour({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="dev-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="dev-modal demo-tour-card"
        role="dialog"
        aria-modal="true"
        aria-label="Демо Hackpet"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dev-modal-close" aria-label="Закрыть демо" onClick={onClose}>
          ×
        </button>
        <DemoCarousel
          enableKeyboard
          lastActionLabel="Закрыть"
          onLastAction={onClose}
          onCtaNavigate={onClose}
        />
      </div>
    </div>
  )
}
