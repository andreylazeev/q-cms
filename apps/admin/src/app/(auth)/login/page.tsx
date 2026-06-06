'use client';

import { useI18n } from '@q-cms/i18n/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useToast } from '../../../components/Toaster.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { useAuth } from '../../../hooks/use-auth.ts';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const search = useSearchParams();
  const { login } = useAuth();
  const { error: showError } = useToast();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError(t('auth.requiredFields'));
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email, password });
      const next = search?.get('next') ?? '/';
      router.push(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.invalidCredentials');
      setFormError(message);
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-muted)',
        padding: 16,
      }}
    >
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-sm"
        aria-labelledby="login-title"
        data-testid="login-form"
      >
        <h1 id="login-title" className="mb-1 text-xl font-semibold">
          {t('auth.title')}
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('auth.subtitle')}
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label={t('auth.email')}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="login-email"
          />
          <Input
            label={t('auth.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="login-password"
          />
          {formError ? (
            <p
              role="alert"
              className="text-sm"
              style={{ color: 'var(--color-danger)' }}
              data-testid="login-error"
            >
              {formError}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            data-testid="login-submit"
          >
            {t('auth.submit')}
          </Button>
        </div>
      </form>
    </main>
  );
}
