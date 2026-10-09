import fs from 'fs';
import puppeteer from 'puppeteer';
import { 
  HamsterCharacter001, HamsterCharacter002, HamsterCharacter003,
  HamsterCharacter004, HamsterCharacter005, HamsterCharacter006,
  HamsterCharacter007, HamsterCharacter008, HamsterCharacter010 
} from '../src/components/SquidHamsterCharacters.js';

// We can render SVG directly to string
import React from 'react';
import ReactDOMServer from 'react-dom/server';

const characters = [
  { num: 1, comp: HamsterCharacter001 },
  { num: 2, comp: HamsterCharacter002 },
  { num: 3, comp: HamsterCharacter003 },
  { num: 4, comp: HamsterCharacter004 },
  { num: 5, comp: HamsterCharacter005 },
  { num: 6, comp: HamsterCharacter006 },
  { num: 7, comp: HamsterCharacter007 },
  { num: 8, comp: HamsterCharacter008 },
  { num: 10, comp: HamsterCharacter010 },
];

async function generate() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512 });

  for (const { num, comp } of characters) {
    const svgStr = ReactDOMServer.renderToStaticMarkup(React.createElement(comp, { className: 'w-full h-full' }));
    const padded = String(num).padStart(3, '0');
    const svgPath = `./public/images/student_${padded}.svg`;
    const pngPath = `./public/images/student_${padded}.png`;
    fs.writeFileSync(svgPath, svgStr);

    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:512px;height:512px;">${svgStr}</body></html>`);
    await page.screenshot({ path: pngPath, omitBackground: true });
    console.log(`Generated student_${padded}.png and student_${padded}.svg`);
  }

  await browser.close();
  console.log('All character images generated successfully!');
}

generate().catch(console.error);
