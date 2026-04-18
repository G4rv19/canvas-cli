import type { CanvasClient } from './client.js';
import type { TodoItem, CalendarEvent } from '../types/canvas.js';

export async function listTodoItems(client: CanvasClient): Promise<TodoItem[]> {
  return client.fetchAll<TodoItem>('/users/self/todo');
}

export async function listUpcomingEvents(client: CanvasClient): Promise<CalendarEvent[]> {
  return client.fetchAll<CalendarEvent>('/users/self/upcoming_events');
}
