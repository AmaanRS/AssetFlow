import { useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconAdjustmentsHorizontal,
  IconBox,
  IconChevronDown,
  IconHistory,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconTag,
} from '@tabler/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiClient } from '../api/client.js'
import {
  toCategoryOptions,
  toDepartmentOptions,
  useAssetHistory,
  useAssets,
  useCategories,
  useDepartments,
} from '../api/hooks.js'
import { useAuth } from '../auth/useAuth.js'
import {
  ASSET_STATUSES,
  assetStatusColor,
  formatCurrency,
  formatDate,
  formatDateTime,
  humanize,
  workflowStatusColor,
} from '../lib/format.js'
import './AssetsPage.css'

const statusOptions = ASSET_STATUSES.map((status) => ({ value: status, label: humanize(status) }))

const registerAssetSchema = z.object({
  assetTag: z.string().trim().optional(),
  name: z.string().trim().min(2, 'Enter an asset name'),
  categoryId: z.string().min(1, 'Select a category'),
  serialNumber: z.string().trim().optional(),
  condition: z.string().trim().optional(),
  location: z.string().trim().optional(),
  acquisitionDate: z.date().nullable().optional(),
  acquisitionCost: z.union([z.number(), z.nan()]).nullable().optional(),
  isSharedResource: z.boolean(),
})

export function AssetsPage() {
  const { user } = useAuth()
  const [registerOpened, registerControls] = useDisclosure(false)
  const [filtersOpened, setFiltersOpened] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [status, setStatus] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)
  const [sharedOnly, setSharedOnly] = useState(false)
  const canRegisterAssets = ['Admin', 'AssetManager'].includes(user.role)

  const categoriesQuery = useCategories()
  const departmentsQuery = useDepartments()
  const assetsQuery = useAssets({
    search: search.trim() || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    departmentId: departmentId || undefined,
    isSharedResource: sharedOnly ? 'true' : undefined,
  })

  const assets = assetsQuery.data?.assets ?? []

  return (
    <div className="assets-page">
      <section className="assets-heading">
        <div>
          <p className="page-kicker">Inventory</p>
          <h1>Asset directory</h1>
          <p>Register, locate, and follow every asset through its lifecycle.</p>
        </div>
        {canRegisterAssets && (
          <Button color="teal" leftSection={<IconPlus size={18} />} onClick={registerControls.open}>
            Register asset
          </Button>
        )}
      </section>

      <section className="asset-toolbar" aria-label="Asset filters">
        <TextInput
          className="asset-search"
          leftSection={<IconSearch size={18} />}
          placeholder="Search by name, tag, or serial number"
          aria-label="Search assets"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Button
          className="filter-toggle"
          variant="default"
          leftSection={<IconAdjustmentsHorizontal size={18} />}
          rightSection={<IconChevronDown size={16} />}
          onClick={() => setFiltersOpened((value) => !value)}
        >
          Filters
        </Button>
        <div className={`asset-filters ${filtersOpened ? 'is-open' : ''}`}>
          <Select
            placeholder="All categories"
            data={toCategoryOptions(categoriesQuery.data)}
            value={categoryId}
            onChange={setCategoryId}
            clearable
          />
          <Select placeholder="All statuses" data={statusOptions} value={status} onChange={setStatus} clearable />
          <Select
            placeholder="All departments"
            data={toDepartmentOptions(departmentsQuery.data)}
            value={departmentId}
            onChange={setDepartmentId}
            clearable
          />
          <Checkbox
            label="Shared resources only"
            color="teal"
            checked={sharedOnly}
            onChange={(event) => setSharedOnly(event.currentTarget.checked)}
          />
        </div>
      </section>

      <section className="asset-directory-card">
        <div className="asset-table-heading">
          <span>Asset</span>
          <span>Category</span>
          <span>Status</span>
          <span>Current holder</span>
          <span>Registered</span>
        </div>

        {assetsQuery.isLoading && (
          <div className="asset-loading"><Loader color="teal" /></div>
        )}

        {!assetsQuery.isLoading && assets.length === 0 && (
          <div className="asset-empty-state">
            <span className="asset-empty-icon"><IconBox size={30} stroke={1.5} /></span>
            <h2>No assets found</h2>
            <p>Try adjusting your search or filters{canRegisterAssets ? ', or register your first asset.' : '.'}</p>
            {canRegisterAssets && (
              <Button variant="light" color="teal" leftSection={<IconPlus size={17} />} onClick={registerControls.open}>
                Register asset
              </Button>
            )}
          </div>
        )}

        {!assetsQuery.isLoading &&
          assets.map((asset) => (
            <button type="button" className="asset-row" key={asset.assetId} onClick={() => setSelectedAssetId(asset.assetId)}>
              <span className="asset-cell-primary">
                <strong>{asset.name}</strong>
                <small>{asset.assetTag}{asset.serialNumber ? ` · ${asset.serialNumber}` : ''}</small>
              </span>
              <span>{asset.category?.name || '—'}</span>
              <span>
                <Badge variant="light" color={assetStatusColor(asset.status)}>{humanize(asset.status)}</Badge>
                {asset.isSharedResource && <Badge variant="light" color="cyan" ml={6}>Shared</Badge>}
              </span>
              <span>
                {asset.currentHolderUser?.name ||
                  (asset.currentHolderDepartment ? `${asset.currentHolderDepartment.name} (dept)` : 'Unassigned')}
              </span>
              <span>{formatDate(asset.createdAt)}</span>
            </button>
          ))}

        {!assetsQuery.isLoading && assets.length > 0 && (
          <div className="asset-table-footer">
            Showing {assets.length} of {assetsQuery.data?.total ?? assets.length} assets
          </div>
        )}
      </section>

      {canRegisterAssets && (
        <RegisterAssetModal
          opened={registerOpened}
          onClose={registerControls.close}
          categories={categoriesQuery.data ?? []}
        />
      )}

      <AssetDetailDrawer assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
    </div>
  )
}

function RegisterAssetModal({ opened, onClose, categories }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerAssetSchema),
    defaultValues: {
      assetTag: '',
      name: '',
      categoryId: null,
      serialNumber: '',
      condition: '',
      location: '',
      acquisitionDate: null,
      acquisitionCost: null,
      isSharedResource: false,
    },
  })

  const closeModal = () => {
    reset()
    onClose()
  }

  const createAsset = useMutation({
    mutationFn: async (values) => {
      const payload = {
        name: values.name.trim(),
        categoryId: Number(values.categoryId),
        isSharedResource: values.isSharedResource,
      }
      if (values.assetTag?.trim()) payload.assetTag = values.assetTag.trim()
      if (values.serialNumber?.trim()) payload.serialNumber = values.serialNumber.trim()
      if (values.condition?.trim()) payload.condition = values.condition.trim()
      if (values.location?.trim()) payload.location = values.location.trim()
      if (values.acquisitionDate) payload.acquisitionDate = values.acquisitionDate.toISOString()
      if (typeof values.acquisitionCost === 'number' && !Number.isNaN(values.acquisitionCost)) {
        payload.acquisitionCost = values.acquisitionCost
      }
      return (await apiClient.post('/api/assets', payload)).data.asset
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Asset registered', message: `${asset.assetTag} · ${asset.name} is now available.` })
      closeModal()
    },
    onError: (error) => {
      const response = error.response?.data
      Object.entries(response?.errors || {}).forEach(([field, message]) => {
        if (['assetTag', 'name', 'serialNumber', 'condition', 'location', 'acquisitionDate', 'acquisitionCost'].includes(field)) {
          setError(field, { message })
        }
      })
      notifications.show({ color: 'red', title: 'Registration failed', message: response?.message || 'Could not register the asset.' })
    },
  })

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title="Register a new asset"
      size="lg"
      centered
      classNames={{ title: 'app-modal-title', header: 'app-modal-header', body: 'app-modal-body', content: 'app-modal-content' }}
    >
      <form onSubmit={handleSubmit((values) => createAsset.mutate(values))}>
        <Stack gap="lg">
          <div className="asset-form-intro">
            <span><IconTag size={20} /></span>
            <div>
              <strong>Asset tag is optional</strong>
              <p>Leave it blank and AssetFlow will auto-generate the next tag (e.g. AF-0012).</p>
            </div>
          </div>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Asset tag" placeholder="Auto-generated" error={errors.assetTag?.message} {...register('assetTag')} />
            <TextInput label="Asset name" placeholder="Dell Latitude 5450" withAsterisk error={errors.name?.message} {...register('name')} />
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  label="Category"
                  placeholder="Select a category"
                  data={toCategoryOptions(categories)}
                  withAsterisk
                  searchable
                  error={errors.categoryId?.message}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <TextInput label="Serial number" placeholder="Optional" error={errors.serialNumber?.message} {...register('serialNumber')} />
            <TextInput label="Condition" placeholder="e.g. Good, Excellent" error={errors.condition?.message} {...register('condition')} />
            <TextInput label="Location" placeholder="e.g. Floor 2 store room" error={errors.location?.message} {...register('location')} />
            <Controller
              name="acquisitionDate"
              control={control}
              render={({ field }) => (
                <DateInput
                  label="Acquisition date"
                  placeholder="Optional"
                  clearable
                  valueFormat="DD MMM YYYY"
                  error={errors.acquisitionDate?.message}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="acquisitionCost"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Acquisition cost (INR)"
                  placeholder="Optional"
                  min={0}
                  thousandSeparator=","
                  error={errors.acquisitionCost?.message}
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? null : Number(value))}
                />
              )}
            />
          </SimpleGrid>

          <div className="shared-resource-field">
            <Controller
              name="isSharedResource"
              control={control}
              render={({ field }) => (
                <Switch
                  color="teal"
                  label="Shared bookable resource"
                  description="Allow employees to reserve this asset by time slot"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </div>

          <div className="asset-form-actions">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button type="submit" color="teal" loading={createAsset.isPending}>Register asset</Button>
          </div>
        </Stack>
      </form>
    </Modal>
  )
}

function AssetDetailDrawer({ assetId, onClose }) {
  const historyQuery = useAssetHistory(assetId)
  const assetsCache = useAssets()
  const asset = (assetsCache.data?.assets ?? []).find((item) => item.assetId === assetId)

  return (
    <Drawer
      opened={Boolean(assetId)}
      onClose={onClose}
      position="right"
      size="lg"
      title={asset ? `${asset.assetTag} · ${asset.name}` : 'Asset details'}
      classNames={{ title: 'app-modal-title', header: 'app-modal-header' }}
    >
      {!asset && <div className="asset-loading"><Loader color="teal" /></div>}
      {asset && (
        <Stack gap="lg">
          <Group gap="sm">
            <Badge variant="light" color={assetStatusColor(asset.status)} size="lg">{humanize(asset.status)}</Badge>
            {asset.isSharedResource && <Badge variant="light" color="cyan" size="lg">Shared resource</Badge>}
          </Group>

          <div className="asset-detail-grid">
            <DetailField label="Category" value={asset.category?.name} />
            <DetailField label="Serial number" value={asset.serialNumber} />
            <DetailField label="Condition" value={asset.condition} />
            <DetailField label="Location" value={asset.location} />
            <DetailField label="Acquisition date" value={formatDate(asset.acquisitionDate)} />
            <DetailField label="Acquisition cost" value={formatCurrency(asset.acquisitionCost)} />
            <DetailField label="Current holder" value={asset.currentHolderUser?.name || asset.currentHolderDepartment?.name} />
            <DetailField label="Registered by" value={asset.registeredBy?.name} />
          </div>

          <Tabs defaultValue="allocations" color="teal">
            <Tabs.List>
              <Tabs.Tab value="allocations" leftSection={<IconHistory size={15} />}>Allocations</Tabs.Tab>
              <Tabs.Tab value="maintenance">Maintenance</Tabs.Tab>
              <Tabs.Tab value="transfers">Transfers</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="allocations" pt="md">
              <HistoryList
                loading={historyQuery.isLoading}
                items={historyQuery.data?.allocations}
                empty="No allocation history."
                render={(item) => (
                  <div className="history-item" key={item.allocationId}>
                    <div>
                      <strong>{item.allocatedToUser?.name || item.allocatedToDepartment?.name || 'Unknown'}</strong>
                      <small>Allocated {formatDate(item.allocatedAt)}{item.returnedAt ? ` · Returned ${formatDate(item.returnedAt)}` : ''}</small>
                    </div>
                    <Badge variant="light" color={workflowStatusColor(item.status)}>{humanize(item.status)}</Badge>
                  </div>
                )}
              />
            </Tabs.Panel>

            <Tabs.Panel value="maintenance" pt="md">
              <HistoryList
                loading={historyQuery.isLoading}
                items={historyQuery.data?.maintenanceRequests}
                empty="No maintenance history."
                render={(item) => (
                  <div className="history-item" key={item.maintenanceRequestId}>
                    <div>
                      <strong>{item.description || `Request #${item.maintenanceRequestId}`}</strong>
                      <small>Raised {formatDate(item.raisedAt)} by {item.raisedBy?.name} · {humanize(item.priority)} priority</small>
                    </div>
                    <Badge variant="light" color={workflowStatusColor(item.status)}>{humanize(item.status)}</Badge>
                  </div>
                )}
              />
            </Tabs.Panel>

            <Tabs.Panel value="transfers" pt="md">
              <HistoryList
                loading={historyQuery.isLoading}
                items={historyQuery.data?.transfers}
                empty="No transfer history."
                render={(item) => (
                  <div className="history-item" key={item.transferRequestId}>
                    <div>
                      <strong>{item.fromUser?.name || item.fromDepartment?.name || '—'} → {item.toUser?.name || item.toDepartment?.name || '—'}</strong>
                      <small>Requested {formatDate(item.requestedAt)} by {item.requestedBy?.name}</small>
                    </div>
                    <Badge variant="light" color={workflowStatusColor(item.status)}>{humanize(item.status)}</Badge>
                  </div>
                )}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="asset-detail-field">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

function HistoryList({ loading, items, empty, render }) {
  if (loading) return <div className="asset-loading"><Loader size="sm" color="teal" /></div>
  if (!items || items.length === 0) {
    return (
      <div className="history-empty">
        <IconInfoCircle size={18} />
        <span>{empty}</span>
      </div>
    )
  }
  return <div className="history-list">{items.map(render)}</div>
}
