import type { CanvasClient } from './client.js';
import type { Announcement } from '../types/canvas.js';

export async function listAnnouncements(
  client: CanvasClient,
  contextCodes: string[],
  startDate?: string
): Promise<Announcement[]> {
  const params: Record<string, string | string[]> = {
    'context_codes[]': contextCodes,
    active_only: 'true',
  };
  if (startDate) params.start_date = startDate;
  return client.fetchAll<Announcement>('/announcements', params);
}
