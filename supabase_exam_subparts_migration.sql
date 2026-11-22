-- Optional Subject Sub-Parts (উপবিভাগ) for Exam Subjects & Marks
-- Non-destructive migration: preserves all existing exams, subjects, and marks.

BEGIN;

ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS sub_parts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS sub_part_marks JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';

COMMIT;
