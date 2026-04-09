/**
 * IIT Delhi student bodies — from bodydata.md (SAC/CAIC/BRCA/BSA/CAIC/dept) + legacy orgs.
 * Categories use slugs from src/config/categories.json (tech, cultural, sports, …).
 *
 * Appointing admins / power users (after seed):
 * 1. Each user must message the bot once (so they exist in `users`).
 * 2. God: `/promote +<E.164> admin <exact club name>` sets club admin and `clubs.admin_phone`.
 * 3. God: `/promote +<E.164> power_user <exact club name>` adds a poster without changing admin.
 * 4. Club admin: `/adduser +<E.164>` adds a power user (they `/join` not needed if you add directly).
 * 5. Alternatively share the club invite code; users send `/join <code>` and become power_user (one club only).
 */

export type IITDBody = {
  name: string;
  slug: string;
  /** Primary category for discovery — must match categories.json slugs */
  category: string;
  tagline: string;
  /** Optional longer blurb; often includes parent board */
  description?: string;
};

function row(
  name: string,
  slug: string,
  category: string,
  tagline: string,
  description?: string
): IITDBody {
  return { name, slug, category, tagline, ...(description ? { description } : {}) };
}

/** All bodies to sync via seed (insert missing, update metadata for existing slugs). */
export const IITD_BODIES: IITDBody[] = [
  // ── Institute-level councils ──
  row(
    'Student Affairs Council (SAC)',
    'sac',
    'social',
    'Apex student affairs; coordinates boards and reps',
    'Institute-level council. Oversees BHM, BSW, BSA, BRCA, BSP and hostel/program reps.'
  ),
  row(
    'Co-curricular and Academic Interaction Council (CAIC)',
    'caic',
    'social',
    'Co-curricular & technical societies; Tryst (tech fest)',
    'Coordinates technical clubs, departmental societies, and CAIC-listed bodies.'
  ),

  // ── SAC boards ──
  row(
    'Board for Hostel Management (BHM)',
    'bhm',
    'social',
    'Hostels, mess, maintenance',
    'SAC board — hostel secretaries and infrastructure.'
  ),
  row(
    'Board for Student Welfare (BSW)',
    'bsw',
    'wellness',
    'Welfare, mentorship, inclusion',
    'SAC board — student welfare, mentorship, SC/ST & international student support.'
  ),
  row(
    'Board for Sports Activities (BSA)',
    'bsa',
    'sports',
    'Institute sports teams & Sportech',
    'SAC board — oversees 13 sports verticals and facilities.'
  ),
  row(
    'Board for Recreational and Creative Activities (BRCA)',
    'brca',
    'cultural',
    'Rendezvous & 11 cultural clubs',
    'SAC board — cultural hub; runs Rendezvous and BRCA clubs.'
  ),
  row(
    'Board for Student Publications (BSP)',
    'bsp',
    'literature',
    'Inception, journalism, media',
    'SAC board — student magazines, design, and outreach.'
  ),

  // ── BRCA clubs (11) ──
  row('Dance Club', 'dance-club', 'cultural', 'Dance performances & workshops', 'BRCA club.'),
  row('Music Club', 'music-club', 'cultural', 'Bands, vocals & music events', 'BRCA club (Madhurima in older refs).'),
  row('Dramatics Club (Ankahi)', 'dramatics-club', 'cultural', 'Theatre & stage', 'BRCA club.'),
  row('Fine Arts & Crafts Club', 'fine-arts-club', 'design', 'Fine arts & crafts (Azure)', 'BRCA club.'),
  row('Design Club', 'design-club', 'design', 'Visual & communication design', 'BRCA club.'),
  row('Photography & Film Club', 'photo-film-club', 'design', 'Photo & cinema', 'BRCA club.'),
  row('Hindi Samiti', 'hindi-samiti', 'literature', 'Hindi literature & culture', 'BRCA club.'),
  row('Debating Club', 'debating-club', 'literature', 'Debates & discourse', 'BRCA club.'),
  row('Quizzing Club', 'quizzing-club', 'literature', 'Quizzes & trivia', 'BRCA club.'),
  row('Literary Club', 'literati', 'literature', 'Literature & creative writing', 'BRCA club (Literati naming in some years).'),
  row('SPIC MACAY', 'spicmacay', 'cultural', 'Indian classical music & culture', 'BRCA — SPIC MACAY chapter.'),

  // ── BSA sports (13) — each as discoverable “body” ──
  row('Aquatics (Swimming / Water Polo)', 'sport-aquatics', 'sports', 'Swimming & water polo', 'BSA vertical.'),
  row('Athletics', 'sport-athletics', 'sports', 'Track & field', 'BSA vertical.'),
  row('Badminton', 'sport-badminton', 'sports', 'Shuttle & league play', 'BSA vertical.'),
  row('Basketball', 'sport-basketball', 'sports', 'Court & league', 'BSA vertical.'),
  row('Chess', 'sport-chess', 'sports', 'Chess & strategy', 'BSA vertical.'),
  row('Cricket', 'sport-cricket', 'sports', 'Cricket teams & tournaments', 'BSA vertical.'),
  row('Football', 'sport-football', 'sports', 'Football', 'BSA vertical.'),
  row('Hockey', 'sport-hockey', 'sports', 'Field hockey', 'BSA vertical.'),
  row('Lawn Tennis', 'sport-lawn-tennis', 'sports', 'Tennis', 'BSA vertical.'),
  row('Squash', 'sport-squash', 'sports', 'Squash courts & league', 'BSA vertical.'),
  row('Table Tennis', 'sport-table-tennis', 'sports', 'Table tennis', 'BSA vertical.'),
  row('Volleyball', 'sport-volleyball', 'sports', 'Volleyball', 'BSA vertical.'),
  row('Weightlifting', 'sport-weightlifting', 'sports', 'Strength sports', 'BSA vertical.'),

  // ── CAIC technical clubs ──
  row('DevClub', 'devclub', 'tech', 'Software & open source', 'CAIC technical — developers club.'),
  row('iGEM IIT Delhi', 'igem', 'engineering', 'Synthetic biology & iGEM', 'CAIC technical.'),
  row('Physics & Astronomy Club (PAC)', 'physoc', 'academic', 'Physics & astronomy outreach', 'CAIC technical (PhySoc / PAC).'),
  row('Business and Consulting Club (BnC)', 'bnc', 'career', 'Consulting & business cases', 'CAIC technical.'),
  row('AeroClub', 'aeroclub', 'engineering', 'Aerial systems & aeromodelling', 'CAIC technical.'),
  row('Economics & Finance Club', 'efc', 'finance', 'Markets, quant & economics', 'CAIC technical.'),
  row('ANCC', 'ancc', 'tech', 'Algorithms & competitive programming', 'CAIC technical.'),
  row('ARIES', 'aries', 'tech', 'AI & intelligent systems', 'CAIC technical.'),
  row('Indian Game Theory Society (IGTS)', 'igts', 'finance', 'Game theory & decisions', 'CAIC technical.'),
  row('Infinity Hyperloop', 'infinity-hyperloop', 'engineering', 'Hyperloop & mobility', 'CAIC technical.'),
  row('Axlr8r Formula Racing', 'axlr8r', 'engineering', 'Formula Student & automotive', 'CAIC technical.'),
  row('Robotics Club', 'robotics-club', 'engineering', 'Robotics & automation', 'CAIC technical.'),
  row('BlocSoc', 'blocsoc', 'tech', 'Blockchain & Web3', 'CAIC technical.'),

  // ── Departmental societies (CAIC) ──
  row('ACES ACM', 'aces-acm', 'tech', 'Computer science & programming', 'Dept society — CSE.'),
  row('MathSoc', 'mathsoc', 'academic', 'Mathematics seminars & contests', 'Dept society — Maths.'),
  row('BETA', 'beta', 'engineering', 'Biotechnology engineering', 'Dept society — biotech.'),
  row('MSES', 'mses', 'engineering', 'Materials science', 'Dept society — MSE.'),
  row('Civil Engineering Forum (CEF)', 'cef', 'engineering', 'Civil engineering community', 'Dept society — civil.'),
  row('MES', 'mes', 'engineering', 'Mechanical engineering community', 'Dept society — mechanical (not BSA “sports”).'),
  row('ChES', 'ches', 'engineering', 'Chemical engineering', 'Dept society — chemical.'),
  row('Energy Society', 'energy-society', 'engineering', 'Energy & sustainability', 'Dept society.'),
  row('EES', 'ees', 'engineering', 'Electrical engineering', 'Dept society — electrical.'),
  row('TES', 'tes', 'engineering', 'Textile engineering', 'Dept society — textile.'),
  row('Chemocronies', 'chemocronies', 'academic', 'Chemistry community', 'Dept society — chemistry.'),
  row('AMS', 'ams', 'engineering', 'Applied mechanics', 'Dept society — AM.'),

  // ── Cells & other ──
  row('Entrepreneurship Development Cell (eDC)', 'edc', 'startup', 'Startups & BeCon', 'Often linked to SAC; student entrepreneurship.'),
  row('National Service Scheme (NSS)', 'nss', 'wellness', 'Social service & volunteering', 'NSS hours & campus drives.'),

  // ── Legacy / campus orgs (still listed for events & ops) ──
  row('Student Incubation Cell (SInC)', 'sinc', 'startup', 'Incubation & builder events', 'Startup incubation programming.'),
  row('BloodConnect', 'bloodconnect', 'wellness', 'Blood donation drives', 'Student blood donation initiative.'),
  row('AINA', 'aina', 'wellness', 'Talks & national initiatives', 'An Initiative for National Advancement.'),
  row('Northeast Society', 'northeast-society', 'cultural', 'Northeast India culture & NEO', 'Regional cultural society.'),
  row('Central Library', 'central-library', 'academic', 'Library events & resources', 'IIT Delhi Central Library listings.'),
  row('NRCVEE', 'nrcvee', 'wellness', 'Value education in engineering', 'National Resource Centre for Value Education in Engineering.'),
  row('IHFC', 'ihfc', 'engineering', 'Collaborative research host', 'IITD Host for Futuristic Collaborative Research.'),
  row('Department of Civil Engineering', 'civil-dept', 'academic', 'Dept announcements', 'Civil engineering department (distinct from CEF society).'),
  row('Campus Announcements', 'campus-announcements', 'social', 'Institute-wide & god posts', 'Fallback club for system/god posts without a society.'),
];
