-- Staff-controlled publication lifecycle for Parent Portal invoices and receipts.
alter table public.parent_portal_documents
  add column if not exists publication_status text not null default 'pending',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parent_portal_documents'::regclass
      and conname = 'parent_portal_documents_publication_status_check'
  ) then
    alter table public.parent_portal_documents
      add constraint parent_portal_documents_publication_status_check
      check (publication_status in ('pending','published'));
  end if;
end;
$$;

create index if not exists parent_portal_documents_publication_idx
  on public.parent_portal_documents(school_id, publication_status, document_date desc);

comment on column public.parent_portal_documents.publication_status is
  'pending documents are staff-only; published documents are visible to the matching Parent Portal account.';
