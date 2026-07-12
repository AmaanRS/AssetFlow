import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconClipboardCheck, IconPlus, IconUserPlus } from '@tabler/icons-react'
import { apiClient } from '../api/client.js'
import { toDepartmentOptions, toUserOptions, useDepartments, useUsers } from '../api/hooks.js'
import { useAuth } from '../auth/useAuth.js'
import { formatDate, humanize } from '../lib/format.js'
import './AuditPage.css'

const VERIFY_STATUSES = [
  { value: 'Verified', color: 'teal' },
  { value: 'Missing', color: 'red' },
  { value: 'Damaged', color: 'orange' },
]

export function AuditPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [createOpened, createControls] = useDisclosure(false)
  const [selectedId, setSelectedId] = useState(null)
  const canManage = ['Admin', 'AssetManager'].includes(user.role)

  const cyclesQuery = useQuery({
    queryKey: ['audit-cycles'],
    queryFn: async () => (await apiClient.get('/api/audit-cycles')).data.auditCycles,
  })

  const cycles = cyclesQuery.data || []

  return (
    <div className="audit-page">
      <section className="audit-heading">
        <div>
          <p className="page-kicker">Verification</p>
          <h1>Asset audits</h1>
          <p>Run structured audit cycles, verify assets, and auto-generate discrepancy reports.</p>
        </div>
        {canManage && <Button color="teal" leftSection={<IconPlus size={18} />} onClick={createControls.open}>New audit cycle</Button>}
      </section>

      {cyclesQuery.isLoading && <div className="audit-loading"><Loader color="teal" /></div>}
      {!cyclesQuery.isLoading && cycles.length === 0 && (
        <div className="audit-empty"><span><IconClipboardCheck size={28} stroke={1.5} /></span><h3>No audit cycles yet</h3><p>{canManage ? 'Create a cycle to start verifying assets.' : 'Cycles you are assigned to will appear here.'}</p></div>
      )}

      <div className="audit-grid">
        {cycles.map((cycle) => (
          <button type="button" className="audit-card" key={cycle.auditCycleId} onClick={() => setSelectedId(cycle.auditCycleId)}>
            <div className="audit-card-top">
              <strong>{cycle.name}</strong>
              <Badge variant="light" color={cycle.status === 'Open' ? 'teal' : 'gray'}>{cycle.status}</Badge>
            </div>
            <p className="audit-card-scope">{cycle.scopeLocation ? `Location: ${cycle.scopeLocation}` : cycle.scopeDepartmentId ? `Department #${cycle.scopeDepartmentId}` : 'Whole organization'}</p>
            <div className="audit-card-meta">
              <span>{formatDate(cycle.startDate)} → {formatDate(cycle.endDate)}</span>
              <span>{cycle.assignments.length} auditor(s) · {cycle._count.verifications} verified</span>
            </div>
          </button>
        ))}
      </div>

      <CreateCycleModal opened={createOpened} onClose={createControls.close} onCreated={() => queryClient.invalidateQueries({ queryKey: ['audit-cycles'] })} />
      <CycleDrawer cycleId={selectedId} onClose={() => setSelectedId(null)} user={user} canManage={canManage} />
    </div>
  )
}

function CreateCycleModal({ opened, onClose, onCreated }) {
  const departmentsQuery = useDepartments()
  const [name, setName] = useState('')
  const [scopeDepartmentId, setScopeDepartmentId] = useState(null)
  const [scopeLocation, setScopeLocation] = useState('')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { if (opened) { setName(''); setScopeDepartmentId(null); setScopeLocation(''); setStartDate(null); setEndDate(null); setError(null) } }, [opened])

  const mutation = useMutation({
    mutationFn: async () => (await apiClient.post('/api/audit-cycles', {
      name: name.trim(),
      scopeDepartmentId: scopeDepartmentId ? Number(scopeDepartmentId) : null,
      scopeLocation: scopeLocation.trim() || null,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    })).data.auditCycle,
    onSuccess: () => {
      notifications.show({ color: 'teal', title: 'Audit cycle created', message: name })
      onCreated(); onClose()
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not create the cycle.'),
  })

  const submit = () => {
    setError(null)
    if (name.trim().length < 2) return setError('Enter a cycle name.')
    if (!startDate || !endDate) return setError('Select a start and end date.')
    mutation.mutate()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New audit cycle" centered classNames={{ title: 'app-modal-title', header: 'app-modal-header', body: 'app-modal-body', content: 'app-modal-content' }}>
      <Stack gap="md">
        <TextInput label="Cycle name" placeholder="Q3 IT Audit" withAsterisk value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Select label="Scope: department (optional)" placeholder="Whole organization" data={toDepartmentOptions(departmentsQuery.data)} value={scopeDepartmentId} onChange={setScopeDepartmentId} clearable searchable />
        <TextInput label="Scope: location (optional)" placeholder="e.g. Floor 1" value={scopeLocation} onChange={(e) => setScopeLocation(e.currentTarget.value)} />
        <Group grow>
          <DateInput label="Start date" valueFormat="DD MMM YYYY" withAsterisk value={startDate} onChange={setStartDate} />
          <DateInput label="End date" valueFormat="DD MMM YYYY" withAsterisk value={endDate} onChange={setEndDate} />
        </Group>
        {error && <div className="workflow-error">{error}</div>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>Cancel</Button><Button color="teal" loading={mutation.isPending} onClick={submit}>Create cycle</Button></Group>
      </Stack>
    </Modal>
  )
}

function CycleDrawer({ cycleId, onClose, user, canManage }) {
  const queryClient = useQueryClient()
  const usersQuery = useUsers()
  const [auditorId, setAuditorId] = useState(null)

  const detailQuery = useQuery({
    queryKey: ['audit-cycle', cycleId],
    queryFn: async () => (await apiClient.get(`/api/audit-cycles/${cycleId}`)).data,
    enabled: Boolean(cycleId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['audit-cycle', cycleId] })
    queryClient.invalidateQueries({ queryKey: ['audit-cycles'] })
  }

  const addAuditor = useMutation({
    mutationFn: async () => apiClient.post(`/api/audit-cycles/${cycleId}/assignments`, { auditorUserId: Number(auditorId) }),
    onSuccess: () => { setAuditorId(null); invalidate(); notifications.show({ color: 'teal', title: 'Auditor assigned', message: 'The auditor was added.' }) },
    onError: (err) => notifications.show({ color: 'red', title: 'Failed', message: err.response?.data?.message || 'Could not assign auditor.' }),
  })

  const verify = useMutation({
    mutationFn: async ({ assetId, verifiedStatus }) => apiClient.post(`/api/audit-cycles/${cycleId}/verifications`, { assetId, verifiedStatus }),
    onSuccess: () => invalidate(),
    onError: (err) => notifications.show({ color: 'red', title: 'Verification failed', message: err.response?.data?.message || 'Could not verify.' }),
  })

  const close = useMutation({
    mutationFn: async () => (await apiClient.patch(`/api/audit-cycles/${cycleId}/close`)).data,
    onSuccess: (data) => { invalidate(); queryClient.invalidateQueries({ queryKey: ['assets'] }); notifications.show({ color: 'teal', title: 'Cycle closed', message: data.summary }) },
    onError: (err) => notifications.show({ color: 'red', title: 'Failed', message: err.response?.data?.message || 'Could not close cycle.' }),
  })

  const cycle = detailQuery.data?.auditCycle
  const assets = detailQuery.data?.assets || []
  const isOpen = cycle?.status === 'Open'
  const isAssigned = cycle?.assignments?.some((a) => a.auditorUserId === user.userId)
  const canVerify = isOpen && (isAssigned || canManage)

  return (
    <Drawer opened={Boolean(cycleId)} onClose={onClose} position="right" size="xl" title={cycle?.name || 'Audit cycle'} classNames={{ title: 'app-modal-title', header: 'app-modal-header' }}>
      {detailQuery.isLoading && <div className="audit-loading"><Loader color="teal" /></div>}
      {cycle && (
        <Stack gap="lg">
          <Group gap="sm">
            <Badge variant="light" color={isOpen ? 'teal' : 'gray'} size="lg">{cycle.status}</Badge>
            <span className="audit-drawer-meta">{formatDate(cycle.startDate)} → {formatDate(cycle.endDate)}</span>
          </Group>

          <div>
            <h3 className="audit-section-title">Auditors</h3>
            <Group gap="xs">
              {cycle.assignments.length === 0 && <span className="audit-muted">No auditors assigned yet.</span>}
              {cycle.assignments.map((a) => <Badge key={a.auditAssignmentId} variant="light" color="grape">{a.auditor.name}</Badge>)}
            </Group>
            {canManage && isOpen && (
              <Group gap="xs" mt="sm">
                <Select placeholder="Add auditor" data={toUserOptions(usersQuery.data)} value={auditorId} onChange={setAuditorId} searchable style={{ flex: 1 }} />
                <Button variant="light" color="teal" leftSection={<IconUserPlus size={16} />} disabled={!auditorId} loading={addAuditor.isPending} onClick={() => addAuditor.mutate()}>Add</Button>
              </Group>
            )}
          </div>

          <div>
            <h3 className="audit-section-title">Assets in scope ({assets.length})</h3>
            <div className="audit-asset-list">
              {assets.map((asset) => (
                <div className="audit-asset-row" key={asset.assetId}>
                  <div className="audit-asset-identity"><strong>{asset.assetTag}</strong><span>{asset.name}</span></div>
                  {asset.verification ? (
                    <Badge variant="light" color={VERIFY_STATUSES.find((s) => s.value === asset.verification.verifiedStatus)?.color || 'gray'}>{asset.verification.verifiedStatus}</Badge>
                  ) : (
                    <Badge variant="outline" color="gray">Unverified</Badge>
                  )}
                  {canVerify && (
                    <Group gap={4} wrap="nowrap">
                      {VERIFY_STATUSES.map((s) => (
                        <Button key={s.value} size="compact-xs" variant={asset.verification?.verifiedStatus === s.value ? 'filled' : 'subtle'} color={s.color} onClick={() => verify.mutate({ assetId: asset.assetId, verifiedStatus: s.value })}>{s.value}</Button>
                      ))}
                    </Group>
                  )}
                </div>
              ))}
            </div>
          </div>

          {cycle.discrepancyReports?.length > 0 && (
            <div>
              <h3 className="audit-section-title">Discrepancy report</h3>
              {cycle.discrepancyReports.map((report) => (
                <div className="audit-report" key={report.reportId}>
                  <Badge variant="light" color={report.status === 'Clean' ? 'teal' : 'red'}>{report.status}</Badge>
                  <p>{report.summary}</p>
                </div>
              ))}
            </div>
          )}

          {canManage && isOpen && (
            <Button color="red" variant="light" loading={close.isPending} onClick={() => close.mutate()}>Close audit cycle</Button>
          )}
        </Stack>
      )}
    </Drawer>
  )
}
