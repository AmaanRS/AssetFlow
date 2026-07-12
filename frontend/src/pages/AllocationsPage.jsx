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
import { DateInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconArrowRight,
  IconArrowsExchange,
  IconClockHour4,
  IconPackage,
  IconPlus,
  IconShieldCheck,
} from '@tabler/icons-react'
import { apiClient } from '../api/client.js'
import {
  toDepartmentOptions,
  toUserOptions,
  useAllocations,
  useAssets,
  useDepartments,
  useTransfers,
  useUsers,
} from '../api/hooks.js'
import { useAuth } from '../auth/useAuth.js'
import { formatDate, humanize, workflowStatusColor } from '../lib/format.js'
import './AllocationsPage.css'

function assetOptions(assets = []) {
  return assets.map((asset) => ({ value: String(asset.assetId), label: `${asset.assetTag} · ${asset.name}` }))
}

export function AllocationsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('allocations')
  const [allocationOpened, allocationControls] = useDisclosure(false)
  const [transferOpened, transferControls] = useDisclosure(false)
  const [transferPreset, setTransferPreset] = useState(null)

  const canAllocate = ['Admin', 'AssetManager'].includes(user.role)
  const canReviewTransfers = ['Admin', 'AssetManager', 'DepartmentHead'].includes(user.role)

  const openTransferWith = (assetId) => {
    setTransferPreset(assetId ? String(assetId) : null)
    transferControls.open()
  }

  return (
    <div className="allocations-page">
      <section className="allocations-heading">
        <div>
          <p className="page-kicker">Asset custody</p>
          <h1>Allocation &amp; transfer</h1>
          <p>Control who holds each asset while preserving a complete movement history.</p>
        </div>
        <Group gap="sm" className="allocation-heading-actions">
          <Button variant="default" leftSection={<IconArrowsExchange size={18} />} onClick={() => openTransferWith(null)}>
            Request transfer
          </Button>
          {canAllocate && (
            <Button color="teal" leftSection={<IconPlus size={18} />} onClick={allocationControls.open}>
              Allocate asset
            </Button>
          )}
        </Group>
      </section>

      <section className="allocation-rule-card">
        <span><IconShieldCheck size={22} /></span>
        <div>
          <strong>Double-allocation protection</strong>
          <p>An asset with an active holder cannot be allocated again. Use a transfer request to change custody.</p>
        </div>
      </section>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'allocations')} color="teal" className="allocation-tabs">
        <Tabs.List>
          <Tabs.Tab value="allocations" leftSection={<IconPackage size={17} />}>Active allocations</Tabs.Tab>
          <Tabs.Tab value="transfers" leftSection={<IconArrowsExchange size={17} />}>{canReviewTransfers ? 'Transfer approvals' : 'My transfers'}</Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconClockHour4 size={17} />}>History</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="allocations"><ActiveAllocations user={user} onTransfer={openTransferWith} /></Tabs.Panel>
        <Tabs.Panel value="transfers"><TransfersList user={user} canReview={canReviewTransfers} /></Tabs.Panel>
        <Tabs.Panel value="history"><AllocationHistory /></Tabs.Panel>
      </Tabs>

      {canAllocate && <AllocationModal opened={allocationOpened} onClose={allocationControls.close} onConflict={openTransferWith} />}
      <TransferModal opened={transferOpened} onClose={() => { transferControls.close(); setTransferPreset(null) }} presetAssetId={transferPreset} />
    </div>
  )
}

/* -------------------------------- Active allocations -------------------------------- */

function ActiveAllocations({ user, onTransfer }) {
  const queryClient = useQueryClient()
  const allocationsQuery = useAllocations({ scope: 'active' })
  const [returnTarget, setReturnTarget] = useState(null)
  const canProcessReturn = ['Admin', 'AssetManager'].includes(user.role)

  const requestReturn = useMutation({
    mutationFn: async (allocationId) => (await apiClient.post('/api/return-requests', { allocationId })).data.returnRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      notifications.show({ color: 'teal', title: 'Return requested', message: 'Your return request is awaiting approval.' })
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Return request failed', message: error.response?.data?.message || 'Could not request the return.' }),
  })

  const allocations = allocationsQuery.data || []

  return (
    <div className="allocation-directory">
      <div className="allocation-table-heading allocation-columns-allocations">
        <span>Asset</span><span>Holder</span><span>Allocated by</span><span>Expected return</span><span>Status</span><span></span>
      </div>
      {allocationsQuery.isLoading && <div className="allocation-loading"><Loader color="teal" /></div>}
      {!allocationsQuery.isLoading && allocations.length === 0 && (
        <EmptyRow icon={IconPackage} title="No active allocations" copy="Assets you allocate or hold will appear here." />
      )}
      {allocations.map((allocation) => {
        const isHolder = allocation.allocatedToUserId === user.userId
        return (
          <div className="allocation-row allocation-columns-allocations" key={allocation.allocationId}>
            <div className="allocation-identity"><strong>{allocation.asset?.assetTag}</strong><span>{allocation.asset?.name}</span></div>
            <span>{allocation.allocatedToUser?.name || allocation.allocatedToDepartment?.name || '—'}</span>
            <span>{allocation.allocatedBy?.name || '—'}</span>
            <span>{formatDate(allocation.expectedReturnDate)}</span>
            <Badge variant="light" color={workflowStatusColor(allocation.status)}>{humanize(allocation.status)}</Badge>
            <Group gap="xs" justify="flex-end" wrap="nowrap">
              {isHolder && allocation.status === 'Active' && (
                <Button size="compact-xs" variant="light" color="orange" loading={requestReturn.isPending} onClick={() => requestReturn.mutate(allocation.allocationId)}>Request return</Button>
              )}
              <Button size="compact-xs" variant="subtle" color="teal" onClick={() => onTransfer(allocation.assetId)}>Transfer</Button>
              {canProcessReturn && (
                <Button size="compact-xs" variant="light" color="teal" onClick={() => setReturnTarget(allocation)}>Process return</Button>
              )}
            </Group>
          </div>
        )
      })}
      <ProcessReturnModal allocation={returnTarget} onClose={() => setReturnTarget(null)} />
    </div>
  )
}

function ProcessReturnModal({ allocation, onClose }) {
  const queryClient = useQueryClient()
  const [checkInNotes, setCheckInNotes] = useState('')
  const [returnCondition, setReturnCondition] = useState('')

  useEffect(() => {
    if (allocation) { setCheckInNotes(''); setReturnCondition('') }
  }, [allocation])

  const mutation = useMutation({
    mutationFn: async () => (await apiClient.patch(`/api/allocations/${allocation.allocationId}/return`, {
      checkInNotes: checkInNotes.trim() || undefined,
      returnCondition: returnCondition.trim() || undefined,
    })).data.allocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Return processed', message: 'The asset is now available.' })
      onClose()
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Return failed', message: error.response?.data?.message || 'Could not process the return.' }),
  })

  return (
    <WorkflowModal opened={Boolean(allocation)} onClose={onClose} title="Process asset return">
      <Stack gap="md">
        {allocation && <div className="allocation-asset-preview"><strong>{allocation.asset?.assetTag} · {allocation.asset?.name}</strong><span>Held by {allocation.allocatedToUser?.name || allocation.allocatedToDepartment?.name}</span></div>}
        <Select label="Condition on return" placeholder="Select condition" data={['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']} value={returnCondition} onChange={(v) => setReturnCondition(v || '')} clearable />
        <Textarea label="Check-in notes" placeholder="Any notes about the returned asset" autosize minRows={2} value={checkInNotes} onChange={(e) => setCheckInNotes(e.currentTarget.value)} />
        <div className="workflow-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} onClick={() => mutation.mutate()}>Mark returned</Button>
        </div>
      </Stack>
    </WorkflowModal>
  )
}

/* -------------------------------- Transfers -------------------------------- */

function TransfersList({ user, canReview }) {
  const queryClient = useQueryClient()
  const transfersQuery = useTransfers()

  const decide = useMutation({
    mutationFn: async ({ id, action }) => (await apiClient.patch(`/api/transfers/${id}/${action}`)).data.transfer,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      notifications.show({ color: 'teal', title: `Transfer ${variables.action === 'approve' ? 'approved' : 'rejected'}`, message: 'The request has been updated.' })
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Action failed', message: error.response?.data?.message || 'Could not update the transfer.' }),
  })

  const transfers = transfersQuery.data || []

  return (
    <div className="allocation-directory">
      <div className="allocation-table-heading allocation-columns-transfers">
        <span>Asset</span><span>From</span><span>To</span><span>Requested by</span><span>Status</span><span></span>
      </div>
      {transfersQuery.isLoading && <div className="allocation-loading"><Loader color="teal" /></div>}
      {!transfersQuery.isLoading && transfers.length === 0 && (
        <EmptyRow icon={IconArrowsExchange} title="No transfer requests" copy="Transfer requests and approvals appear here." />
      )}
      {transfers.map((transfer) => (
        <div className="allocation-row allocation-columns-transfers" key={transfer.transferRequestId}>
          <div className="allocation-identity"><strong>{transfer.asset?.assetTag}</strong><span>{transfer.asset?.name}</span></div>
          <span>{transfer.fromUser?.name || transfer.fromDepartment?.name || '—'}</span>
          <span>{transfer.toUser?.name || transfer.toDepartment?.name || '—'}</span>
          <span>{transfer.requestedBy?.name || '—'}</span>
          <Badge variant="light" color={workflowStatusColor(transfer.status)}>{humanize(transfer.status)}</Badge>
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            {canReview && transfer.status === 'Requested' ? (
              <>
                <Button size="compact-xs" variant="light" color="teal" loading={decide.isPending} onClick={() => decide.mutate({ id: transfer.transferRequestId, action: 'approve' })}>Approve</Button>
                <Button size="compact-xs" variant="subtle" color="red" onClick={() => decide.mutate({ id: transfer.transferRequestId, action: 'reject' })}>Reject</Button>
              </>
            ) : (
              <span className="allocation-muted">{transfer.approvedBy ? `by ${transfer.approvedBy.name}` : formatDate(transfer.requestedAt)}</span>
            )}
          </Group>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------- History -------------------------------- */

function AllocationHistory() {
  const historyQuery = useAllocations({ status: 'Returned' })
  const history = historyQuery.data || []

  return (
    <div className="allocation-directory">
      <div className="allocation-table-heading allocation-columns-history">
        <span>Asset</span><span>Holder</span><span>Allocated</span><span>Returned</span><span>Condition</span>
      </div>
      {historyQuery.isLoading && <div className="allocation-loading"><Loader color="teal" /></div>}
      {!historyQuery.isLoading && history.length === 0 && (
        <EmptyRow icon={IconClockHour4} title="No allocation history" copy="Returned allocations will appear here." />
      )}
      {history.map((allocation) => (
        <div className="allocation-row allocation-columns-history" key={allocation.allocationId}>
          <div className="allocation-identity"><strong>{allocation.asset?.assetTag}</strong><span>{allocation.asset?.name}</span></div>
          <span>{allocation.allocatedToUser?.name || allocation.allocatedToDepartment?.name || '—'}</span>
          <span>{formatDate(allocation.allocatedAt)}</span>
          <span>{formatDate(allocation.returnedAt)}</span>
          <span>{allocation.returnCondition || '—'}</span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------- Allocate modal -------------------------------- */

function AllocationModal({ opened, onClose, onConflict }) {
  const queryClient = useQueryClient()
  const assetsQuery = useAssets({ status: 'Available', pageSize: 100 })
  const usersQuery = useUsers()
  const departmentsQuery = useDepartments()

  const [assetId, setAssetId] = useState(null)
  const [recipientType, setRecipientType] = useState('USER')
  const [recipientId, setRecipientId] = useState(null)
  const [expectedReturnDate, setExpectedReturnDate] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (opened) { setAssetId(null); setRecipientType('USER'); setRecipientId(null); setExpectedReturnDate(null); setError(null) }
  }, [opened])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { assetId: Number(assetId) }
      if (recipientType === 'USER') payload.allocatedToUserId = Number(recipientId)
      else payload.allocatedToDepartmentId = Number(recipientId)
      if (expectedReturnDate) payload.expectedReturnDate = expectedReturnDate.toISOString()
      return (await apiClient.post('/api/allocations', payload)).data.allocation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Asset allocated', message: 'The asset has been allocated.' })
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.conflict) {
        const conflictedAsset = assetId
        notifications.show({ color: 'orange', title: 'Asset already held', message: data.message })
        onClose()
        onConflict(conflictedAsset)
        return
      }
      setError(data?.message || 'Could not allocate the asset.')
    },
  })

  const submit = () => {
    setError(null)
    if (!assetId) return setError('Select an available asset.')
    if (!recipientId) return setError(`Select a ${recipientType === 'USER' ? 'employee' : 'department'}.`)
    mutation.mutate()
  }

  return (
    <WorkflowModal opened={opened} onClose={onClose} title="Allocate an asset">
      <Stack gap="md">
        <Select label="Available asset" placeholder={assetsQuery.isLoading ? 'Loading…' : 'Select an available asset'} data={assetOptions(assetsQuery.data?.assets)} value={assetId} onChange={setAssetId} searchable withAsterisk />
        <RecipientPicker recipientType={recipientType} setRecipientType={(t) => { setRecipientType(t); setRecipientId(null) }} recipientId={recipientId} setRecipientId={setRecipientId} users={usersQuery.data} departments={departmentsQuery.data} />
        <DateInput label="Expected return date" placeholder="Optional" clearable valueFormat="DD MMM YYYY" value={expectedReturnDate} onChange={setExpectedReturnDate} />
        {error && <div className="workflow-error">{error}</div>}
        <div className="workflow-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} onClick={submit}>Allocate asset</Button>
        </div>
      </Stack>
    </WorkflowModal>
  )
}

/* -------------------------------- Transfer modal -------------------------------- */

function TransferModal({ opened, onClose, presetAssetId }) {
  const queryClient = useQueryClient()
  const assetsQuery = useAssets({ status: 'Allocated', pageSize: 100 })
  const usersQuery = useUsers()
  const departmentsQuery = useDepartments()

  const [assetId, setAssetId] = useState(null)
  const [recipientType, setRecipientType] = useState('USER')
  const [recipientId, setRecipientId] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (opened) { setAssetId(presetAssetId || null); setRecipientType('USER'); setRecipientId(null); setReason(''); setError(null) }
  }, [opened, presetAssetId])

  const selectedAsset = (assetsQuery.data?.assets || []).find((a) => String(a.assetId) === String(assetId))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { assetId: Number(assetId) }
      if (recipientType === 'USER') payload.toUserId = Number(recipientId)
      else payload.toDepartmentId = Number(recipientId)
      if (reason.trim()) payload.reason = reason.trim()
      return (await apiClient.post('/api/transfers', payload)).data.transfer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      notifications.show({ color: 'teal', title: 'Transfer requested', message: 'The transfer request awaits approval.' })
      onClose()
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not submit the transfer request.'),
  })

  const submit = () => {
    setError(null)
    if (!assetId) return setError('Select an allocated asset.')
    if (!recipientId) return setError(`Select a receiving ${recipientType === 'USER' ? 'employee' : 'department'}.`)
    mutation.mutate()
  }

  return (
    <WorkflowModal opened={opened} onClose={onClose} title="Request an asset transfer">
      <Stack gap="md">
        <Select label="Currently allocated asset" placeholder={assetsQuery.isLoading ? 'Loading…' : 'Select an allocated asset'} data={assetOptions(assetsQuery.data?.assets)} value={assetId} onChange={setAssetId} searchable withAsterisk />
        {selectedAsset && (
          <div className="current-holder-preview">
            <div><strong>Current holder</strong><p>{selectedAsset.currentHolderUser?.name || selectedAsset.currentHolderDepartment?.name || 'Unknown'}</p></div>
            <IconArrowRight size={19} />
          </div>
        )}
        <RecipientPicker recipientType={recipientType} setRecipientType={(t) => { setRecipientType(t); setRecipientId(null) }} recipientId={recipientId} setRecipientId={setRecipientId} users={usersQuery.data} departments={departmentsQuery.data} label="Transfer to" />
        <Textarea label="Reason (optional)" placeholder="Why is this transfer needed?" autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        {error && <div className="workflow-error">{error}</div>}
        <div className="workflow-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} onClick={submit}>Submit request</Button>
        </div>
      </Stack>
    </WorkflowModal>
  )
}

/* -------------------------------- Shared -------------------------------- */

function RecipientPicker({ recipientType, setRecipientType, recipientId, setRecipientId, users, departments, label = 'Allocate to' }) {
  return (
    <Stack gap="xs">
      <div>
        <div className="field-label">{label}</div>
        <SegmentedControlLike value={recipientType} onChange={setRecipientType} />
      </div>
      {recipientType === 'USER' ? (
        <Select placeholder="Select employee" data={toUserOptions(users)} value={recipientId} onChange={setRecipientId} searchable withAsterisk />
      ) : (
        <Select placeholder="Select department" data={toDepartmentOptions(departments)} value={recipientId} onChange={setRecipientId} searchable withAsterisk />
      )}
    </Stack>
  )
}

function SegmentedControlLike({ value, onChange }) {
  return (
    <div className="recipient-toggle">
      <button type="button" className={value === 'USER' ? 'is-active' : ''} onClick={() => onChange('USER')}>Employee</button>
      <button type="button" className={value === 'DEPARTMENT' ? 'is-active' : ''} onClick={() => onChange('DEPARTMENT')}>Department</button>
    </div>
  )
}

function EmptyRow({ icon: Icon, title, copy }) {
  return (
    <div className="allocation-empty">
      <span className="allocation-empty-icon"><Icon size={29} stroke={1.5} /></span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  )
}

function WorkflowModal({ opened, onClose, title, children }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="md"
      classNames={{ title: 'app-modal-title', header: 'app-modal-header', body: 'app-modal-body', content: 'app-modal-content' }}
    >
      {children}
    </Modal>
  )
}
