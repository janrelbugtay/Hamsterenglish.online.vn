import fs from 'fs';
import https from 'https';
import path from 'path';

const students = [
  { id: 1, driveId: '1u9s1Xu8uza3W8ZpwWX5NqKVPA4F9gBz7' },
  { id: 2, driveId: '1Yww-WssC4zOP56Syalqa6mw-rmImoymq' },
  { id: 3, driveId: '1--gLzDjWZb5o8xyUruCm0CAIgT5yWH9d' },
  { id: 4, driveId: '1rHWCqfAcDeTg4zNZDoCzqQlVG3q-UvJ8' },
  { id: 5, driveId: '1-vu3sEk0FKaC4NIGANnHiw1YnBRz3F9o' },
  { id: 6, driveId: '1UgKip6JWFFoubn64WLXrvoUVXtjXPocX' },
  { id: 7, driveId: '1lW6qzVWDBoVgp8w9AmrtKBTbhB6PrbjA' },
  { id: 8, driveId: '1171GyfDvSgQL98DraWZ-cADZCqfkeVrc' },
  { id: 9, driveId: '1MgOUPx-rLyJqSKcaab8V-pnpSouEUX7P' },
  { id: 10, driveId: '1qav0p4elcuPV6TUIDHTvQitEOPZMeEsa' },
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
  for (const s of students) {
    const url = `https://lh3.googleusercontent.com/d/${s.driveId}`;
    const dest = path.join(targetDir, `drive_student_${s.id}.png`);
    try {
      await downloadImage(url, dest);
      const stat = fs.statSync(dest);
      console.log(`Downloaded Student ${s.id} (${stat.size} bytes) -> ${dest}`);
    } catch (err) {
      console.error(`Error downloading student ${s.id}:`, err);
    }
  }
}

run();
