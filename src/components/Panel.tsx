import type { ReactNode } from 'react'

interface PanelProps {
  index: string
  title: string
  children: ReactNode
}

export function Panel({ index, title, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-index">{index}</span>
        <p className="panel-title">{title}</p>
      </div>
      {children}
    </section>
  )
}
