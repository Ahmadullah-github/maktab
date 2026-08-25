import { redirect } from '@tanstack/react-router';
import { getRuntimeInfo } from './runtime';

export async function requirePlatformRoute(): Promise<void> {
  if (!(await getRuntimeInfo()).capabilities.platform) {
    throw redirect({ to: '/schedule-dashboard' });
  }
}

export async function denyDesktopOnlyPlaceholder(): Promise<void> {
  if ((await getRuntimeInfo()).productMode === 'desktop-timetable') {
    throw redirect({ to: '/schedule-dashboard' });
  }
}
