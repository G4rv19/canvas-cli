import type { CanvasClient } from './client.js';

export interface CanvasPage {
  url: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function listPages(client: CanvasClient, courseId: number): Promise<CanvasPage[]> {
  return client.fetchAll<CanvasPage>(`/courses/${courseId}/pages`);
}

export async function getPage(client: CanvasClient, courseId: number, pageUrl: string): Promise<CanvasPage> {
  return client.fetch<CanvasPage>(`/courses/${courseId}/pages/${pageUrl}`);
}

export async function getPageById(client: CanvasClient, courseId: number, pageId: number): Promise<CanvasPage> {
  return client.fetch<CanvasPage>(`/courses/${courseId}/pages/${pageId}`);
}
