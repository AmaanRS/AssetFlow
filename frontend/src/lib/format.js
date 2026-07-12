// Small presentation helpers shared across AssetFlow screens.

export function humanize(value) {
  if (value == null) return ''
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
}

export const ASSET_STATUS_COLORS = {
  Available: 'teal',
  Allocated: 'blue',
  Reserved: 'grape',
  UnderMaintenance: 'orange',
  Lost: 'red',
  Retired: 'gray',
  Disposed: 'dark',
}

export const ASSET_STATUSES = [
  'Available',
  'Allocated',
  'Reserved',
  'UnderMaintenance',
  'Lost',
  'Retired',
  'Disposed',
]

export const WORKFLOW_STATUS_COLORS = {
  // Allocations
  Active: 'teal',
  ReturnRequested: 'orange',
  Returned: 'gray',
  // Transfers / maintenance
  Requested: 'blue',
  Pending: 'blue',
  Approved: 'teal',
  Rejected: 'red',
  InProgress: 'orange',
  Resolved: 'teal',
  TechnicianAssigned: 'grape',
  // Bookings
  Cancelled: 'gray',
  Completed: 'gray',
  Ongoing: 'orange',
  Upcoming: 'blue',
}

export function assetStatusColor(status) {
  return ASSET_STATUS_COLORS[status] || 'gray'
}

export function workflowStatusColor(status) {
  return WORKFLOW_STATUS_COLORS[status] || 'gray'
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function holderLabel(entity) {
  if (!entity) return 'Unassigned'
  if (entity.currentHolderUser) return entity.currentHolderUser.name
  if (entity.currentHolderDepartment) return `${entity.currentHolderDepartment.name} (dept)`
  return 'Unassigned'
}
