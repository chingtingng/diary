-- Drop Fun. Existing Fun (and leftover Home) rows move to Other.
update public.expenses
set category = 'other'
where category in ('home', 'fun');

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
    'other'
  ));
