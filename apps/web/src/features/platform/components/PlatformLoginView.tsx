import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Loader2, LockKeyhole } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { usePlatformSessionStore } from '../platformSessionStore';

export function PlatformLoginView() {
  const navigate = useNavigate();
  const login = usePlatformSessionStore((state) => state.login);
  const status = usePlatformSessionStore((state) => state.status);
  const error = usePlatformSessionStore((state) => state.error);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const isLoading = status === 'loading';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login(username.trim(), password);
      await navigate({ to: '/platform' });
    } catch {
      // The store exposes the API-safe message beside the form.
    }
  }

  return (
    <div className="min-h-full p-6 lg:p-10 grid place-items-center">
      <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <section className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border bg-primary/5 px-3 py-1 text-sm text-primary">
            <Building2 className="h-4 w-4" />
            Cloud school platform
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
            One account, only the school work you are allowed to perform.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Staff and guardians receive separate accounts. Your active school, contract modules,
            and assigned roles determine every screen and operation.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            {['Dari and Pashto ready', 'Browser and desktop', 'Tenant-isolated data'].map((item) => (
              <div key={item} className="rounded-xl border bg-card/70 p-4">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="shadow-xl shadow-primary/5">
          <CardHeader>
            <div className="mb-2 h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle>Sign in to your school</CardTitle>
            <CardDescription>Use the username and initial password issued by the school.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="platform-username">Username</Label>
                <Input
                  id="platform-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform-password">Password</Label>
                <Input
                  id="platform-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error && (
                <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Change the initial password after your first sign-in.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
