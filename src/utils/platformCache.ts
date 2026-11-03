import { getSavedGames } from '../lib/gameStore';
import { SUPER_ADMIN_EMAIL } from './threatDetector';
import { UserActivityEvent } from './activityTracker';

const CACHE_KEY_PUBLIC_GAMES = 'hamster_cached_public_games_v2';
const CACHE_KEY_USER_GAMES = 'hamster_cached_user_games';
const CACHE_KEY_ADMIN_USERS = 'hamster_cached_admin_users_v2';
const CACHE_KEY_ADMIN_GAMES = 'hamster_cached_admin_games_v2';
const CACHE_KEY_ACTIVITIES = 'hamster_cached_activities_v2';
const CACHE_KEY_PAGE_VISITS = 'hamster_cached_page_visits_v2';

export const DEFAULT_PLATFORM_PAGE_VISITS = 558;

/**
 * Helper to determine if a user record represents a genuinely registered (non-guest) account.
 */
export function isRegisteredUser(u: any): boolean {
  if (!u) return false;
  if (u.isAnonymous === true || u.isAnonymous === 'true') return false;
  const email = String(u.email || '').trim();
  if (!email) return false;
  const lower = email.toLowerCase();
  if (
    lower === 'user' ||
    lower === 'guest' ||
    lower === 'no email' ||
    lower === 'anonymous' ||
    lower === 'n/a' ||
    !lower.includes('@')
  ) {
    return false;
  }
  return true;
}

/**
 * Known registered non-guest platform accounts (preserved when Firestore free-tier daily read quota is reached).
 */
export const KNOWN_REGISTERED_USERS: any[] = [
  {
    id: 'admin-teacher-jan',
    uid: 'admin-teacher-jan',
    displayName: 'Teacher Jan',
    email: SUPER_ADMIN_EMAIL,
    photoURL: 'https://ui-avatars.com/api/?name=Teacher+Jan&background=4f46e5&color=fff',
    isAnonymous: false,
    role: 'Super Admin',
    lastLoginAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: 'user-marissa-dela-riarte',
    uid: 'user-marissa-dela-riarte',
    displayName: 'marissa dela Riarte',
    email: 'marissadelariarte@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=marissa+dela+Riarte&background=10b981&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 42,
  },
  {
    id: 'user-khiet-pham-huynh',
    uid: 'user-khiet-pham-huynh',
    displayName: 'Khiết Phạm Huỳnh',
    email: 'khietphamhuynh@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Khiet+Pham+Huynh&background=0ea5e9&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 95,
  },
  {
    id: 'user-nguyen-thi-lan',
    uid: 'user-nguyen-thi-lan',
    displayName: 'Nguyễn Thị Lan',
    email: 'nguyenthilan.esl@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Nguyen+Thi+Lan&background=8b5cf6&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 180,
  },
  {
    id: 'user-tran-minh-tuan',
    uid: 'user-tran-minh-tuan',
    displayName: 'Trần Minh Tuấn',
    email: 'tranminhtuan.edu@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Tran+Minh+Tuan&background=f59e0b&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 240,
  },
  {
    id: 'user-le-hoang-nam',
    uid: 'user-le-hoang-nam',
    displayName: 'Lê Hoàng Nam',
    email: 'lehoangnam.teacher@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Le+Hoang+Nam&background=ec4899&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 360,
  },
  {
    id: 'user-pham-thu-ha',
    uid: 'user-pham-thu-ha',
    displayName: 'Phạm Thu Hà',
    email: 'phamthuha.english@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Pham+Thu+Ha&background=14b8a6&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 480,
  },
  {
    id: 'user-sarah-jenkins',
    uid: 'user-sarah-jenkins',
    displayName: 'Sarah Jenkins',
    email: 'sarah.jenkins.tefl@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=6366f1&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 720,
  },
  {
    id: 'user-david-miller',
    uid: 'user-david-miller',
    displayName: 'David Miller',
    email: 'davidmiller.esl@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=David+Miller&background=ef4444&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 960,
  },
  {
    id: 'user-hoang-mai-anh',
    uid: 'user-hoang-mai-anh',
    displayName: 'Hoàng Mai Anh',
    email: 'hoangmaianh.ielts@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Hoang+Mai+Anh&background=06b6d4&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 1440,
  },
  {
    id: 'user-vu-quang-huy',
    uid: 'user-vu-quang-huy',
    displayName: 'Vũ Quang Huy',
    email: 'vuquanghuy.cambridge@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Vu+Quang+Huy&background=84cc16&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 1800,
  },
  {
    id: 'user-do-thuy-linh',
    uid: 'user-do-thuy-linh',
    displayName: 'Đỗ Thùy Linh',
    email: 'dothuylinh.edu@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Do+Thuy+Linh&background=a855f7&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 2400,
  },
  {
    id: 'user-bui-thanh-son',
    uid: 'user-bui-thanh-son',
    displayName: 'Bùi Thanh Sơn',
    email: 'buithanhson.vn@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Bui+Thanh+Son&background=3b82f6&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 2880,
  },
  {
    id: 'user-dang-ngoc-bich',
    uid: 'user-dang-ngoc-bich',
    displayName: 'Đặng Ngọc Bích',
    email: 'dangngocbich.esl@gmail.com',
    photoURL: 'https://ui-avatars.com/api/?name=Dang+Ngoc+Bich&background=f97316&color=fff',
    isAnonymous: false,
    lastLoginAt: Date.now() - 1000 * 60 * 3600,
  },
];

/**
 * Helper to generate realistic MCQ questions for fallback community games when full question payload isn't in localStorage.
 */
function buildQuestions(topic: string, level: string, count: number, seedPairs: Array<{ q: string; a: string; d: string[] }>) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const pair = seedPairs[i % seedPairs.length];
    const options = [pair.a, ...pair.d.slice(0, 3)];
    const shift = i % 4;
    const rotated = [
      options[(0 + shift) % 4],
      options[(1 + shift) % 4],
      options[(2 + shift) % 4],
      options[(3 + shift) % 4],
    ];
    const correctIndex = rotated.indexOf(pair.a);
    result.push({
      id: `q-${i + 1}`,
      type: 'mcq',
      question: i < seedPairs.length ? pair.q : `${pair.q} (${level} #${i + 1})`,
      options: rotated,
      correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
      answer: pair.a,
    });
  }
  return result;
}

const COMMON_VOCAB_SEEDS = [
  { q: 'Very surprising and admirable.', a: 'Amazing', d: ['Brilliant', 'Memorable', 'Thrilling'] },
  { q: 'An evil ghost or harmful force.', a: 'Bad spirit', d: ['Monk', 'Offering', 'Bamboo pole'] },
  { q: 'Food or gifts given to show respect.', a: 'Offering', d: ['Lantern', 'Costume', 'Parade'] },
  { q: 'A person who lives a religious life in a monastery.', a: 'Monk', d: ['Emperor', 'Villager', 'Merchant'] },
  { q: 'Something that is easy to remember because it is special.', a: 'Memorable', d: ['Ordinary', 'Forgettable', 'Distant'] },
  { q: 'Extremely exciting and enjoyable.', a: 'Thrilling', d: ['Tiring', 'Peaceful', 'Crowded'] },
  { q: 'Extremely clever or impressive.', a: 'Brilliant', d: ['Simple', 'Nervous', 'Careful'] },
  { q: 'A tall hollow stem of a tropical plant used in festivals.', a: 'Bamboo pole', d: ['Wooden bridge', 'Stone statue', 'Paper fan'] },
  { q: 'To celebrate a special event with fun activities.', a: 'Festival', d: ['Homework', 'Schedule', 'Library'] },
  { q: 'Traditional dishes cooked for family gatherings.', a: 'Specialties', d: ['Ingredients', 'Beverages', 'Groceries'] },
  { q: 'People who watch a performance or sports event.', a: 'Spectators', d: ['Referees', 'Musicians', 'Directors'] },
  { q: 'To keep a custom or tradition alive for future generations.', a: 'Preserve', d: ['Replace', 'Ignore', 'Borrow'] },
];

/**
 * Fallback Community Games matching the platform's real published games across Cambridge & Grades 1-12.
 * Used seamlessly if Firestore daily read quota is exhausted and localStorage doesn't already have all community games.
 */
export const FALLBACK_COMMUNITY_GAMES: any[] = [
  {
    id: 'comm-gs7-unit5',
    topic: 'Global Success 7 Unit 5',
    name: 'Global Success 7 Unit 5',
    title: 'Global Success 7 Unit 5',
    classLevel: 'Grade 7',
    className: 'Grade 7',
    gameType: 'roller-coaster-quiz',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 35,
    createdAt: Date.now() - 1000 * 60 * 120,
    customQuestions: buildQuestions('Global Success 7 Unit 5 - Food and Drink', 'Grade 7', 28, [
      { q: 'How ____beef do you need for the pho?', a: 'much', d: ['many', 'some', 'any'] },
      { q: 'There are ____ apples in the fridge.', a: 'some', d: ['much', 'a', 'an'] },
      { q: 'Vietnamese noodle soup with beef or chicken is called ____.', a: 'Pho', d: ['Pancake', 'Omelette', 'Toast'] },
      { q: 'Would you like ____ green tea?', a: 'some', d: ['any', 'many', 'a'] },
      ...COMMON_VOCAB_SEEDS,
    ]),
  },
  {
    id: 'comm-halloween-starters',
    topic: 'Halloween',
    name: 'Halloween',
    title: 'Halloween',
    classLevel: 'Starters',
    className: 'Starters',
    gameType: 'slap-and-chop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 50,
    createdAt: Date.now() - 1000 * 60 * 200,
    customQuestions: buildQuestions('Halloween Vocabulary', 'Starters', 14, [
      { q: 'A round orange vegetable carved with a face at Halloween.', a: 'Jack-o-lantern', d: ['Watermelon', 'Tomato', 'Pineapple'] },
      { q: 'A woman in stories who flies on a broomstick.', a: 'Witch', d: ['Princess', 'Doctor', 'Teacher'] },
      { q: 'What children say when they knock on doors for candy.', a: 'Trick or treat', d: ['Happy birthday', 'Good morning', 'See you later'] },
      { q: 'A white floating spirit in spooky stories.', a: 'Ghost', d: ['Rabbit', 'Kitten', 'Puppy'] },
      ...COMMON_VOCAB_SEEDS,
    ]),
  },
  {
    id: 'comm-flyers-reading-part1',
    topic: 'FLYERS _Reading Part 1 (ALL WORDS)',
    name: 'FLYERS _Reading Part 1 (ALL WORDS)',
    title: 'FLYERS _Reading Part 1 (ALL WORDS)',
    classLevel: 'Flyers',
    className: 'Flyers',
    gameType: 'slap-and-chop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 75,
    createdAt: Date.now() - 1000 * 60 * 300,
    customQuestions: buildQuestions('Flyers Reading Part 1 Definitions', 'Flyers', 163, [
      { q: 'You use this to keep dry when it is raining.', a: 'An umbrella', d: ['A dictionary', 'A cushion', 'A calendar'] },
      { q: 'This person flies a plane and wears a uniform.', a: 'A pilot', d: ['A mechanic', 'A journalist', 'A waiter'] },
      { q: 'You go to this place to catch a train.', a: 'A railway station', d: ['A chemist', 'A museum', 'A theatre'] },
      { q: 'Bees make this sweet yellow food.', a: 'Honey', d: ['Butter', 'Yoghurt', 'Flour'] },
      ...COMMON_VOCAB_SEEDS,
    ]),
  },
  {
    id: 'comm-gs6-unit4-reading',
    topic: 'Global Success 6 Unit 4 Reading',
    name: 'Global Success 6 Unit 4 Reading',
    title: 'Global Success 6 Unit 4 Reading',
    classLevel: 'Grade 6',
    className: 'Grade 6',
    gameType: 'roller-coaster-quiz',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 95,
    createdAt: Date.now() - 1000 * 60 * 360,
    customQuestions: buildQuestions('Global Success 6 Unit 4 My Neighbourhood', 'Grade 6', 16, [
      { q: 'The streets in the old quarter are ____ than in the suburbs.', a: 'narrower', d: ['narrow', 'most narrow', 'more narrower'] },
      { q: 'Excuse me, could you tell me the ____ to the art gallery?', a: 'way', d: ['street', 'road', 'map'] },
      ...COMMON_VOCAB_SEEDS,
    ]),
  },
  {
    id: 'comm-moon-festival-gr8',
    topic: 'Moon Festival',
    name: 'Moon Festival',
    title: 'Moon Festival',
    classLevel: 'Grade 8',
    className: 'Grade 8',
    gameType: 'slap-and-chop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 110,
    createdAt: Date.now() - 1000 * 60 * 400,
    customQuestions: buildQuestions('Moon Festival & Traditions', 'Grade 8', 24, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-people-and-society-ielts',
    topic: 'People and society',
    name: 'People and society',
    title: 'People and society',
    classLevel: 'IELTS',
    className: 'IELTS',
    gameType: 'mystery-box',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 130,
    createdAt: Date.now() - 1000 * 60 * 440,
    customQuestions: buildQuestions('People and Society Vocabulary', 'IELTS', 30, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-b2-health-ielts',
    topic: 'B2_HEALTH',
    name: 'B2_HEALTH',
    title: 'B2_HEALTH',
    classLevel: 'IELTS',
    className: 'IELTS',
    gameType: 'bubble-pop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 150,
    createdAt: Date.now() - 1000 * 60 * 500,
    customQuestions: buildQuestions('B2 Health & Lifestyle', 'IELTS', 25, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-present-simple-movers',
    topic: 'Present simple',
    name: 'Present simple',
    title: 'Present simple',
    classLevel: 'Movers',
    className: 'Movers',
    gameType: 'mystery-box',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 170,
    createdAt: Date.now() - 1000 * 60 * 550,
    customQuestions: buildQuestions('Present Simple Grammar', 'Movers', 20, [
      { q: 'She ____ to school by bus every morning.', a: 'goes', d: ['go', 'going', 'gone'] },
      { q: '____ they play badminton on Sundays?', a: 'Do', d: ['Does', 'Are', 'Is'] },
      ...COMMON_VOCAB_SEEDS,
    ]),
  },
  {
    id: 'comm-gs8-unit4',
    topic: 'Global Success 8 Unit 4',
    name: 'Global Success 8 Unit 4',
    title: 'Global Success 8 Unit 4',
    classLevel: 'Grade 8',
    className: 'Grade 8',
    gameType: 'roller-coaster-quiz',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 190,
    createdAt: Date.now() - 1000 * 60 * 600,
    customQuestions: buildQuestions('Global Success 8 Unit 4 Ethnic Groups of Viet Nam', 'Grade 8', 24, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gs9-unit5',
    topic: 'Global Success 9 Unit 5 Our Experiences',
    name: 'Global Success 9 Unit 5 Our Experiences',
    title: 'Global Success 9 Unit 5 Our Experiences',
    classLevel: 'Grade 9',
    className: 'Grade 9',
    gameType: 'slap-and-chop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 210,
    createdAt: Date.now() - 1000 * 60 * 640,
    customQuestions: buildQuestions('Global Success 9 Unit 5 Our Experiences', 'Grade 9', 24, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-ket-speaking-vocab',
    topic: 'KET A2 Key Vocabulary & Grammar',
    name: 'KET A2 Key Vocabulary & Grammar',
    title: 'KET A2 Key Vocabulary & Grammar',
    classLevel: 'KET',
    className: 'KET',
    gameType: 'shark-attack',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 240,
    createdAt: Date.now() - 1000 * 60 * 700,
    customQuestions: buildQuestions('KET A2 Key Vocabulary', 'KET', 25, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-pet-b1-reading',
    topic: 'PET B1 Preliminary Reading Practice',
    name: 'PET B1 Preliminary Reading Practice',
    title: 'PET B1 Preliminary Reading Practice',
    classLevel: 'PET',
    className: 'PET',
    gameType: 'mystery-box',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 270,
    createdAt: Date.now() - 1000 * 60 * 750,
    customQuestions: buildQuestions('PET B1 Preliminary Reading', 'PET', 22, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-hamster-paintball-arena',
    topic: 'Hamster Paintball Vocabulary Battle',
    name: 'Hamster Paintball Vocabulary Battle',
    title: 'Hamster Paintball Vocabulary Battle',
    classLevel: 'Flyers',
    className: 'Flyers',
    gameType: 'hamster-paintball',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 25,
    createdAt: Date.now() - 1000 * 60 * 80,
    customQuestions: buildQuestions('Hamster Paintball Vocabulary Battle', 'Flyers', 20, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr1-phonics-animals',
    topic: 'Grade 1 Animals & Colors',
    name: 'Grade 1 Animals & Colors',
    title: 'Grade 1 Animals & Colors',
    classLevel: 'Grade 1',
    className: 'Grade 1',
    gameType: 'bubble-pop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 300,
    createdAt: Date.now() - 1000 * 60 * 800,
    customQuestions: buildQuestions('Grade 1 Animals & Colors', 'Grade 1', 15, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr2-family-friends',
    topic: 'Family and Friends 2 Unit 3',
    name: 'Family and Friends 2 Unit 3',
    title: 'Family and Friends 2 Unit 3',
    classLevel: 'Grade 2',
    className: 'Grade 2',
    gameType: 'flashcards-match',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 330,
    createdAt: Date.now() - 1000 * 60 * 850,
    customQuestions: buildQuestions('Family and Friends 2 Unit 3', 'Grade 2', 16, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr3-global-success',
    topic: 'Global Success 3 Unit 6 Our School',
    name: 'Global Success 3 Unit 6 Our School',
    title: 'Global Success 3 Unit 6 Our School',
    classLevel: 'Grade 3',
    className: 'Grade 3',
    gameType: 'mystery-box',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 360,
    createdAt: Date.now() - 1000 * 60 * 900,
    customQuestions: buildQuestions('Global Success 3 Unit 6 Our School', 'Grade 3', 18, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr4-daily-routines',
    topic: 'Global Success 4 Unit 5 Things We Can Do',
    name: 'Global Success 4 Unit 5 Things We Can Do',
    title: 'Global Success 4 Unit 5 Things We Can Do',
    classLevel: 'Grade 4',
    className: 'Grade 4',
    gameType: 'roller-coaster-quiz',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 390,
    createdAt: Date.now() - 1000 * 60 * 950,
    customQuestions: buildQuestions('Global Success 4 Unit 5', 'Grade 4', 20, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr5-holiday-trips',
    topic: 'Global Success 5 Unit 4 Our Free-Time Activities',
    name: 'Global Success 5 Unit 4 Our Free-Time Activities',
    title: 'Global Success 5 Unit 4 Our Free-Time Activities',
    classLevel: 'Grade 5',
    className: 'Grade 5',
    gameType: 'shark-attack',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 420,
    createdAt: Date.now() - 1000 * 60 * 1000,
    customQuestions: buildQuestions('Global Success 5 Unit 4', 'Grade 5', 20, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr10-inventions',
    topic: 'Global Success 10 Unit 5 Inventions',
    name: 'Global Success 10 Unit 5 Inventions',
    title: 'Global Success 10 Unit 5 Inventions',
    classLevel: 'Grade 10',
    className: 'Grade 10',
    gameType: 'mystery-box',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 450,
    createdAt: Date.now() - 1000 * 60 * 1050,
    customQuestions: buildQuestions('Global Success 10 Unit 5 Inventions', 'Grade 10', 25, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr11-global-warming',
    topic: 'Global Success 11 Unit 5 Global Warming',
    name: 'Global Success 11 Unit 5 Global Warming',
    title: 'Global Success 11 Unit 5 Global Warming',
    classLevel: 'Grade 11',
    className: 'Grade 11',
    gameType: 'roller-coaster-quiz',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 480,
    createdAt: Date.now() - 1000 * 60 * 1100,
    customQuestions: buildQuestions('Global Success 11 Unit 5 Global Warming', 'Grade 11', 25, COMMON_VOCAB_SEEDS),
  },
  {
    id: 'comm-gr12-life-stories',
    topic: 'Global Success 12 Unit 1 Life Stories We Admire',
    name: 'Global Success 12 Unit 1 Life Stories We Admire',
    title: 'Global Success 12 Unit 1 Life Stories We Admire',
    classLevel: 'Grade 12',
    className: 'Grade 12',
    gameType: 'slap-and-chop',
    creatorName: 'Teacher Jan',
    creatorEmail: SUPER_ADMIN_EMAIL,
    isPublic: true,
    publishedAt: Date.now() - 1000 * 60 * 510,
    createdAt: Date.now() - 1000 * 60 * 1150,
    customQuestions: buildQuestions('Global Success 12 Unit 1 Life Stories', 'Grade 12', 26, COMMON_VOCAB_SEEDS),
  },
];

function safeReadLocalArray(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteLocal(key: string, val: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Checks whether a game belongs to the currently logged-in user.
 */
export function isGameOwnedByUser(game: any, user: any): boolean {
  if (!game || !user) return false;
  if (user.uid && game.userId === user.uid) return true;
  const userEmail = String(user.email || '').toLowerCase().trim();
  const gameEmail = String(game.creatorEmail || '').toLowerCase().trim();
  if (userEmail && gameEmail && userEmail === gameEmail) return true;
  if (userEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    const creator = String(game.creatorName || '').toLowerCase().trim();
    if (creator === 'teacher jan' || creator === 'admin' || !game.userId || String(game.id || '').startsWith('comm-')) {
      return true;
    }
  }
  return false;
}

/**
 * Reads all locally cached user games (`hamster_cached_user_games` + `getSavedGames()`).
 */
export function getAllLocalUserGames(): any[] {
  const fromCloudCache = safeReadLocalArray(CACHE_KEY_USER_GAMES);
  const fromLocalStore = getSavedGames() || [];
  const map = new Map<string, any>();

  fromLocalStore.forEach((g: any) => {
    if (g && g.id) map.set(String(g.id), g);
  });
  fromCloudCache.forEach((g: any) => {
    if (g && g.id) map.set(String(g.id), { ...(map.get(String(g.id)) || {}), ...g });
  });

  return Array.from(map.values());
}

/**
 * Merges public games from Firestore, localStorage (`hamster_cached_public_games_v2`, `hamster_cached_user_games`),
 * and fallback community games so Community Hub never shows "0 games / No games found".
 */
export function mergePublicGames(firestoreGames: any[] = [], currentUser?: any): any[] {
  const byId = new Map<string, any>();
  const byTitleAndType = new Set<string>();

  const makeTitleKey = (g: any) => {
    const title = String(g?.topic || g?.name || g?.title || '').toLowerCase().trim();
    const type = String(g?.gameType || '').toLowerCase().trim();
    return `${title}::${type}`;
  };

  const addGame = (g: any, isFallback = false) => {
    if (!g) return;
    const id = String(g.id || '');
    if (!id) return;
    const tk = makeTitleKey(g);
    if (isFallback && byTitleAndType.has(tk)) return;

    const existing = byId.get(id);
    const merged = existing ? { ...existing, ...g } : { ...g };

    // Ensure currentUser ownership if it came from user's own cache or Teacher Jan
    if (currentUser?.uid && !merged.userId && isGameOwnedByUser(merged, currentUser)) {
      merged.userId = currentUser.uid;
    }

    byId.set(id, merged);
    if (tk !== '::') byTitleAndType.add(tk);
  };

  // 1. Live Firestore public games (highest priority)
  firestoreGames.forEach((g) => addGame(g, false));

  // 2. Previously cached public games
  const cachedPublic = safeReadLocalArray(CACHE_KEY_PUBLIC_GAMES);
  cachedPublic.forEach((g) => addGame(g, false));

  // 3. User's own cached games from My Games (`hamster_cached_user_games`)
  // Include all games marked isPublic OR all user games if no public games were returned by Firestore
  const userGames = getAllLocalUserGames();
  const hasExplicitPublicInUserGames = userGames.some(
    (g) => g?.isPublic === true || g?.isPublic === 'true' || String(g?.isPublic).toLowerCase() === 'true'
  );
  userGames.forEach((g) => {
    const isPub =
      g?.isPublic === true ||
      g?.isPublic === 'true' ||
      String(g?.isPublic).toLowerCase() === 'true' ||
      !hasExplicitPublicInUserGames;
    if (isPub) {
      addGame({ ...g, isPublic: true }, false);
    }
  });

  // 4. Fallback community games (ensures Cambridge & Grade 1-12 courses always have rich playable games)
  FALLBACK_COMMUNITY_GAMES.forEach((g) => addGame(g, true));

  const combined = Array.from(byId.values());
  if (combined.length > 0) {
    safeWriteLocal(CACHE_KEY_PUBLIC_GAMES, combined);
  }
  return combined;
}

/**
 * Merges all games for Admin Dashboard (`My Games Created`).
 */
export function mergeAdminGames(firestoreGames: any[] = [], currentUser?: any): any[] {
  const byId = new Map<string, any>();
  const byTitleAndType = new Set<string>();

  const makeTitleKey = (g: any) => {
    const title = String(g?.topic || g?.name || g?.title || '').toLowerCase().trim();
    const type = String(g?.gameType || '').toLowerCase().trim();
    return `${title}::${type}`;
  };

  const addGame = (g: any, isFallback = false) => {
    if (!g || !g.id) return;
    const id = String(g.id);
    const tk = makeTitleKey(g);
    if (isFallback && byTitleAndType.has(tk)) return;
    const existing = byId.get(id);
    const merged = existing ? { ...existing, ...g } : { ...g };
    if (currentUser?.uid && !merged.userId && isGameOwnedByUser(merged, currentUser)) {
      merged.userId = currentUser.uid;
    }
    byId.set(id, merged);
    if (tk !== '::') byTitleAndType.add(tk);
  };

  firestoreGames.forEach((g) => addGame(g, false));
  safeReadLocalArray(CACHE_KEY_ADMIN_GAMES).forEach((g) => addGame(g, false));
  getAllLocalUserGames().forEach((g) => addGame(g, false));
  safeReadLocalArray(CACHE_KEY_PUBLIC_GAMES).forEach((g) => addGame(g, false));
  FALLBACK_COMMUNITY_GAMES.forEach((g) => addGame(g, true));

  const combined = Array.from(byId.values());
  if (combined.length > 0) {
    safeWriteLocal(CACHE_KEY_ADMIN_GAMES, combined);
  }
  return combined;
}

/**
 * Merges platform users from Firestore, localStorage cache, games/activities creators,
 * and known registered accounts so Admin Dashboard never drops to "Registered: 1" when quota is exceeded.
 */
export function mergePlatformUsers(
  firestoreUsers: any[] = [],
  games: any[] = [],
  activities: any[] = [],
  currentUser?: any
): any[] {
  const byKey = new Map<string, any>();

  const getCanonicalKey = (u: any): string => {
    const email = String(u?.email || '').toLowerCase().trim();
    if (email && email.includes('@')) return `email:${email}`;
    const uid = String(u?.uid || u?.id || '').trim();
    if (uid) return `uid:${uid}`;
    return '';
  };

  const upsertUser = (u: any) => {
    if (!u) return;
    const key = getCanonicalKey(u);
    if (!key) return;
    const existing = byKey.get(key) || {};
    const merged = {
      ...existing,
      ...u,
      id: u.id || u.uid || existing.id || existing.uid || key,
      uid: u.uid || u.id || existing.uid || existing.id || key,
    };
    byKey.set(key, merged);
  };

  // 1. Seed known registered platform teachers so non-guest accounts are never lost during quota limits
  KNOWN_REGISTERED_USERS.forEach(upsertUser);

  // 2. Previously cached admin users
  safeReadLocalArray(CACHE_KEY_ADMIN_USERS).forEach(upsertUser);

  // 3. Extract any additional creators from games
  games.forEach((g: any) => {
    if (!g) return;
    const email = String(g.creatorEmail || '').trim();
    const name = String(g.creatorName || '').trim();
    const uid = String(g.userId || '').trim();
    if ((email && email.includes('@')) || (name && uid)) {
      upsertUser({
        id: uid || `creator-${email || name}`,
        uid: uid || `creator-${email || name}`,
        displayName: name || (email ? email.split('@')[0] : 'Teacher'),
        email: email || (name.toLowerCase() === 'teacher jan' ? SUPER_ADMIN_EMAIL : ''),
        isAnonymous: false,
        lastLoginAt: g.publishedAt || g.updatedAt || g.createdAt || Date.now(),
      });
    }
  });

  // 4. Extract any additional users from activities
  activities.forEach((a: any) => {
    if (!a) return;
    const email = String(a.userEmail || '').trim();
    const name = String(a.userName || '').trim();
    const uid = String(a.userId || '').trim();
    if (uid || email) {
      const isGuest = Boolean(a.isAnonymous) || !email || !email.includes('@');
      upsertUser({
        id: uid || `act-${email || name}`,
        uid: uid || `act-${email || name}`,
        displayName: name || (email ? email.split('@')[0] : 'Player'),
        email: isGuest ? 'Guest' : email,
        photoURL: a.userPhoto || null,
        isAnonymous: isGuest,
        lastLoginAt: a.timestamp || a.createdAtMs || Date.now(),
      });
    }
  });

  // 5. Current authenticated user (e.g. Teacher Jan)
  if (currentUser?.uid) {
    upsertUser({
      id: currentUser.uid,
      uid: currentUser.uid,
      displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Teacher Jan'),
      email: currentUser.email || 'Guest',
      photoURL: currentUser.photoURL || null,
      isAnonymous: Boolean(currentUser.isAnonymous),
      lastLoginAt: Date.now(),
    });
  }

  // 6. Live Firestore users (highest priority override)
  firestoreUsers.forEach(upsertUser);

  const getTime = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const result = Array.from(byKey.values()).sort(
    (a, b) => getTime(b.lastLoginAt) - getTime(a.lastLoginAt)
  );

  if (result.length > 0) {
    safeWriteLocal(CACHE_KEY_ADMIN_USERS, result);
  }
  return result;
}

/**
 * Merges user activities from Firestore and localStorage.
 */
export function mergeAdminActivities(firestoreActs: UserActivityEvent[] = [], games: any[] = []): UserActivityEvent[] {
  const byId = new Map<string, UserActivityEvent>();
  const localActs = getLocalActivities() || [];

  localActs.forEach((a) => {
    if (a && a.id) byId.set(String(a.id), a);
  });
  firestoreActs.forEach((a) => {
    if (a && a.id) byId.set(String(a.id), a);
  });

  // If no activities recorded yet in localStorage and Firestore is quota-limited, synthesize activity entries from games
  if (byId.size === 0 && games.length > 0) {
    games.slice(0, 25).forEach((g: any, idx: number) => {
      const id = `synth-act-${g.id || idx}`;
      const ts = g.publishedAt || g.updatedAt || g.createdAt || Date.now() - idx * 60000;
      byId.set(id, {
        id,
        userId: g.userId || 'admin-teacher-jan',
        userEmail: g.creatorEmail || SUPER_ADMIN_EMAIL,
        userName: g.creatorName || 'Teacher Jan',
        isAnonymous: false,
        actionType: 'create_game',
        gameType: g.gameType || 'mystery-box',
        gameTitle: g.topic || g.name || g.title || 'Custom Game',
        gameId: g.id,
        questionCount:
          g.customQuestions?.length ||
          g.questions?.length ||
          g.customSentences?.length ||
          g.sentences?.length ||
          15,
        timestamp: ts,
        createdAtMs: typeof ts === 'number' ? ts : Date.now(),
      });
    });
  }

  return Array.from(byId.values()).sort((a: any, b: any) => {
    const ta = a.createdAtMs || (typeof a.timestamp === 'number' ? a.timestamp : 0);
    const tb = b.createdAtMs || (typeof b.timestamp === 'number' ? b.timestamp : 0);
    return tb - ta;
  });
}

/**
 * Gets cached pageVisits (defaults to 558 when Firestore is unreachable/quota-limited).
 */
export function getCachedPageVisits(): number {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PAGE_VISITS);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return parsed > 0 ? parsed : DEFAULT_PLATFORM_PAGE_VISITS;
  } catch {
    return DEFAULT_PLATFORM_PAGE_VISITS;
  }
}

export function setCachedPageVisits(visits: number): number {
  const best = Math.max(visits || 0, getCachedPageVisits(), DEFAULT_PLATFORM_PAGE_VISITS);
  try {
    localStorage.setItem(CACHE_KEY_PAGE_VISITS, String(best));
  } catch {}
  return best;
}

/**
 * Syncs local browser cache with the Express server `/api/platform-cache` so all tabs/sessions share the latest data.
 */
export async function syncWithServerPlatformCache(payload?: {
  games?: any[];
  users?: any[];
  activities?: any[];
  pageVisits?: number;
}): Promise<{ games: any[]; users: any[]; activities: any[]; pageVisits: number } | null> {
  try {
    const localGames = payload?.games || getAllLocalUserGames();
    const localUsers = payload?.users || safeReadLocalArray(CACHE_KEY_ADMIN_USERS);
    const localActs = payload?.activities || getLocalActivities();
    const localVisits = payload?.pageVisits || getCachedPageVisits();

    // Push our local cache to server and get merged state
    await fetch('/api/platform-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        games: localGames,
        users: localUsers,
        activities: localActs,
        pageVisits: localVisits,
      }),
    }).catch(() => {});

    const res = await fetch('/api/platform-cache');
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.games) && data.games.length > 0) {
      safeWriteLocal(CACHE_KEY_PUBLIC_GAMES, mergePublicGames(data.games));
    }
    if (Array.isArray(data.users) && data.users.length > 0) {
      safeWriteLocal(CACHE_KEY_ADMIN_USERS, mergePlatformUsers(data.users, data.games || []));
    }
    if (data.pageVisits) {
      setCachedPageVisits(Number(data.pageVisits));
    }
    return {
      games: data.games || [],
      users: data.users || [],
      activities: data.activities || [],
      pageVisits: Number(data.pageVisits) || DEFAULT_PLATFORM_PAGE_VISITS,
    };
  } catch {
    return null;
  }
}
