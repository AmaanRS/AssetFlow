import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconBuilding,
  IconCategory,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShieldLock,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { apiClient } from '../api/client.js'
import {
  toDepartmentOptions,
  toUserOptions,
  useCategories,
  useDepartments,
  useUsers,
} from '../api/hooks.js'
import { formatDate, humanize } from '../lib/format.js'
import './OrganizationPage.css'

const roleOptions = [
  { value: 'DepartmentHead', label: 'Department Head' },
  { value: 'AssetManager', label: 'Asset Manager' },
]

const roleFilterOptions = [
  { value: 'Employee', label: 'Employee' },
  { value: 'DepartmentHead', label: 'Department Head' },
  { value: 'AssetManager', label: 'Asset Manager' },
  { value: 'Admin', label: 'Administrator' },
]

function slugify(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function OrganizationPage() {
  const [activeTab, setActiveTab] = useState('departments')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(null)

  return (
    <div className="organization-page">
      <section className="organization-heading">
        <div>
          <div className="admin-label"><IconShieldLock size={15} /> Admin workspace</div>
          <h1>Organization setup</h1>
          <p>Manage the master data used across every AssetFlow workflow.</p>
        </div>
        <Badge variant="light" color="teal" size="lg">Admin only</Badge>
      </section>

      <Tabs value={activeTab} onChange={(value) => { setActiveTab(value ?? 'departments'); setSearch('') }} color="teal" className="organization-tabs">
        <Tabs.List grow>
          <Tabs.Tab value="departments" leftSection={<IconBuilding size={17} />}>Departments</Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<IconCategory size={17} />}>Categories</Tabs.Tab>
          <Tabs.Tab value="employees" leftSection={<IconUsers size={17} />}>Employees</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="departments"><DepartmentsTab search={search} setSearch={setSearch} /></Tabs.Panel>
        <Tabs.Panel value="categories"><CategoriesTab search={search} setSearch={setSearch} /></Tabs.Panel>
        <Tabs.Panel value="employees">
          <EmployeesTab search={search} setSearch={setSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}

function Toolbar({ title, description, action, onAction, search, setSearch, extra }) {
  return (
    <>
      <section className="organization-toolbar">
        <div><h2>{title}</h2><p>{description}</p></div>
        {action && <Button color="teal" leftSection={<IconPlus size={17} />} onClick={onAction}>{action}</Button>}
      </section>
      <div className="organization-search-row">
        <TextInput
          leftSection={<IconSearch size={17} />}
          placeholder={`Search ${title.toLowerCase()}`}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        {extra}
      </div>
    </>
  )
}

/* -------------------------------- Departments -------------------------------- */

function DepartmentsTab({ search, setSearch }) {
  const [opened, controls] = useDisclosure(false)
  const [editing, setEditing] = useState(null)
  const departmentsQuery = useDepartments()
  const usersQuery = useUsers()

  const departments = (departmentsQuery.data || []).filter((d) =>
    `${d.name} ${d.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  const openCreate = () => { setEditing(null); controls.open() }
  const openEdit = (department) => { setEditing(department); controls.open() }

  return (
    <>
      <Toolbar title="Departments" description="Structure teams and assign accountable department heads." action="Add department" onAction={openCreate} search={search} setSearch={setSearch} />
      <div className="organization-directory">
        <div className="organization-table-heading columns-departments">
          <span>Department</span><span>Head</span><span>Parent</span><span>Members</span><span>Status</span><span></span>
        </div>
        {departmentsQuery.isLoading && <div className="organization-loading"><Loader color="teal" /></div>}
        {!departmentsQuery.isLoading && departments.length === 0 && (
          <EmptyState icon={IconBuilding} title="No departments yet" copy="Create your first department to get started." />
        )}
        {departments.map((department) => (
          <div className="org-row columns-departments" key={department.departmentId}>
            <div className="org-identity"><strong>{department.name}</strong><span>{department.description || 'No description'}</span></div>
            <span>{department.head?.name || 'Unassigned'}</span>
            <span>{department.parent?.name || '—'}</span>
            <span>{department.memberCount}</span>
            <Badge variant="light" color={department.status === 'Active' ? 'teal' : 'gray'}>{department.status}</Badge>
            <ActionIcon variant="subtle" color="teal" onClick={() => openEdit(department)} aria-label="Edit department"><IconPencil size={17} /></ActionIcon>
          </div>
        ))}
      </div>
      <DepartmentModal opened={opened} onClose={controls.close} department={editing} users={usersQuery.data || []} departments={departmentsQuery.data || []} />
    </>
  )
}

function DepartmentModal({ opened, onClose, department, users, departments }) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(department)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [headUserId, setHeadUserId] = useState(null)
  const [parentDepartmentId, setParentDepartmentId] = useState(null)
  const [status, setStatus] = useState('Active')

  useEffect(() => {
    if (opened) {
      setName(department?.name ?? '')
      setDescription(department?.description ?? '')
      setHeadUserId(department?.headUserId ? String(department.headUserId) : null)
      setParentDepartmentId(department?.parentDepartmentId ? String(department.parentDepartmentId) : null)
      setStatus(department?.status ?? 'Active')
    }
  }, [opened, department])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        headUserId: headUserId ? Number(headUserId) : null,
        parentDepartmentId: parentDepartmentId ? Number(parentDepartmentId) : null,
        status,
      }
      if (isEditing) return (await apiClient.patch(`/api/departments/${department.departmentId}`, payload)).data.department
      return (await apiClient.post('/api/departments', payload)).data.department
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      notifications.show({ color: 'teal', title: isEditing ? 'Department updated' : 'Department created', message: record.name })
      onClose()
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Save failed', message: error.response?.data?.message || 'Could not save the department.' }),
  })

  const parentOptions = toDepartmentOptions(departments).filter((option) => !isEditing || Number(option.value) !== department.departmentId)

  return (
    <SetupModal opened={opened} onClose={onClose} title={isEditing ? 'Edit department' : 'Add department'}>
      <Stack gap="md">
        <TextInput label="Department name" placeholder="Engineering" withAsterisk value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea label="Description" placeholder="What does this department manage?" autosize minRows={2} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Select label="Department head" placeholder="Optional" data={toUserOptions(users)} value={headUserId} onChange={setHeadUserId} searchable clearable />
        <Select label="Parent department" placeholder="Optional" data={parentOptions} value={parentDepartmentId} onChange={setParentDepartmentId} searchable clearable />
        <div>
          <div className="field-label">Status</div>
          <SegmentedControl fullWidth color="teal" value={status} onChange={setStatus} data={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
        </div>
        <div className="setup-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} disabled={name.trim().length < 2} onClick={() => mutation.mutate()}>{isEditing ? 'Save changes' : 'Create department'}</Button>
        </div>
      </Stack>
    </SetupModal>
  )
}

/* -------------------------------- Categories -------------------------------- */

function CategoriesTab({ search, setSearch }) {
  const [opened, controls] = useDisclosure(false)
  const [editing, setEditing] = useState(null)
  const categoriesQuery = useCategories()

  const categories = (categoriesQuery.data || []).filter((c) =>
    `${c.name} ${c.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  const openCreate = () => { setEditing(null); controls.open() }
  const openEdit = (category) => { setEditing(category); controls.open() }

  return (
    <>
      <Toolbar title="Asset categories" description="Create the categories used while registering and filtering assets." action="Add category" onAction={openCreate} search={search} setSearch={setSearch} />
      <div className="organization-directory">
        <div className="organization-table-heading columns-categories">
          <span>Category</span><span>Description</span><span>Custom fields</span><span>Assets</span><span></span>
        </div>
        {categoriesQuery.isLoading && <div className="organization-loading"><Loader color="teal" /></div>}
        {!categoriesQuery.isLoading && categories.length === 0 && (
          <EmptyState icon={IconCategory} title="No categories yet" copy="Add a category such as Electronics or Vehicles." />
        )}
        {categories.map((category) => (
          <div className="org-row columns-categories" key={category.categoryId}>
            <div className="org-identity"><strong>{category.name}</strong></div>
            <span>{category.description || '—'}</span>
            <span>{Array.isArray(category.customFields) && category.customFields.length ? category.customFields.map((f) => f.label || f.key).join(', ') : '—'}</span>
            <span>{category.assetCount}</span>
            <ActionIcon variant="subtle" color="teal" onClick={() => openEdit(category)} aria-label="Edit category"><IconPencil size={17} /></ActionIcon>
          </div>
        ))}
      </div>
      <CategoryModal opened={opened} onClose={controls.close} category={editing} />
    </>
  )
}

function CategoryModal({ opened, onClose, category }) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(category)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState([])

  useEffect(() => {
    if (opened) {
      setName(category?.name ?? '')
      setDescription(category?.description ?? '')
      setFields(Array.isArray(category?.customFields) ? category.customFields.map((f) => ({ label: f.label ?? f.key, type: f.type ?? 'text' })) : [])
    }
  }, [opened, category])

  const mutation = useMutation({
    mutationFn: async () => {
      const customFields = fields
        .filter((f) => f.label.trim())
        .map((f) => ({ key: slugify(f.label), label: f.label.trim(), type: f.type }))
      const payload = { name: name.trim(), description: description.trim() || null, customFields }
      if (isEditing) return (await apiClient.patch(`/api/categories/${category.categoryId}`, payload)).data.category
      return (await apiClient.post('/api/categories', payload)).data.category
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      notifications.show({ color: 'teal', title: isEditing ? 'Category updated' : 'Category created', message: record.name })
      onClose()
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Save failed', message: error.response?.data?.message || 'Could not save the category.' }),
  })

  const addField = () => setFields((current) => [...current, { label: '', type: 'text' }])
  const updateField = (index, patch) => setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const removeField = (index) => setFields((current) => current.filter((_, i) => i !== index))

  return (
    <SetupModal opened={opened} onClose={onClose} title={isEditing ? 'Edit category' : 'Add asset category'}>
      <Stack gap="md">
        <TextInput label="Category name" placeholder="Electronics" withAsterisk value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea label="Description" placeholder="Describe the assets grouped in this category" autosize minRows={2} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <div>
          <div className="field-label">Category-specific fields (optional)</div>
          <p className="field-hint">e.g. a warranty period for Electronics. These appear on assets in this category.</p>
          <Stack gap="xs">
            {fields.map((field, index) => (
              <Group key={index} gap="xs" wrap="nowrap">
                <TextInput placeholder="Field label" value={field.label} onChange={(e) => updateField(index, { label: e.currentTarget.value })} style={{ flex: 1 }} />
                <Select data={[{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }]} value={field.type} onChange={(value) => updateField(index, { type: value })} w={110} />
                <ActionIcon variant="subtle" color="red" onClick={() => removeField(index)}><IconTrash size={16} /></ActionIcon>
              </Group>
            ))}
            <Button variant="light" color="teal" size="xs" leftSection={<IconPlus size={14} />} onClick={addField}>Add field</Button>
          </Stack>
        </div>
        <div className="setup-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} disabled={name.trim().length < 2} onClick={() => mutation.mutate()}>{isEditing ? 'Save changes' : 'Create category'}</Button>
        </div>
      </Stack>
    </SetupModal>
  )
}

/* -------------------------------- Employees -------------------------------- */

function EmployeesTab({ search, setSearch, roleFilter, setRoleFilter }) {
  const [opened, controls] = useDisclosure(false)
  const [selected, setSelected] = useState(null)
  const usersQuery = useUsers()
  const departmentsQuery = useDepartments()

  const users = (usersQuery.data || []).filter((user) => {
    const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (!roleFilter || user.role === roleFilter)
  })

  const openManage = (user) => { setSelected(user); controls.open() }

  return (
    <>
      <Toolbar
        title="Employee directory"
        description="Review employees and manage department and role assignments."
        search={search}
        setSearch={setSearch}
        extra={<Select placeholder="All roles" data={roleFilterOptions} clearable value={roleFilter} onChange={setRoleFilter} />}
      />
      <div className="organization-directory">
        <div className="organization-table-heading columns-employees">
          <span>Employee</span><span>Department</span><span>Role</span><span>Status</span><span>Joined</span><span></span>
        </div>
        {usersQuery.isLoading && <div className="organization-loading"><Loader color="teal" /></div>}
        {!usersQuery.isLoading && users.length === 0 && (
          <EmptyState icon={IconUsers} title="No matching employees" copy="Adjust the search or role filter." />
        )}
        {users.map((user) => (
          <div className="org-row columns-employees" key={user.userId}>
            <div className="org-identity"><strong>{user.name}</strong><span>{user.email}</span></div>
            <span>{user.department?.name || 'Unassigned'}</span>
            <Badge variant="light" color={user.role === 'Admin' ? 'teal' : 'gray'}>{humanize(user.role)}</Badge>
            <Badge variant="light" color={user.status === 'Active' ? 'teal' : 'gray'}>{user.status}</Badge>
            <span>{formatDate(user.createdAt)}</span>
            <Button size="compact-xs" variant="light" color="teal" onClick={() => openManage(user)}>Manage</Button>
          </div>
        ))}
      </div>
      <ManageEmployeeModal opened={opened} onClose={controls.close} user={selected} departments={departmentsQuery.data || []} />
    </>
  )
}

function ManageEmployeeModal({ opened, onClose, user, departments }) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)
  const [status, setStatus] = useState('Active')

  useEffect(() => {
    if (opened && user) {
      setRole(null)
      setDepartmentId(user.departmentId ? String(user.departmentId) : null)
      setStatus(user.status ?? 'Active')
    }
  }, [opened, user])

  const mutation = useMutation({
    mutationFn: async () => {
      // Promotion (Employee -> elevated) is a separate, one-way endpoint.
      if (role && user.role === 'Employee') {
        await apiClient.patch(`/api/users/${user.userId}/role`, { role })
      }
      const desiredDept = departmentId ? Number(departmentId) : null
      const patch = {}
      if (desiredDept !== (user.departmentId ?? null)) patch.departmentId = desiredDept
      if (status !== user.status) patch.status = status
      if (Object.keys(patch).length > 0) {
        await apiClient.patch(`/api/users/${user.userId}`, patch)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifications.show({ color: 'teal', title: 'Employee updated', message: `${user.name} has been updated.` })
      onClose()
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Update failed', message: error.response?.data?.message || 'Could not update this employee.' }),
  })

  if (!user) return null

  return (
    <SetupModal opened={opened} onClose={onClose} title={`Manage ${user.name}`}>
      <Stack gap="md">
        <div className="promotion-user"><strong>{user.name}</strong><span>{user.email}</span></div>

        {user.role === 'Employee' ? (
          <Select label="Promote to role" placeholder="Keep as Employee" data={roleOptions} value={role} onChange={setRole} clearable description="Promotion is permanent and cannot be reverted via the app." />
        ) : (
          <TextInput label="Current role" value={humanize(user.role)} disabled />
        )}

        <Select label="Department" placeholder="Unassigned" data={toDepartmentOptions(departments)} value={departmentId} onChange={setDepartmentId} searchable clearable />

        <div>
          <div className="field-label">Status</div>
          <SegmentedControl fullWidth color="teal" value={status} onChange={setStatus} data={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
        </div>

        <div className="setup-form-actions">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="teal" loading={mutation.isPending} onClick={() => mutation.mutate()}>Save changes</Button>
        </div>
      </Stack>
    </SetupModal>
  )
}

/* -------------------------------- Shared -------------------------------- */

function EmptyState({ icon: Icon, title, copy }) {
  return (
    <div className="organization-empty">
      <span className="organization-empty-icon"><Icon size={29} stroke={1.5} /></span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  )
}

function SetupModal({ opened, onClose, title, children }) {
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
