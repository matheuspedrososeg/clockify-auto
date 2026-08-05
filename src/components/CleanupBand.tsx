import { Button } from 'antd'
import type { CleanupVM } from '../hooks/useCleanup'
import { useI18n } from '../i18n/useI18n'

interface CleanupBandProps {
  cleanup: CleanupVM
}

export function CleanupBand({ cleanup }: CleanupBandProps) {
  const { t } = useI18n()

  return (
    <section className="cta-band">
      <div className="band-inner">
        <div className="cta-card">
          <div>
            <h2>{t.cleanup.ctaTitle}</h2>
            <p>
              {cleanup.pending > 0 ? t.cleanup.ctaSubtitle(cleanup.pending) : t.cleanup.ctaNothing}
            </p>
          </div>
          <Button
            type="primary"
            loading={cleanup.fixingAll}
            disabled={cleanup.pending === 0}
            onClick={() => cleanup.fixAll()}
          >
            {t.cleanup.ctaButton}
          </Button>
        </div>
      </div>
    </section>
  )
}
