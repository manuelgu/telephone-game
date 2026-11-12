import type { ReactNode } from 'react'

interface Props {
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** In-app confirm dialog (native confirm() is ugly and blocks on iOS PWAs). */
export function Confirm({ title, children, confirmLabel, cancelLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onPointerDown={onCancel}>
      <div className="modal card" role="dialog" aria-modal="true" onPointerDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
