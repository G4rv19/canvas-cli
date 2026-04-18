import type { CanvasClient } from './client.js';

export interface Conversation {
  id: number;
  subject: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  workflow_state: string;
  participants: { id: number; name: string }[];
}

export interface ConversationMessage {
  id: number;
  author_id: number;
  body: string;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

export async function listConversations(client: CanvasClient): Promise<Conversation[]> {
  return client.fetchAll<Conversation>('/conversations');
}

export async function getConversation(client: CanvasClient, id: number): Promise<ConversationDetail> {
  return client.fetch<ConversationDetail>(`/conversations/${id}`);
}
