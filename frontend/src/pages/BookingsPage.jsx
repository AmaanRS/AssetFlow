import { useState } from 'react'
import { Alert, Badge, Button, Select, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IconCalendarEvent, IconClock, IconInfoCircle } from '@tabler/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiClient } from '../api/client.js'
import { useAssets } from '../api/hooks.js'
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
  const [createdBooking, setCreatedBooking] = useState(null)
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
    onSuccess: (booking) => {
      setCreatedBooking(booking)
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      notifications.show({ color: 'teal', title: 'Booking confirmed', message: `Booking #${booking.bookingId} is active.` })
      reset()
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
    <div className="workflow-page">
      <section className="workflow-heading">
        <div><p className="page-kicker">Shared resources</p><h1>Resource booking</h1><p>Reserve an available shared asset without overlapping another booking.</p></div>
      </section>
      <Alert color="teal" variant="light" icon={<IconInfoCircle size={19} />}>
        Pick a shared resource by name — the system validates availability, maintenance, and overlapping bookings.
      </Alert>
      <section className="workflow-create-card">
        <div className="workflow-card-heading"><span><IconCalendarEvent size={22} /></span><div><h2>Book a time slot</h2><p>Times are converted to ISO-8601 with your local timezone.</p></div></div>
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
      {createdBooking && (
        <section className="workflow-result"><div><span>Latest confirmed booking</span><strong>Booking #{createdBooking.bookingId} · Asset #{createdBooking.assetId}</strong><small>{new Date(createdBooking.startTime).toLocaleString()} to {new Date(createdBooking.endTime).toLocaleString()}</small></div><Badge color="teal" variant="light">{createdBooking.status}</Badge></section>
      )}
    </div>
  )
}
