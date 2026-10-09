/**
 * Embedded Google Drive Characters
 * Real photo assets from Google Drive embedded as student avatars.
 * Padded numbers (001, 002, 003...) match the official images.
 * Full official roster includes Students 1-8, 10, and Students 11 to 40.
 */

export interface StudentCharacterDef {
  id: number;
  driveId: string;
  tag: string;
  title: string;
}

export const GOOGLE_DRIVE_STUDENTS: StudentCharacterDef[] = [
  {
    id: 1,
    driveId: '1u9s1Xu8uza3W8ZpwWX5NqKVPA4F9gBz7',
    tag: '001',
    title: 'Character 001',
  },
  {
    id: 2,
    driveId: '1Yww-WssC4zOP56Syalqa6mw-rmImoymq',
    tag: '002',
    title: 'Character 002',
  },
  {
    id: 3,
    driveId: '1--gLzDjWZb5o8xyUruCm0CAlgT5yWH9d',
    tag: '003',
    title: 'Character 003',
  },
  {
    id: 4,
    driveId: '1rHWCqfAcDeTg4zNZDoCzqQlVG3q-UvJ8',
    tag: '004',
    title: 'Character 004',
  },
  {
    id: 5,
    driveId: '1-vu3sEk0FKaC4NlGANnHiw1YnBRz3F9o',
    tag: '005',
    title: 'Character 005',
  },
  {
    id: 6,
    driveId: '1UgKip6JWFFoubn64WLXrvoUVXtjXPocX',
    tag: '006',
    title: 'Character 006',
  },
  {
    id: 7,
    driveId: '1lW6qzVWDBoVgp8w9AmrtKBTbhB6PrbjA',
    tag: '007',
    title: 'Character 007',
  },
  {
    id: 8,
    driveId: '1171GyfDvSgQL98DraWZ-cADZCqfkeVrc',
    tag: '008',
    title: 'Character 008',
  },
  {
    id: 10,
    driveId: '1qav0p4elcuPV6TUIDHTvQitEOPZMeEsa',
    tag: '010',
    title: 'Character 010',
  },
  {
    id: 11,
    driveId: '1I_SaYxnyONbabGB9ejXCM7KBSR53E7yj',
    tag: '011',
    title: 'Student 11',
  },
  {
    id: 12,
    driveId: '1fo6TScqbfu2SCzp-QrKiGhf80xDHzadC',
    tag: '012',
    title: 'Student 12',
  },
  {
    id: 13,
    driveId: '12MMb4sFoNOt00wb3Nk-5jb9EGAAF9LwU',
    tag: '013',
    title: 'Student 13',
  },
  {
    id: 14,
    driveId: '1lWoBpy-sUmIXntaKaDICyxTmMPgJ6Agw',
    tag: '014',
    title: 'Student 14',
  },
  {
    id: 15,
    driveId: '18Hdg_pM5Fa4io4mG8_Hg9QQxtFjXIElr',
    tag: '015',
    title: 'Student 15',
  },
  {
    id: 16,
    driveId: '1FwjKBgbyCoR7IRkZylV4w-hWW3rRKLPl',
    tag: '016',
    title: 'Student 16',
  },
  {
    id: 17,
    driveId: '1V6eQ0YIR2hwX6raQ3R0SIWrcVCiNmWr3',
    tag: '017',
    title: 'Student 17',
  },
  {
    id: 18,
    driveId: '10gg_NEq7ONS2PUA6L4pFSxp1gR5T5J7t',
    tag: '018',
    title: 'Student 18',
  },
  {
    id: 19,
    driveId: '1ERvXVhbZGsSbEF_UNwOokzpwR7UQfcfe',
    tag: '019',
    title: 'Student 19',
  },
  {
    id: 20,
    driveId: '1a6an-aimnGmpt-wGDI4unHQ8N2Mp-b0F',
    tag: '020',
    title: 'Student 20',
  },
  {
    id: 21,
    driveId: '161y2_mK2y0KhzXL1hPNNTZq70JwVZqi1',
    tag: '021',
    title: 'Student 21',
  },
  {
    id: 22,
    driveId: '1HnOQ7YWkZud8aSP_8HH3qp3D5yhmQChI',
    tag: '022',
    title: 'Student 22',
  },
  {
    id: 23,
    driveId: '1zjux6UA6uVRx8aNCxsZl03asRgvHQ_DQ',
    tag: '023',
    title: 'Student 23',
  },
  {
    id: 24,
    driveId: '1xMCSDYL9YcWLbxuQoVgOui2GuDSe5htU',
    tag: '024',
    title: 'Student 24',
  },
  {
    id: 25,
    driveId: '1AgWXbJz4xDtTYqixedKjke4SNf9xBL3m',
    tag: '025',
    title: 'Student 25',
  },
  {
    id: 26,
    driveId: '1NfkVET4BBzSan_xCBv-2PSqar81HVWM2',
    tag: '026',
    title: 'Student 26',
  },
  {
    id: 27,
    driveId: '1d78anitTb6rqyMMNBpG1RlwcFgFg13bU',
    tag: '027',
    title: 'Student 27',
  },
  {
    id: 28,
    driveId: '107lPDseyCr8xrctT5Vvxa0AkVkaph_NOE',
    tag: '028',
    title: 'Student 28',
  },
  {
    id: 29,
    driveId: '1eqS7ftNN91QpbMNYeS2Do1vCpF7cRP23',
    tag: '029',
    title: 'Student 29',
  },
  {
    id: 30,
    driveId: '1pqTJC9_owR5H5GLtamSxtZzh-vwn8CWl',
    tag: '030',
    title: 'Student 30',
  },
  {
    id: 31,
    driveId: '1clpP1axyiONpHb1Fes81iASnALPajPHH',
    tag: '031',
    title: 'Student 31',
  },
  {
    id: 32,
    driveId: '1DRgkKgK5bcfHHPU30JZvprpUS0qRg9eY',
    tag: '032',
    title: 'Student 32',
  },
  {
    id: 33,
    driveId: '1BRSfxo2Ssv5l3bPyvmKfMncksfbyO_5m',
    tag: '033',
    title: 'Student 33',
  },
  {
    id: 34,
    driveId: '1m-WXLMBYKOtB-Qcsx8KwJlCD5XYc_ONb',
    tag: '034',
    title: 'Student 34',
  },
  {
    id: 35,
    driveId: '180PjF8dXPAE6ExtfkLY_uL4sdKHDSWNZ',
    tag: '035',
    title: 'Student 35',
  },
  {
    id: 36,
    driveId: '1Orld290vuz8QpO2mqUrPNJ9w0LVDolpE',
    tag: '036',
    title: 'Student 36',
  },
  {
    id: 37,
    driveId: '1pbgtlPINic0Al87nImN9IEzxz29puUpa',
    tag: '037',
    title: 'Student 37',
  },
  {
    id: 38,
    driveId: '1xA7AUGgB-yk7YaxbI8nZKQuUXryhGFyv',
    tag: '038',
    title: 'Student 38',
  },
  {
    id: 39,
    driveId: '1v1PAXLnqIuZ9dFTX-eLi3NNkq0uGeE4F',
    tag: '039',
    title: 'Student 39',
  },
  {
    id: 40,
    driveId: '1Sgp-htwMyn2AfNkxrwoPcmQxW9C9yPHo',
    tag: '040',
    title: 'Student 40',
  },
];

export const OFFICIAL_CHARACTER_NUMBERS = GOOGLE_DRIVE_STUDENTS.map(s => s.id);

/**
 * Returns character configuration matching the student's assigned number.
 * Falls back sequentially if student number extends beyond available photos.
 */
export function getStudentCharacter(num: number): {
  id: number;
  tag: string;
  driveUrl: string;
  thumbnailUrl: string;
  localUrl: string;
  title: string;
} {
  // Try exact number match
  let def = GOOGLE_DRIVE_STUDENTS.find(s => s.id === num);
  
  // If not found, cycle through available characters
  if (!def) {
    const safeNum = Math.max(1, num || 1);
    const index = (safeNum - 1) % GOOGLE_DRIVE_STUDENTS.length;
    def = GOOGLE_DRIVE_STUDENTS[index] || GOOGLE_DRIVE_STUDENTS[0];
  }

  const padded = String(def.id).padStart(3, '0');

  return {
    id: def.id,
    tag: def.tag,
    localUrl: `/images/student_${padded}.png`,
    driveUrl: `https://lh3.googleusercontent.com/d/${def.driveId}`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${def.driveId}&sz=w1000`,
    title: def.title,
  };
}
