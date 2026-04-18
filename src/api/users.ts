import type { CanvasClient } from './client.js';
import type { UserProfile } from '../types/canvas.js';

export async function getProfile(client: CanvasClient): Promise<UserProfile> {
  return client.fetch<UserProfile>('/users/self/profile');
}
