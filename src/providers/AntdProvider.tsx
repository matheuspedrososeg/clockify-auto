import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import ptBR from 'antd/locale/pt_BR'
import { antdTheme } from '../theme'
import { useI18n } from '../i18n/useI18n'
import type { Lang } from '../i18n/dictionaries'

const ANTD_LOCALES = { en: enUS, pt: ptBR } satisfies Record<Lang, typeof enUS>

export function AntdProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n()

  return (
    <ConfigProvider theme={antdTheme} locale={ANTD_LOCALES[lang]}>
      {children}
    </ConfigProvider>
  )
}
