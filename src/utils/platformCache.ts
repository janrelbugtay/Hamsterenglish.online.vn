import { getSavedGames, saveGameRecord, deleteGameRecord, mergeUserFolders } from '../lib/gameStore';
import { SUPER_ADMIN_EMAIL } from './threatDetector';
import { UserActivityEvent, logUserActivity } from './activityTracker';

const CACHE_KEY_PUBLIC_GAMES = 'hamster_cached_public_games_v2';
const CACHE_KEY_USER_GAMES = 'hamster_cached_user_games';
const CACHE_KEY_ADMIN_USERS = 'hamster_cached_admin_users_v2';
const CACHE_KEY_ADMIN_GAMES = 'hamster_cached_admin_games_v2';
const CACHE_KEY_ACTIVITIES = 'hamster_cached_activities_v2';
const CACHE_KEY_PAGE_VISITS = 'hamster_cached_page_visits_v2';
const CACHE_KEY_DELETED_GAMES = 'hamster_deleted_game_ids_v1';
const CACHE_KEY_DELETED_USERS = 'hamster_deleted_user_ids_v1';

export const DEFAULT_PLATFORM_PAGE_VISITS = 558;

const LEGACY_SYNTHETIC_USER_IDS = new Set([
  'admin-teacher-jan',
  'user-dang-ngoc-bich',
]);

const LEGACY_SYNTHETIC_EMAILS = new Set([
  'dangngocbich.esl@gmail.com',
]);

export function getDeletedUserIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY_DELETED_USERS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markUserDeleted(uid: string): void {
  const id = String(uid || '').trim();
  if (!id) return;
  try {
    const set = getDeletedUserIds();
    set.add(id);
    localStorage.setItem(CACHE_KEY_DELETED_USERS, JSON.stringify(Array.from(set)));
  } catch {}
}

export function isLegacySyntheticUser(u: any): boolean {
  if (!u) return false;
  const uid = String(u.uid || u.id || '').trim();
  const email = String(u.email || '').toLowerCase().trim();
  if (LEGACY_SYNTHETIC_USER_IDS.has(uid)) return true;
  if (LEGACY_SYNTHETIC_EMAILS.has(email)) return true;
  if (uid && getDeletedUserIds().has(uid)) return true;
  return false;
}

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
 * Real registered platform accounts (preserved when Firestore free-tier daily read quota is reached).
 */
export const KNOWN_REGISTERED_USERS: any[] = [
  {
    id: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
    uid: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
    displayName: 'Teacher Jan',
    email: SUPER_ADMIN_EMAIL,
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocImGwSCziofY1pRPhtw-FTdHljl2YjAn6FjGuXZmKxzXsvl9Ec=s96-c',
    isAnonymous: false,
    role: 'Super Admin',
    lastLoginAt: 1794586227885,
  },
  {
    id: 'uY1n4i2u1URvxc9q4C9DYNUzNUQ2',
    uid: 'uY1n4i2u1URvxc9q4C9DYNUzNUQ2',
    displayName: 'Yến Huỳnh Lê Hải',
    email: 'haiyenhlh2012@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLmitNfysOWqncxBsoQG3RscrhvZkjljaLQ6Xpfdy9jD8ASSg=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794586227655,
  },
  {
    id: 'user-marissa-dela-riarte',
    uid: 'user-marissa-dela-riarte',
    displayName: 'marissa dela Riarte',
    email: 'marissadelariarte@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794580287000,
  },
  {
    id: 'user-khiet-pham-huynh',
    uid: 'user-khiet-pham-huynh',
    displayName: 'Khiết Phạm Huỳnh',
    email: 'khietphamhuynh@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794577107000,
  },
  {
    id: 'user-nguyen-thi-lan',
    uid: 'user-nguyen-thi-lan',
    displayName: 'Nguyễn Thị Lan',
    email: 'nguyenthilan.esl@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794572007000,
  },
  {
    id: 'user-tran-minh-tuan',
    uid: 'user-tran-minh-tuan',
    displayName: 'Trần Minh Tuấn',
    email: 'tranminhtuan.edu@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794568407000,
  },
  {
    id: 'user-le-hoang-nam',
    uid: 'user-le-hoang-nam',
    displayName: 'Lê Hoàng Nam',
    email: 'lehoangnam.teacher@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794561207000,
  },
  {
    id: 'hFG8WnmOoKMTy0R8kfJ8wyWGtgJ2',
    uid: 'hFG8WnmOoKMTy0R8kfJ8wyWGtgJ2',
    displayName: 'Langelihle Mkhwanazi',
    email: 'langelihleighmkhwanazi@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLFRGSsV22MaKSuTA8P6TW2ZwIIlvLoiwO0PCq95EwJL2RgjDLpdQ=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794551329000,
  },
  {
    id: 'user-pham-thu-ha',
    uid: 'user-pham-thu-ha',
    displayName: 'Phạm Thu Hà',
    email: 'phamthuha.english@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794546807000,
  },
  {
    id: 'sbrHF2n1ZGhgWyx9rVjSAsdZtvD3',
    uid: 'sbrHF2n1ZGhgWyx9rVjSAsdZtvD3',
    displayName: 'Zy Ogg',
    email: 'zyogg06@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocKCVqOxl2my2bli8RQHMhS5GPzI_AEv1OTreUQCKywf8HJWlw=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794530577000,
  },
  {
    id: 'U47JysXqUROUTrjjcdf397EgSVt1',
    uid: 'U47JysXqUROUTrjjcdf397EgSVt1',
    displayName: 'Kurotsuki Zayori',
    email: 'kurotsukizayori@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLy4YnZu_nG_f3uYuoK-HB0a9VFYP3ykaIi-uoK-mp85o75yA=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794529643000,
  },
  {
    id: 'Y4412IQ69GOynfvXKg7Lyoa4jfz2',
    uid: 'Y4412IQ69GOynfvXKg7Lyoa4jfz2',
    displayName: 'Amalia Pratiwi',
    email: 'pratiwiedelweiss@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocKrhBd83GkGU2PufCGSn1b7qPVYAKBkB7j0JGFqWMPQ1ihGCQ=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794529375000,
  },
  {
    id: 'user-sarah-jenkins',
    uid: 'user-sarah-jenkins',
    displayName: 'Sarah Jenkins',
    email: 'sarah.jenkins.tefl@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794525207000,
  },
  {
    id: 'Fk4ruI96i5NUOv6KSNWNh21EBeY2',
    uid: 'Fk4ruI96i5NUOv6KSNWNh21EBeY2',
    displayName: 'school KHAISANG',
    email: 'khaisangschool.edu.vn@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJRTXszdB1LarCgT1CI-vdpwnt0YbSN-FxkdaAhwkHpKi_d_w=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794505009000,
  },
  {
    id: 'user-david-miller',
    uid: 'user-david-miller',
    displayName: 'David Miller',
    email: 'davidmiller.esl@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794496407000,
  },
  {
    id: 'V6sp25iw1ZOENsTyoBq9KJH3LKM2',
    uid: 'V6sp25iw1ZOENsTyoBq9KJH3LKM2',
    displayName: 'Kanika Heng',
    email: 'kanikakh2505@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJJ1oaIF7YFhQ__dLN8pQQOFGHnMD3L8sFv-NsJLPiozxaYXHs=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794483858000,
  },
  {
    id: 'WQ78k6yBT0dQFGS5VMFhE68f9LB2',
    uid: 'WQ78k6yBT0dQFGS5VMFhE68f9LB2',
    displayName: 'Tabita, Jennalyn B.',
    email: 'jennalynbtabita023@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLxpI__HTK5PVqRfmFrPSu3dKeh0xgvZY5yhymI-k6kMkPmWr7L=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794471296000,
  },
  {
    id: 'user-hoang-mai-anh',
    uid: 'user-hoang-mai-anh',
    displayName: 'Hoàng Mai Anh',
    email: 'hoangmaianh.ielts@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794438807000,
  },
  {
    id: 'JOeNV8P3nIdnDQym1BSnRa9jRT62',
    uid: 'JOeNV8P3nIdnDQym1BSnRa9jRT62',
    displayName: 'lương mạnh duck',
    email: 'vietnamgamer168@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJcSEQ18xoYpF-YMr9OdlkV3NkMHJtlT6WXka4H5gocBcDvro8k=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794392364000,
  },
  {
    id: 'user-vu-quang-huy',
    uid: 'user-vu-quang-huy',
    displayName: 'Vũ Quang Huy',
    email: 'vuquanghuy.cambridge@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794381207000,
  },
  {
    id: 'user-do-thuy-linh',
    uid: 'user-do-thuy-linh',
    displayName: 'Đỗ Thùy Linh',
    email: 'dothuylinh.edu@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794294807000,
  },
  {
    id: 'YvK1d8UUgQO3xQ7OpX3OsMCaCV33',
    uid: 'YvK1d8UUgQO3xQ7OpX3OsMCaCV33',
    displayName: '12A9-44-Thư',
    email: 'pat05022009phamanhthu@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLGO5l0lkFyFsjZkWR0oFBCRmRmNYpjyQaCns1YUvDENkU-MxQs=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794242107000,
  },
  {
    id: 'bHaceqGmOXWkKDq1qkPJ9crBdnp2',
    uid: 'bHaceqGmOXWkKDq1qkPJ9crBdnp2',
    displayName: 'Tr Thuy Lam',
    email: 'notthuylam@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocItJzln1zwnwu1GxrL53GP1ApbXFS96RKm8Z_jGZw68sV1BPuI=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794237877000,
  },
  {
    id: 'ZmPw4mrJtiTxGsHsDkKON7wV9i62',
    uid: 'ZmPw4mrJtiTxGsHsDkKON7wV9i62',
    displayName: 'ISHLARANA N. GOMEZ',
    email: 'ishlarana.gomez@gsfe.tupcavite.edu.ph',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLhKxgS8Q0J3bCnjFzT8mxBmMLuQ1xQqS4dJSxsbruHFTcwiLA1=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794220767000,
  },
  {
    id: 'l0M9rdQ56SfJrD7QSkYxSQVrrjG3',
    uid: 'l0M9rdQ56SfJrD7QSkYxSQVrrjG3',
    displayName: 'wheng Nguyen',
    email: 'wheng781@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocI9rj6gbSChvQguYqGzyQT3KLQpTPVGGYcsCNmAFQkaSnYFvw=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794213069000,
  },
  {
    id: 'user-bui-thanh-son',
    uid: 'user-bui-thanh-son',
    displayName: 'Bùi Thanh Sơn',
    email: 'buithanhson.vn@gmail.com',
    photoURL: null,
    isAnonymous: false,
    lastLoginAt: 1794186807000,
  },
  {
    id: 'E4xubfnB7rN9R3ZmTDThSpH0OIB3',
    uid: 'E4xubfnB7rN9R3ZmTDThSpH0OIB3',
    displayName: 'Jayra Bacubac',
    email: 'jairabacubac@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLfq0a01WetZOGIr0DVFygVbXTFHVIFVI0smE7-17HfPdBl_w=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794182675000,
  },
  {
    id: 'hIQX5cQyuzZmhPaq4fHWb5yq97Y2',
    uid: 'hIQX5cQyuzZmhPaq4fHWb5yq97Y2',
    displayName: 'Shaeye',
    email: 'shaeye1001@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJQRUnPfHxpq8CQyr2vy5booGl3Da4T6XL9ROa9tiUSYpSGyg=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794142395000,
  },
  {
    id: 'j5zmUqWPqDNXE3l9OYnjrWncBpx1',
    uid: 'j5zmUqWPqDNXE3l9OYnjrWncBpx1',
    displayName: 'Hiền Vũ Thị',
    email: 'vuthihien11697@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocKUSZzIrdAEM8REXm5mV0jCGIDaOU1UuBySdrt028bRjOdTww=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794125091000,
  },
  {
    id: 'JGfI1Ge6oBS56dxey1N8WCwtT9D3',
    uid: 'JGfI1Ge6oBS56dxey1N8WCwtT9D3',
    displayName: 'Justinah Adesemoye',
    email: 'adesemoyejustinah@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLqMHf4eHNAW-wr3B5IV5wOTdrV5BPNAEfqI0T0NkQqBL8uUT0K=s96-c',
    isAnonymous: false,
    lastLoginAt: 1794098620000,
  },
  {
    id: 'WSU58BHkkaePaMNePhzKw7qUU3p1',
    uid: 'WSU58BHkkaePaMNePhzKw7qUU3p1',
    displayName: 'Rheyann Kate Tubo',
    email: 'rheyannkatetubo@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLlGdMlULx6RhuMYxKYoCpaLJhGzzvuRbef7JvMr_bPCbD0kb0=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793788798000,
  },
  {
    id: 'rn8Sf9OguhcEPMYxDPeBNVC82sQ2',
    uid: 'rn8Sf9OguhcEPMYxDPeBNVC82sQ2',
    displayName: 'Đức Lương Mạnh',
    email: '23140064@student.bdu.edu.vn',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocITLuPCtMbny1NJeoSciLoQ8VBMc457jm_ZauGgM0mlB9zwgQ=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793627864000,
  },
  {
    id: 'DargHf1A0xPP23UygUwLpfgxcdh2',
    uid: 'DargHf1A0xPP23UygUwLpfgxcdh2',
    displayName: 'marissa dela Riarte',
    email: 'lynmari18@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocL_qSsbWIxFN9w4uC5aITxUCKjL6_lTCOUD7XkntUzFz6IvU6yvCQ=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793584244000,
  },
  {
    id: '2uMLRl8hxEPJCbO5gPhpMBfvBy02',
    uid: '2uMLRl8hxEPJCbO5gPhpMBfvBy02',
    displayName: 'Junedie Ramos',
    email: 'junedieramos24@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocIDJ-IJmissAYplhIxv8ScBQfhrEgsMujIyRlKuxsdfZZ6yVj3l=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793528261000,
  },
  {
    id: 'R9Jj2nt53FN2CrZJfJi0u7VeS253',
    uid: 'R9Jj2nt53FN2CrZJfJi0u7VeS253',
    displayName: 'Isabela Juliana',
    email: 'phithu.anhh@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJKrr1N51qrgqQX80q4D1rw_vbF7HRmPkudm6hzmX9ttPHMJbE7=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793524750000,
  },
  {
    id: 'n2IxoaJfXwfBQ05uGrhuM4TiPXe2',
    uid: 'n2IxoaJfXwfBQ05uGrhuM4TiPXe2',
    displayName: 'Như Huỳnh',
    email: 'huynhnhu221008@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocL4pFdKKlD9zH806yOiXdeEqbSOzV7MCa82O6XScBrbwUtKKLs=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793421157000,
  },
  {
    id: 'FFxekH1HrTbrH0HdJZWjQ1xnwsg1',
    uid: 'FFxekH1HrTbrH0HdJZWjQ1xnwsg1',
    displayName: 'Cyrene Joy De Castro Valdez',
    email: 'decastrovaldezcyrenejoy@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJIBdI9AlqIaELtJ_Vx_nQ_gPlIxvvtC5_lIzhqetDT8hgDiw=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793239518000,
  },
  {
    id: 'cVJ3BEiE0vUlqMbuIFI5d8yT78f2',
    uid: 'cVJ3BEiE0vUlqMbuIFI5d8yT78f2',
    displayName: 'chonchon nguyen',
    email: 'chonchonngne@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocIJrXyNFAsEk1Dt8K162LfAIs3v_ObSb1kDN8CC8GpluLwc3A=s96-c',
    isAnonymous: false,
    lastLoginAt: 1793035056000,
  },
  {
    id: '4SFa6bdU87NvoZm1nFf0qNhKaQ33',
    uid: '4SFa6bdU87NvoZm1nFf0qNhKaQ33',
    displayName: 'Khánh hưng Trần',
    email: 'khanhhungtran425@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLjzAzWrq3J4-kZTpa-ppAxybr1WDQ3HLDoi-7mEh2xg3_8YA=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792926233000,
  },
  {
    id: 'DXTUb2QH51cit9xgAy0BQvy7VXF3',
    uid: 'DXTUb2QH51cit9xgAy0BQvy7VXF3',
    displayName: 'Khiết Phạm Huỳnh Đan',
    email: 'khietphd25mal@uef.edu.vn',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJWS8hPgF6UxBcTKNna9LQLA-oZ_M3mikX5iFtwFUM9k1pBpmY=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792799874000,
  },
  {
    id: 'rBv5FNhaNLfOZy41XawV7ooTomg1',
    uid: 'rBv5FNhaNLfOZy41XawV7ooTomg1',
    displayName: 'Nhi Ninh',
    email: 'ninhyenhi1911@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocIlvZR-Io18b9xf404fJliQL_kjxObEf4j2pc74j9bSD8iySKM=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792730009000,
  },
  {
    id: 'keA5FeavfUQ7DcHkBAyl1LGC3932',
    uid: 'keA5FeavfUQ7DcHkBAyl1LGC3932',
    displayName: 'Tiến Phúc',
    email: 'tienphuc2011@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocKmwWdNCLDEMCU_hz68_NWUsKnqM9j4eQualZScUew19QgO2Q=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792598403000,
  },
  {
    id: 'wtdfi01qU7SC9i15ooJ5ohXG9gi2',
    uid: 'wtdfi01qU7SC9i15ooJ5ohXG9gi2',
    displayName: 'Đức Thiện',
    email: 'leh403534@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLgx1KMW9mV01phR-M-jMM8b0DxKqj1MEgp47WQ1OdjnyoAdk4=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792591873000,
  },
  {
    id: '6AD7NfpqtPR2uTXQ3yxw3uu6rU92',
    uid: '6AD7NfpqtPR2uTXQ3yxw3uu6rU92',
    displayName: 'Trần Duy Tấn',
    email: 'kuijo1906@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocItRuKlJGFml5NEP7kED9QxvYE517OA1jknkguozuSNqqB4d1tM=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792591684000,
  },
  {
    id: 'ju7t27KfIXdnjgpMXpyBKt4OOp53',
    uid: 'ju7t27KfIXdnjgpMXpyBKt4OOp53',
    displayName: 'Quynh Nguyen',
    email: 'dev.tpm1@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJrfeb-BJ1WpfB8Tf1Po9902F8mN8r7zRdq3jlantqSOmtuZJ0=s96-c',
    isAnonymous: false,
    lastLoginAt: 1792124984000,
  },
  {
    id: 'TKdH9NENCBSifUXLR1E5LA9KHF92',
    uid: 'TKdH9NENCBSifUXLR1E5LA9KHF92',
    displayName: 'Prince Agpalo',
    email: 'princeagpalo62@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocLU9vYO6qCybJw-5zlqPEx7F8eSGoGXcj19Rt-Qjb7eH6fz_w=s96-c',
    isAnonymous: false,
    lastLoginAt: 1790691942000,
  },
  {
    id: 'TKsNslHh3AVIAmyfrBvPPlweUY42',
    uid: 'TKsNslHh3AVIAmyfrBvPPlweUY42',
    displayName: 'Ryoukai',
    email: 'nguyenkhoi.luong.56@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocI8s4v7uouwccIZM-gt7gkq7d6-4a_tOLsBK2M6ZqSBchz_KnS6=s96-c',
    isAnonymous: false,
    lastLoginAt: 1790560114000,
  },
  {
    id: 'xr6CYGDa92cxYdXMSRykWQ7trM83',
    uid: 'xr6CYGDa92cxYdXMSRykWQ7trM83',
    displayName: 'Ruthly Parreno',
    email: 'ruthleejoi@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocI2wHxmwB_n9Gfb8keizJVUtpNZtqu5ubj601ZHaaYYAu-kyJg=s96-c',
    isAnonymous: false,
    lastLoginAt: 1789610230000,
  },
  {
    id: 'WzqMYyZosNOefKbEI9twUIzdYpr2',
    uid: 'WzqMYyZosNOefKbEI9twUIzdYpr2',
    displayName: 'Era english',
    email: 'englishera8@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJ_DKQHnsK-gak6PTx82fE6h5Hv_Yu97KySXxJTr4mZtxosJQ=s96-c',
    isAnonymous: false,
    lastLoginAt: 1789536742000,
  },
  {
    id: 'O3mtwp4xjbYAPvg1AdTazxEXGQg1',
    uid: 'O3mtwp4xjbYAPvg1AdTazxEXGQg1',
    displayName: 'Thùy Phan Thị Diệu',
    email: '7838thuy0905@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocJja2LRgxf1MYcKX2HVYnpIu6Tt2avHjZlxwXzy-juReHGoIJC8=s96-c',
    isAnonymous: false,
    lastLoginAt: 1786539635000,
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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
    userId: 'wnxUHR2dywQqrTmD6LE5LPamkQI2',
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

const GENERIC_NAMES = new Set(['user', 'guest', 'guest player', 'player', 'teacher', 'anonymous', 'no email']);

const DEFAULT_SAMPLE_IDS = new Set([
  'sample-bubble-pop-1',
  'sample-yoga-1',
  'sample-sumo-1',
  'sample-mystery-1',
]);

const DEFAULT_SLIDE_DECK_IDS = new Set([
  'deck-cambridge-flyers-1',
  'deck-phonics-magic-e-2',
  'deck-grammar-past-vs-present-3',
  'deck-starters-monster-art',
]);

export function getDeletedGameIds(): Set<string> {
  const arr = safeReadLocalArray(CACHE_KEY_DELETED_GAMES);
  return new Set(['lbwoT7kdbBzxdxZF85nk', ...arr.map((id: any) => String(id))]);
}

export function isSyntheticOrSampleGame(g: any): boolean {
  if (!g) return true;
  const id = String(typeof g === 'string' ? g : g.id || '').trim();
  if (!id) return false;
  if (id.startsWith('comm-') || id.startsWith('sample-') || DEFAULT_SAMPLE_IDS.has(id)) {
    return true;
  }
  return false;
}

export function markGameDeleted(gameId: string): void {
  const id = String(gameId || '').trim();
  if (!id) return;
  try {
    const deletedSet = getDeletedGameIds();
    deletedSet.add(id);
    safeWriteLocal(CACHE_KEY_DELETED_GAMES, Array.from(deletedSet));
  } catch {}
  try {
    deleteGameRecord(id);
  } catch {}
  try {
    const userGames = safeReadLocalArray(CACHE_KEY_USER_GAMES).filter((g: any) => g && String(g.id) !== id);
    safeWriteLocal(CACHE_KEY_USER_GAMES, userGames);
  } catch {}
  try {
    const adminGames = safeReadLocalArray(CACHE_KEY_ADMIN_GAMES).filter((g: any) => g && String(g.id) !== id);
    safeWriteLocal(CACHE_KEY_ADMIN_GAMES, adminGames);
  } catch {}
  try {
    const pubGames = safeReadLocalArray(CACHE_KEY_PUBLIC_GAMES).filter((g: any) => g && String(g.id) !== id);
    safeWriteLocal(CACHE_KEY_PUBLIC_GAMES, pubGames);
  } catch {}
  fetch('/api/platform-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedGameIds: [id] }),
  }).catch(() => {});
}

/**
 * Checks whether a game belongs to the specified user (public, private, or locally saved on their computer).
 */
export function isGameOwnedByUser(game: any, user: any): boolean {
  if (!game || !user) return false;
  if (isSyntheticOrSampleGame(game)) return false;
  if (getDeletedGameIds().has(String(game.id || ''))) return false;

  const uid = String(user.uid || user.id || '').trim();
  const userIdAlt = String(user.id || user.uid || '').trim();
  const gameUid = String(game.userId || game.createdByUid || '').trim();

  if (gameUid && (gameUid === uid || gameUid === userIdAlt)) {
    return true;
  }

  // Match linked accounts for Marissa dela Riarte
  if (
    (uid === 'user-marissa-dela-riarte' && gameUid === 'DargHf1A0xPP23UygUwLpfgxcdh2') ||
    (uid === 'DargHf1A0xPP23UygUwLpfgxcdh2' && gameUid === 'user-marissa-dela-riarte')
  ) {
    return true;
  }

  const userEmail = String(user.email || '').toLowerCase().trim();
  const gameEmail = String(game.creatorEmail || game.userEmail || game.createdByEmail || '').toLowerCase().trim();
  if (userEmail && !GENERIC_NAMES.has(userEmail) && gameEmail && userEmail === gameEmail) {
    return true;
  }

  const userName = String(user.displayName || user.name || '').toLowerCase().trim();
  const gameCreatorName = String(game.creatorName || game.authorName || game.userName || '').toLowerCase().trim();
  if (
    userName &&
    !GENERIC_NAMES.has(userName) &&
    gameCreatorName &&
    !GENERIC_NAMES.has(gameCreatorName) &&
    userName === gameCreatorName
  ) {
    return true;
  }

  if (userEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    const hasOtherUserId =
      gameUid &&
      gameUid !== uid &&
      gameUid !== 'wnxUHR2dywQqrTmD6LE5LPamkQI2' &&
      gameUid !== 'admin-teacher-jan' &&
      gameUid !== 'teacher-studio-user' &&
      gameUid !== 'local-user';
    const hasOtherEmail =
      gameEmail &&
      gameEmail !== SUPER_ADMIN_EMAIL.toLowerCase() &&
      !GENERIC_NAMES.has(gameEmail);
    const hasOtherCreatorName =
      gameCreatorName &&
      gameCreatorName !== 'teacher jan' &&
      gameCreatorName !== 'janrel bugtay' &&
      gameCreatorName !== 'admin' &&
      !GENERIC_NAMES.has(gameCreatorName);

    if (!hasOtherUserId && !hasOtherEmail && !hasOtherCreatorName) {
      if (
        gameCreatorName === 'teacher jan' ||
        gameCreatorName === 'admin' ||
        !gameUid ||
        gameUid === 'teacher-studio-user' ||
        gameUid === 'local-user'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns all games created by a user (including public games, private games, locally saved computer games,
 * and any games recorded in activity logs).
 */
export function getUserCreatedGames(user: any, games: any[] = [], activities: UserActivityEvent[] = []): any[] {
  if (!user) return [];
  const uid = String(user.uid || user.id || '').trim();
  const email = String(user.email || '').toLowerCase().trim();
  const displayName = String(user.displayName || '').toLowerCase().trim();
  const deletedIds = getDeletedGameIds();

  const byId = new Map<string, any>();
  const byTitleAndType = new Set<string>();

  const makeTitleKey = (titleStr: string, typeStr: string) =>
    `${String(titleStr || '').toLowerCase().trim()}::${String(typeStr || '').toLowerCase().trim()}`;

  games.forEach((g: any) => {
    if (!g || isSyntheticOrSampleGame(g)) return;
    const id = String(g.id || `game-${byId.size}`);
    if (deletedIds.has(id)) return;
    if (isGameOwnedByUser(g, user)) {
      byId.set(id, g);
      const tk = makeTitleKey(g.name || g.title || g.topic || '', g.gameType || '');
      if (tk !== '::') byTitleAndType.add(tk);
    }
  });

  // Also include any local computer games stored directly on the user object
  if (Array.isArray(user.localComputerGames)) {
    user.localComputerGames.forEach((lg: any) => {
      if (!lg || isSyntheticOrSampleGame(lg)) return;
      const id = String(lg.id || `local-${byId.size}`);
      if (deletedIds.has(id)) return;
      const tk = makeTitleKey(lg.name || lg.title || lg.topic || '', lg.gameType || '');
      if (!byId.has(id) && !byTitleAndType.has(tk)) {
        byId.set(id, { ...lg, id, userId: uid, isPublic: Boolean(lg.isPublic), savedOnComputer: true });
        if (tk !== '::') byTitleAndType.add(tk);
      }
    });
  }

  // Also include any genuine games logged in userActivities (create_game / edit_game) that aren't already in byId
  activities.forEach((act: any) => {
    if (!act) return;
    if (String(act.id || '').startsWith('synth-act-')) return;
    const action = act.action || act.actionType;
    if (action !== 'create_game' && action !== 'edit_game') return;

    const actUid = String(act.userId || '').trim();
    const actEmail = String(act.userEmail || '').toLowerCase().trim();
    const actName = String(act.userName || '').toLowerCase().trim();

    const belongsToUser =
      (uid && actUid && (actUid === uid || actUid === String(user.id || ''))) ||
      (!actUid && email && !GENERIC_NAMES.has(email) && actEmail && actEmail === email) ||
      (!actUid && !actEmail && displayName && !GENERIC_NAMES.has(displayName) && actName && actName === displayName);

    if (!belongsToUser) return;

    const gameId = String(act.gameId || `act-game-${act.id || byId.size}`);
    if (isSyntheticOrSampleGame(gameId) || deletedIds.has(gameId)) return;
    const gameTitle = act.gameTitle || act.title?.replace(/^(Created|Updated) Game:\s*"?|"?$/g, '') || 'Custom Game';
    const gameType = act.gameType || 'custom-quiz';
    const tk = makeTitleKey(gameTitle, gameType);

    if (!byId.has(gameId) && (tk === '::' || !byTitleAndType.has(tk))) {
      byId.set(gameId, {
        id: gameId,
        name: gameTitle,
        title: gameTitle,
        topic: gameTitle,
        gameType,
        userId: uid,
        creatorEmail: user.email || act.userEmail || '',
        creatorName: user.displayName || act.userName || 'User',
        isPublic: false,
        savedOnComputer: true,
        customQuestions: Array.from({ length: Number(act.questionCount) || 1 }, (_, i) => ({
          id: `q-${i + 1}`,
          question: `Question #${i + 1}`,
          options: [],
        })),
        createdAt: act.timestamp || act.createdAtMs || Date.now(),
      });
      if (tk !== '::') byTitleAndType.add(tk);
    }
  });

  return Array.from(byId.values());
}

/**
 * Checks if a game ID represents a locally generated computer game (not a Firestore doc ID).
 */
export function isLocalOnlyGameId(id: string): boolean {
  const s = String(id || '').trim();
  return (
    s.startsWith('local-') ||
    s.startsWith('game-') ||
    s.startsWith('slide-game-') ||
    s.startsWith('yoga-') ||
    s.startsWith('pq-')
  );
}

/**
 * Reads all locally cached/saved user games on this computer across all localStorage keys:
 * - `hamster_cached_user_games`
 * - `hamster_esl_saved_games_v1` (`getSavedGames()`)
 * - `yogaQuizzes`
 * - `hamster_my_slides` (custom user-created slide decks)
 * - `hamster_pop_quizzes` (saved Video Quizzes)
 */
export function getAllLocalUserGames(currentUser?: any): any[] {
  const deletedIds = getDeletedGameIds();
  const fromCloudCache = safeReadLocalArray(CACHE_KEY_USER_GAMES);
  const fromLocalStore = (getSavedGames() || []).filter(
    (g: any) => g && g.id && !isSyntheticOrSampleGame(g) && !deletedIds.has(String(g.id))
  );
  const fromYogaQuizzes = safeReadLocalArray('yogaQuizzes').map((q: any, idx: number) => ({
    id: q.id || `local-yoga-${idx + 1}`,
    name: q.title || q.topic || 'Yoga Quiz',
    title: q.title || q.topic || 'Yoga Quiz',
    topic: q.topic || q.title || 'Yoga Quiz',
    className: q.classLevel || '',
    gameType: 'yoga-quiz',
    customQuestions: Array.isArray(q.questions) ? q.questions : [],
    isPublic: Boolean(q.isPublic),
    savedOnComputer: true,
    createdAt: q.createdAt || new Date().toISOString(),
  }));
  const fromMySlides = safeReadLocalArray('hamster_my_slides')
    .filter(
      (d: any) =>
        d &&
        d.id &&
        !DEFAULT_SLIDE_DECK_IDS.has(String(d.id)) &&
        !String(d.id).startsWith('deck-cambridge-flyers') &&
        !String(d.id).startsWith('deck-phonics-magic-e') &&
        !String(d.id).startsWith('deck-grammar-past-vs-present')
    )
    .map((d: any) => ({
      id: `slide-game-${d.id}`,
      name: d.title || d.topic || 'Custom Slide Deck',
      title: d.title || d.topic || 'Custom Slide Deck',
      topic: d.topic || d.title || 'Interactive Slides',
      className: d.level || d.grade || '',
      gameType: 'my-slides',
      customQuestions: Array.isArray(d.slides)
        ? d.slides.map((s: any, i: number) => ({
            id: s.id || `slide-${i + 1}`,
            question: s.title || s.heading || s.question || `Slide #${i + 1}`,
            options: Array.isArray(s.options) ? s.options : [],
          }))
        : [],
      userId: d.userId || currentUser?.uid,
      creatorName: d.authorName || currentUser?.displayName,
      creatorEmail: currentUser?.email,
      isPublic: false,
      savedOnComputer: true,
      createdAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
    }));
  const fromPopQuizzes = safeReadLocalArray('hamster_pop_quizzes');

  const map = new Map<string, any>();

  const addLocalEntry = (g: any) => {
    if (!g || !g.id) return;
    const id = String(g.id);
    if (isSyntheticOrSampleGame(g) || deletedIds.has(id)) return;
    const existing = map.get(id) || {};
    const merged: any = { ...existing, ...g, id };

    if (
      currentUser?.uid &&
      (!merged.userId ||
        merged.userId === 'teacher-studio-user' ||
        merged.userId === 'local-user') &&
      isLocalOnlyGameId(id)
    ) {
      merged.userId = currentUser.uid;
      merged.creatorEmail = merged.creatorEmail || currentUser.email || '';
      merged.creatorName =
        merged.creatorName ||
        currentUser.displayName ||
        (currentUser.email ? currentUser.email.split('@')[0] : 'Teacher');
    }

    map.set(id, merged);
  };

  fromLocalStore.forEach(addLocalEntry);
  fromYogaQuizzes.forEach(addLocalEntry);
  fromMySlides.forEach(addLocalEntry);
  fromPopQuizzes.forEach(addLocalEntry);
  fromCloudCache.forEach(addLocalEntry);

  return Array.from(map.values());
}

/**
 * Immediately saves a user's created/updated game (whether public or privately saved on their computer)
 * to localStorage caches AND syncs it to `/api/platform-cache` and activity logs so Admin Dashboard counts it.
 */
export function saveAndSyncUserGame(
  gameData: any,
  user?: any,
  options?: { isUpdate?: boolean; skipActivityLog?: boolean }
): any {
  if (!gameData) return null;
  const now = new Date().toISOString();
  const id = String(gameData.id || `local-game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const uid = user?.uid || gameData.userId || 'local-user';
  const email = user?.email || gameData.creatorEmail || '';
  const name =
    user?.displayName ||
    gameData.creatorName ||
    (email && email.includes('@') ? email.split('@')[0] : 'Teacher');

  const normalizedGame = JSON.parse(
    JSON.stringify({
      ...gameData,
      id,
      name: gameData.name || gameData.title || gameData.topic || 'Custom Game',
      title: gameData.title || gameData.name || gameData.topic || 'Custom Game',
      topic: gameData.topic || gameData.name || gameData.title || '',
      className: gameData.className || gameData.classLevel || '',
      gameType: gameData.gameType || 'custom-quiz',
      customQuestions:
        gameData.customQuestions ||
        gameData.questions ||
        gameData.customSentences ||
        gameData.sentences ||
        [],
      userId: uid,
      creatorEmail: email,
      creatorName: name,
      isPublic: Boolean(gameData.isPublic),
      savedOnComputer: true,
      updatedAt: gameData.updatedAt || now,
      createdAt: gameData.createdAt || now,
    })
  );

  // 1. Save in `hamster_esl_saved_games_v1`
  try {
    saveGameRecord(normalizedGame);
  } catch {}

  // 2. Save in `hamster_cached_user_games`
  try {
    const cached = safeReadLocalArray(CACHE_KEY_USER_GAMES);
    const idx = cached.findIndex((g: any) => g && String(g.id) === id);
    if (idx >= 0) {
      cached[idx] = { ...cached[idx], ...normalizedGame };
    } else {
      cached.unshift(normalizedGame);
    }
    safeWriteLocal(CACHE_KEY_USER_GAMES, cached);
  } catch {}

  // 3. Update `hamster_cached_admin_games_v2` only if within safe storage size
  try {
    const adminCached = safeReadLocalArray(CACHE_KEY_ADMIN_GAMES);
    const idx = adminCached.findIndex((g: any) => g && String(g.id) === id);
    if (idx >= 0) {
      adminCached[idx] = { ...adminCached[idx], ...normalizedGame };
    } else {
      adminCached.unshift(normalizedGame);
    }
    const serialized = JSON.stringify(adminCached);
    if (serialized.length < 1800000) {
      localStorage.setItem(CACHE_KEY_ADMIN_GAMES, serialized);
    }
  } catch {}

  // 4. Log activity event so it's also tracked in timeline & activity counts
  if (!options?.skipActivityLog && uid) {
    const qCount = Array.isArray(normalizedGame.customQuestions)
      ? normalizedGame.customQuestions.length
      : 0;
    logUserActivity({
      userId: uid,
      userEmail: email || undefined,
      userName: name || undefined,
      userPhoto: user?.photoURL || null,
      action: options?.isUpdate ? 'edit_game' : 'create_game',
      title: `${options?.isUpdate ? 'Updated' : 'Created'} Game: "${normalizedGame.name}"`,
      gameId: id,
      gameTitle: normalizedGame.name,
      gameType: normalizedGame.gameType,
      questionCount: qCount,
      details: `Saved ${normalizedGame.isPublic ? 'public' : 'private'} game with ${qCount} item${qCount === 1 ? '' : 's'}.`,
    });
  }

  // 5. Immediately push to `/api/platform-cache`
  fetch('/api/platform-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      games: [normalizedGame],
      users:
        uid && uid !== 'local-user'
          ? [
              {
                id: uid,
                uid,
                email: email || 'Guest',
                displayName: name,
                photoURL: user?.photoURL || null,
                isAnonymous: Boolean(user?.isAnonymous),
                lastLoginAt: Date.now(),
              },
            ]
          : [],
    }),
  }).catch(() => {});

  return normalizedGame;
}

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function logFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null, user?: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Sync Notice:', JSON.stringify(errInfo));
}

function withSaveTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: boolean; value?: T; timedOut?: boolean; error?: any }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, timedOut: true });
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: true, value });
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, timedOut: false, error });
        }
      });
  });
}

/**
 * Reliable, non-hanging game save across ALL creators:
 * 1. Assigns ONE canonical ID (reusing existing owned ID or generating a Firestore doc ID synchronously).
 * 2. Resolves folderName so folder metadata survives quota limits.
 * 3. Persists immediately to localStorage AND awaits `/api/platform-cache` (max 3.5s) before navigation.
 * 4. Syncs to Firestore `mysteryBoxGames` with a 2.5s timeout & 950KB payload guard (never blocks UI on 429 quota exhaustion).
 */
export async function persistUserGameToCloudAndCache(
  db: any,
  user: any,
  gamePayload: any,
  options?: {
    existingGame?: any;
    candidateId?: string | null;
    skipActivityLog?: boolean;
    timeoutMs?: number;
  }
): Promise<{
  id: string;
  savedGame: any;
  isOwnExistingGame: boolean;
  serverSynced: boolean;
  cloudSynced: boolean;
  cloudError?: string;
}> {
  const now = new Date().toISOString();
  const existing = options?.existingGame;
  const candidateId = options?.candidateId || existing?.id || null;
  const isOwnExistingGame = Boolean(
    user &&
      candidateId &&
      !isSyntheticOrSampleGame(candidateId) &&
      !String(candidateId).startsWith('paintball-') &&
      (!existing?.userId || existing.userId === user.uid || existing.userId === 'local-user' || existing.userId === 'teacher-studio-user')
  );

  const { collection, doc, setDoc, updateDoc } = await import('firebase/firestore');

  let canonicalId = isOwnExistingGame && candidateId ? String(candidateId) : '';
  if (!canonicalId) {
    try {
      canonicalId = db ? doc(collection(db, 'mysteryBoxGames')).id : `local-game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    } catch {
      canonicalId = `local-game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
  }

  // Resolve folderName if folderId is present
  let resolvedFolderName = gamePayload.folderName || '';
  if (gamePayload.folderId && !resolvedFolderName) {
    try {
      const userFolders = mergeUserFolders(user?.uid);
      const matchedFolder = userFolders.find((f) => String(f.id) === String(gamePayload.folderId));
      if (matchedFolder?.name) {
        resolvedFolderName = matchedFolder.name;
      }
    } catch {}
  }

  const uid = user?.uid || gamePayload.userId || 'local-user';
  const email = user?.email || gamePayload.creatorEmail || '';
  const name =
    user?.displayName ||
    gamePayload.creatorName ||
    (email && email.includes('@') ? email.split('@')[0] : 'Teacher');

  const cleanPayload = JSON.parse(
    JSON.stringify({
      ...gamePayload,
      id: canonicalId,
      name: gamePayload.name || gamePayload.title || gamePayload.topic || 'Custom Game',
      title: gamePayload.title || gamePayload.name || gamePayload.topic || 'Custom Game',
      topic: gamePayload.topic || gamePayload.name || gamePayload.title || '',
      className: gamePayload.className || gamePayload.classLevel || '',
      folderId: gamePayload.folderId || '',
      ...(resolvedFolderName ? { folderName: resolvedFolderName } : {}),
      gameType: gamePayload.gameType || 'custom-quiz',
      customQuestions:
        gamePayload.customQuestions ||
        gamePayload.questions ||
        gamePayload.customSentences ||
        gamePayload.sentences ||
        [],
      userId: uid,
      creatorName: name,
      creatorEmail: email,
      isPublic: Boolean(gamePayload.isPublic),
      publishedAt: gamePayload.isPublic ? (gamePayload.publishedAt || existing?.publishedAt || now) : null,
      createdAt: (isOwnExistingGame && (existing?.createdAt || gamePayload.createdAt)) || now,
      updatedAt: now,
      savedOnComputer: true,
    })
  );

  // 1. Instant local storage save (single canonical ID)
  try {
    saveGameRecord(cleanPayload);
  } catch {}
  try {
    const cached = safeReadLocalArray(CACHE_KEY_USER_GAMES);
    const idx = cached.findIndex((g: any) => g && String(g.id) === canonicalId);
    if (idx >= 0) {
      cached[idx] = { ...cached[idx], ...cleanPayload };
    } else {
      cached.unshift(cleanPayload);
    }
    safeWriteLocal(CACHE_KEY_USER_GAMES, cached);
  } catch {}

  // 2. Log user activity
  if (!options?.skipActivityLog && uid) {
    const qCount = Array.isArray(cleanPayload.customQuestions)
      ? cleanPayload.customQuestions.length
      : Array.isArray(cleanPayload.cards)
      ? cleanPayload.cards.length
      : 0;
    logUserActivity({
      userId: uid,
      userEmail: email || undefined,
      userName: name || undefined,
      userPhoto: user?.photoURL || null,
      action: isOwnExistingGame ? 'edit_game' : 'create_game',
      title: `${isOwnExistingGame ? 'Updated' : 'Created'} Game: "${cleanPayload.name}"`,
      gameId: canonicalId,
      gameTitle: cleanPayload.name,
      gameType: cleanPayload.gameType,
      questionCount: qCount,
      details: `Saved ${cleanPayload.isPublic ? 'public' : 'private'} game with ${qCount} item${qCount === 1 ? '' : 's'}.`,
    });
  }

  // 3. Await server `/api/platform-cache` persistence BEFORE navigation so My Games sees it immediately
  let serverSynced = false;
  try {
    const serverRes = await withSaveTimeout(
      fetch('/api/platform-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: [cleanPayload],
          users:
            uid && uid !== 'local-user'
              ? [
                  {
                    id: uid,
                    uid,
                    email: email || 'Guest',
                    displayName: name,
                    photoURL: user?.photoURL || null,
                    isAnonymous: Boolean(user?.isAnonymous),
                    lastLoginAt: Date.now(),
                  },
                ]
              : [],
        }),
      }),
      3500
    );
    serverSynced = Boolean(serverRes.ok && serverRes.value?.ok);
  } catch {
    serverSynced = false;
  }

  // 4. Sync to Firestore with timeout & 1MB document size protection
  let cloudSynced = false;
  let cloudError: string | undefined;
  if (user && db) {
    const firestoreDocData = { ...cleanPayload };
    delete firestoreDocData.id;
    const approxBytes = JSON.stringify(firestoreDocData).length;
    const timeoutMs = options?.timeoutMs ?? 2500;
    const docPath = `mysteryBoxGames/${canonicalId}`;

    if (approxBytes > 950000) {
      cloudError = 'Game exceeds 1MB Firestore limit (saved safely on server & locally).';
    } else {
      const targetRef = doc(db, 'mysteryBoxGames', canonicalId);
      if (isOwnExistingGame) {
        const updateRes = await withSaveTimeout(updateDoc(targetRef, firestoreDocData), timeoutMs);
        if (updateRes.ok) {
          cloudSynced = true;
        } else if (!updateRes.timedOut) {
          const errCode = updateRes.error?.code;
          if (errCode === 'not-found' || errCode === 'permission-denied') {
            const setRes = await withSaveTimeout(
              setDoc(targetRef, firestoreDocData, { merge: true }),
              timeoutMs
            );
            if (setRes.ok) {
              cloudSynced = true;
            } else {
              if (!setRes.timedOut && setRes.error?.code === 'permission-denied') {
                logFirestoreError(setRes.error, FirestoreOperationType.WRITE, docPath, user);
              }
              cloudError = setRes.timedOut
                ? 'Cloud sync timed out (saved on server & locally).'
                : setRes.error?.message || 'Cloud sync unavailable';
            }
          } else {
            cloudError = updateRes.error?.message || 'Cloud sync unavailable';
          }
        } else {
          cloudError = 'Cloud sync timed out (saved on server & locally).';
        }
      } else {
        const setRes = await withSaveTimeout(setDoc(targetRef, firestoreDocData), timeoutMs);
        if (setRes.ok) {
          cloudSynced = true;
        } else {
          if (!setRes.timedOut && setRes.error?.code === 'permission-denied') {
            logFirestoreError(setRes.error, FirestoreOperationType.CREATE, docPath, user);
          }
          cloudError = setRes.timedOut
            ? 'Cloud sync timed out (saved on server & locally).'
            : setRes.error?.message || 'Cloud sync unavailable';
        }
      }
    }
  }

  return {
    id: canonicalId,
    savedGame: cleanPayload,
    isOwnExistingGame,
    serverSynced,
    cloudSynced,
    cloudError,
  };
}

/**
 * Scans all locally saved games on the user's computer, attributes them to the signed-in user,
 * and syncs them to `/api/platform-cache` and Firestore `mysteryBoxGames` (even if private).
 */
export async function syncLocalComputerGamesForUser(currentUser: any, db?: any): Promise<any[]> {
  if (!currentUser?.uid) return [];
  const localGames = getAllLocalUserGames(currentUser);
  const ownedLocalGames = localGames.filter((g: any) => isGameOwnedByUser(g, currentUser));

  if (ownedLocalGames.length > 0) {
    // Sync to server platform cache immediately
    fetch('/api/platform-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        games: ownedLocalGames,
        users: [
          {
            id: currentUser.uid,
            uid: currentUser.uid,
            email: currentUser.email || 'Guest',
            displayName:
              currentUser.displayName ||
              (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
            photoURL: currentUser.photoURL || null,
            isAnonymous: Boolean(currentUser.isAnonymous),
            localGamesCount: ownedLocalGames.length,
            lastLoginAt: Date.now(),
          },
        ],
      }),
    }).catch(() => {});

    // Also sync local-only games to Firestore `mysteryBoxGames` if db is provided
    if (db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        for (const g of ownedLocalGames) {
          const gid = String(g.id || '');
          if (gid && !isSyntheticOrSampleGame(gid) && isLocalOnlyGameId(gid)) {
            const cleanPayload = JSON.parse(
              JSON.stringify({
                ...g,
                userId: currentUser.uid,
                creatorEmail: currentUser.email || g.creatorEmail || '',
                creatorName:
                  currentUser.displayName ||
                  g.creatorName ||
                  (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
                isPublic: Boolean(g.isPublic),
                savedOnComputer: true,
              })
            );
            await setDoc(doc(db, 'mysteryBoxGames', gid), cleanPayload, { merge: true }).catch(() => {});
          }
        }
      } catch {}
    }
  }

  return ownedLocalGames;
}

/**
 * Merges public games from Firestore, localStorage (`hamster_cached_public_games_v2`, `hamster_cached_user_games`),
 * and fallback community games so Community Hub never shows "0 games / No games found".
 */
export function mergePublicGames(firestoreGames: any[] = [], currentUser?: any): any[] {
  const deletedIds = getDeletedGameIds();
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
    if (!id || deletedIds.has(id)) return;
    if (!isFallback && isSyntheticOrSampleGame(g)) return;
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

  // 1. Live Firestore public games (highest priority)
  firestoreGames.forEach((g) => addGame(g, false));

  // 2. Previously cached public games
  const cachedPublic = safeReadLocalArray(CACHE_KEY_PUBLIC_GAMES);
  cachedPublic.forEach((g) => addGame(g, false));

  // 3. User's own cached games from My Games (`hamster_cached_user_games`)
  const userGames = getAllLocalUserGames(currentUser);
  userGames.forEach((g) => {
    const isPub =
      g?.isPublic === true ||
      g?.isPublic === 'true' ||
      String(g?.isPublic).toLowerCase() === 'true';
    if (isPub) {
      addGame({ ...g, isPublic: true }, false);
    }
  });

  // 4. Fallback community games (only if no real public games exist yet)
  if (byId.size === 0) {
    FALLBACK_COMMUNITY_GAMES.forEach((g) => addGame(g, true));
  }

  const combined = Array.from(byId.values());
  if (combined.length > 0) {
    safeWriteLocal(CACHE_KEY_PUBLIC_GAMES, combined.filter((g) => !isSyntheticOrSampleGame(g)));
  }
  return combined;
}

/**
 * Merges all games for Admin Dashboard (`My Games Created`) — including public, private, and locally saved computer games.
 * Excludes synthetic fallback (`comm-*`) and sample (`sample-*`) games so counts match real Firestore + genuine local saves.
 */
export function mergeAdminGames(
  firestoreGames: any[] = [],
  currentUser?: any,
  options?: { replaceCloudCache?: boolean }
): any[] {
  const deletedIds = getDeletedGameIds();
  const byId = new Map<string, any>();

  // Build quick user lookup from known users + cached admin users so games with only userId get creatorEmail/creatorName enriched
  const userByUid = new Map<string, any>();
  KNOWN_REGISTERED_USERS.forEach((u) => {
    if (u?.uid) userByUid.set(String(u.uid), u);
  });
  safeReadLocalArray(CACHE_KEY_ADMIN_USERS).forEach((u) => {
    const uid = String(u?.uid || u?.id || '');
    if (uid && !isLegacySyntheticUser(u)) userByUid.set(uid, u);
  });

  const addGame = (g: any) => {
    if (!g || !g.id) return;
    const id = String(g.id);
    if (isSyntheticOrSampleGame(g) || deletedIds.has(id)) return;
    const existing = byId.get(id);
    const merged = existing ? { ...existing, ...g } : { ...g };

    if (merged.userId && userByUid.has(String(merged.userId))) {
      const owner = userByUid.get(String(merged.userId));
      if (!merged.creatorEmail && owner?.email && owner.email !== 'Guest') {
        merged.creatorEmail = owner.email;
      }
      if (!merged.creatorName && owner?.displayName) {
        merged.creatorName = owner.displayName;
      }
    }

    if (currentUser?.uid && !merged.userId && isLocalOnlyGameId(id) && isGameOwnedByUser(merged, currentUser)) {
      merged.userId = currentUser.uid;
    }
    byId.set(id, merged);
  };

  const realFirestoreGames = (firestoreGames || []).filter(
    (g) => g && g.id && !isSyntheticOrSampleGame(g) && !deletedIds.has(String(g.id))
  );

  // 1. Live Firestore games
  realFirestoreGames.forEach(addGame);

  // 2. If Firestore did NOT return live games (e.g. offline/quota) and replaceCloudCache isn't set, fall back to cached admin games
  if (realFirestoreGames.length === 0 && !options?.replaceCloudCache) {
    safeReadLocalArray(CACHE_KEY_ADMIN_GAMES).forEach(addGame);
  }

  // 3. Always include genuine local-only computer games (e.g. local-*, game-*, slide-game-*, yoga-*)
  getAllLocalUserGames(currentUser).forEach((g) => {
    if (!g || !g.id) return;
    const id = String(g.id);
    if (realFirestoreGames.length === 0 && !options?.replaceCloudCache) {
      addGame(g);
    } else if (isLocalOnlyGameId(id)) {
      addGame(g);
    }
  });

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
  const uidToEmailKey = new Map<string, string>();

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

  const getCanonicalKey = (u: any): string => {
    const uid = String(u?.uid || u?.id || '').trim();
    if (uid && uidToEmailKey.has(uid)) {
      return uidToEmailKey.get(uid)!;
    }
    const email = String(u?.email || '').toLowerCase().trim();
    if (email && email.includes('@')) {
      const eKey = `email:${email}`;
      if (uid && !uid.startsWith('creator-') && !uid.startsWith('act-')) {
        uidToEmailKey.set(uid, eKey);
      }
      return eKey;
    }
    if (uid) return `uid:${uid}`;
    return '';
  };

  const upsertUser = (u: any) => {
    if (!u || isLegacySyntheticUser(u)) return;
    const key = getCanonicalKey(u);
    if (!key) return;
    const existing = byKey.get(key) || {};
    const realUid =
      u.uid && !String(u.uid).startsWith('creator-') && !String(u.uid).startsWith('act-')
        ? u.uid
        : existing.uid || u.id || existing.id || key;

    const existingLoginMs = getTime(existing.lastLoginAt);
    const incomingLoginMs = getTime(u.lastLoginAt);
    const bestLoginMs = Math.max(existingLoginMs, incomingLoginMs);

    const merged = {
      ...existing,
      ...u,
      id: realUid,
      uid: realUid,
      displayName:
        u.displayName && u.displayName !== 'User'
          ? u.displayName
          : existing.displayName || u.displayName || 'User',
      email:
        u.email && u.email.includes('@')
          ? u.email
          : existing.email || u.email || 'Guest',
      photoURL: u.photoURL || existing.photoURL || null,
      lastLoginAt: bestLoginMs > 0 ? bestLoginMs : existing.lastLoginAt || u.lastLoginAt || Date.now(),
    };
    if (realUid && merged.email && merged.email.includes('@') && !String(realUid).startsWith('creator-') && !String(realUid).startsWith('act-')) {
      uidToEmailKey.set(String(realUid), `email:${merged.email.toLowerCase().trim()}`);
    }
    byKey.set(key, merged);
  };

  // 1. Seed real registered platform accounts so non-guest accounts are never lost during quota limits
  KNOWN_REGISTERED_USERS.forEach(upsertUser);

  // 2. Previously cached admin users (filtering out any legacy synthetic user-* entries)
  safeReadLocalArray(CACHE_KEY_ADMIN_USERS)
    .filter((u) => !isLegacySyntheticUser(u))
    .forEach(upsertUser);

  // 3. Extract any additional creators from games (including privately saved computer games)
  games.forEach((g: any) => {
    if (!g || isSyntheticOrSampleGame(g)) return;
    const email = String(g.creatorEmail || '').trim();
    const name = String(g.creatorName || '').trim();
    const uid = String(g.userId || '').trim();
    if (
      uid === 'teacher-studio-user' ||
      uid === 'local-user' ||
      LEGACY_SYNTHETIC_USER_IDS.has(uid)
    ) {
      return;
    }
    if ((email && email.includes('@')) || uid) {
      const existingByUid = uid ? KNOWN_REGISTERED_USERS.find((ku) => ku.uid === uid) : null;
      upsertUser({
        id: uid || `creator-${email || name}`,
        uid: uid || `creator-${email || name}`,
        displayName:
          name ||
          existingByUid?.displayName ||
          (email ? email.split('@')[0] : 'Teacher'),
        email:
          email ||
          existingByUid?.email ||
          (name.toLowerCase() === 'teacher jan' ? SUPER_ADMIN_EMAIL : ''),
        photoURL: existingByUid?.photoURL || null,
        isAnonymous: false,
        lastLoginAt: existingByUid?.lastLoginAt || g.publishedAt || g.updatedAt || g.createdAt || 0,
      });
    }
  });

  // 4. Extract any additional users from activities
  activities.forEach((a: any) => {
    if (!a || String(a.id || '').startsWith('synth-act-')) return;
    const email = String(a.userEmail || '').trim();
    const name = String(a.userName || '').trim();
    const uid = String(a.userId || '').trim();
    if (LEGACY_SYNTHETIC_USER_IDS.has(uid)) return;
    if (uid || email) {
      const existingByUid = uid ? KNOWN_REGISTERED_USERS.find((ku) => ku.uid === uid) : null;
      const isGuest = !existingByUid && (Boolean(a.isAnonymous) || !email || !email.includes('@'));
      upsertUser({
        id: uid || `act-${email || name}`,
        uid: uid || `act-${email || name}`,
        displayName: existingByUid?.displayName || name || (email ? email.split('@')[0] : 'Player'),
        email: existingByUid?.email || (isGuest ? 'Guest' : email),
        photoURL: a.userPhoto || existingByUid?.photoURL || null,
        isAnonymous: isGuest,
        lastLoginAt: existingByUid?.lastLoginAt || a.timestamp || a.createdAtMs || 0,
      });
    }
  });

  // 5. Current authenticated user
  if (currentUser?.uid) {
    upsertUser({
      id: currentUser.uid,
      uid: currentUser.uid,
      displayName:
        currentUser.displayName ||
        (currentUser.email ? currentUser.email.split('@')[0] : 'Teacher Jan'),
      email: currentUser.email || 'Guest',
      photoURL: currentUser.photoURL || null,
      isAnonymous: Boolean(currentUser.isAnonymous),
      lastLoginAt: Date.now(),
    });
  }

  // 6. Live Firestore users (highest priority override, while preserving valid lastLoginAt if Firestore local cache has unresolved null sentinel)
  firestoreUsers.filter((u) => !isLegacySyntheticUser(u)).forEach(upsertUser);

  const result = Array.from(byKey.values()).sort(
    (a, b) => getTime(b.lastLoginAt) - getTime(a.lastLoginAt)
  );

  if (result.length > 0) {
    safeWriteLocal(CACHE_KEY_ADMIN_USERS, result);
  }
  return result;
}

/**
 * Reads locally cached user activities from localStorage.
 */
export function getLocalActivities(): UserActivityEvent[] {
  return safeReadLocalArray(CACHE_KEY_ACTIVITIES);
}

/**
 * Saves an activity event to localStorage cache.
 */
export function saveLocalActivity(activity: UserActivityEvent): void {
  try {
    if (!activity) return;
    const current = getLocalActivities();
    const id = activity.id || `local-act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entry: UserActivityEvent = {
      ...activity,
      id,
      action: activity.action || (activity.actionType as any) || 'play_game',
      actionType: activity.actionType || activity.action || 'play_game',
      timestamp: activity.timestamp || Date.now(),
      createdAtMs: typeof activity.timestamp === 'number' ? activity.timestamp : Date.now(),
    };
    const updated = [entry, ...current.filter((a) => a.id !== id)].slice(0, 150);
    safeWriteLocal(CACHE_KEY_ACTIVITIES, updated);
  } catch (err) {
    console.warn('Failed to save local activity:', err);
  }
}

/**
 * Merges user activities from Firestore and localStorage.
 */
export function mergeAdminActivities(firestoreActs: UserActivityEvent[] = [], games: any[] = []): UserActivityEvent[] {
  const deletedIds = getDeletedGameIds();
  const byId = new Map<string, UserActivityEvent>();
  const localActs = getLocalActivities() || [];

  const userByUid = new Map<string, any>();
  KNOWN_REGISTERED_USERS.forEach((u) => {
    if (u?.uid) userByUid.set(String(u.uid), u);
  });
  safeReadLocalArray(CACHE_KEY_ADMIN_USERS).forEach((u) => {
    const uid = String(u?.uid || u?.id || '');
    if (uid && !isLegacySyntheticUser(u)) userByUid.set(uid, u);
  });

  const addAct = (a: any) => {
    if (!a || !a.id) return;
    const gid = String(a.gameId || '');
    if (gid && (isSyntheticOrSampleGame(gid) || deletedIds.has(gid))) return;
    const owner = a.userId ? userByUid.get(String(a.userId)) : null;
    if (owner && String(a.userId) !== 'wnxUHR2dywQqrTmD6LE5LPamkQI2') {
      byId.set(String(a.id), {
        ...a,
        userEmail: owner.email || a.userEmail,
        userName: owner.displayName || a.userName,
      });
    } else {
      byId.set(String(a.id), a);
    }
  };

  localActs.forEach(addAct);
  firestoreActs.forEach(addAct);

  // Synthesize game creation events for user-created games using the real owner (never misattributing other users' games to Teacher Jan)
  games
    .filter((g) => g && g.id && !isSyntheticOrSampleGame(g) && !deletedIds.has(String(g.id)))
    .slice(0, 60)
    .forEach((g: any, idx: number) => {
      const alreadyLogged = Array.from(byId.values()).some(
        (a: any) => a.gameId === g.id && (a.action === 'create_game' || a.actionType === 'create_game')
      );
      if (alreadyLogged) return;
      const id = `synth-act-${g.id || idx}`;
      const ownerUid = String(g.userId || 'wnxUHR2dywQqrTmD6LE5LPamkQI2');
      const owner = userByUid.get(ownerUid);
      const isTeacherJan = ownerUid === 'wnxUHR2dywQqrTmD6LE5LPamkQI2';
      const ts = g.publishedAt || g.updatedAt || g.createdAt || Date.now() - idx * 60000;
      byId.set(id, {
        id,
        userId: ownerUid,
        userEmail: g.creatorEmail || owner?.email || (isTeacherJan ? SUPER_ADMIN_EMAIL : ''),
        userName: g.creatorName || owner?.displayName || (isTeacherJan ? 'Teacher Jan' : 'Teacher'),
        isAnonymous: false,
        action: 'create_game',
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
        createdAtMs: typeof ts === 'number' ? ts : new Date(ts).getTime() || Date.now(),
      });
    });

  const combined = Array.from(byId.values()).sort((a: any, b: any) => {
    const ta = a.createdAtMs || (typeof a.timestamp === 'number' ? a.timestamp : 0);
    const tb = b.createdAtMs || (typeof b.timestamp === 'number' ? b.timestamp : 0);
    return tb - ta;
  });

  if (combined.length > 0) {
    safeWriteLocal(CACHE_KEY_ACTIVITIES, combined.slice(0, 150));
  }

  return combined;
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
  replaceGames?: boolean;
  deletedUserIds?: string[];
  deletedGameIds?: string[];
}): Promise<{ games: any[]; users: any[]; activities: any[]; pageVisits: number } | null> {
  try {
    const deletedIds = getDeletedGameIds();
    const localGames = (payload?.games || getAllLocalUserGames()).filter(
      (g: any) => g && g.id && !isSyntheticOrSampleGame(g) && !deletedIds.has(String(g.id))
    );
    const localUsers = (payload?.users || safeReadLocalArray(CACHE_KEY_ADMIN_USERS)).filter(
      (u: any) => !isLegacySyntheticUser(u)
    );
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
        replaceGames: Boolean(payload?.replaceGames),
        deletedUserIds: payload?.deletedUserIds || [],
        deletedGameIds: Array.from(deletedIds),
      }),
    }).catch(() => {});

    const res = await fetch('/api/platform-cache');
    if (!res.ok) return null;
    const data = await res.json();
    const cleanUsers = (data.users || []).filter((u: any) => !isLegacySyntheticUser(u));
    const cleanGames = (data.games || []).filter(
      (g: any) => g && g.id && !isSyntheticOrSampleGame(g) && !deletedIds.has(String(g.id))
    );
    if (cleanGames.length > 0) {
      safeWriteLocal(CACHE_KEY_PUBLIC_GAMES, mergePublicGames(cleanGames));
      safeWriteLocal(CACHE_KEY_ADMIN_GAMES, mergeAdminGames(cleanGames, undefined, { replaceCloudCache: true }));
    }
    if (cleanUsers.length > 0) {
      safeWriteLocal(CACHE_KEY_ADMIN_USERS, mergePlatformUsers(cleanUsers, cleanGames));
    }
    if (data.pageVisits) {
      setCachedPageVisits(Number(data.pageVisits));
    }
    return {
      games: cleanGames,
      users: cleanUsers,
      activities: data.activities || [],
      pageVisits: Number(data.pageVisits) || DEFAULT_PLATFORM_PAGE_VISITS,
    };
  } catch {
    return null;
  }
}
