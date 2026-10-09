import fs from 'fs';
import https from 'https';
import path from 'path';

export const STUDENTS_11_TO_26 = [
  { id: 11, driveId: '1I_SaYxnyONbabGB9ejXCM7KBSR53E7yj', tag: '011', title: 'Character 011' },
  { id: 12, driveId: '1fo6TScqbfu2SCzp-QrKiGhf80xDHzadC', tag: '012', title: 'Character 012' },
  { id: 13, driveId: '12MMb4sFoNOtOOwb3Nk-5jb9EGAAF9LwU', tag: '013', title: 'Character 013' },
  { id: 14, driveId: '1lWoBpy-sUmIXntaKaDICyxTmMPgJ6Agw', tag: '014', title: 'Character 014' },
  { id: 15, driveId: '18Hdg_pM5Fa4io4mG8_Hg9QQxtFjXIElr', tag: '015', title: 'Character 015' },
  { id: 16, driveId: '1FwjKBgbyCoR7IRkZylV4w-hWW3rRKLPI', tag: '016', title: 'Character 016' },
  { id: 17, driveId: '1V6eQ0YIR2hwX6raQ3R0SIWrcVCiNmWr3', tag: '017', title: 'Character 017' },
  { id: 18, driveId: '10gg_NEq7ONS2PUA6L4pFSxp1gR5T5J7t', tag: '018', title: 'Character 018' },
  { id: 19, driveId: '1ERvXVhbZGsSbEF_UNwOokzpwR7UQfcfe', tag: '019', title: 'Character 019' },
  { id: 20, driveId: '1a6an-aimnGmpt-wGDI4unHQ8N2Mp-b0F', tag: '020', title: 'Character 020' },
  { id: 21, driveId: '161y2_mK2y0KhzXL1hPNNTZq70JwVZqi1', tag: '021', title: 'Character 021' },
  { id: 22, driveId: '1HnOQ7YWkZud8aSP_8HH3qp3D5yhmQChI', tag: '022', title: 'Character 022' },
  { id: 23, driveId: '1zjux6UA6uVRx8aNCxsZl03asRgvHQ_DQ', tag: '023', title: 'Character 023' },
  { id: 24, driveId: '1xMCSDYL9YcWLbxuQoVgOui2GuDSe5htU', tag: '024', title: 'Character 024' },
  { id: 25, driveId: '1AgWXbJz4xDtTYqixedKjke4SNf9xBL3m', tag: '025', title: 'Character 025' },
  { id: 26, driveId: '1NfkVET4BBzSan_xCBv-2PSqar81HVWM2', tag: '026', title: 'Character 026' },
];

const targetDir = './public/images';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Downloading all students 11 to 26...');
  for (const s of STUDENTS_11_TO_26) {
    const padded = String(s.id).padStart(3, '0');
    const url = `https://lh3.googleusercontent.com/d/${s.driveId}`;
    const dest = path.join(targetDir, `student_${padded}.png`);
    try {
      await downloadImage(url, dest);
      const stat = fs.statSync(dest);
      console.log(`✓ Student ${s.id} downloaded (${stat.size} bytes)`);
    } catch (err) {
      console.error(`✗ Error downloading student ${s.id}:`, err.message);
    }
  }
  console.log('Done!');
}

run();
