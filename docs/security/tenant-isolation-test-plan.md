# AfriCore ERP PRO tenant-security verification plan

## Scope

This branch contains draft restrictive RLS guards for legacy public-schema tables and school-scoped exam-paper Storage access. It is not deployed to any Supabase database.

## Required isolated test environment

Run these tests only against a disposable Supabase development branch or local database with representative fixtures. Do not run the write tests against Production.

Create:
- School A and School B.
- One ordinary authenticated user in each school.
- One Super Admin.
- One exam and exam subject in each school.
- One student in each school.
- Exam questions, grading scales, question marks, class timetables, journal entries and journal lines for each school.
- Exam-paper objects uploaded by each school's user, plus an ownerless legacy object.

## Expected results

| Test | School A | School B | Super Admin |
|---|---|---|---|
| Read School A exam questions | Allow | Deny | Allow |
| Read School A grading scales | Allow | Deny | Allow |
| Read School A student question marks | Allow | Deny | Allow |
| Read School A class timetable | Allow | Deny | Allow |
| Insert question marks for School B student/exam | Deny | Deny | Allow only for valid admin workflow |
| Insert grading scale against School B exam | Deny | Deny | Allow |
| Read School A journal entries/lines | Allow | Deny | Allow |
| Read School A finance audit log | Allow for same-school actor | Deny | Allow |
| Read School A exam PDF | Allow | Deny | Allow |
| Upload PDF to School B exam folder | Deny | Deny | Allow |
| Read ownerless legacy exam PDF | Deny | Deny | Allow |
| Move/update object to another school's exam folder | Deny | Deny | Allow |

## Important legacy-data note

The current Storage inventory has 532 exam-paper objects:
- 498 have an owner_id that maps to a profile.
- 34 have no owner_id.
- Only 12 objects currently have a first path segment matching an existing exam id.

The Storage policy therefore permits legacy reads only when the uploader's profile can be resolved to the current school, or the path resolves to an exam owned by the current school. The 34 ownerless legacy files are denied to ordinary school users until an administrator safely reconciles their ownership. No files are moved or deleted by these migrations.

## Remaining photo-bucket work

The student-photos and teacher-photos buckets are currently public. Existing object paths include legacy layouts that do not consistently encode school_id, and frontend code stores/uses public URLs. Do not flip these buckets to private until the app has been refactored to:
1. Write new objects under a school-scoped path.
2. Resolve private signed URLs for existing stored photo references.
3. Migrate/reconcile legacy object ownership.
4. Verify profile, student and teacher photo display for all roles.

## Release gate

- Apply migrations only to an isolated Supabase development branch.
- Run the complete matrix above with real JWTs for each test role.
- Verify INSERT, SELECT, UPDATE and DELETE independently.
- Verify Storage upload, list, download, signed URL, overwrite and delete.
- Run Supabase security and performance advisors.
- Verify existing exam upload, AI analysis, marks entry, result analysis and finance flows.
- Do not merge to main, apply to Production, change bucket visibility, or deploy until explicitly approved.
