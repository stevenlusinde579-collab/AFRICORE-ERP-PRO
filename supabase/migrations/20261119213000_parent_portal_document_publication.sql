-- Staff-controlled publication lifecycle for Parent Portal fee receipts.
-- Other existing Parent Portal documents remain automatically visible.
alter table public.parent_portal_documents
  add column if not exists publication_status text not null default 'published',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

alter table public.parent_portal_documents
  alter column publication_status set default 'published';

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

-- Existing documents are already eligible for parent visibility except fee receipts,
-- which now require an explicit staff publish action.
update public.parent_portal_documents
set publication_status = case
  when document_type = 'receipt' and source_type = 'fee_payment' then 'pending'
  else 'published'
end;

create or replace function public.set_parent_fee_receipt_pending()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.document_type = 'receipt' and new.source_type = 'fee_payment' then
    new.publication_status := 'pending';
    new.published_at := null;
    new.published_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_parent_fee_receipt_pending on public.parent_portal_documents;
create trigger trg_parent_fee_receipt_pending
before insert on public.parent_portal_documents
for each row execute function public.set_parent_fee_receipt_pending();

revoke all on function public.set_parent_fee_receipt_pending() from public, anon, authenticated;

create index if not exists parent_portal_documents_publication_idx
  on public.parent_portal_documents(school_id, publication_status, document_date desc);

comment on column public.parent_portal_documents.publication_status is
  'Fee receipts require staff publication; other Parent Portal documents remain automatically visible.';
