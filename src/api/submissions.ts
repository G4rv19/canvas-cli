import type { CanvasClient } from './client.js';

export interface SubmissionComment {
  id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface RubricRating {
  rating_id: string;
  comments: string;
  points?: number;
}

export interface SubmissionDetail {
  id: number;
  assignment_id: number;
  score: number | null;
  grade: string | null;
  workflow_state: string;
  submitted_at: string | null;
  graded_at: string | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
  submission_comments: SubmissionComment[];
  rubric_assessment?: Record<string, RubricRating>;
}

export async function getSubmission(
  client: CanvasClient,
  courseId: number,
  assignmentId: number
): Promise<SubmissionDetail> {
  return client.fetch<SubmissionDetail>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
    { 'include[]': ['submission_comments', 'rubric_assessment'] }
  );
}
