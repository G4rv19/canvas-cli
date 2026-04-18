import type { CanvasClient } from './client.js';
import type { Course } from '../types/canvas.js';

export async function listCourses(client: CanvasClient): Promise<Course[]> {
  const courses = await client.fetchAll<Course>('/courses', {
    enrollment_state: 'active',
    'include[]': ['term', 'total_students'],
    state: 'available',
  });
  return courses.filter((c) => c.workflow_state === 'available');
}

export async function getCourse(client: CanvasClient, courseId: number): Promise<Course> {
  return client.fetch<Course>(`/courses/${courseId}`, {
    'include[]': ['term', 'total_students'],
  });
}
