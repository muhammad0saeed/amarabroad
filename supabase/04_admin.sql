-- amarAbroad: who can sign in to /admin.
-- Paste into Supabase → SQL Editor, put the email you'll sign in with (lowercase) in place of the
-- placeholder, then Run. Never commit a real address here: this repository is public.
-- To remove an admin later: delete from public.admins where email = '…';

insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;
