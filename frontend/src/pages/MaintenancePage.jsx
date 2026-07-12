import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Tabs,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconInfoCircle, IconPlus, IconTool } from '@tabler/icons-react'
import { apiClient } from '../api/client.js'
import { toUserOptions, useAssets, useUsers } from '../api/hooks.js'
import { useAuth } from '../auth/useAuth.js'
import { formatDate, humanize, workflowStatusColor } from '../lib/format.js'
import './WorkflowCreatePage.css'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const PRIORITY_COLORS = { Low: 'gray', Medium: 'blue', High: 'orange', Critical: 'red' }

function assetOptions(assets = []) {
  return assets.map((asset) => ({ value: String(asset.assetId), label: `${asset.assetTag} · ${asset.name}` }))
}

export function MaintenancePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('requests')
  const canManage = ['Admin', 'AssetManager'].includes(user.role)

  return (
    <div className="workflow-page">
      <section className="workflow-heading">
        <div>
          <p className="page-kicker">Asset care</p>
          <h1>Maintenance</h1>
          <p>Raise maintenance requests and route them through approval before repair work starts.</p>
        </div>
      </section>

      <Tabs value={tab} onChange={(value) => setTab(value ?? 'requests')} color="teal" className="workflow-tabs">
        <Tabs.List>
          <Tabs.Tab value="requests" leftSection={<IconTool size={16} />}>Requests</Tabs.Tab>
          <Tabs.Tab value="raise" leftSection={<IconPlus size={16} />}>Raise request</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="requests" pt="md"><RequestsList canManage={canManage} /></Tabs.Panel>
        <Tabs.Panel value="raise" pt="md"><RaiseRequest onDone={() => setTab('requests')} /></Tabs.Panel>
      </Tabs>
    </div>
  )
}

function RaiseRequest({ onDone }) {
  const queryClient = useQueryClient()
  const assetsQuery = useAssets({ pageSize: 100 })
  const [assetId, setAssetId] = useState(null)
  const [priority, setPriority] = useState('Medium')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: async () => (await apiClient.post('/api/maintenance-requests', {
      assetId: Number(assetId),
      priority,
      description: description.trim() || undefined,
    })).data.maintenanceRequest,
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Maintenance request raised', message: `Request #${request.maintenanceRequestId} is pending approval.` })
      setAssetId(null); setPriority('Medium'); setDescription(''); setError(null)
      onDone()
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not raise the request.'),
  })

  const submit = () => {
    setError(null)
    if (!assetId) return setError('Select the asset that needs maintenance.')
    mutation.mutate()
  }

  return (
    <section className="workflow-create-card">
      <div className="workflow-card-heading"><span><IconTool size={22} /></span><div><h2>Raise maintenance request</h2><p>Pick the asset by tag or name — no IDs needed. The request starts as Pending.</p></div></div>
      <Stack gap="md">
        <Select label="Asset" placeholder={assetsQuery.isLoading ? 'Loading…' : 'Search by tag or name'} data={assetOptions(assetsQuery.data?.assets)} value={assetId} onChange={setAssetId} searchable withAsterisk />
        <Select label="Priority" data={PRIORITIES} value={priority} onChange={(v) => setPriority(v || 'Medium')} />
        <Textarea label="Describe the issue" placeholder="What's wrong with the asset?" autosize minRows={3} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        {error && <div className="workflow-error">{error}</div>}
        <div className="workflow-submit"><Button color="teal" loading={mutation.isPending} onClick={submit}>Raise request</Button></div>
      </Stack>
    </section>
  )
}

function RequestsList({ canManage }) {
  const queryClient = useQueryClient()
  const requestsQuery = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => (await apiClient.get('/api/maintenance-requests')).data.maintenanceRequests,
  })
  const [assignTarget, setAssignTarget] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)

  const action = useMutation({
    mutationFn: async ({ id, verb, body }) => (await apiClient.patch(`/api/maintenance-requests/${id}/${verb}`, body || {})).data.maintenanceRequest,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Updated', message: `Request ${variables.verb}d.` })
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Action failed', message: error.response?.data?.message || 'Could not update the request.' }),
  })

  const requests = requestsQuery.data || []

  return (
    <div className="workflow-list-card">
      <div className="workflow-table-heading workflow-columns-maintenance">
        <span>Asset</span><span>Issue</span><span>Priority</span><span>Raised by</span><span>Status</span><span></span>
      </div>
      {requestsQuery.isLoading && <div className="workflow-loading"><Loader color="teal" /></div>}
      {!requestsQuery.isLoading && requests.length === 0 && (
        <div className="workflow-empty"><IconInfoCircle size={20} /><span>No maintenance requests yet.</span></div>
      )}
      {requests.map((mr) => (
        <div className="workflow-row workflow-columns-maintenance" key={mr.maintenanceRequestId}>
          <div className="workflow-identity"><strong>{mr.asset?.assetTag}</strong><span>{mr.asset?.name}</span></div>
          <span className="workflow-truncate">{mr.description || '—'}</span>
          <Badge variant="light" color={PRIORITY_COLORS[mr.priority] || 'gray'}>{mr.priority}</Badge>
          <span>{mr.raisedBy?.name || '—'}</span>
          <Badge variant="light" color={workflowStatusColor(mr.status)}>{humanize(mr.status)}</Badge>
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            {canManage && mr.status === 'Pending' && (
              <>
                <Button size="compact-xs" variant="light" color="teal" onClick={() => action.mutate({ id: mr.maintenanceRequestId, verb: 'approve' })}>Approve</Button>
                <Button size="compact-xs" variant="subtle" color="red" onClick={() => action.mutate({ id: mr.maintenanceRequestId, verb: 'reject' })}>Reject</Button>
              </>
            )}
            {canManage && ['Approved', 'TechnicianAssigned'].includes(mr.status) && (
              <>
                <Button size="compact-xs" variant="subtle" color="grape" onClick={() => setAssignTarget(mr)}>Assign</Button>
                <Button size="compact-xs" variant="subtle" color="orange" onClick={() => action.mutate({ id: mr.maintenanceRequestId, verb: 'start' })}>Start</Button>
              </>
            )}
            {canManage && ['Approved', 'TechnicianAssigned', 'InProgress'].includes(mr.status) && (
              <Button size="compact-xs" variant="light" color="teal" onClick={() => setResolveTarget(mr)}>Resolve</Button>
            )}
          </Group>
        </div>
      ))}
      <AssignModal request={assignTarget} onClose={() => setAssignTarget(null)} onSubmit={(technicianUserId) => { action.mutate({ id: assignTarget.maintenanceRequestId, verb: 'assign', body: { technicianUserId } }); setAssignTarget(null) }} />
      <ResolveModal request={resolveTarget} onClose={() => setResolveTarget(null)} onSubmit={(resolutionNotes) => { action.mutate({ id: resolveTarget.maintenanceRequestId, verb: 'resolve', body: { resolutionNotes } }); setResolveTarget(null) }} />
    </div>
  )
}

function AssignModal({ request, onClose, onSubmit }) {
  const usersQuery = useUsers()
  const [technicianUserId, setTechnicianUserId] = useState(null)
  useEffect(() => { if (request) setTechnicianUserId(null) }, [request])

  return (
    <Modal opened={Boolean(request)} onClose={onClose} title="Assign technician" centered classNames={{ title: 'app-modal-title', header: 'app-modal-header', body: 'app-modal-body', content: 'app-modal-content' }}>
      <Stack gap="md">
        <Select label="Technician" placeholder="Select a user" data={toUserOptions(usersQuery.data)} value={technicianUserId} onChange={setTechnicianUserId} searchable withAsterisk />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" disabled={!technicianUserId} onClick={() => onSubmit(Number(technicianUserId))}>Assign</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function ResolveModal({ request, onClose, onSubmit }) {
  const [notes, setNotes] = useState('')
  useEffect(() => { if (request) setNotes('') }, [request])

  return (
    <Modal opened={Boolean(request)} onClose={onClose} title="Resolve maintenance" centered classNames={{ title: 'app-modal-title', header: 'app-modal-header', body: 'app-modal-body', content: 'app-modal-content' }}>
      <Stack gap="md">
        <p className="workflow-modal-note">Resolving returns the asset to Available.</p>
        <Textarea label="Resolution notes" placeholder="What was done?" autosize minRows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" onClick={() => onSubmit(notes.trim() || undefined)}>Mark resolved</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
