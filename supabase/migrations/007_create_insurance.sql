-- Insurance plugin: policies, documents, and private storage bucket

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insurer text not null default '',
  policy_name text not null,
  policy_type text not null default 'other'
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
    )),
  policy_number text not null default '',
  coverage_amount numeric(14, 2) check (coverage_amount is null or coverage_amount >= 0),
  premium numeric(12, 2) not null default 0 check (premium >= 0),
  premium_frequency text not null default 'annual'
    check (premium_frequency in ('monthly', 'annual')),
  renewal_date date,
  status text not null default 'active'
    check (status in ('active', 'pending', 'expired', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_policies_user_id_renewal_idx
  on public.insurance_policies (user_id, renewal_date asc nulls last);

alter table public.insurance_policies enable row level security;

create policy "Users can view their own insurance policies"
  on public.insurance_policies for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insurance policies"
  on public.insurance_policies for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own insurance policies"
  on public.insurance_policies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own insurance policies"
  on public.insurance_policies for delete
  using (auth.uid() = user_id);

create trigger insurance_policies_updated_at
  before update on public.insurance_policies
  for each row execute function public.handle_updated_at();

create table if not exists public.insurance_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.insurance_policies(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_type text not null default 'other'
    check (file_type in ('pdf', 'image', 'doc', 'other')),
  file_size bigint not null default 0 check (file_size >= 0),
  notes text not null default '',
  uploaded_at timestamptz not null default now()
);

create index if not exists insurance_documents_user_id_uploaded_idx
  on public.insurance_documents (user_id, uploaded_at desc);

create index if not exists insurance_documents_policy_id_idx
  on public.insurance_documents (policy_id);

alter table public.insurance_documents enable row level security;

create policy "Users can view their own insurance documents"
  on public.insurance_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insurance documents"
  on public.insurance_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own insurance documents"
  on public.insurance_documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own insurance documents"
  on public.insurance_documents for delete
  using (auth.uid() = user_id);

-- Private bucket for insurance PDFs / images (1 GB free-tier friendly)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insurance-documents',
  'insurance-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "Users can view their own insurance files"
  on storage.objects for select
  using (
    bucket_id = 'insurance-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own insurance files"
  on storage.objects for insert
  with check (
    bucket_id = 'insurance-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own insurance files"
  on storage.objects for update
  using (
    bucket_id = 'insurance-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own insurance files"
  on storage.objects for delete
  using (
    bucket_id = 'insurance-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
