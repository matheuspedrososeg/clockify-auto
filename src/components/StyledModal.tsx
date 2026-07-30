import type { ReactNode } from 'react'
import { Modal } from 'antd'

interface StyledModalProps {
  title: string
  okText: string
  cancelText: string
  onOk: () => void
  onCancel: () => void
  okDanger?: boolean
  width?: number
  children: ReactNode
}

export function StyledModal({
  title,
  okText,
  cancelText,
  onOk,
  onCancel,
  okDanger,
  width = 900,
  children,
}: StyledModalProps) {
  return (
    <Modal
      open
      centered
      width={width}
      className="styled-modal"
      title={<p className="panel-title styled-modal-title">{title}</p>}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ danger: okDanger }}
      onOk={onOk}
      onCancel={onCancel}
    >
      {children}
    </Modal>
  )
}

export function ModalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="modal-section">
      <p className="panel-title">{title}</p>
      {children}
    </section>
  )
}
