#!/usr/bin/env node
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
};

async function notionGet(p) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.notion.com/v1' + p);
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    function doRequest(reqUrl) {
      const proto = reqUrl.startsWith('https') ? https : http;
      proto.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) { doRequest(res.headers.location); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.pipe(dest);
        dest.on('finish', () => { dest.close(); resolve(); });
        dest.on('error', reject);
      }).on('error', e => { dest.close(); reject(e); });
    }
    doRequest(url);
  });
}

function getExt(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
    return m ? m[1].toLowerCase() : 'png';
  } catch { return 'png'; }
}

const imagesDir = '/home/node/.openclaw/workspace/macklin-site/public/images';
fs.mkdirSync(imagesDir, { recursive: true });

// Fetch homepage blocks
const page = await notionGet('/blocks/421baa07-f956-4890-97a0-06d8906063fd/children?page_size=100');
const blocks = page.results;

const homepage = {
  bio: [],
  certifications: [],
  experience: [],
  volunteering: [],
};

let section = 'bio';
let imageIdx = 0;

async function downloadImage(url, name) {
  const ext = getExt(url);
  const filename = `${name}.${ext}`;
  const destPath = path.join(imagesDir, filename);
  try {
    await downloadFile(url, destPath);
    console.log(`✓ ${filename}`);
    return `/images/${filename}`;
  } catch(e) {
    console.log(`✗ ${filename}: ${e.message}`);
    return null;
  }
}

for (const block of blocks) {
  const t = block.type;
  
  if (t === 'heading_2') {
    const text = block.heading_2.rich_text.map(r => r.plain_text).join('').toLowerCase();
    if (text.includes('writing')) section = 'writing';
    else if (text.includes('talk')) section = 'talks';
    else if (text.includes('cert')) section = 'certifications';
    else if (text.includes('experience')) section = 'experience';
    else if (text.includes('volunteer')) section = 'volunteering';
    continue;
  }
  
  if (section === 'bio' && t === 'paragraph') {
    const text = block.paragraph.rich_text.map(r => r.plain_text).join('');
    if (text.trim()) homepage.bio.push(text);
  }
  
  if (section === 'experience' && t === 'image') {
    imageIdx++;
    const url = block.image.external?.url || block.image.file?.url;
    const imgPath = await downloadImage(url, `exp-logo-${imageIdx}`);
    homepage.experience.push({ logo: imgPath, role: null });
  }
  
  if (section === 'experience' && t === 'paragraph') {
    const text = block.paragraph.rich_text.map(r => r.plain_text).join('');
    if (text.trim() && homepage.experience.length > 0) {
      const last = homepage.experience[homepage.experience.length - 1];
      if (!last.role) last.role = text;
    }
  }
  
  if ((section === 'certifications') && t === 'column_list') {
    // fetch columns
    const cols = await notionGet(`/blocks/${block.id}/children`);
    for (const col of cols.results) {
      if (col.type !== 'column') continue;
      const colBlocks = await notionGet(`/blocks/${col.id}/children`);
      let certImg = null, certName = null;
      for (const cb of colBlocks.results) {
        if (cb.type === 'image') {
          const url = cb.image.external?.url || cb.image.file?.url;
          imageIdx++;
          certImg = await downloadImage(url, `cert-${imageIdx}`);
        }
        if (cb.type === 'paragraph') {
          const text = cb.paragraph.rich_text.map(r => r.plain_text).join('');
          if (text.trim() && !certName) certName = text.split('\n')[0];
        }
      }
      if (certImg || certName) homepage.certifications.push({ image: certImg, name: certName });
    }
  }
  
  if (section === 'volunteering' && t === 'column_list') {
    const cols = await notionGet(`/blocks/${block.id}/children`);
    for (const col of cols.results) {
      if (col.type !== 'column') continue;
      const colBlocks = await notionGet(`/blocks/${col.id}/children`);
      let volImg = null, volName = null;
      for (const cb of colBlocks.results) {
        if (cb.type === 'image') {
          const url = cb.image.external?.url || cb.image.file?.url;
          imageIdx++;
          volImg = await downloadImage(url, `vol-${imageIdx}`);
        }
        if (cb.type === 'paragraph') {
          const text = cb.paragraph.rich_text.map(r => r.plain_text).join('');
          if (text.trim() && !volName) volName = text;
        }
      }
      if (volImg || volName) homepage.volunteering.push({ image: volImg, name: volName });
    }
  }
}

fs.writeFileSync('/home/node/.openclaw/workspace/macklin-site/scripts/homepage-data.json', JSON.stringify(homepage, null, 2));
console.log('\nHomepage data:', JSON.stringify(homepage, null, 2));
