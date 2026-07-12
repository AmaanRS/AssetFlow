import { Alert, Button, Skeleton } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { IconAlertCircle, IconAlertTriangle, IconArrowRight, IconPlus } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { DASHBOARD_METRICS, QUICK_ACTIONS, ROLE_DASHBOARD_CONFIG } from '../config/app-ui.js'
import './DashboardPage.css'

async function getDashboardSummary() {
  const { data } = await apiClient.get('/api/dashboard/summary')
  return data
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const roleConfig = ROLE_DASHBOARD_CONFIG[user.role] || ROLE_DASHBOARD_CONFIG.Employee
  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary })
  const quickActions = roleConfig.quickActions.map((key) => QUICK_ACTIONS[key])
  const currentDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <p className="page-kicker">{roleConfig.eyebrow}</p>
          <h1>Good morning, {user.name.split(' ')[0]}</h1>
          <p>{roleConfig.subtitle} Updated {currentDate}.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Button variant="default" leftSection={<IconArrowRight size={18} />} onClick={() => navigate(roleConfig.secondaryAction.path)}>
            {roleConfig.secondaryAction.label}
          </Button>
          <Button color="teal" leftSection={<IconPlus size={18} />} onClick={() => navigate(roleConfig.primaryAction.path)}>
            {roleConfig.primaryAction.label}
          </Button>
        </div>
      </section>

      {summaryQuery.isError && (
        <Alert color="red" icon={<IconAlertCircle size={19} />} title="Dashboard data unavailable">
          {summaryQuery.error.response?.data?.message || 'Could not load the dashboard summary.'}
        </Alert>
      )}

      <section className="kpi-grid" aria-label="Asset overview">
        {DASHBOARD_METRICS.map((metric) => {
          const Icon = metric.icon
          return (
            <article className="kpi-card" key={metric.key}>
              <div className={`kpi-icon tone-${metric.tone}`}><Icon size={21} stroke={1.8} /></div>
              <div className="kpi-value">
                {summaryQuery.isLoading ? <Skeleton height={29} width={46} /> : (summaryQuery.data?.[metric.key] ?? '-')}
              </div>
              <div className="kpi-label">{metric.label}</div>
              <div className="kpi-change">{metric.detail}</div>
            </article>
          )
        })}
      </section>

      {!summaryQuery.isLoading && !summaryQuery.isError && summaryQuery.data.overdueReturns > 0 && (
        <section className="overdue-banner">
          <div className="overdue-icon"><IconAlertTriangle size={21} /></div>
          <div>
            <strong>{summaryQuery.data.overdueReturns} overdue booking {summaryQuery.data.overdueReturns === 1 ? 'return' : 'returns'}</strong>
            <span>These active bookings ended before the current time.</span>
          </div>
          <Button variant="subtle" color="red" rightSection={<IconArrowRight size={16} />} onClick={() => navigate('/bookings')}>Review bookings</Button>
        </section>
      )}

      <section className="dashboard-card quick-card">
        <div className="card-heading">
          <div><h2>Quick actions</h2><p>Actions available for your current role</p></div>
        </div>
        <div className="quick-actions">
          {quickActions.map((action) => {
            const ActionIcon = action.icon
            return (
              <button type="button" key={action.title} onClick={() => navigate(action.path)}>
                <span><ActionIcon size={19} /></span>
                <div><strong>{action.title}</strong><small>{action.detail}</small></div>
                <IconArrowRight size={17} />
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
