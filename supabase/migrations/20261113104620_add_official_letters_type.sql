alter table public.parent_portal_published_letters
  drop constraint if exists parent_portal_published_letters_letter_type_check;

alter table public.parent_portal_published_letters
  add constraint parent_portal_published_letters_letter_type_check
  check (letter_type in ('fee_reminder','annual_fee_guidance','official_letter'));
