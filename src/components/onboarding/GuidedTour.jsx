import './GuidedTour.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const cardWidth = 340
const padding = 18

function GuidedTour({ steps = [], storageKey, active = true, onFinish }) {
  const { t } = useTranslation('common')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [cardStyle, setCardStyle] = useState({})
  const currentStep = steps[currentIndex]

  const visibleSteps = useMemo(() => steps.filter(Boolean), [steps])

  const finish = useCallback(() => {
    onFinish?.()
  }, [onFinish])

  const goNextMissingTarget = useCallback(() => {
    setTargetRect(null)

    setCurrentIndex((index) => {
      if (index >= visibleSteps.length - 1) {
        window.setTimeout(finish, 0)
        return index
      }

      return index + 1
    })
  }, [finish, visibleSteps.length])

  useEffect(() => {
    if (!active || !currentStep) return undefined

    let rafId = 0

    const updatePosition = ({ shouldScroll = false } = {}) => {
      if (!currentStep.selector) {
        setTargetRect(null)
        setCardStyle(getCenteredCardPosition())
        return
      }

      const element = document.querySelector(currentStep.selector)

      if (!element) {
        goNextMissingTarget()
        return
      }

      if (shouldScroll && currentStep.scroll !== false) {
        element.scrollIntoView({
          behavior: 'auto',
          block: currentStep.align || getDefaultScrollAlign(element),
          inline: 'nearest'
        })
      }

      rafId = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const nextRect = {
          top: Math.max(8, rect.top - 8),
          left: Math.max(8, rect.left - 8),
          width: Math.min(viewportWidth - 16, rect.width + 16),
          height: Math.min(viewportHeight - 16, rect.height + 16)
        }

        setTargetRect(nextRect)
        setCardStyle(getCardPosition(nextRect))
      })
    }

    const handleViewportChange = () => updatePosition()

    const timeoutId = window.setTimeout(() => updatePosition({ shouldScroll: true }), 0)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [active, currentIndex, currentStep, goNextMissingTarget])

  if (!active || !visibleSteps.length || !currentStep) return null

  const isFirst = currentIndex === 0
  const isLast = currentIndex >= visibleSteps.length - 1

  const goPrevious = () => {
    setCurrentIndex((index) => Math.max(index - 1, 0))
  }

  const goNext = () => {
    if (isLast) {
      finish()
      return
    }

    setCurrentIndex((index) => Math.min(index + 1, visibleSteps.length - 1))
  }

  return (
    <div className="guided-tour" data-tour-key={storageKey} role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
      {targetRect ? (
        <div
          className="guided-tour-highlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height
          }}
        />
      ) : (
        <div className="guided-tour-scrim" />
      )}

      <section className="guided-tour-card" style={cardStyle}>
        <span className="guided-tour-progress">
          {t('guidedTour.progress', { current: currentIndex + 1, total: visibleSteps.length })}
        </span>
        <h2 id="guided-tour-title">{currentStep.title}</h2>
        <p>{currentStep.description}</p>

        <div className="guided-tour-actions">
          <button type="button" className="guided-tour-skip" onClick={finish}>
            {t('guidedTour.skip')}
          </button>

          <div>
            <button type="button" onClick={goPrevious} disabled={isFirst}>
              {t('guidedTour.back')}
            </button>
            <button type="button" className="primary" onClick={goNext}>
              {isLast ? t('guidedTour.finish') : t('guidedTour.next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function getCardPosition(rect) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (viewportWidth <= 720) {
    return {
      left: padding,
      right: padding,
      bottom: padding,
      width: 'auto'
    }
  }

  const fitsRight = rect.left + rect.width + cardWidth + padding < viewportWidth
  const fitsLeft = rect.left - cardWidth - padding > padding
  const fitsBelow = rect.top + rect.height + 220 < viewportHeight
  const targetNearTop = rect.top < 96

  if (targetNearTop && fitsBelow) {
    return {
      top: rect.top + rect.height + padding,
      left: Math.min(Math.max(padding, rect.left - cardWidth + rect.width), viewportWidth - cardWidth - padding),
      width: cardWidth
    }
  }

  if (fitsRight) {
    return {
      top: Math.max(padding, rect.top),
      left: rect.left + rect.width + padding,
      width: cardWidth
    }
  }

  if (fitsLeft) {
    return {
      top: Math.max(padding, rect.top),
      left: rect.left - cardWidth - padding,
      width: cardWidth
    }
  }

  if (fitsBelow) {
    return {
      top: rect.top + rect.height + padding,
      left: Math.min(Math.max(padding, rect.left), viewportWidth - cardWidth - padding),
      width: cardWidth
    }
  }

  return {
    top: Math.max(padding, rect.top - 230),
    left: Math.min(Math.max(padding, rect.left), viewportWidth - cardWidth - padding),
    width: cardWidth
  }
}

function getDefaultScrollAlign(element) {
  if (element.matches('[data-tour$="-sidebar"]')) return 'start'
  if (element.getBoundingClientRect().height > window.innerHeight * 0.65) return 'start'

  return 'center'
}

function getCenteredCardPosition() {
  if (window.innerWidth <= 720) {
    return {
      left: padding,
      right: padding,
      bottom: padding,
      width: 'auto'
    }
  }

  return {
    top: '24vh',
    left: `calc(50% - ${cardWidth / 2}px)`,
    width: cardWidth
  }
}

export default GuidedTour
