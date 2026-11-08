-- amarAbroad: more subjects (32) and three new subject areas (law, education, arts & media), so programs
-- the robot couldn't place (physiotherapy, nursing, law, environmental science…) get a subject and appear.
-- Applied to the live project on 2026-11-09. Robot rules: robot/rules.ts SUBJECTS; existing programs are
-- re-sorted with: npm run robot -- refield

alter table public.fields drop constraint if exists fields_field_group_check;
alter table public.fields add constraint fields_field_group_check
  check (field_group in ('computing','engineering','business','social','law','education','humanities','arts','health','life_sciences','natural_sciences','design'));

insert into public.fields (slug, name_en, name_bn, field_group, tile) values
  ('ai', 'Artificial Intelligence & Machine Learning', 'আর্টিফিশিয়াল ইন্টেলিজেন্স ও মেশিন লার্নিং', 'computing', 'indigo'),
  ('cybersecurity', 'Cybersecurity', 'সাইবার সিকিউরিটি', 'computing', 'indigo'),
  ('information-systems', 'Information Systems & IT', 'ইনফরমেশন সিস্টেমস ও আইটি', 'computing', 'indigo'),
  ('chemical-engineering', 'Chemical & Process Engineering', 'কেমিক্যাল ও প্রসেস ইঞ্জিনিয়ারিং', 'engineering', 'blue'),
  ('mechatronics-robotics', 'Mechatronics & Robotics', 'মেকাট্রনিক্স ও রোবোটিক্স', 'engineering', 'blue'),
  ('energy-engineering', 'Energy & Renewable Energy Engineering', 'এনার্জি ও নবায়নযোগ্য শক্তি ইঞ্জিনিয়ারিং', 'engineering', 'blue'),
  ('industrial-engineering', 'Industrial & Production Engineering', 'ইন্ডাস্ট্রিয়াল ও প্রোডাকশন ইঞ্জিনিয়ারিং', 'engineering', 'blue'),
  ('aerospace-automotive', 'Aerospace & Automotive Engineering', 'অ্যারোস্পেস ও অটোমোটিভ ইঞ্জিনিয়ারিং', 'engineering', 'blue'),
  ('materials-engineering', 'Materials Science & Engineering', 'ম্যাটেরিয়ালস সায়েন্স ও ইঞ্জিনিয়ারিং', 'engineering', 'blue'),
  ('marketing', 'Marketing', 'মার্কেটিং', 'business', 'amber'),
  ('accounting', 'Accounting', 'অ্যাকাউন্টিং', 'business', 'amber'),
  ('supply-chain', 'Logistics & Supply Chain', 'লজিস্টিকস ও সাপ্লাই চেইন', 'business', 'amber'),
  ('hospitality-tourism', 'Hospitality & Tourism', 'হসপিটালিটি ও ট্যুরিজম', 'business', 'amber'),
  ('psychology', 'Psychology', 'মনোবিজ্ঞান', 'social', 'teal'),
  ('political-science', 'Politics & International Relations', 'রাষ্ট্রবিজ্ঞান ও আন্তর্জাতিক সম্পর্ক', 'social', 'teal'),
  ('development-studies', 'Development Studies', 'উন্নয়ন অধ্যয়ন', 'social', 'teal'),
  ('history-philosophy', 'History & Philosophy', 'ইতিহাস ও দর্শন', 'humanities', 'pink'),
  ('languages-linguistics', 'Languages & Linguistics', 'ভাষা ও ভাষাবিজ্ঞান', 'humanities', 'pink'),
  ('nursing', 'Nursing & Midwifery', 'নার্সিং ও মিডওয়াইফারি', 'health', 'green'),
  ('physiotherapy-rehab', 'Physiotherapy & Rehabilitation', 'ফিজিওথেরাপি ও রিহ্যাবিলিটেশন', 'health', 'green'),
  ('dentistry', 'Dentistry', 'ডেন্টিস্ট্রি', 'health', 'green'),
  ('nutrition-dietetics', 'Nutrition & Dietetics', 'পুষ্টি ও ডায়েটেটিক্স', 'health', 'green'),
  ('sport-science', 'Sport & Exercise Science', 'স্পোর্টস ও এক্সারসাইজ সায়েন্স', 'health', 'green'),
  ('environmental-science', 'Environmental Science & Ecology', 'পরিবেশ বিজ্ঞান ও বাস্তুবিদ্যা', 'life_sciences', 'green'),
  ('food-science', 'Food Science & Technology', 'খাদ্য বিজ্ঞান ও প্রযুক্তি', 'life_sciences', 'green'),
  ('geography', 'Geography & GIS', 'ভূগোল ও জিআইএস', 'natural_sciences', 'teal'),
  ('design', 'Design (Graphic, Product, Fashion)', 'ডিজাইন (গ্রাফিক, প্রোডাক্ট, ফ্যাশন)', 'design', 'pink'),
  ('law', 'Law', 'আইন', 'law', 'amber'),
  ('criminology', 'Criminology & Criminal Justice', 'অপরাধবিজ্ঞান ও ফৌজদারি বিচার', 'law', 'amber'),
  ('education', 'Education & Teaching', 'শিক্ষা ও শিক্ষকতা', 'education', 'teal'),
  ('media-communication', 'Media, Communication & Journalism', 'মিডিয়া, যোগাযোগ ও সাংবাদিকতা', 'arts', 'pink'),
  ('fine-arts', 'Fine Arts, Music & Film', 'চারুকলা, সংগীত ও চলচ্চিত্র', 'arts', 'pink')
on conflict (slug) do update set name_en = excluded.name_en, name_bn = excluded.name_bn, field_group = excluded.field_group, tile = excluded.tile;
