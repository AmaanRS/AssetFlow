import { useState } from 'react'
import { Alert, Badge, Button, Group, Loader, Select, Stack, Tabs, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconCalendarEvent, IconClock, IconInfoCircle, IconList, IconPlus } from '@tabler/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiClient } from '../api/client.js'
import { useAssets } from '../api/hooks.js'
import { useAuth } from '../auth/useAuth.js'
import { formatDateTime, workflowStatusColor } from '../lib/format.js'
import './WorkflowCreatePage.css'

const bookingSchema = z.object({
  assetId: z.string().min(1, 'Select a shared resource'),
  startTime: z.string().min(1, 'Select a start time'),
  endTime: z.string().min(1, 'Select an end time'),
}).refine((values) => !values.startTime || new Date(values.startTime) > new Date(), {
  path: ['startTime'], message: 'Start time must be in the future',
}).refine((values) => !values.startTime || !values.endTime || new Date(values.endTime) > new Date(values.startTime), {
  path: ['endTime'], message: 'End time must be after start time',
})

export function BookingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('list')
  const canManage = ['Admin', 'AssetManager', 'DepartmentHead'].includes(user.role)

  return (
    <div className="workflow-page wide">
      <section className="workflow-heading">
        <div><p className="page-kicker">Shared resources</p><h1>Resource booking</h1><p>Reserve shared assets by time slot without overlaps.</p></div>
      </section>

      <Tabs value={tab} onChange={(value) => setTab(value ?? 'list')} color="teal" className="workflow-tabs">
        <Tabs.List>
          <Tabs.Tab value="list" leftSection={<IconList size={16} />}>{canManage ? 'All bookings' : 'My bookings'}</Tabs.Tab>
          <Tabs.Tab value="book" leftSection={<IconPlus size={16} />}>Book a resource</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="list" pt="md"><BookingsList user={user} canManage={canManage} /></Tabs.Panel>
        <Tabs.Panel value="book" pt="md"><BookResource onDone={() => setTab('list')} /></Tabs.Panel>
      </Tabs>
    </div>
  )
}

function BookingsList({ user, canManage }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => (await apiClient.get('/api/bookings')).data.bookings,
  })

  const cancel = useMutation({
    mutationFn: async (bookingId) => apiClient.patch(`/api/bookings/${bookingId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Booking cancelled', message: 'The booking has been cancelled.' })
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Cancel failed', message: error.response?.data?.message || 'Could not cancel the booking.' }),
  })

  const bookings = query.data || []

  return (
    <div className="workflow-list-card">
      <div className="workflow-table-heading workflow-columns-bookings">
        <span>Resource</span><span>Booked by</span><span>Time slot</span><span>Status</span><span></span>
      </div>
      {query.isLoading && <div className="workflow-loading"><Loader color="teal" /></div>}
      {!query.isLoading && bookings.length === 0 && (
        <div className="workflow-empty"><IconInfoCircle size={20} /><span>No bookings yet.</span></div>
      )}
      {bookings.map((booking) => {
        const canCancel = booking.status === 'Active' && (canManage || booking.userId === user.userId)
        return (
          <div className="workflow-row workflow-columns-bookings" key={booking.bookingId}>
            <div className="workflow-identity"><strong>{booking.asset?.assetTag}</strong><span>{booking.asset?.name}</span></div>
            <span>{booking.user?.name || '—'}</span>
            <span className="workflow-truncate">{formatDateTime(booking.startTime)} → {formatDateTime(booking.endTime)}</span>
            <Badge variant="light" color={workflowStatusColor(booking.displayStatus)}>{booking.displayStatus}</Badge>
            <Group justify="flex-end">
              {canCancel && <Button size="compact-xs" variant="subtle" color="red" loading={cancel.isPending} onClick={() => cancel.mutate(booking.bookingId)}>Cancel</Button>}
            </Group>
          </div>
        )
      })}
    </div>
  )
}

function BookResource({ onDone }) {
  const queryClient = useQueryClient()
  const assetsQuery = useAssets({ isSharedResource: 'true', status: 'Available', pageSize: 100 })
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { assetId: null, startTime: '', endTime: '' },
  })
  const createBooking = useMutation({
    mutationFn: async (values) => (await apiClient.post('/api/bookings', {
      assetId: Number(values.assetId),
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
    })).data.booking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Booking confirmed', message: 'Your booking is confirmed.' })
      reset()
      onDone()
    },
    onError: (error) => {
      const response = error.response?.data
      Object.entries(response?.errors || {}).forEach(([field, message]) => {
        if (['assetId', 'startTime', 'endTime'].includes(field)) setError(field, { message })
      })
      notifications.show({ color: 'red', title: 'Booking failed', message: response?.message || 'Could not book this resource.' })
    },
  })

  return (
    <section className="workflow-create-card">
      <div className="workflow-card-heading"><span><IconCalendarEvent size={22} /></span><div><h2>Book a time slot</h2><p>Pick a resource by name. Overlapping bookings are rejected automatically.</p></div></div>
      <form onSubmit={handleSubmit((values) => createBooking.mutate(values))}>
        <Stack gap="md">
          <Controller name="assetId" control={control} render={({ field }) => (
            <Select label="Shared resource" placeholder={assetsQuery.isLoading ? 'Loading…' : 'Select a bookable resource'} data={(assetsQuery.data?.assets ?? []).map((a) => ({ value: String(a.assetId), label: `${a.assetTag} · ${a.name}` }))} searchable withAsterisk error={errors.assetId?.message} value={field.value} onChange={field.onChange} />
          )} />
          <div className="workflow-form-grid">
            <TextInput type="datetime-local" label="Start time" leftSection={<IconClock size={17} />} withAsterisk error={errors.startTime?.message} {...register('startTime')} />
            <TextInput type="datetime-local" label="End time" leftSection={<IconClock size={17} />} withAsterisk error={errors.endTime?.message} {...register('endTime')} />
          </div>
          <div className="workflow-submit"><Button type="submit" color="teal" loading={createBooking.isPending}>Confirm booking</Button></div>
        </Stack>
      </form>
    </section>
  )
}
