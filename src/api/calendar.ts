import type { CanvasClient } from './client.js';
import type { CalendarEvent } from '../types/canvas.js';

export async function listCalendarEvents(
  client: CanvasClient,
  startDate?: string,
  endDate?: string,
  contextCodes?: string[]
): Promise<CalendarEvent[]> {
  const params: Record<string, string | string[]> = {
    type: 'event',
  };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (contextCodes) params['context_codes[]'] = contextCodes;

  const events = await client.fetchAll<CalendarEvent>('/calendar_events', params);

  // Also fetch assignment type events
  const assignmentParams = { ...params, type: 'assignment' };
  const assignments = await client.fetchAll<CalendarEvent>('/calendar_events', assignmentParams);

  return [...events, ...assignments].sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : Infinity;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : Infinity;
    return aTime - bTime;
  });
}
