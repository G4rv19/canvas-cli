import type { CanvasClient } from './client.js';
import type { Assignment } from '../types/canvas.js';

export async function listAssignments(
  client: CanvasClient,
  courseId: number,
  bucket?: string
): Promise<Assignment[]> {
  const params: Record<string, string | string[]> = {
    'include[]': ['submission'],
    order_by: 'due_at',
  };
  if (bucket) params.bucket = bucket;
  return client.fetchAll<Assignment>(`/courses/${courseId}/assignments`, params);
}

export async function getAssignment(
  client: CanvasClient,
  courseId: number,
  assignmentId: number
): Promise<Assignment> {
  return client.fetch<Assignment>(`/courses/${courseId}/assignments/${assignmentId}`, {
    'include[]': ['submission'],
  });
}
