import { useRuntime } from '@/runtime';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({ component: AboutPage });

function AboutPage() {
  const runtime = useRuntime();
  return <main className="p-6 max-w-2xl space-y-3"><h1 className="text-2xl font-bold">Maktab Timetable</h1><p>A standalone desktop timetable generator. Cloud school-platform modules are not part of desktop v1.</p><p className="text-sm text-muted-foreground">Version {runtime.appVersion} · Build {runtime.buildId} · Channel {runtime.channel}</p></main>;
}
