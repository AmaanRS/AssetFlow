import { useState } from 'react'
import {
  ActionIcon,
  Avatar,
  Badge,
  Burger,
  Menu,
  TextInput,
} from '@mantine/core'
import {
  IconBuildingWarehouse,
  IconChevronDown,
  IconLogout,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { NAV_ITEMS } from '../config/app-ui.js'
import './AppLayout.css'

const ROLE_META = {
  Admin: { label: 'Admin', color: 'teal' },
  AssetManager: { label: 'Asset Manager', color: 'blue' },
  DepartmentHead: { label: 'Department Head', color: 'grape' },
  Employee: { label: 'Employee', color: 'gray' },
}

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const roleMeta = ROLE_META[user.role] || ROLE_META.Employee
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await apiClient.get('/api/notifications?unread=true')).data,
    refetchInterval: 30000,
  })
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const items = NAV_ITEMS.filter(
    (item) => item.roles.includes('ALL') || item.roles.includes(user.role),
  )

  return (
    <div className="app-frame">
      <aside className={`app-sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="sidebar-heading">
          <NavLink className="sidebar-brand" to="/dashboard" onClick={() => setNavOpen(false)}>
            <span className="sidebar-brand-mark">
              <IconBuildingWarehouse size={22} stroke={1.8} />
            </span>
            <span>AssetFlow</span>
          </NavLink>
          <ActionIcon
            className="sidebar-close"
            variant="subtle"
            color="gray"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <IconX size={20} />
          </ActionIcon>
        </div>

        <div className={`organization-chip role-${user.role}`}>
          <Avatar size={34} radius="md" color={roleMeta.color}>
            {initials}
          </Avatar>
          <div className="organization-copy">
            <strong>{user.name}</strong>
            <Badge size="xs" variant="light" color={roleMeta.color} radius="sm">{roleMeta.label}</Badge>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>
          {items.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path

            return (
              <NavLink
                className={`nav-item ${active ? 'is-active' : ''}`}
                key={item.label}
                to={item.path}
                onClick={() => setNavOpen(false)}
              >
                <Icon size={19} stroke={1.7} />
                <span>{item.label}</span>
                {item.path === '/notifications' && unreadCount > 0 && (
                  <Badge size="sm" circle color="red" ml="auto">{unreadCount > 9 ? '9+' : unreadCount}</Badge>
                )}
              </NavLink>
            )
          })}
        </nav>

      </aside>

      {navOpen && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}

      <div className="app-main">
        <header className="app-header">
          <div className="header-start">
            <Burger opened={navOpen} onClick={() => setNavOpen((value) => !value)} hiddenFrom="md" size="sm" />
            <TextInput
              className="global-search"
              leftSection={<IconSearch size={17} />}
              placeholder="Search assets, people, resources..."
              aria-label="Search workspace"
            />
          </div>

          <div className="header-actions">
            <Badge variant="light" color={roleMeta.color} size="lg" radius="sm" className="header-role-badge">
              {roleMeta.label}
            </Badge>
            <Menu position="bottom-end" shadow="md" width={210}>
              <Menu.Target>
                <button className="profile-trigger" type="button">
                  <Avatar size={34} color={roleMeta.color}>{initials}</Avatar>
                  <span className="profile-name">{user.name}</span>
                  <IconChevronDown size={16} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.role.replace(/([a-z])([A-Z])/g, '$1 $2')} · {user.email}</Menu.Label>
                <Menu.Item color="red" leftSection={<IconLogout size={17} />} onClick={() => { logout(); navigate('/login', { replace: true }) }}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </header>

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
