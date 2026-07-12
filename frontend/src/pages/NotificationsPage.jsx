import { Badge, Button, Loader } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBell, IconChecks } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { formatDateTime, humanize } from '../lib/format.js'
import './NotificationsPage.css'

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => (await apiClient.get('/api/notifications')).data,
  })

  const markRead = useMutation({
    mutationFn: async (id) => apiClient.patch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: async () => apiClient.patch('/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = query.data?.notifications || []

  const onClick = (notification) => {
    if (!notification.readStatus) markRead.mutate(notification.notificationId)
    if (notification.linkPath) navigate(notification.linkPath)
  }

  return (
    <div className="notifications-page">
      <section className="notifications-heading">
        <div>
          <p className="page-kicker">Stay informed</p>
          <h1>Notifications</h1>
          <p>Approvals, assignments, returns, and alerts across your workflows.</p>
        </div>
        <Button variant="light" color="teal" leftSection={<IconChecks size={17} />} disabled={(query.data?.unreadCount ?? 0) === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </section>

      <div className="notifications-card">
        {query.isLoading && <div className="notifications-loading"><Loader color="teal" /></div>}
        {!query.isLoading && notifications.length === 0 && (
          <div className="notifications-empty"><span><IconBell size={28} stroke={1.5} /></span><h3>You're all caught up</h3><p>New activity will show up here.</p></div>
        )}
        {notifications.map((notification) => (
          <button type="button" className={`notification-item ${notification.readStatus ? '' : 'is-unread'}`} key={notification.notificationId} onClick={() => onClick(notification)}>
            <span className="notification-marker" />
            <div className="notification-body">
              <div className="notification-top">
                <Badge variant="light" color="teal" size="sm">{humanize(notification.type)}</Badge>
                <span className="notification-time">{formatDateTime(notification.createdAt)}</span>
              </div>
              <p>{notification.message}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
