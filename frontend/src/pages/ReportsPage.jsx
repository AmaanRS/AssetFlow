import { Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient } from '../api/client.js'
import { humanize } from '../lib/format.js'
import './ReportsPage.css'

const PIE_COLORS = ['#238b79', '#3b82c4', '#a855c4', '#e08b3b', '#e04f5f', '#7c8a86', '#334943']

export function ReportsPage() {
  const query = useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await apiClient.get('/api/reports')).data,
  })

  if (query.isLoading) return <div className="reports-loading"><Loader color="teal" /></div>
  if (query.isError) return <div className="reports-loading">Could not load reports.</div>

  const data = query.data
  const statusData = data.statusBreakdown.map((s) => ({ name: humanize(s.status), value: s.count }))

  return (
    <div className="reports-page">
      <section className="reports-heading">
        <div>
          <p className="page-kicker">Analytics</p>
          <h1>Reports &amp; analytics</h1>
          <p>Operational insight across assets, utilization, maintenance, and bookings.</p>
        </div>
      </section>

      <section className="reports-kpis">
        <Kpi label="Total assets" value={data.totals.totalAssets} />
        <Kpi label="Allocated" value={data.totals.allocatedAssets} />
        <Kpi label="Available" value={data.totals.availableAssets} />
        <Kpi label="Under maintenance" value={data.totals.underMaintenance} />
        <Kpi label="Utilization" value={`${data.totals.utilizationRate}%`} />
      </section>

      <div className="reports-grid">
        <ChartCard title="Assets by status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusData.map((entry, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assets by category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.categoryBreakdown.map((c) => ({ name: c.category, count: c.count }))}>
              <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
              <Bar dataKey="count" fill="#238b79" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Booking activity by weekday">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.bookingHeatmap}>
              <XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
              <Bar dataKey="count" fill="#3b82c4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Allocations by department">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.departmentAllocation.map((d) => ({ name: d.department, count: d.count }))}>
              <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
              <Bar dataKey="count" fill="#a855c4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="reports-lists">
        <ListCard title="Most-used assets" items={data.mostUsedAssets} empty="No allocation activity yet." render={(a) => <><span>{a.assetTag} · {a.name}</span><strong>{a.allocations}</strong></>} />
        <ListCard title="Idle assets (available, never allocated)" items={data.idleAssets} empty="No idle assets." render={(a) => <><span>{a.assetTag} · {a.name}</span></>} />
        <ListCard title="Maintenance by category" items={data.maintenanceByCategory} empty="No maintenance history." render={(m) => <><span>{m.category}</span><strong>{m.count}</strong></>} />
      </div>
    </div>
  )
}

function Kpi({ label, value }) {
  return <div className="reports-kpi"><strong>{value}</strong><span>{label}</span></div>
}

function ChartCard({ title, children }) {
  return <div className="reports-chart-card"><h2>{title}</h2>{children}</div>
}

function ListCard({ title, items, empty, render }) {
  return (
    <div className="reports-list-card">
      <h2>{title}</h2>
      {(!items || items.length === 0) && <p className="reports-list-empty">{empty}</p>}
      {items && items.map((item, index) => <div className="reports-list-row" key={index}>{render(item)}</div>)}
    </div>
  )
}
