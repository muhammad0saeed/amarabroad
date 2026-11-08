-- amarAbroad: countries where Bangladesh's HSC (12 years of school) usually isn't enough on its own for a
-- bachelor's degree, with the usual extra step and the official or university source.
-- Applied to the live project on 2026-11-09. Shown on bachelor's program pages and as a note in Match me
-- for HSC students. Universities can differ: the text says "usually".

alter table public.countries add column if not exists hsc_entry_note_en text;
alter table public.countries add column if not exists hsc_entry_note_bn text;
alter table public.countries add column if not exists hsc_entry_source_url text;

update public.countries c set hsc_entry_note_en = v.en, hsc_entry_note_bn = v.bn, hsc_entry_source_url = v.url
from (values
  ('germany',
   'HSC alone usually isn''t enough for a German bachelor''s: most HSC holders first do a foundation year (Studienkolleg) and its exam, or study 1-2 years at a recognised university in Bangladesh in a related subject. Check your case in the DAAD admission database.',
   'জার্মান ব্যাচেলরে সাধারণত শুধু এইচএসসি যথেষ্ট নয়: বেশিরভাগ এইচএসসি পাস শিক্ষার্থী আগে এক বছরের ফাউন্ডেশন (স্টুডিয়েনকলেগ) ও তার পরীক্ষা দেন, অথবা বাংলাদেশের স্বীকৃত বিশ্ববিদ্যালয়ে সংশ্লিষ্ট বিষয়ে ১-২ বছর পড়েন। DAAD-এর ভর্তি ডেটাবেসে নিজের ক্ষেত্রটি মিলিয়ে নিন।',
   'https://www.daad.de/en/studying-in-germany/requirements/admission-database/'),
  ('norway',
   'Norway''s entry rule (GSU list) for Bangladesh is usually HSC plus 1 year of completed university studies.',
   'বাংলাদেশের জন্য নরওয়ের ভর্তির নিয়ম (GSU তালিকা) সাধারণত এইচএসসি এবং বিশ্ববিদ্যালয়ে ১ বছর পড়া সম্পন্ন।',
   'https://hkdir.no/en/foreign-education/lists-and-databases/higher-education-entrance-qualification-gsu'),
  ('netherlands',
   'Nuffic rates the HSC (at least second division) like a Dutch HAVO diploma: usually enough for universities of applied sciences (hogescholen); research universities often ask for a foundation year or 1 year of university as well.',
   'নুফিক এইচএসসিকে (অন্তত দ্বিতীয় বিভাগ) ডাচ HAVO ডিপ্লোমার সমান ধরে: অ্যাপ্লায়েড সায়েন্সেস বিশ্ববিদ্যালয়ে (হোখেস্কুল) সাধারণত যথেষ্ট; রিসার্চ বিশ্ববিদ্যালয় প্রায়ই সাথে ফাউন্ডেশন বছর বা বিশ্ববিদ্যালয়ে ১ বছর চায়।',
   'https://www.nuffic.nl/en/node/202'),
  ('united-kingdom',
   'Many UK universities ask HSC holders to complete a foundation year first (some accept a high HSC grade directly). Check the university''s entry requirements for Bangladesh.',
   'যুক্তরাজ্যের অনেক বিশ্ববিদ্যালয় এইচএসসি পাস শিক্ষার্থীদের আগে ফাউন্ডেশন বছর শেষ করতে বলে (কিছু বিশ্ববিদ্যালয় ভালো এইচএসসি ফলে সরাসরি নেয়)। বাংলাদেশের জন্য বিশ্ববিদ্যালয়ের ভর্তির শর্ত দেখুন।',
   'https://www.manchester.ac.uk/study/international/country-specific-information/bangladesh/entry-requirements/')
) as v(slug, en, bn, url)
where c.slug = v.slug;
