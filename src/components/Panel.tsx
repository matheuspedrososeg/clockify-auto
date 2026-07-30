import type { ReactNode } from 'react'
import { Tooltip } from 'antd'
import { Info } from 'lucide-react'

interface PanelProps {
  index: string
  title: string
  info?: ReactNode
  children: ReactNode
}

export function Panel({ index, title, info, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-index">{index}</span>
        <p className="panel-title">{title}</p>
        {info && (
          <Tooltip title={info} trigger={['hover', 'click']}>
            <button type="button" className="panel-info" aria-label={typeof info === 'string' ? info : undefined}>
              <Info size={14} />
            </button>
          </Tooltip>
        )}
      </div>
      {children}
    </section>
  )
}
