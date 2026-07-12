import {
  IconArrowsExchange,
  IconBell,
  IconBuilding,
  IconCalendarEvent,
  IconChartBar,
  IconClipboardCheck,
  IconDashboard,
  IconPackage,
  IconTool,
} from '@tabler/icons-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: IconDashboard, roles: ['ALL'] },
  { label: 'Organization setup', path: '/organization', icon: IconBuilding, roles: ['Admin'] },
  { label: 'Assets', path: '/assets', icon: IconPackage, roles: ['ALL'] },
  { label: 'Allocation & transfer', path: '/allocations', icon: IconArrowsExchange, roles: ['ALL'] },
  { label: 'Resource booking', path: '/bookings', icon: IconCalendarEvent, roles: ['ALL'] },
  { label: 'Maintenance', path: '/maintenance', icon: IconTool, roles: ['ALL'] },
  { label: 'Audit', path: '/audits', icon: IconClipboardCheck, roles: ['ALL'] },
  { label: 'Reports', path: '/reports', icon: IconChartBar, roles: ['Admin', 'AssetManager', 'DepartmentHead'] },
  { label: 'Notifications', path: '/notifications', icon: IconBell, roles: ['ALL'] },
]

export const ROLE_DASHBOARD_CONFIG = {
  Admin: {
    eyebrow: 'Organization overview',
    subtitle: 'Organization-wide asset and workflow metrics from AssetFlow.',
    primaryAction: { label: 'Organization setup', path: '/organization' },
    secondaryAction: { label: 'Register asset', path: '/assets' },
    quickActions: ['organization', 'asset', 'booking'],
  },
  AssetManager: {
    eyebrow: 'Operations overview',
    subtitle: 'Review organization-wide asset movement, maintenance, and returns.',
    primaryAction: { label: 'Register asset', path: '/assets' },
    secondaryAction: { label: 'Review transfers', path: '/allocations' },
    quickActions: ['asset', 'booking', 'maintenance'],
  },
  DepartmentHead: {
    eyebrow: 'Department workspace',
    subtitle: 'Review current organization metrics and manage available workflows.',
    primaryAction: { label: 'Book resource', path: '/bookings' },
    secondaryAction: { label: 'Request transfer', path: '/allocations' },
    quickActions: ['booking', 'maintenance', 'transfer'],
  },
  Employee: {
    eyebrow: 'My workspace',
    subtitle: 'Review current organization metrics and access your asset workflows.',
    primaryAction: { label: 'Book resource', path: '/bookings' },
    secondaryAction: { label: 'Request return', path: '/allocations' },
    quickActions: ['booking', 'maintenance', 'transfer'],
  },
}

export const QUICK_ACTIONS = {
  organization: { title: 'Organization setup', detail: 'Manage employees and role promotions', icon: IconBuilding, path: '/organization' },
  asset: { title: 'Register an asset', detail: 'Create an available asset record', icon: IconPackage, path: '/assets' },
  booking: { title: 'Book a resource', detail: 'Reserve a shared asset by time slot', icon: IconCalendarEvent, path: '/bookings' },
  maintenance: { title: 'Raise maintenance', detail: 'Create a maintenance request', icon: IconTool, path: '/maintenance' },
  transfer: { title: 'Asset requests', detail: 'Review transfer and return options', icon: IconArrowsExchange, path: '/allocations' },
}

export const DASHBOARD_METRICS = [
  { key: 'assetsAvailable', label: 'Available assets', detail: 'Status: Available', tone: 'green', icon: IconPackage },
  { key: 'assetsAllocated', label: 'Allocated assets', detail: 'Status: Allocated', tone: 'blue', icon: IconArrowsExchange },
  { key: 'maintenanceToday', label: 'Maintenance today', detail: 'Raised today (UTC)', tone: 'orange', icon: IconTool },
  { key: 'activeBookings', label: 'Active bookings', detail: 'Currently in progress', tone: 'violet', icon: IconCalendarEvent },
  { key: 'pendingTransfers', label: 'Pending transfers', detail: 'Awaiting action', tone: 'pink', icon: IconArrowsExchange },
  { key: 'upcomingReturns', label: 'Upcoming returns', detail: 'Booking ends within 7 days', tone: 'cyan', icon: IconClipboardCheck },
]
