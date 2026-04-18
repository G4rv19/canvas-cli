export interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  enrollment_term_id: number;
  enrollments?: Enrollment[];
  term?: { id: number; name: string };
  total_students?: number;
}

export interface Assignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  points_possible: number;
  html_url: string;
  submission_types: string[];
  grading_type: string;
  has_submitted_submissions: boolean;
  published: boolean;
  submission?: Submission;
}

export interface Submission {
  id: number;
  assignment_id: number;
  score: number | null;
  grade: string | null;
  workflow_state: string;
  submitted_at: string | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  context_code: string;
  html_url: string;
  author: { display_name: string } | null;
}

export interface Module {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  state: string;
  items_count: number;
  published: boolean;
  items?: ModuleItem[];
}

export interface ModuleItem {
  id: number;
  module_id: number;
  title: string;
  type: string;
  content_id: number;
  html_url: string;
  position: number;
  indent: number;
  completion_requirement?: {
    type: string;
    completed: boolean;
  };
}

export interface TodoItem {
  type: string;
  assignment?: Assignment;
  context_type: string;
  course_id: number;
  html_url: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  context_code: string;
  html_url: string;
  location_name: string | null;
  type?: string;
  assignment?: Assignment;
}

export interface Enrollment {
  id: number;
  course_id: number;
  type: string;
  enrollment_state: string;
  grades?: {
    current_score: number | null;
    current_grade: string | null;
    final_score: number | null;
    final_grade: string | null;
  };
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  folder_id: number;
}

export interface UserProfile {
  id: number;
  name: string;
  login_id: string;
  email: string | null;
  avatar_url: string;
  bio: string | null;
}
