import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LogIn, Heart } from 'lucide-react';
import { cn } from '@/utils/cn';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-secondary">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            <Heart className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">MediView Pro</h1>
          <p className="text-sm text-foreground-muted">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm text-danger">
              {error}
            </p>
          )}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={cn(
              'rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-foreground',
              'placeholder:text-foreground-muted',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
            )}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              'rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-foreground',
              'placeholder:text-foreground-muted',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
            )}
          />
          <button
            type="submit"
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white',
              'hover:bg-accent-hover transition-colors'
            )}
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
