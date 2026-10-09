import fs from 'fs';
import puppeteer from 'puppeteer';

async function convert() {
  try {
    const svgPath = './public/images/student_001.svg';
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 512, height: 512 });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:512px;height:512px;">${svgContent}</body></html>`);
    await page.screenshot({ path: './public/images/student_001.png', omitBackground: true });
    await browser.close();
    console.log('Successfully created ./public/images/student_001.png');
  } catch (err) {
    console.error('Error generating student_001.png:', err);
  }
}

convert();
