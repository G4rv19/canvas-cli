import type { CanvasClient } from './client.js';

export interface DiscussionTopic {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: { display_name: string } | null;
  discussion_subentry_count: number;
  html_url: string;
  read_state: string;
  unread_count: number;
}

export interface DiscussionEntry {
  id: number;
  user_name: string;
  message: string;
  created_at: string;
  replies?: DiscussionEntry[];
}

export async function listDiscussions(client: CanvasClient, courseId: number): Promise<DiscussionTopic[]> {
  return client.fetchAll<DiscussionTopic>(`/courses/${courseId}/discussion_topics`, {
    order_by: 'recent_activity',
  });
}

export async function getDiscussionEntries(
  client: CanvasClient,
  courseId: number,
  topicId: number
): Promise<DiscussionEntry[]> {
  return client.fetchAll<DiscussionEntry>(
    `/courses/${courseId}/discussion_topics/${topicId}/entries`
  );
}
