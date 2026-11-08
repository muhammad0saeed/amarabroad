-- amarAbroad: monthly living-cost range per country, for a careful Bangladeshi middle-class student
-- (shared room, cooking at home, public transport). Applied to the live project on 2026-11-09.
--
-- Minimum: the amount the country's student-visa office says a student must have each month
-- (official, linked). Maximum: an official upper figure where one exists (London, students aged
-- 24+ in Austria, the JASSO average in Japan); otherwise our estimate, minimum + 30%, for a bigger
-- city or a single room (living_cost_max_basis_en is null then, and the site says "our estimate").
-- Amounts are per month in the country's currency. Countries without a reliable official figure
-- are left empty rather than guessed. Check yearly: most amounts are indexed every year.

alter table public.countries add column if not exists living_cost_min numeric(12,2);
alter table public.countries add column if not exists living_cost_max numeric(12,2);
alter table public.countries add column if not exists living_cost_min_basis_en text;
alter table public.countries add column if not exists living_cost_min_basis_bn text;
alter table public.countries add column if not exists living_cost_max_basis_en text;
alter table public.countries add column if not exists living_cost_max_basis_bn text;
alter table public.countries add column if not exists living_cost_source_url text;
alter table public.countries add column if not exists living_cost_checked date;
alter table public.countries drop constraint if exists countries_living_cost_range;
alter table public.countries add constraint countries_living_cost_range
  check (living_cost_min is null or (living_cost_min > 0 and (living_cost_max is null or living_cost_max >= living_cost_min)));

update public.countries c set
  living_cost_min = v.min, living_cost_max = v.max,
  living_cost_min_basis_en = v.min_en, living_cost_min_basis_bn = v.min_bn,
  living_cost_max_basis_en = v.max_en, living_cost_max_basis_bn = v.max_bn,
  living_cost_source_url = v.url, living_cost_checked = date '2026-11-09'
from (values
  ('germany', 992, 1290, 'blocked account for a student visa (€11,904 a year)', 'স্টুডেন্ট ভিসার ব্লকড অ্যাকাউন্ট (বছরে €১১,৯০৪)', null, null, 'https://www.make-it-in-germany.com/en/visa-residence/types/studying'),
  ('united-kingdom', 1171, 1529, 'UK Home Office amount for a Student visa outside London', 'লন্ডনের বাইরে স্টুডেন্ট ভিসার জন্য ইউকে হোম অফিসের অঙ্ক', 'UK Home Office amount for London', 'লন্ডনের জন্য ইউকে হোম অফিসের অঙ্ক', 'https://www.gov.uk/student-visa/money'),
  ('canada', 1954, 2540, 'IRCC living-cost amount for a study permit (CAD 23,448 a year, from 1 Sep 2026)', 'স্টাডি পারমিটের জন্য IRCC-র জীবনযাত্রার খরচ (বছরে CAD ২৩,৪৪৮, ১ সেপ্টেম্বর ২০২৬ থেকে)', null, null, 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/financial-support.html'),
  ('australia', 2476, 3220, 'Home Affairs living-cost amount for a student visa (AUD 29,710 a year)', 'স্টুডেন্ট ভিসার জন্য হোম অ্যাফেয়ার্সের জীবনযাত্রার খরচ (বছরে AUD ২৯,৭১০)', null, null, 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500'),
  ('sweden', 10656, 13850, 'Swedish Migration Agency amount for a student permit (2026)', 'স্টুডেন্ট পারমিটের জন্য সুইডিশ মাইগ্রেশন এজেন্সির অঙ্ক (২০২৬)', null, null, 'https://www.migrationsverket.se/en/lankade-moduler-engelska/studera/forsorjningskrav-studera-huvudsokande.html'),
  ('finland', 800, 1040, 'Finnish Immigration Service amount for a student permit', 'স্টুডেন্ট পারমিটের জন্য ফিনিশ ইমিগ্রেশন সার্ভিসের অঙ্ক', null, null, 'https://migri.fi/en/income-requirement-for-students'),
  ('netherlands', 1131, 1470, 'IND amount for university students (2026)', 'বিশ্ববিদ্যালয়ের শিক্ষার্থীদের জন্য IND-এর অঙ্ক (২০২৬)', null, null, 'https://ind.nl/nl/inkomenseisen-normbedragen'),
  ('france', 878, 1140, 'France-Visas minimum for a student visa (from 1 Aug 2026)', 'স্টুডেন্ট ভিসার জন্য ফ্রান্স-ভিসার ন্যূনতম অঙ্ক (১ আগস্ট ২০২৬ থেকে)', null, null, 'https://france-visas.gouv.fr/'),
  ('italy', 783, 1020, 'Italian consulates'' amount for a study visa (€10,179.85 a year, 2026/27)', 'স্টাডি ভিসার জন্য ইতালীয় কনস্যুলেটের অঙ্ক (বছরে €১০,১৭৯.৮৫, ২০২৬/২৭)', null, null, 'https://ambhelsinki.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/study-visa-visa-for-students-enrolling-in-full-italian-university-programs-bachelors-masters-phds/'),
  ('spain', 600, 780, 'Spanish consulates'' amount for a student visa (100% of IPREM, 2026)', 'স্টুডেন্ট ভিসার জন্য স্প্যানিশ কনস্যুলেটের অঙ্ক (IPREM-এর ১০০%, ২০২৬)', null, null, 'https://www.exteriores.gob.es/en'),
  ('belgium', 1062, 1380, 'Belgian Immigration Office amount for students (2026/27)', 'শিক্ষার্থীদের জন্য বেলজিয়ান ইমিগ্রেশন অফিসের অঙ্ক (২০২৬/২৭)', null, null, 'https://dofi.ibz.be/en'),
  ('austria', 723, 1308, 'OeAD amount for students under 24', '২৪ বছরের কম বয়সী শিক্ষার্থীদের জন্য OeAD-এর অঙ্ক', 'OeAD amount for students aged 24 or older', '২৪ বা তার বেশি বয়সী শিক্ষার্থীদের জন্য OeAD-এর অঙ্ক', 'https://oead.at/en/to-austria/entry-and-residence/residence-permit-student-no-mobility-programme'),
  ('norway', 15488, 20130, 'UDI amount for a study permit (NOK 170,368 a year, 2026/27)', 'স্টাডি পারমিটের জন্য UDI-এর অঙ্ক (বছরে NOK ১,৭০,৩৬৮, ২০২৬/২৭)', null, null, 'https://www.udi.no/en/want-to-apply/studies/studietillatelse/'),
  ('denmark', 7426, 9650, 'SIRI amount a student must show (2026)', 'শিক্ষার্থীকে যে অঙ্ক দেখাতে হয়, SIRI (২০২৬)', null, null, 'https://nyidanmark.dk/en-GB/Words-and-concepts/SIRI/Self-support---SIRI'),
  ('ireland', 833, 1080, 'Irish Immigration amount for students (€10,000 for the first year)', 'শিক্ষার্থীদের জন্য আইরিশ ইমিগ্রেশনের অঙ্ক (প্রথম বছরে €১০,০০০)', null, null, 'https://www.irishimmigration.ie/'),
  ('portugal', 920, 1200, 'Portuguese consulates'' amount for a student visa (the 2026 minimum wage)', 'স্টুডেন্ট ভিসার জন্য পর্তুগিজ কনস্যুলেটের অঙ্ক (২০২৬ সালের ন্যূনতম মজুরি)', null, null, 'https://vistos.mne.gov.pt/en/'),
  ('japan', 89000, 105000, 'JASSO average for international students', 'আন্তর্জাতিক শিক্ষার্থীদের জন্য JASSO-র গড় হিসাব', 'JASSO survey average for self-funded students', 'নিজ খরচে পড়া শিক্ষার্থীদের জন্য JASSO জরিপের গড়', 'https://www.studyinjapan.go.jp/en/')
) as v(slug, min, max, min_en, min_bn, max_en, max_bn, url)
where c.slug = v.slug;
