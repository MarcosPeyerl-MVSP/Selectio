import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import './Institutional.css'

export default function InstitutionalLayout({ page, children }) {
  const { t } = useTranslation('institutional')
  const { pathname } = useLocation()
  const title = t(`${page}.title`)
  useEffect(() => {
    const previous = document.title
    document.title = `${title} | Selectio`
    return () => { document.title = previous }
  }, [title])
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return (
    <div className="page institutional-page">
      <Navbar />
      <main key={pathname} className={`institutional-main institutional-main--${page}`}>
        <nav className="institutional-breadcrumb" aria-label={t('breadcrumb')}>
          <Link to="/">{t('home')}</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
        </nav>
        <header className="institutional-heading">
          <p className="institutional-eyebrow">{t('eyebrow')}</p>
          {page === 'notFound' && <p className="institutional-error-code" aria-hidden="true">404</p>}
          <h1>{title}</h1>
          <p>{t(`${page}.intro`)}</p>
        </header>
        {children}
      </main>
      <Footer />
    </div>
  )
}
