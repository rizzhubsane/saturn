/**
 * Seed script: Parses real event data from Mercury Connect WhatsApp group
 * and populates the database with clubs and events.
 *
 * Run: npx tsx src/seed.ts
 *
 * Some events are sourced from IIT Delhi circular announcements.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Clubs extracted from the Mercury Connect chat ──
const clubs = [
  { name: 'BlocSoc', slug: 'blocsoc', category: 'tech', tagline: 'Blockchain Society, IIT Delhi' },
  { name: 'IGTS', slug: 'igts', category: 'finance', tagline: 'Indian Game Theory Society' },
  { name: 'AeroClub', slug: 'aeroclub', category: 'engineering', tagline: 'Aeronautics & Aviation Technology' },
  { name: 'Economics & Finance Club', slug: 'efc', category: 'finance', tagline: 'Markets, Quant & Finance' },
  { name: 'ACES-ACM', slug: 'aces-acm', category: 'tech', tagline: 'Association for Computing at IIT Delhi' },
  { name: 'DevClub', slug: 'devclub', category: 'tech', tagline: 'Software Development Club' },
  { name: 'Mathematical Society', slug: 'mathsoc', category: 'academic', tagline: 'Mathematics at IIT Delhi' },
  { name: 'SInC', slug: 'sinc', category: 'startup', tagline: 'Student Incubation Cell' },
  { name: 'SPIC MACAY', slug: 'spicmacay', category: 'cultural', tagline: 'Promoting Indian Classical Music & Culture' },
  { name: 'BloodConnect', slug: 'bloodconnect', category: 'wellness', tagline: 'Student-run blood donation initiative' },
  { name: 'AXLR8R Formula Racing', slug: 'axlr8r', category: 'engineering', tagline: 'Formula Student Racing Team' },
  { name: 'Robotics Club', slug: 'robotics-club', category: 'engineering', tagline: 'Robotics & Automation' },
  { name: 'ANCC', slug: 'ancc', category: 'tech', tagline: 'Algorithms & Competitive Programming' },
  { name: 'PhySoc', slug: 'physoc', category: 'academic', tagline: 'Physics Society, IIT Delhi' },
  { name: 'Quizzing Club', slug: 'quizzing-club', category: 'literature', tagline: 'Quizzes, Trivia & Knowledge' },
  { name: 'ARIES', slug: 'aries', category: 'tech', tagline: 'AI, Robotics & Innovation' },
  { name: 'AINA', slug: 'aina', category: 'wellness', tagline: 'An Initiative for National Advancement' },
  { name: 'Infinity Hyperloop', slug: 'infinity-hyperloop', category: 'engineering', tagline: 'Future of Ultra-Fast Travel' },
  { name: 'MES', slug: 'mes', category: 'sports', tagline: 'Mechanical Engineering Society' },
  { name: 'Literati', slug: 'literati', category: 'literature', tagline: 'Literary Society, IIT Delhi' },
  { name: 'eDC', slug: 'edc', category: 'startup', tagline: 'Entrepreneurship Development Cell' },
  { name: 'iGEM IIT Delhi', slug: 'igem', category: 'engineering', tagline: 'Synthetic Biology & Bioengineering' },
  { name: 'Northeast Society', slug: 'northeast-society', category: 'cultural', tagline: 'Celebrating Northeast Indian Culture' },
  { name: 'BSW', slug: 'bsw', category: 'social', tagline: 'Board of Student Welfare' },
  { name: 'Central Library', slug: 'central-library', category: 'academic', tagline: 'IIT Delhi Central Library' },
  { name: 'NRCVEE', slug: 'nrcvee', category: 'wellness', tagline: 'National Resource Centre for Value Education in Engineering' },
  { name: 'IHFC', slug: 'ihfc', category: 'engineering', tagline: 'IITD Host for Futuristic Collaborative Research' },
  { name: 'Civil Engineering', slug: 'civil-dept', category: 'academic', tagline: 'Department of Civil Engineering, IIT Delhi' },
];

// ── Events extracted from the chat. Dates are real. ──
// Today is 2026-04-09. Events before today get status 'expired', on/after get 'confirmed'.
const events: Array<{
  title: string;
  description: string;
  date: string;
  time: string | null;
  end_time: string | null;
  venue: string | null;
  venue_normalized: string | null;
  categories: string[];
  highlights: string[];
  links: Array<{url: string, label: string}>;
  event_type: string;
  registration_link: string | null;
  club_slug: string;
  raw_message: string;
}> = [
  // ── UPCOMING (Apr 9+) ──
  {
    title: 'iGEM IIT Delhi Main Orientation',
    description: 'Orientation for iGEM IIT Delhi 2026 team. Learn about synthetic biology, bioengineering, and how to represent IIT Delhi on the global stage.',
    date: '2026-04-09',
    time: '18:30:00',
    end_time: '19:30:00',
    venue: 'LH 310',
    venue_normalized: 'Lecture Hall 310',
    categories: ['engineering', 'academic'],
    highlights: ['Represent IITD on global stage', 'No experience needed'],
    links: [
      { url: 'https://chat.whatsapp.com/IwYCPYKOMHO3ki0Tcvoyxx', label: 'other' },
      { url: 'https://www.instagram.com/igem_iitd', label: 'instagram' },
    ],
    event_type: 'meetup',
    registration_link: null,
    club_slug: 'igem',
    raw_message: 'iGEM IIT Delhi Main Orientation, 9th April, 6:30 PM, LH 310',
  },
  {
    title: 'Manthan: Industrial Revolution to Evolution',
    description: 'Discussion with Mr. Alok Srivastava (IIT Delhi & IIM Calcutta alum) on business, leadership, and personal growth from industrial revolution to evolution.',
    date: '2026-04-09',
    time: '19:00:00',
    end_time: '20:00:00',
    venue: 'CAIC Room',
    venue_normalized: 'CAIC Room',
    categories: ['talk', 'wellness'],
    highlights: ['Speaker: Alok Srivastava (IITD + IIMC alum)', 'Explore conscious leadership'],
    links: [{ url: 'https://www.linkedin.com/in/alok-srivastava/', label: 'info' }],
    event_type: 'talk',
    registration_link: null,
    club_slug: 'aina',
    raw_message: 'AINA Manthan with Mr. Alok Srivastava, 9 April, 7PM, CAIC Room',
  },
  {
    title: 'NEO: Northeast Experience at IIT Delhi',
    description: 'First ever Northeast cultural fest at IIT Delhi. Food stalls, handicraft stalls, and cultural performances celebrating the 8 states of Northeast India.',
    date: '2026-04-09',
    time: '11:00:00',
    end_time: null,
    venue: 'LHC Route & Seminar Hall',
    venue_normalized: 'Lecture Hall Complex & Seminar Hall',
    categories: ['cultural', 'food', 'social'],
    highlights: ['First-ever NE cultural fest at IITD', 'Food + handicrafts + performances'],
    links: [
      { url: 'https://docs.google.com/forms/d/e/1FAIpQLSfEKC-BbjDGYy7bThr0x__Y9GPK2dDWpzNqUJO9Hmqbkc3jnQ/viewform', label: 'register' },
    ],
    event_type: 'fest',
    registration_link: 'https://docs.google.com/forms/d/e/1FAIpQLSfEKC-BbjDGYy7bThr0x__Y9GPK2dDWpzNqUJO9Hmqbkc3jnQ/viewform',
    club_slug: 'northeast-society',
    raw_message: 'NEO Northeast Experience at IIT Delhi, 9th April, 11 AM onwards',
  },
  {
    title: 'Blood Donation Camp — Jai Bhim Saptaha',
    description: 'Blood donation camp organized for Ambedkar Jayanti week. NSS hours for donors, goodies and refreshments.',
    date: '2026-04-10',
    time: '10:00:00',
    end_time: '18:00:00',
    venue: 'Exhibition Hall',
    venue_normalized: 'Exhibition Hall',
    categories: ['wellness'],
    highlights: ['Earn NSS hours', 'Save lives this Ambedkar Jayanti'],
    links: [],
    event_type: 'other',
    registration_link: null,
    club_slug: 'bloodconnect',
    raw_message: 'Blood Donation Camp, 10th April, Exhibition Hall, 10 AM - 6 PM',
  },
  {
    title: 'Anthropic Hackathon',
    description: 'SInC x Claude Builder Club hackathon. Build innovative AI solutions. Prizes worth Rs 2.15 Lakhs including Luna Rings, API credits, and cash.',
    date: '2026-04-12',
    time: '10:00:00',
    end_time: '17:00:00',
    venue: 'LH 410',
    venue_normalized: 'Lecture Hall 410',
    categories: ['tech', 'competition', 'startup'],
    highlights: ['Prize pool Rs 2.15L + Luna Rings', 'Build with Claude AI'],
    links: [
      { url: 'https://luma.com/f3vy9h9z', label: 'register' },
      { url: 'https://chat.whatsapp.com/Bhoa44aXYcU3rjFFW6f3zD', label: 'other' },
    ],
    event_type: 'hackathon',
    registration_link: 'https://luma.com/f3vy9h9z',
    club_slug: 'sinc',
    raw_message: 'Anthropic Hackathon, 12th April, LH 410, 10 AM - 5 PM, Prize pool 2.15L',
  },
  {
    title: 'Cofounder Matching',
    description: 'Find collaborators who complement your skills. Pitch ideas, explore opportunities, and take the first step toward building something meaningful.',
    date: '2026-04-12',
    time: '17:00:00',
    end_time: null,
    venue: 'LHC',
    venue_normalized: 'Lecture Hall Complex',
    categories: ['startup'],
    highlights: ['Find your cofounder', 'Pitch your startup idea'],
    links: [
      { url: 'https://forms.gle/uxa3hMHFxWuxqndu5', label: 'register' },
    ],
    event_type: 'meetup',
    registration_link: 'https://forms.gle/uxa3hMHFxWuxqndu5',
    club_slug: 'edc',
    raw_message: 'Cofounder Matching by eDC, 12 April, 5 PM, LHC',
  },
  // ── RECENT PAST (expired) ──
  {
    title: 'Bharat Bricks Hacks 2026',
    description: '2-day national-level hackathon powered by Databricks. Build real-world AI & data solutions on enterprise tools.',
    date: '2026-04-07',
    time: '14:00:00',
    end_time: '18:00:00',
    venue: 'IIT Delhi',
    venue_normalized: 'IIT Delhi Campus',
    categories: ['tech', 'competition'],
    highlights: ['Powered by Databricks', 'Rs 2.5L prizes + Databricks HQ visit'],
    links: [
      { url: 'https://luma.com/bb2026-iitd', label: 'register' },
      { url: 'https://bharatbricks.org/e/iit-delhi', label: 'info' },
    ],
    event_type: 'hackathon',
    registration_link: 'https://luma.com/bb2026-iitd',
    club_slug: 'aries',
    raw_message: 'Bharat Bricks Hacks 2026, Apr 7-8, IIT Delhi',
  },
  {
    title: 'CSE Research Symposium',
    description: 'Two-day research symposium featuring keynote talks by Arkaprava Basu (IISc) and Jyothi Krishnan (IIT Gandhinagar), faculty showcases, poster sessions, and quizzes.',
    date: '2026-04-04',
    time: '09:00:00',
    end_time: '17:00:00',
    venue: 'LH 114',
    venue_normalized: 'Lecture Hall 114',
    categories: ['academic', 'tech'],
    highlights: ['Keynotes by IISc & IIT-GN faculty', 'Research networking + project opportunities'],
    links: [
      { url: 'https://iitd-aces-acm.github.io/research_symposium/', label: 'website' },
    ],
    event_type: 'seminar',
    registration_link: null,
    club_slug: 'aces-acm',
    raw_message: 'Research Symposium, Apr 4-5, LH 114',
  },
  {
    title: 'Khelculus',
    description: 'Multi-sport event with competitions for everyone. Whether you are a pro player or just in it for the fun.',
    date: '2026-04-04',
    time: '10:00:00',
    end_time: null,
    venue: 'Mittal & SAC',
    venue_normalized: 'Mittal School & Student Activity Centre',
    categories: ['sports', 'social'],
    highlights: ['Multi-sport day', 'Open to all skill levels'],
    links: [
      { url: 'https://chat.whatsapp.com/F89smZ2yloTItM5CYDkI2q', label: 'other' },
    ],
    event_type: 'competition',
    registration_link: null,
    club_slug: 'mes',
    raw_message: 'Khelculus, 4th April, Mittal & SAC',
  },
  {
    title: 'QRT Quant Championship Challenge',
    description: 'Applied quantitative research competition by ARIES x QRT. Two-phase: offline kickoff then online till April 1.',
    date: '2026-03-27',
    time: '17:00:00',
    end_time: null,
    venue: 'LH 111',
    venue_normalized: 'Lecture Hall 111',
    categories: ['finance', 'competition', 'tech'],
    highlights: ['Partnered with QRT', 'Hands-on quant research + cash prizes'],
    links: [
      { url: 'https://forms.gle/mZ7aq2oeqE1tPcky6', label: 'register' },
      { url: 'https://chat.whatsapp.com/KS34kbUJddVL3Sfyf04BSN', label: 'other' },
    ],
    event_type: 'competition',
    registration_link: 'https://forms.gle/mZ7aq2oeqE1tPcky6',
    club_slug: 'aries',
    raw_message: 'QRT Quant Championship, 27 March, 5 PM, LH 111',
  },
  {
    title: 'Predestination — Movie Screening',
    description: 'Mind-bending screening of Predestination — a film where every moment loops back on itself. Open to all.',
    date: '2026-03-27',
    time: '19:30:00',
    end_time: null,
    venue: 'Dogra Hall',
    venue_normalized: 'Dogra Hall',
    categories: ['social', 'cultural'],
    highlights: ['Mind-bending sci-fi thriller', 'Free screening at Dogra Hall'],
    links: [],
    event_type: 'screening',
    registration_link: null,
    club_slug: 'physoc',
    raw_message: 'Predestination screening, 27 March, 7:30 PM, Dogra Hall',
  },
  {
    title: 'Build With AI — MCP Workshop',
    description: 'ACES-ACM x Anthropic workshop on Claude and Model Context Protocol (MCP). Hands-on session to integrate AI tools for software development.',
    date: '2026-03-26',
    time: '18:30:00',
    end_time: '19:30:00',
    venue: 'LH 418',
    venue_normalized: 'Lecture Hall 418',
    categories: ['tech', 'workshop'],
    highlights: ['6 months Claude Pro free', '$25 API credits for attendees'],
    links: [
      { url: 'https://forms.gle/aSYkHmLz18CXgPUd8', label: 'register' },
    ],
    event_type: 'workshop',
    registration_link: 'https://forms.gle/aSYkHmLz18CXgPUd8',
    club_slug: 'aces-acm',
    raw_message: 'Build With AI workshop, 26 March, LH418',
  },
  {
    title: 'Shipathon 2 — Agentic AI Sprint',
    description: '24-hour hackathon by ARIES x NASIKO. Build a fully working AI-powered product in 24 hours on the Agentic AI theme.',
    date: '2026-03-25',
    time: '10:00:00',
    end_time: null,
    venue: 'LH 325',
    venue_normalized: 'Lecture Hall 325',
    categories: ['tech', 'competition'],
    highlights: ['24-hour build sprint', 'Cash prizes for Agentic AI products'],
    links: [
      { url: 'https://forms.office.com/r/HLNBWMsQnT', label: 'register' },
    ],
    event_type: 'hackathon',
    registration_link: 'https://forms.office.com/r/HLNBWMsQnT',
    club_slug: 'aries',
    raw_message: 'Shipathon 2 Agentic AI, 25-26 March, LH 325',
  },
  {
    title: 'The Delusional Optimist\'s Guide to Startups',
    description: 'Fireside chat with IIT Delhi founders and Entrepreneurs First. Featuring Aditya Aggarwala (ex-YC, Thiel Fellow), Shatrughan Singh (Operon), Deepanshu Rohilla (MrFood.AI).',
    date: '2026-03-18',
    time: '18:00:00',
    end_time: null,
    venue: 'LH 114',
    venue_normalized: 'Lecture Hall 114',
    categories: ['startup', 'talk'],
    highlights: ['Ex-YC founder & Thiel Fellow on stage', 'IITD founder stories'],
    links: [],
    event_type: 'talk',
    registration_link: null,
    club_slug: 'edc',
    raw_message: 'Delusional Optimists Guide to Startups, 18 March, LH114',
  },
  {
    title: 'Quant Premier League',
    description: 'Three-round competition: Finance quiz, strategic auction market, and rapid buzzer finals. Test your quant skills and market strategy.',
    date: '2026-03-19',
    time: '18:30:00',
    end_time: null,
    venue: 'LHC',
    venue_normalized: 'Lecture Hall Complex',
    categories: ['finance', 'competition'],
    highlights: ['Quiz + auction + buzzer rounds', 'Test your market strategy'],
    links: [
      { url: 'https://chat.whatsapp.com/I7mQAwZTUwm8AUfM0MJUes', label: 'other' },
    ],
    event_type: 'competition',
    registration_link: null,
    club_slug: 'efc',
    raw_message: 'Quant Premier League, 19 March, 6:30 PM, LHC',
  },
  {
    title: 'BlackRock Speaker Session: Quantitative Finance',
    description: 'Interactive session with Michael Sternberg, MD & Global Head of Aladdin Financial Engineering at BlackRock, on how quant finance works beyond textbooks.',
    date: '2026-03-11',
    time: '16:00:00',
    end_time: null,
    venue: 'LH 310',
    venue_normalized: 'Lecture Hall 310',
    categories: ['finance', 'career', 'talk'],
    highlights: ['Speaker: MD at BlackRock', 'Behind-the-scenes of Aladdin platform'],
    links: [
      { url: 'https://forms.gle/oJ2cGkDKbeUHkt7e8', label: 'register' },
      { url: 'https://chat.whatsapp.com/KlKXCfrjuCRBnJxCUIupqe', label: 'other' },
    ],
    event_type: 'talk',
    registration_link: 'https://forms.gle/oJ2cGkDKbeUHkt7e8',
    club_slug: 'efc',
    raw_message: 'BlackRock speaker session, 11 March, 4 PM, LH 310',
  },
  {
    title: 'Lockout 2026 — CP Tournament',
    description: 'High-intensity knockout competitive programming tournament. ICPC-style prelims followed by finals. Sponsored by Jump Trading with a special interaction session.',
    date: '2026-03-11',
    time: '17:15:00',
    end_time: '20:00:00',
    venue: 'LH 325',
    venue_normalized: 'Lecture Hall 325',
    categories: ['tech', 'competition'],
    highlights: ['Sponsored by Jump Trading', 'Rs 20K prize pool + 25 CAIC points'],
    links: [
      { url: 'https://chat.whatsapp.com/Llx04K98W2A0oLQGHW0ooI', label: 'other' },
    ],
    event_type: 'competition',
    registration_link: null,
    club_slug: 'ancc',
    raw_message: 'Lockout 2026, 11 March, 5:15 PM, LH 325',
  },
  {
    title: 'Capture The Flag — Tryst\'26',
    description: 'DevClub CTF Challenge at Tryst. Speed, strategy, security. Teams of up to 4. Rs 60K prize pool.',
    date: '2026-02-28',
    time: '09:30:00',
    end_time: '13:30:00',
    venue: 'LH 114',
    venue_normalized: 'Lecture Hall 114',
    categories: ['tech', 'competition'],
    highlights: ['Rs 60K prize pool', 'Cybersecurity CTF challenge'],
    links: [
      { url: 'https://unstop.com/hackathons/capture-the-flag-tryst26-iit-delhi-1643516', label: 'register' },
      { url: 'https://chat.whatsapp.com/IR4Obzn3Iun74FJF10qICa', label: 'other' },
    ],
    event_type: 'hackathon',
    registration_link: 'https://unstop.com/hackathons/capture-the-flag-tryst26-iit-delhi-1643516',
    club_slug: 'devclub',
    raw_message: 'DevClub CTF, 28 Feb, 9:30 AM, LH114, 60K prize pool',
  },
  {
    title: 'CodeMod 2026',
    description: 'Project Euler-style mathematics programming contest. Combine deep mathematical thinking with algorithmic implementation. Powered by Jump Trading.',
    date: '2026-02-28',
    time: '14:00:00',
    end_time: '16:00:00',
    venue: 'Online',
    venue_normalized: null,
    categories: ['tech', 'competition', 'academic'],
    highlights: ['IMO-level math + code', 'Rs 10K prize pool by Jump Trading'],
    links: [
      { url: 'https://unstop.com/competitions/codemod-tryst26-iit-delhi-1637585', label: 'register' },
      { url: 'https://chat.whatsapp.com/HXlDresUnMUDUUjwdpAaxN', label: 'other' },
    ],
    event_type: 'competition',
    registration_link: 'https://unstop.com/competitions/codemod-tryst26-iit-delhi-1637585',
    club_slug: 'ancc',
    raw_message: 'CodeMod 2026, 28 Feb, 2 PM, Jump Trading sponsor',
  },
  {
    title: 'Future of Finance with Goldman Sachs',
    description: 'From equity derivatives to trading algorithms to risk systems. IGTS x EFC x Goldman Sachs session on how engineering shapes global finance.',
    date: '2026-02-03',
    time: '19:00:00',
    end_time: null,
    venue: 'LH 111',
    venue_normalized: 'Lecture Hall 111',
    categories: ['finance', 'career', 'talk'],
    highlights: ['Goldman Sachs engineers on stage', 'Career insights in quant & fintech'],
    links: [
      { url: 'https://chat.whatsapp.com/DsJwai250eg1IJIT8OIXzp', label: 'other' },
    ],
    event_type: 'talk',
    registration_link: null,
    club_slug: 'efc',
    raw_message: 'Future of Finance with Goldman Sachs, 3 Feb, 7 PM, LH 111',
  },
  {
    title: 'GDB Masterclass',
    description: 'Hands-on masterclass on GDB debugging by Rajat Jain (Ex-Tower Research Capital, Founder BeQuant.dev). Professional workflows for crashes, memory, concurrency.',
    date: '2026-02-05',
    time: '18:45:00',
    end_time: '20:45:00',
    venue: 'LH 308',
    venue_normalized: 'Lecture Hall 308',
    categories: ['tech', 'workshop'],
    highlights: ['Speaker: Ex-Tower Research quant dev', 'Industry-grade debugging skills'],
    links: [
      { url: 'https://chat.whatsapp.com/EL9MkHUs52w4Sqin6i9xxP', label: 'other' },
    ],
    event_type: 'workshop',
    registration_link: null,
    club_slug: 'devclub',
    raw_message: 'GDB Masterclass by DevClub x BeQuant.dev, 5 Feb, LH308',
  },
  {
    title: 'Rajasthani Folk Concert — Virasat \'26',
    description: 'SPIC MACAY presents Rajasthani folk music by Bungar Khan. Authentic traditional rhythms and melodies in a culturally immersive evening.',
    date: '2026-02-11',
    time: '18:00:00',
    end_time: '20:00:00',
    venue: 'Seminar Hall',
    venue_normalized: 'Seminar Hall',
    categories: ['cultural'],
    highlights: ['Live Rajasthani folk by Bungar Khan', 'No registration needed'],
    links: [],
    event_type: 'performance',
    registration_link: null,
    club_slug: 'spicmacay',
    raw_message: 'Rajasthani Folk Concert, 11 Feb, 6-8 PM, Seminar Hall',
  },
  {
    title: 'India AI Impact Summit — Campus Dialogue',
    description: 'High-impact dialogue with Suvrat Bhooshan (CEO Gan.ai), Dr. Arghya Ray (IIT Delhi), and a leading AI influencer on the future of AI in India.',
    date: '2026-02-13',
    time: '17:00:00',
    end_time: '18:30:00',
    venue: 'Auditorium, Vishwakarma Bhavan',
    venue_normalized: 'DMS IIT Delhi',
    categories: ['tech', 'talk'],
    highlights: ['CEO of Gan.ai on stage', 'Pitch ideas to industry leaders'],
    links: [
      { url: 'https://forms.gle/5cpA9h6a5AUbureq5', label: 'register' },
    ],
    event_type: 'panel',
    registration_link: 'https://forms.gle/5cpA9h6a5AUbureq5',
    club_slug: 'aina',
    raw_message: 'India AI Impact Summit, 13 Feb, 5 PM, Vishwakarma Bhavan',
  },
  {
    title: 'Da Vinci Speed Dating: Career Edition',
    description: 'Interact 1:1 with Da Vinci Trading professionals from India & Amsterdam offices. Explore careers in trading, tech, and more.',
    date: '2026-04-15',
    time: '17:00:00',
    end_time: null,
    venue: 'TBD',
    venue_normalized: null,
    categories: ['career', 'finance'],
    highlights: ['1:1 with Da Vinci pros from Amsterdam', 'Dinner invite for selected participants'],
    links: [
      { url: 'https://davincitrading.com/career-match/', label: 'register' },
    ],
    event_type: 'meetup',
    registration_link: 'https://davincitrading.com/career-match/',
    club_slug: 'efc',
    raw_message: 'Da Vinci Speed Dating Career Edition, register at davincitrading.com',
  },
  // ── IIT Delhi circular announcements ──
  {
    title: 'Inaugural & Book Exhibition on Dr. B.R. Ambedkar',
    description:
      'On Dr. Ambedkar\'s birth anniversary: books on Dr. B.R. Ambedkar on display on the first floor of the Central Library, 9:30 AM–5:15 PM, April 10–16, 2026. ' +
      'Inauguration by Prof. Arvind K. Nema (Deputy Director, Operations), with Prof. Manojkumar Ramteke (Liaison Officer, SC/ST Cell) and Prof. B.J. Alappat (Chairperson, ACL) on April 10 at 10:30 AM. Contact: cdd@library.iitd.ac.in.',
    date: '2026-04-10',
    time: '09:30:00',
    end_time: '17:15:00',
    venue: 'Central Library, First Floor',
    venue_normalized: 'Central Library (First Floor)',
    categories: ['cultural', 'academic', 'wellness'],
    highlights: ['Runs Apr 10–16', 'Inauguration Apr 10, 10:30 AM'],
    links: [{ url: 'https://library.iitd.ac.in/pdf/ExhibBRAmbedkar202604.pdf', label: 'info' }],
    event_type: 'other',
    registration_link: null,
    club_slug: 'central-library',
    raw_message: 'Book Exhibition on Dr. B.R. Ambedkar, Central Library, Apr 10–16, 2026',
  },
  {
    title: 'Insights from Ramana Maharshi for Mastering Inner Peace',
    description:
      'NRCVEE talk. Speaker: Dr. Venkat S. Ramanan, President of Sri Ramanasramam and great grandnephew of Sri Ramana Maharshi. ' +
      'He will discuss teachings of Sri Ramana Maharshi on retaining inner peace amid changing circumstances—work, relationships, loss, and success.',
    date: '2026-04-10',
    time: '17:00:00',
    end_time: '18:00:00',
    venue: 'LH 111',
    venue_normalized: 'Lecture Hall Complex LH111',
    categories: ['talk', 'wellness'],
    highlights: ['Dr. Venkat S. Ramanan', 'NRCVEE'],
    links: [],
    event_type: 'talk',
    registration_link: null,
    club_slug: 'nrcvee',
    raw_message: 'Ramana Maharshi talk, Fri Apr 10 2026, 5–6 PM, LH111',
  },
  {
    title: 'IHFC 61st CoboTalks — Robotically Steerable Guidewires',
    description:
      'IHFC flagship monthly seminar. Speaker: Dr. Jaydev Desai, Professor and Cardiovascular Biomedical Engineering Distinguished Chair, Georgia Tech; Director, Georgia Center for Medical Robotics. ' +
      'Topic: robotically steerable guidewires toward autonomous endovascular interventions; neurovascular and CTO challenges. Session for students, educators, researchers, and entrepreneurs.',
    date: '2026-04-08',
    time: '18:00:00',
    end_time: '19:00:00',
    venue: 'Online',
    venue_normalized: 'Online (see join link)',
    categories: ['engineering', 'talk', 'tech'],
    highlights: ['Dr. Jaydev Desai, Georgia Tech', 'Surgical robotics'],
    links: [
      { url: 'https://ihfc.accubate.app/ext/survey/16478/apply', label: 'register' },
      { url: 'https://tinyurl.com/b8yjwvpd', label: 'other' },
    ],
    event_type: 'talk',
    registration_link: 'https://ihfc.accubate.app/ext/survey/16478/apply',
    club_slug: 'ihfc',
    raw_message: 'IHFC 61st CoboTalks, Wed Apr 8 2026, 6–7 PM IST',
  },
  {
    title: 'ME Guest Talk — Dr. Debjit Kundu (GE Aerospace)',
    description:
      'Title: Aerosols in asymmetric airways: in health and in disease. ' +
      'Dr. Debjit Kundu (Lead Engineer, GE Aerospace) on deposition of inhaled particles, reduced-order airway models, and implications for drug delivery and infection risk. ' +
      'Ph.D. IIT Madras (PMRF). Hosted by Mechanical Engineering.',
    date: '2026-04-22',
    time: '16:00:00',
    end_time: null,
    venue: 'ME Seminar Room (II-422)',
    venue_normalized: 'ME Seminar Room II-422',
    categories: ['academic', 'engineering', 'talk'],
    highlights: ['GE Aerospace', 'Aerosols & airways'],
    links: [],
    event_type: 'talk',
    registration_link: null,
    club_slug: 'mes',
    raw_message: 'ME guest talk Debjit Kundu, Apr 22 2026, 4 PM, II-422',
  },
  {
    title: 'IKS Conference & Hackathon — Unriddling Inference',
    description:
      'Interdisciplinary conference: "Unriddling Inference: From Pramāṇa Theory to Modern Logic and AI". ' +
      'Explores classical Indian pramāṇa theory as a framework for justification and valid inference relevant to AI and formal logic. Offline at IIT Delhi. ' +
      'Organized with Civil Engineering; contact Dr. Jyotiranjan Beuria for queries.',
    date: '2026-04-12',
    time: '09:00:00',
    end_time: '18:00:00',
    venue: 'LH 418',
    venue_normalized: 'Lecture Hall 418',
    categories: ['academic', 'talk', 'tech'],
    highlights: ['IKS × AI & logic', 'Full day Apr 12'],
    links: [{ url: 'https://events.issdelhi.org/unriddling-inference-2026/', label: 'register' }],
    event_type: 'seminar',
    registration_link: 'https://events.issdelhi.org/unriddling-inference-2026/',
    club_slug: 'civil-dept',
    raw_message: 'IKS Conference Unriddling Inference, Apr 12 2026, LH418',
  },
];

async function seed() {
  console.log('Starting seed...\n');

  // 1. Create a system user for seeded events
  const systemPhone = '910000000000';
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('phone', systemPhone)
    .single();

  let systemUserId: string;
  if (existingUser) {
    systemUserId = existingUser.id;
    console.log(`System user exists: ${systemUserId}`);
  } else {
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        phone: systemPhone,
        name: 'Saturn Seeder',
        role: 'god',
        interests: [],
        onboarded: true,
      })
      .select('id')
      .single();
    if (error) throw new Error(`Failed to create system user: ${error.message}`);
    systemUserId = newUser!.id;
    console.log(`Created system user: ${systemUserId}`);
  }

  // 2. Create clubs
  const clubIdMap = new Map<string, string>();
  for (const club of clubs) {
    const { data: existing } = await supabase
      .from('clubs')
      .select('id')
      .eq('slug', club.slug)
      .single();

    if (existing) {
      clubIdMap.set(club.slug, existing.id);
      console.log(`  Club exists: ${club.name}`);
      continue;
    }

    const inviteCode = club.slug.toUpperCase().replace(/-/g, '').substring(0, 6).padEnd(6, 'X');
    const { data: newClub, error } = await supabase
      .from('clubs')
      .insert({
        name: club.name,
        slug: club.slug,
        invite_code: inviteCode,
        admin_phone: systemPhone,
        category: club.category,
        tagline: club.tagline,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Failed to create club ${club.name}: ${error.message}`);
      continue;
    }
    clubIdMap.set(club.slug, newClub!.id);
    console.log(`  Created club: ${club.name}`);
  }

  console.log(`\nClubs seeded: ${clubIdMap.size}\n`);

  // 3. Detect if V2 columns exist
  let hasV2Columns = true;
  const { error: probeErr } = await supabase
    .from('events')
    .select('event_type')
    .limit(1);
  if (probeErr && probeErr.message.includes('event_type')) {
    hasV2Columns = false;
    console.log('V2 columns (highlights, links, event_type) not yet migrated — inserting without them.');
  } else {
    console.log('V2 columns detected — including highlights, links, event_type.');
  }

  // 4. Create events
  const today = '2026-04-09';
  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const clubId = clubIdMap.get(event.club_slug);
    if (!clubId) {
      console.error(`  No club found for slug: ${event.club_slug}`);
      skipped++;
      continue;
    }

    // Check for duplicates by title + date
    const { data: dup } = await supabase
      .from('events')
      .select('id')
      .eq('title', event.title)
      .eq('date', event.date)
      .single();

    if (dup) {
      console.log(`  Skipped (exists): ${event.title}`);
      skipped++;
      continue;
    }

    const status = event.date < today ? 'expired' : 'confirmed';

    // Build insert payload; only include V2 columns if they exist in the DB
    const payload: Record<string, unknown> = {
      club_id: clubId,
      posted_by: systemUserId,
      title: event.title,
      description: event.description,
      raw_message: event.raw_message,
      date: event.date,
      time: event.time,
      end_time: event.end_time,
      venue: event.venue,
      venue_normalized: event.venue_normalized,
      categories: event.categories,
      registration_link: event.registration_link,
      status,
      is_express: false,
      broadcast_sent: status === 'expired',
    };
    if (hasV2Columns) {
      payload.highlights = event.highlights;
      payload.links = event.links;
      payload.event_type = event.event_type;
    }

    const { error } = await supabase.from('events').insert(payload);

    if (error) {
      console.error(`  Failed: ${event.title} — ${error.message}`);
      skipped++;
    } else {
      console.log(`  ${status === 'confirmed' ? '+' : '-'} ${event.title} (${event.date}) [${status}]`);
      created++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  console.log(`Upcoming events: ${events.filter(e => e.date >= today).length}`);
  console.log(`Past events (expired): ${events.filter(e => e.date < today).length}`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
