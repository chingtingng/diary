-- Add policy number and expand allowed policy types

alter table public.insurance_policies
  add column if not exists policy_number text not null default '';

alter table public.insurance_policies
  drop constraint if exists insurance_policies_policy_type_check;

alter table public.insurance_policies
  add constraint insurance_policies_policy_type_check
  check (policy_type in (
    'life',
    'health',
    'critical_illness',
    'personal_accident',
    'disability',
    'travel',
    'auto',
    'home',
    'other'
  ));
