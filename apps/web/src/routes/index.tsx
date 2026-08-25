import { getRuntimeInfo } from '@/runtime';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const runtime = await getRuntimeInfo();
    throw redirect({ to: runtime.capabilities.localTimetable ? '/schedule-dashboard' : '/dashboard' });
  },
});
