import type { CanvasClient } from './client.js';
import type { CanvasFile } from '../types/canvas.js';

export async function listFiles(client: CanvasClient, courseId: number): Promise<CanvasFile[]> {
  return client.fetchAll<CanvasFile>(`/courses/${courseId}/files`);
}
