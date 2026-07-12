import { useMemo } from 'react'
import {
  Anchor,
  Button,
  Checkbox,
  PasswordInput,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import {
  IconArrowRight,
  IconBuildingWarehouse,
  IconInfoCircle,
  IconLock,
  IconMail,
  IconShieldCheck,
  IconUser,
} from '@tabler/icons-react'
import { z } from 'zod'

const emailRule = z.string().trim().email('Enter a valid work email')

const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    email: emailRule,
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const schema = useMemo(() => (isSignup ? signupSchema : loginSchema), [isSignup])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isSignup
      ? { name: '', email: '', password: '', confirmPassword: '' }
      : { email: '', password: '', remember: true },
  })

  const onSubmit = async () => {
    notifications.show({
      color: 'teal',
      title: isSignup ? 'Account details validated' : 'Sign-in details validated',
      message: 'The backend authentication endpoint is ready to be connected.',
    })
  }

  const handleForgotPassword = () => {
    notifications.show({
      color: 'teal',
      title: 'Password recovery',
      message: 'Password recovery will be enabled when the backend endpoint is available.',
    })
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <aside className="auth-story">
          <Brand />

          <div className="story-content">
            <div className="story-kicker">
              <IconShieldCheck size={17} stroke={1.8} />
              One operational source of truth
            </div>
            <h1 className="story-title">Every asset. Accounted for.</h1>
            <p className="story-copy">
              Track equipment, coordinate shared resources, and keep every handoff
              visible across your organization.
            </p>
          </div>

          <div className="story-footer">
            <IconLock size={15} />
            Secure, role-based access for every team
          </div>
        </aside>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-card">
            <div className="mobile-brand">
              <Brand />
            </div>

            <p className="auth-eyebrow">AssetFlow workspace</p>
            <h2 className="auth-title" id="auth-title">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="auth-subtitle">
              {isSignup
                ? 'Join your organization as an employee.'
                : 'Enter your credentials to access your workspace.'}
            </p>

            {isSignup && (
              <div className="employee-note">
                <IconInfoCircle size={20} stroke={1.8} />
                <span>
                  New accounts start with Employee access. An administrator assigns
                  Department Head or Asset Manager roles later.
                </span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {isSignup && (
                <TextInput
                  className="auth-field"
                  label="Full name"
                  placeholder="Priya Sharma"
                  autoComplete="name"
                  leftSection={<IconUser size={18} stroke={1.7} />}
                  error={errors.name?.message}
                  {...register('name')}
                />
              )}

              <TextInput
                className="auth-field"
                label="Work email"
                placeholder="name@company.com"
                type="email"
                autoComplete="email"
                leftSection={<IconMail size={18} stroke={1.7} />}
                error={errors.email?.message}
                {...register('email')}
              />

              <PasswordInput
                className="auth-field"
                label="Password"
                placeholder={isSignup ? 'Minimum 8 characters' : 'Enter your password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                leftSection={<IconLock size={18} stroke={1.7} />}
                error={errors.password?.message}
                {...register('password')}
              />

              {isSignup && (
                <PasswordInput
                  className="auth-field"
                  label="Confirm password"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  leftSection={<IconLock size={18} stroke={1.7} />}
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              )}

              {!isSignup && (
                <div className="auth-options">
                  <Checkbox
                    label="Keep me signed in"
                    color="teal"
                    {...register('remember')}
                  />
                  <Anchor
                    className="auth-link"
                    component="button"
                    type="button"
                    size="sm"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </Anchor>
                </div>
              )}

              <Button
                className="auth-submit"
                type="submit"
                fullWidth
                loading={isSubmitting}
                rightSection={<IconArrowRight size={18} />}
              >
                {isSignup ? 'Create employee account' : 'Sign in to AssetFlow'}
              </Button>
            </form>

            <p className="auth-switch">
              {isSignup ? 'Already have an account?' : 'New to AssetFlow?'}{' '}
              <Anchor
                className="auth-link"
                component={Link}
                to={isSignup ? '/login' : '/signup'}
              >
                {isSignup ? 'Sign in' : 'Create account'}
              </Anchor>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function Brand() {
  return (
    <div className="brand-lockup" aria-label="AssetFlow">
      <span className="brand-mark" aria-hidden="true">
        <IconBuildingWarehouse size={24} stroke={1.8} />
      </span>
      <span className="brand-name">AssetFlow</span>
    </div>
  )
}
