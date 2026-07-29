import { Segmented } from 'antd'
import { useI18n } from '../i18n/useI18n'
import { LANG_OPTIONS, type Lang } from '../i18n/dictionaries'

export function TopNav() {
  const { lang, setLang, t } = useI18n()

  return (
    <nav className="top-nav">
      <div className="band-inner top-nav-inner">
        <span className="top-nav-brand">{t.nav.brand}</span>
        <div className="top-nav-lang">
          <Segmented
            size="small"
            options={LANG_OPTIONS}
            value={lang}
            onChange={v => setLang(v as Lang)}
          />
        </div>
      </div>
    </nav>
  )
}
