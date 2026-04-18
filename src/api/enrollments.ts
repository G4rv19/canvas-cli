import type { CanvasClient } from './client.js';
import type { Enrollment } from '../types/canvas.js';

export async function listMyEnrollments(client: CanvasClient): Promise<Enrollment[]> {
  return client.fetchAll<Enrollment>('/users/self/enrollments', {
    state: 'active',
  });
}

export async function listCourseEnrollments(
  client: CanvasClient,
  courseId: number
): Promise<Enrollment[]> {
  return client.fetchAll<Enrollment>(`/courses/${courseId}/enrollments`, {
    user_id: 'self',
  });
}
