-- Fix stock purchase receipt Finance approval: align expense journal call with
-- finance.post_journal_entry(bigint,date,text,varchar,varchar,uuid,uuid,uuid,jsonb).
--
-- public.expenses.id is bigint, while finance.post_journal_entry.source_id is uuid.
-- The expense is already linked to its journal through expenses.journal_entry_id,
-- so source_id must be NULL rather than passing the incompatible bigint ID.
-- Also cast the optional reference to varchar to match the function signature.

begin;

do $migration$
declare
  v_signature regprocedure :=
    'public.create_expense_with_payable(date,text,text,numeric,text,character varying,bigint,uuid,character varying,bigint,character varying,date)'::regprocedure;
  v_definition text;
  v_old text := $old$nullif(trim(p_reference_number),''),
      'expense'::varchar,
      v_expense.id,$old$;
  v_new text := $new$nullif(trim(p_reference_number), '')::varchar,
      'expense'::varchar,
      null::uuid,$new$;
  v_count integer;
begin
  v_definition := pg_get_functiondef(v_signature);
  v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);

  if v_count <> 2 then
    raise exception
      'Expected exactly 2 expense journal call sites to patch, found %; migration stopped safely.',
      v_count;
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$migration$;

commit;
