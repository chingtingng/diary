-- Add mood column for colour-tagged journal entries
alter table public.entries
  add column if not exists mood text
  check (mood is null or mood in ('great', 'good', 'okay', 'low', 'rough'));
