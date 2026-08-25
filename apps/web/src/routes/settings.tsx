import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLicense } from '@/hooks/useLicense';
import { useRuntime } from '@/runtime';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

function SettingsPage() {
  const runtime = useRuntime();
  const license = useLicense();
  const queryClient = useQueryClient();
  const [licenseKey, setLicenseKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [restoreHandle, setRestoreHandle] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (operation: () => Promise<{ ok: boolean; value?: unknown; error?: { message: string } }>) => {
    const result = await operation();
    if (!result.ok) throw new Error(result.error?.message || 'Operation failed');
    setMessage('Operation completed successfully.');
    return result.value;
  };

  return (
    <main className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Desktop settings</h1>
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">License</h2>
        <p className="text-sm text-muted-foreground">State: {license.mode}. Licensing controls generation only.</p>
        {runtime.capabilities.licensing && (
          <div className="flex gap-2">
            <Input type="password" value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="Provisioned license key" autoComplete="off" />
            <Button onClick={() => void run(() => window.maktab!.license.activate(licenseKey)).then(() => { setLicenseKey(''); void queryClient.invalidateQueries({ queryKey: ['license'] }); }).catch((error) => setMessage(error.message))}>Activate</Button>
            <Button variant="outline" onClick={() => void run(() => window.maktab!.license.refresh()).then(() => queryClient.invalidateQueries({ queryKey: ['license'] })).catch((error) => setMessage(error.message))}>Refresh</Button>
          </div>
        )}
      </section>
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Encrypted backup and restore</h2>
        <p className="text-sm text-muted-foreground">Use at least 12 characters. Maktab cannot recover a forgotten passphrase.</p>
        <Input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Backup passphrase" autoComplete="new-password" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void run(() => window.maktab!.data.createBackup(passphrase)).catch((error) => setMessage(error.message))}>Create backup</Button>
          <Button variant="outline" onClick={() => void run(() => window.maktab!.data.inspectBackup(passphrase)).then((value) => setRestoreHandle((value as { handle?: string })?.handle || null)).catch((error) => setMessage(error.message))}>Inspect backup</Button>
          {restoreHandle && <Button variant="destructive" onClick={() => void run(() => window.maktab!.data.restoreBackup(restoreHandle, passphrase)).then(() => setRestoreHandle(null)).catch((error) => setMessage(error.message))}>Confirm restore</Button>}
        </div>
      </section>
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Updates and diagnostics</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void run(() => window.maktab!.updates.check()).catch((error) => setMessage(error.message))}>Check for update</Button>
          <Button variant="outline" onClick={() => void run(() => window.maktab!.diagnostics.exportSupportBundle()).catch((error) => setMessage(error.message))}>Export support bundle</Button>
        </div>
      </section>
      <section className="text-sm text-muted-foreground">Version {runtime.appVersion} · Build {runtime.buildId} · {runtime.channel}</section>
      {message && <p role="status" className="text-sm">{message}</p>}
    </main>
  );
}
