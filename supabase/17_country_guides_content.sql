-- Country guides (made by scripts/country-guides-sql.mjs from data/country-guides.json; edit that file, not this one).
-- Run after 16_country_guides.sql.

update public.countries set
  overview_en = $g$Australia has many universities ranked worldwide, a large Bangladeshi community, and clear rules for working while studying. It is one of the more expensive choices, so check the full cost early.$g$,
  education_system_en = $g$Bachelor's degrees usually take 3 years (4 with honours or in fields like engineering); coursework master's take 1.5–2 years. The main intakes are February and July. Every course open to international students must be on CRICOS, the government register.$g$,
  post_study_work_en = $g$After graduating you can apply for the Temporary Graduate visa (subclass 485). The post-study stream usually gives 2 years after a bachelor's or coursework master's and up to 3 years after a research master's or PhD, with an age limit of 35. Check Home Affairs for the current rules.$g$,
  student_work_hours = 24,
  student_work_note_en = $g$48 hours per fortnight during term (about 24 a week), unlimited during official breaks.$g$,
  min_wage = 26.44,
  min_wage_note_en = $g$National minimum wage from 1 July 2026 (casual jobs pay at least 25% more). Some industry awards set higher rates.$g$,
  visa_info_en = $g$You need a Student visa (subclass 500). Accept an offer and pay the deposit to get your Confirmation of Enrolment (CoE), buy Overseas Student Health Cover, then apply online through ImmiAccount. You'll give biometrics at the visa centre in Dhaka and do a health check with an approved doctor.$g$,
  visa_info_url = $g$https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500$g$,
  embassy_url = $g$https://bangladesh.highcommission.gov.au/$g$,
  before_start = $g$[{"en":"Check the course on CRICOS (cricos.education.gov.au): only registered courses lead to a student visa."},{"en":"Book an English test the university and the visa both accept (IELTS, PTE or TOEFL); the visa has its own minimum."},{"en":"Prepare to show money for tuition, living costs (the amount Home Affairs sets each year) and travel."},{"en":"Write a clear Genuine Student statement: why this course, why Australia, how it fits your plans."},{"en":"Buy Overseas Student Health Cover (OSHC) for the whole visa before you apply."},{"en":"Start early: the CoE, health check and visa together often take 1–3 months."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Cafés, restaurants and kitchens"},{"en":"Supermarkets and retail shops"},{"en":"Warehouses and delivery"},{"en":"Cleaning"},{"en":"Aged care and disability support (with a short certificate)"},{"en":"On-campus jobs and tutoring"}]$g$::jsonb,
  job_links = $g$[{"name":"SEEK","url":"https://www.seek.com.au/"},{"name":"Indeed Australia","url":"https://au.indeed.com/"},{"name":"Jora","url":"https://au.jora.com/"},{"name":"Fair Work: your rights as an international student","url":"https://www.fairwork.gov.au/find-help-for/visa-holders-and-migrants"}]$g$::jsonb,
  reading = $g$[{"title":"Student visa (subclass 500)","source":"Department of Home Affairs","url":"https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500"},{"title":"Study Australia: official guide for international students","source":"Australian Government","url":"https://www.studyaustralia.gov.au/en"},{"title":"Visa holders and migrants: pay and rights at work","source":"Fair Work Ombudsman","url":"https://www.fairwork.gov.au/find-help-for/visa-holders-and-migrants"}]$g$::jsonb,
  photo = $g${"src":"/photos/australia.webp","credit":"Benh LIEU SONG, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_and_Harbour_Bridge_Dusk_(2)_2019-06-21.jpg"}$g$::jsonb,
  source_url = $g$https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'australia';

update public.countries set
  overview_en = $g$The UK offers short degrees (a master's usually takes one year), world-famous universities and a large Bangladeshi community. Living costs are high, especially in London.$g$,
  education_system_en = $g$Bachelor's degrees take 3 years (4 in Scotland); taught master's usually 1 year. The main intake is September, and many universities also start in January. Undergraduate applications go through UCAS; postgraduate ones go to each university.$g$,
  post_study_work_en = $g$The Graduate visa lets you stay and work after your degree: 2 years if you apply on or before 31 December 2026, 18 months if you apply from 1 January 2027, and 3 years after a PhD.$g$,
  student_work_hours = 20,
  student_work_note_en = $g$Up to 20 hours a week during term for degree-level students, full-time in official vacations. Self-employment and freelancing (including app delivery as a self-employed rider) are not allowed.$g$,
  min_wage = 12.71,
  min_wage_note_en = $g$National Living Wage for ages 21 and over from April 2026 (£10.85 for ages 18–20).$g$,
  visa_info_en = $g$You need a Student visa. Your university gives you a CAS after you accept the offer. Show money for the first year's tuition and living costs held for 28 days, do a TB test at an approved clinic in Bangladesh, pay the Immigration Health Surcharge, and apply online with biometrics in Dhaka.$g$,
  visa_info_url = $g$https://www.gov.uk/student-visa$g$,
  embassy_url = $g$https://www.gov.uk/world/organisations/british-high-commission-dhaka$g$,
  before_start = $g$[{"en":"Check the English requirement: a UKVI-approved test, or the university's own rules (some accept your medium of instruction)."},{"en":"Save money early: the visa asks for tuition plus a fixed monthly living amount (higher in London), held for 28 days."},{"en":"Book a TB test at an approved clinic in Bangladesh; it's required before applying."},{"en":"Pay the deposit to get your CAS; you can't apply for the visa without it."},{"en":"Budget for the Immigration Health Surcharge, paid when you apply."},{"en":"Look for housing as soon as you have an offer: university halls fill fast."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Retail and supermarkets"},{"en":"Restaurants, cafés and takeaways"},{"en":"Care assistant jobs"},{"en":"Warehouses (as an employee, not self-employed)"},{"en":"University jobs: student ambassador, library, events"}]$g$::jsonb,
  job_links = $g$[{"name":"Indeed UK","url":"https://uk.indeed.com/"},{"name":"Reed","url":"https://www.reed.co.uk/"},{"name":"Totaljobs","url":"https://www.totaljobs.com/"},{"name":"UKCISA: working during your studies","url":"https://www.ukcisa.org.uk/student-advice/working/"}]$g$::jsonb,
  reading = $g$[{"title":"Student visa","source":"GOV.UK","url":"https://www.gov.uk/student-visa"},{"title":"Graduate visa","source":"GOV.UK","url":"https://www.gov.uk/graduate-visa"},{"title":"Working during your studies","source":"UKCISA (UK Council for International Student Affairs)","url":"https://www.ukcisa.org.uk/student-advice/working/"}]$g$::jsonb,
  photo = $g${"src":"/photos/united-kingdom.webp","credit":"Julian Herzog, CC BY 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Radcliffe_Camera_Oxford_2018_02.jpg"}$g$::jsonb,
  source_url = $g$https://www.gov.uk/student-visa$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'united-kingdom';

update public.countries set
  overview_en = $g$The US has the most universities in the world and many scholarships and assistantships, especially for master's and PhD students. Costs vary hugely between universities and states.$g$,
  education_system_en = $g$Bachelor's degrees take 4 years; master's usually 1–2 years. The main intake is August/September (Fall), with some programs in January (Spring). Some universities ask for the SAT (bachelor's) or GRE/GMAT (graduate).$g$,
  post_study_work_en = $g$Optional Practical Training (OPT) gives 12 months of work in your field after graduating. STEM graduates can extend it by 24 months.$g$,
  student_work_hours = 20,
  student_work_note_en = $g$On-campus only, up to 20 hours a week during term and full-time in breaks. Off-campus work is allowed only through CPT or OPT, linked to your studies.$g$,
  min_wage = 7.25,
  min_wage_note_en = $g$Federal minimum; many states and cities set higher rates, and campus jobs often pay more.$g$,
  visa_info_en = $g$You need an F-1 visa. The university sends an I-20 after admission; pay the SEVIS fee, fill in the DS-160 and attend an interview at the US Embassy in Dhaka, showing funds for the cost on your I-20.$g$,
  visa_info_url = $g$https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html$g$,
  embassy_url = $g$https://bd.usembassy.gov/$g$,
  before_start = $g$[{"en":"Check whether each university needs the SAT, GRE or GMAT, and which English tests it accepts (TOEFL, IELTS, Duolingo)."},{"en":"Look for funding at the same time as admission: assistantships and university scholarships often have earlier deadlines."},{"en":"Prepare bank documents for the full yearly cost written on your I-20."},{"en":"Book the visa interview early: wait times in Dhaka can be long."},{"en":"Practise explaining your study plan and your ties to Bangladesh for the interview."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Dining halls and campus cafés"},{"en":"Library and campus offices"},{"en":"Teaching or research assistant (graduate students, often with a fee waiver)"},{"en":"Campus IT help desk and tutoring centres"}]$g$::jsonb,
  job_links = $g$[{"name":"Handshake (used by most universities)","url":"https://joinhandshake.com/"},{"name":"Study in the States: working in the US","url":"https://studyinthestates.dhs.gov/students/working"}]$g$::jsonb,
  reading = $g$[{"title":"Student visa","source":"U.S. Department of State","url":"https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html"},{"title":"EducationUSA: your 5 steps to U.S. study","source":"U.S. Department of State","url":"https://educationusa.state.gov/"},{"title":"Working in the United States as an F-1 student","source":"Study in the States (DHS)","url":"https://studyinthestates.dhs.gov/students/working"}]$g$::jsonb,
  photo = $g${"src":"/photos/united-states.webp","credit":"King of Hearts, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Charles_River_Esplanade_Boston_May_2018_panorama.jpg"}$g$::jsonb,
  source_url = $g$https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'united-states';

update public.countries set
  overview_en = $g$Most public universities in Germany charge little or no tuition, and many master's programs are taught in English. Germany has a strong job market for graduates, and learning German helps a lot.$g$,
  education_system_en = $g$Bachelor's degrees take 3–3.5 years; master's 2 years. The main intakes are October (winter semester) and April (summer). Bangladesh's HSC alone usually isn't enough for a bachelor's: you need a foundation year (Studienkolleg) or one year of a bachelor's at home. Many applications go through uni-assist.$g$,
  post_study_work_en = $g$After graduating you can get a residence permit for up to 18 months to look for a job that matches your degree, and work freely meanwhile.$g$,
  student_work_hours = 20,
  student_work_note_en = $g$Up to 140 full days or 280 half days a year. Most students work about 20 hours a week in term; student assistant jobs at the university don't count towards the limit.$g$,
  min_wage = 13.9,
  min_wage_note_en = $g$Statutory minimum wage from 1 January 2026 (rising to €14.60 in January 2027).$g$,
  visa_info_en = $g$You need a national (D) visa for studies. Open a blocked account with the amount the government sets for a year of living costs, get health insurance, and book an appointment at the German Embassy in Dhaka early: waiting times are long.$g$,
  visa_info_url = $g$https://www.make-it-in-germany.com/en/visa-residence/types/studying$g$,
  embassy_url = $g$https://dhaka.diplo.de/$g$,
  before_start = $g$[{"en":"Check if your HSC is enough or if you need Studienkolleg or one year of a bachelor's first."},{"en":"Find out if the program applies through uni-assist and how long its document check takes."},{"en":"Open a blocked account (Sperrkonto) for the yearly amount the government sets."},{"en":"Book the visa appointment at the embassy in Dhaka as early as you can."},{"en":"Start learning German now: it makes daily life and part-time jobs much easier, even on English programs."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Working student (Werkstudent) in companies, often related to your field"},{"en":"Student assistant (HiWi) at the university"},{"en":"Restaurants, cafés and delivery"},{"en":"Retail and supermarkets"},{"en":"Mini-jobs (up to €603 a month)"}]$g$::jsonb,
  job_links = $g$[{"name":"Federal Employment Agency job board","url":"https://www.arbeitsagentur.de/jobsuche/"},{"name":"StepStone","url":"https://www.stepstone.de/"},{"name":"Indeed Germany","url":"https://de.indeed.com/"},{"name":"Studentjob.de","url":"https://www.studentjob.de/"}]$g$::jsonb,
  reading = $g$[{"title":"Visa and residence for studying","source":"Make it in Germany (German government)","url":"https://www.make-it-in-germany.com/en/visa-residence/types/studying"},{"title":"Study in Germany","source":"DAAD","url":"https://www.study-in-germany.de/en/"}]$g$::jsonb,
  photo = $g${"src":"/photos/germany.webp","credit":"Pexels","source_url":"https://www.pexels.com/photo/sommerabend-am-rhein-27831541/"}$g$::jsonb,
  source_url = $g$https://www.make-it-in-germany.com/en/visa-residence/types/studying$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'germany';

update public.countries set
  overview_en = $g$Finland offers many English-taught programs, a safe and calm student life, and generous university scholarships for non-EU students. Winters are long and dark, and Finnish helps for jobs.$g$,
  education_system_en = $g$Bachelor's degrees take 3–4 years; master's 2 years. Most English programs start in August/September, and the main application round (Studyinfo joint application) is in January. Universities of applied sciences focus on practical, job-oriented studies.$g$,
  post_study_work_en = $g$After graduating you can get a residence permit for up to 2 years to look for work or start a business.$g$,
  student_work_hours = 30,
  student_work_note_en = $g$On average 30 hours a week during term; full-time during holidays. Work that is part of your degree doesn't count.$g$,
  min_wage = null,
  min_wage_note_en = $g$Finland has no national minimum wage: collective agreements set the minimum pay in each industry.$g$,
  visa_info_en = $g$You need a residence permit for studies, applied online through Enter Finland. Show money for living costs (the amount Migri sets per month), have health insurance, and visit the visa centre in Dhaka to prove your identity.$g$,
  visa_info_url = $g$https://migri.fi/en/studying-in-finland$g$,
  embassy_url = $g$https://finlandabroad.fi/web/ind/en$g$,
  before_start = $g$[{"en":"Apply in the January joint application on Studyinfo.fi; a few programs have their own rounds."},{"en":"Check each university's scholarship: many cover 50–100% of tuition and are applied for with your admission."},{"en":"Prepare bank proof for a year of living costs for the residence permit."},{"en":"Apply for the permit as soon as you have your admission letter: it can take 1–3 months."},{"en":"Book housing early through student housing foundations in your city."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Cleaning"},{"en":"Restaurant kitchens and cafés"},{"en":"Food delivery and warehouses"},{"en":"Elderly care (often needs some Finnish)"},{"en":"IT and engineering traineeships in summer"}]$g$::jsonb,
  job_links = $g$[{"name":"Job Market Finland (public employment service)","url":"https://tyomarkkinatori.fi/en"},{"name":"Duunitori","url":"https://duunitori.fi/"},{"name":"Work in Finland","url":"https://www.workinfinland.com/en"}]$g$::jsonb,
  reading = $g$[{"title":"Studying in Finland: residence permits","source":"Finnish Immigration Service (Migri)","url":"https://migri.fi/en/studying-in-finland"},{"title":"Study in Finland","source":"Finnish National Agency for Education","url":"https://www.studyinfinland.fi/"},{"title":"Studyinfo: apply to Finnish universities","source":"Finnish National Agency for Education","url":"https://opintopolku.fi/konfo/en/"}]$g$::jsonb,
  photo = $g${"src":"/photos/finland.webp","credit":"JIP, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Helsinki_Senate_Square_and_Helsinki_Cathedral_in_May_2026.jpg"}$g$::jsonb,
  source_url = $g$https://migri.fi/en/studying-in-finland$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'finland';

update public.countries set
  overview_en = $g$Canada is popular with Bangladeshi students for its universities, work rights and post-graduation work permits. Study permits are now capped, so start early and check the latest rules.$g$,
  education_system_en = $g$Bachelor's degrees take 4 years; master's 1–2 years. Colleges offer shorter diplomas. The main intake is September, with some programs in January and May. Each province runs its own education system.$g$,
  post_study_work_en = $g$A Post-Graduation Work Permit (PGWP) can last up to 3 years, depending on how long you studied. College (non-degree) programs must be in an eligible field; bachelor's, master's and PhD graduates don't have this field rule.$g$,
  student_work_hours = 24,
  student_work_note_en = $g$Up to 24 hours a week off campus during term, unlimited in scheduled breaks. On-campus work has no hour limit.$g$,
  min_wage = 18.15,
  min_wage_note_en = $g$Federal minimum from April 2026, for federally regulated jobs. Each province sets its own minimum; check yours.$g$,
  visa_info_en = $g$You need a study permit (and a visitor visa, issued with it). Most students also need a Provincial Attestation Letter (PAL) from the province, which your school helps with. Show money for tuition and the living-cost amount IRCC sets, give biometrics in Dhaka and do a medical exam with a panel physician.$g$,
  visa_info_url = $g$https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html$g$,
  embassy_url = $g$https://www.international.gc.ca/country-pays/bangladesh/dhaka-dacca.aspx?lang=eng$g$,
  before_start = $g$[{"en":"Make sure the school is a Designated Learning Institution (DLI) and the program qualifies for a PGWP."},{"en":"Ask the school how to get your Provincial Attestation Letter (PAL)."},{"en":"Prepare proof of funds: tuition plus the yearly living amount IRCC sets (it rose in recent years)."},{"en":"Book biometrics and the medical exam early."},{"en":"Get your Social Insurance Number (SIN) after arriving, before you start working."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Coffee shops and restaurants"},{"en":"Retail and grocery stores"},{"en":"Warehouses"},{"en":"Customer service and call centres"},{"en":"On-campus jobs"}]$g$::jsonb,
  job_links = $g$[{"name":"Job Bank (Government of Canada)","url":"https://www.jobbank.gc.ca/"},{"name":"Indeed Canada","url":"https://ca.indeed.com/"},{"name":"Work off campus as a student","url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/work-off-campus.html"}]$g$::jsonb,
  reading = $g$[{"title":"Study permit: who can apply","source":"Immigration, Refugees and Citizenship Canada","url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html"},{"title":"Work off campus as an international student","source":"Immigration, Refugees and Citizenship Canada","url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/work-off-campus.html"},{"title":"EduCanada: study in Canada","source":"Government of Canada","url":"https://www.educanada.ca/"}]$g$::jsonb,
  photo = $g${"src":"/photos/canada.webp","credit":"Chicken4War, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Skyline_of_Toronto_with_kayakers,_2026.jpg"}$g$::jsonb,
  source_url = $g$https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'canada';

update public.countries set
  overview_en = $g$The Netherlands has many English-taught programs, a practical teaching style and almost everyone speaks English. Housing is very hard to find, so plan it first.$g$,
  education_system_en = $g$Research universities offer 3-year bachelor's and 1–2-year master's; universities of applied sciences offer 4-year practical bachelor's. Most programs start in September; you apply through Studielink and the university, often by 1 February to 1 May for non-EU students.$g$,
  post_study_work_en = $g$After graduating you can apply for a one-year orientation year (zoekjaar) to look for work, with no work permit needed.$g$,
  student_work_hours = 16,
  student_work_note_en = $g$Up to 16 hours a week during the year, or full-time in June, July and August. Your employer needs a work permit (TWV) for you, which some employers avoid.$g$,
  min_wage = 14.99,
  min_wage_note_en = $g$Statutory minimum wage for ages 21 and over from 1 July 2026 (lower for younger workers).$g$,
  visa_info_en = $g$Your university applies for your entry visa (MVV) and residence permit. You pay the fee and show money for living costs. After arriving you register with the city (BSN number) and, as a Bangladeshi national, take a TB test.$g$,
  visa_info_url = $g$https://ind.nl/en/residence-permits/study$g$,
  embassy_url = $g$https://www.netherlandsworldwide.nl/contact/embassies-consulates-general/bangladesh/embassy-dhaka$g$,
  before_start = $g$[{"en":"Note each program's non-EU deadline (often 1 February to 1 May) and apply through Studielink."},{"en":"Start looking for housing the day you get your offer; watch out for rental scams asking for money first."},{"en":"Prepare proof of funds for the residence permit; the university tells you the amount."},{"en":"Plan for the TB test and city registration in your first weeks."},{"en":"If you'll work, you need Dutch basic health insurance."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Restaurants and bars"},{"en":"Distribution centres and warehouses"},{"en":"Food delivery"},{"en":"Supermarkets (Dutch often needed)"},{"en":"Summer jobs (full-time allowed June–August)"}]$g$::jsonb,
  job_links = $g$[{"name":"Indeed Netherlands","url":"https://nl.indeed.com/"},{"name":"StudentJob NL","url":"https://www.studentjob.nl/"},{"name":"YoungCapital","url":"https://www.youngcapital.nl/"}]$g$::jsonb,
  reading = $g$[{"title":"Residence permit for study","source":"IND (Immigration and Naturalisation Service)","url":"https://ind.nl/en/residence-permits/study"},{"title":"Study in NL","source":"Nuffic","url":"https://www.studyinnl.org/"},{"title":"Orientation year for graduates","source":"IND","url":"https://ind.nl/en/residence-permits/work/residence-permit-for-orientation-year"}]$g$::jsonb,
  photo = $g${"src":"/photos/netherlands.webp","credit":"Basile Morin, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Colorful_canal_houses_at_golden_hour_in_Damrak_avenue_Amsterdam_the_Netherlands.jpg"}$g$::jsonb,
  source_url = $g$https://ind.nl/en/residence-permits/study$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'netherlands';

update public.countries set
  overview_en = $g$Belgium has well-ranked universities (such as KU Leuven and Ghent) with low tuition compared to the UK or US, and many English master's programs. The country has Dutch- and French-speaking regions with their own rules.$g$,
  education_system_en = $g$Bachelor's degrees take 3 years; master's 1–2 years. Most programs start in September. Flanders (Dutch-speaking) and Wallonia–Brussels (French-speaking) run their own universities, fees and application rules.$g$,
  post_study_work_en = $g$After graduating you can apply for a search year of up to 12 months to look for work or start a business.$g$,
  student_work_hours = 20,
  student_work_note_en = $g$Up to 20 hours a week during term, full-time in school holidays, with a valid student residence permit.$g$,
  min_wage = 13.56,
  min_wage_note_en = $g$About €13.56 an hour (full-time minimum of €2,233.61 a month from August 2026).$g$,
  visa_info_en = $g$You need a long-stay (D) visa for studies. Show money through a blocked account or a Belgian sponsor, and bring a medical certificate and police clearance. Register with your town hall within 8 days of arriving.$g$,
  visa_info_url = $g$https://dofi.ibz.be/en/themes/third-country-nationals/study$g$,
  embassy_url = $g$$g$,
  before_start = $g$[{"en":"Decide on the region first: Flemish and French-speaking universities have different fees and deadlines."},{"en":"Check which documents need to be legalised (diplomas, birth certificate) and start early."},{"en":"Prepare proof of funds: a blocked account or a sponsor's form, for the yearly amount set by the government."},{"en":"Get a medical certificate and a police clearance certificate for the visa."},{"en":"Register at your town hall within 8 days of arriving."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Student jobs in retail and supermarkets"},{"en":"Restaurants, cafés and events"},{"en":"Logistics and warehouses"},{"en":"Tutoring and university jobs"}]$g$::jsonb,
  job_links = $g$[{"name":"StudentJob Belgium","url":"https://www.studentjob.be/"},{"name":"VDAB (Flanders employment service)","url":"https://www.vdab.be/"},{"name":"Actiris (Brussels employment service)","url":"https://www.actiris.brussels/en/citizens/"},{"name":"Indeed Belgium","url":"https://be.indeed.com/"}]$g$::jsonb,
  reading = $g$[{"title":"Studies: third-country nationals","source":"Immigration Office (DOFI)","url":"https://dofi.ibz.be/en/themes/third-country-nationals/study"},{"title":"Study in Flanders","source":"Flemish government","url":"https://www.studyinflanders.be/"},{"title":"Study in Belgium (French-speaking universities)","source":"Wallonie-Bruxelles Campus","url":"https://www.studyinbelgium.be/en"},{"title":"Search year after higher studies","source":"Immigration Office (DOFI)","url":"https://dofi.ibz.be/en/themes/third-country-nationals/study/search-year-after-higher-studies"}]$g$::jsonb,
  photo = $g${"src":"/photos/belgium.webp","credit":"Latinista, CC BY-SA 3.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Leuven_Grote_Markt.JPG"}$g$::jsonb,
  source_url = $g$https://dofi.ibz.be/en/themes/third-country-nationals/study$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'belgium';

update public.countries set
  overview_en = $g$Ireland is English-speaking, home to many tech and pharma companies, and offers a 1- or 2-year stay-back after graduating. Housing in Dublin is scarce and expensive.$g$,
  education_system_en = $g$Honours bachelor's degrees take 3–4 years; taught master's usually 1 year. The main intake is September. Undergraduate applications from outside the EU usually go directly to the university.$g$,
  post_study_work_en = $g$The Third Level Graduate Programme (Stamp 1G) gives 12 months after an honours bachelor's (level 8) and up to 2 years after a master's or PhD (level 9 and above).$g$,
  student_work_hours = 20,
  student_work_note_en = $g$Up to 20 hours a week during term, and 40 hours a week from June to September and 15 December to 15 January.$g$,
  min_wage = 14.15,
  min_wage_note_en = $g$National minimum wage for ages 20 and over from 1 January 2026.$g$,
  visa_info_en = $g$Bangladeshi students need a study visa. Your course must be on the official list of eligible programmes (ILEP). Apply online, send your documents to the visa office, and show money for living costs and private medical insurance. Register with immigration after arriving.$g$,
  visa_info_url = $g$https://www.irishimmigration.ie/coming-to-study-in-ireland/$g$,
  embassy_url = $g$https://www.ireland.ie/en/india/newdelhi/$g$,
  before_start = $g$[{"en":"Check the course is on the ILEP list, or you can't get a student permission."},{"en":"Prepare bank proof for living costs (the amount the immigration service sets) plus tuition."},{"en":"Buy private medical insurance that meets the immigration rules."},{"en":"Arrange housing before you travel, especially in Dublin."},{"en":"Register for your Irish Residence Permit (IRP) soon after arriving; there is a fee."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Retail and supermarkets"},{"en":"Cafés, restaurants and hotels"},{"en":"Healthcare assistant and care work"},{"en":"Warehouses"},{"en":"University jobs"}]$g$::jsonb,
  job_links = $g$[{"name":"IrishJobs.ie","url":"https://www.irishjobs.ie/"},{"name":"Jobs.ie","url":"https://www.jobs.ie/"},{"name":"Indeed Ireland","url":"https://ie.indeed.com/"}]$g$::jsonb,
  reading = $g$[{"title":"Coming to study in Ireland","source":"Irish Immigration Service","url":"https://www.irishimmigration.ie/coming-to-study-in-ireland/"},{"title":"Education in Ireland","source":"Enterprise Ireland","url":"https://www.educationinireland.com/en/"},{"title":"Third Level Graduate Programme (Stamp 1G)","source":"Irish Immigration Service","url":"https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/third-level-graduate-programme/"}]$g$::jsonb,
  photo = $g${"src":"/photos/ireland.webp","credit":"Oliver Gargan, CC BY-SA 4.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Dublin_-_Trinity_College_Dublin_-_20170825170404.jpg"}$g$::jsonb,
  source_url = $g$https://www.irishimmigration.ie/coming-to-study-in-ireland/$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'ireland';

update public.countries set
  overview_en = $g$France has low public university fees, well-known business and engineering schools, and a growing number of English programs. Learning some French makes daily life much easier.$g$,
  education_system_en = $g$Bachelor's (licence) degrees take 3 years; master's 2 years. Most programs start in September. Public universities charge non-EU students set fees (many waive part of them); private schools charge more. Bangladeshi students apply through Campus France's Études en France procedure.$g$,
  post_study_work_en = $g$After a master's (or equivalent) you can get a one-year residence permit to look for work or start a business.$g$,
  student_work_hours = 20,
  student_work_note_en = $g$Up to 964 hours a year (about 20 hours a week).$g$,
  min_wage = 12.31,
  min_wage_note_en = $g$SMIC (national minimum wage) from 1 June 2026.$g$,
  visa_info_en = $g$Most students apply through Campus France Bangladesh (online file and interview), then for a long-stay student visa (VLS-TS) on France-Visas. Show at least the monthly amount the government sets for living costs. Validate the visa online after arriving.$g$,
  visa_info_url = $g$https://france-visas.gouv.fr/en/web/france-visas/student$g$,
  embassy_url = $g$https://bd.ambafrance.org/$g$,
  before_start = $g$[{"en":"Create your Études en France account with Campus France Bangladesh early; it has its own deadlines."},{"en":"Check the university's fees for non-EU students and whether it offers a fee waiver."},{"en":"Prepare proof of funds for the monthly amount the visa requires."},{"en":"Apply for a CROUS student residence and check the CAF housing support you can get."},{"en":"Learn basic French before you go: it helps with jobs, housing and paperwork."}]$g$::jsonb,
  part_time_jobs = $g$[{"en":"Restaurants and cafés"},{"en":"Retail"},{"en":"Babysitting and English tutoring"},{"en":"University and CROUS jobs"}]$g$::jsonb,
  job_links = $g$[{"name":"Jobaviz (CROUS student jobs)","url":"https://www.jobaviz.fr/"},{"name":"France Travail (public employment service)","url":"https://www.francetravail.fr/"},{"name":"Indeed France","url":"https://fr.indeed.com/"}]$g$::jsonb,
  reading = $g$[{"title":"Studying in France","source":"Campus France","url":"https://www.campusfrance.org/en"},{"title":"Campus France Bangladesh","source":"Campus France","url":"https://www.bangladesh.campusfrance.org/"},{"title":"Student visa","source":"France-Visas (French government)","url":"https://france-visas.gouv.fr/en/web/france-visas/student"}]$g$::jsonb,
  photo = $g${"src":"/photos/france.webp","credit":"ThePromenader, CC BY-SA 3.0, via Wikimedia Commons","source_url":"https://commons.wikimedia.org/wiki/File:Eiffel_st-jacques_horz_jms.jpg"}$g$::jsonb,
  source_url = $g$https://france-visas.gouv.fr/en/web/france-visas/student$g$,
  last_verified = '2026-11-09',
  published = true
where slug = 'france';
