import { useState } from 'react'
import { Anchor, Button, PasswordInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconArrowRight, IconBuildingWarehouse, IconLock } from '@tabler/icons-react'
import { z } from 'zod'
import { apiClient } from '../api/client.js'

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes')

const resetSchema = z
  .object({ password: passwordRule, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [requestError, setRequestError] = useState('')
  const token = searchParams.get('token') || ''
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const submitReset = async ({ password }) => {
    setRequestError('')
    if (!token) {
      setRequestError('This password reset link is missing its token.')
      return
    }

    try {
      const { data } = await apiClient.post('/api/auth/reset-password', { token, password })
      notifications.show({ color: 'teal', title: 'Password updated', message: data.message })
      navigate('/login', { replace: true })
    } catch (error) {
      const response = error.response?.data
      if (response?.errors?.password) setError('password', { message: response.errors.password })
      setRequestError(response?.message || 'Unable to reset your password. Check that the server is running.')
    }
  }

  return (
    <main className="reset-page">
      <section className="reset-card">
        <div className="reset-brand">
          <span><IconBuildingWarehouse size={23} /></span>
          AssetFlow
        </div>
        <p className="auth-eyebrow">Account security</p>
        <h1>Choose a new password</h1>
        <p className="reset-copy">Use at least 8 characters. Your previous sessions will be signed out.</p>
        {requestError && <div className="reset-error" role="alert">{requestError}</div>}
        <form className="auth-form" onSubmit={handleSubmit(submitReset)}>
          <PasswordInput
            className="auth-field"
            label="New password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            leftSection={<IconLock size={18} />}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordInput
            className="auth-field"
            label="Confirm password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            leftSection={<IconLock size={18} />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" className="auth-submit" loading={isSubmitting} rightSection={<IconArrowRight size={18} />}>
            Update password
          </Button>
        </form>
        <p className="auth-switch"><Anchor component={Link} to="/login" className="auth-link">Back to sign in</Anchor></p>
      </section>
    </main>
  )
}
