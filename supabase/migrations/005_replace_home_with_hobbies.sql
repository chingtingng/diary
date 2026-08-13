-- Replace Home with Hobbies. Existing Home rows move to Other.
update public.expenses
set category = 'other'
where category = 'home';

alter table public.expenses drop constraint if exists expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'food',
    'transport',
    'travel',
    'hobbies',
    'shopping',
    'health',
    'fun',
    'other'
  ));
