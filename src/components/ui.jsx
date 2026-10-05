// Small reusable UI pieces used across pages.

export function Alert({ type = 'info', children }) {
  // role="alert" makes screen readers announce errors and success messages.
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function StatusBadge({ status }) {
  const label = status === 'complete' ? 'Complete' : 'Flagged'
  return <span className={`badge badge-${status}`}>{label}</span>
}
