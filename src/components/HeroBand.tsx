import { useI18n } from '../i18n/useI18n'

export function HeroBand() {
  const { t } = useI18n()

  return (
    <header className="hero-band">
      <div className="band-inner">
        <div className="hero-card">
          <p className="hero-eyebrow">{t.hero.eyebrow}</p>
          <h1>{t.hero.title}</h1>
          <p className="hero-sub">{t.hero.subtitle}</p>
        </div>
      </div>
    </header>
  )
}
