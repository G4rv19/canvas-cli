import type { CanvasClient } from './client.js';
import type { CanvasFile } from '../types/canvas.js';

export interface CanvasGroup {
  id: number;
  name: string;
  description: string | null;
  course_id: number;
  members_count: number;
}

export interface GroupMember {
  id: number;
  name: string;
  sortable_name: string;
  login_id: string;
}

export async function listMyGroups(client: CanvasClient): Promise<CanvasGroup[]> {
  return client.fetchAll<CanvasGroup>('/users/self/groups');
}

export async function getGroupMembers(client: CanvasClient, groupId: number): Promise<GroupMember[]> {
  return client.fetchAll<GroupMember>(`/groups/${groupId}/users`);
}

export async function getGroupFiles(client: CanvasClient, groupId: number): Promise<CanvasFile[]> {
  return client.fetchAll<CanvasFile>(`/groups/${groupId}/files`);
}
