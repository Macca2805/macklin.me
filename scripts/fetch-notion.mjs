#!/usr/bin/env node
// Notion content fetcher - converts Notion blocks to MDX files

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BASE_URL = 'https://api.notion.com/v1';

if (!NOTION_TOKEN) {
  console.error('NOTION_TOKEN env var required');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function notionGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getPage(pageId) {
  return notionGet(`/pages/${pageId}`);
}

async function getBlocks(blockId, cursor = null) {
  let url = `/blocks/${blockId}/children?page_size=100`;
  if (cursor) url += `&start_cursor=${cursor}`;
  return notionGet(url);
}

async function getAllBlocks(blockId) {
  let allBlocks = [];
  let cursor = null;
  do {
    const res = await getBlocks(blockId, cursor);
    allBlocks = allBlocks.concat(res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return allBlocks;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    
    function doRequest(requestUrl) {
      protocol.get(requestUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
          return;
        }
        res.pipe(dest);
        dest.on('finish', () => { dest.close(); resolve(destPath); });
        dest.on('error', reject);
      }).on('error', (e) => {
        dest.close();
        reject(e);
      });
    }
    doRequest(url);
  });
}

function getImageExt(url) {
  try {
    const u = new URL(url);
    const p = u.pathname;
    const match = p.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
    return match ? match[1].toLowerCase() : 'jpg';
  } catch { return 'jpg'; }
}

function richTextToMd(richText) {
  if (!richText || richText.length === 0) return '';
  return richText.map(t => {
    let text = t.plain_text || '';
    if (t.annotations) {
      if (t.annotations.code) text = '`' + text + '`';
      if (t.annotations.bold) text = '**' + text + '**';
      if (t.annotations.italic) text = '_' + text + '_';
      if (t.annotations.strikethrough) text = '~~' + text + '~~';
    }
    if (t.href) text = `[${text}](${t.href})`;
    return text;
  }).join('');
}

const imageFailures = [];
const imageDownloads = [];
const unsupportedBlocks = [];

async function blocksToMd(blocks, imagesDir, pageSlug, depth = 0) {
  let md = '';
  let imageIndex = 0;
  let numberedListCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const type = block.type;
    
    // Reset numbered list counter when not in a numbered list
    if (type !== 'numbered_list_item') numberedListCount = 0;

    switch (type) {
      case 'paragraph': {
        const text = richTextToMd(block.paragraph.rich_text);
        if (text.trim()) md += text + '\n\n';
        else md += '\n';
        break;
      }
      case 'heading_1': {
        md += '# ' + richTextToMd(block.heading_1.rich_text) + '\n\n';
        break;
      }
      case 'heading_2': {
        md += '## ' + richTextToMd(block.heading_2.rich_text) + '\n\n';
        break;
      }
      case 'heading_3': {
        md += '### ' + richTextToMd(block.heading_3.rich_text) + '\n\n';
        break;
      }
      case 'bulleted_list_item': {
        const prefix = '  '.repeat(depth) + '- ';
        md += prefix + richTextToMd(block.bulleted_list_item.rich_text) + '\n';
        if (block.has_children) {
          const children = await getAllBlocks(block.id);
          md += await blocksToMd(children, imagesDir, pageSlug, depth + 1);
        }
        break;
      }
      case 'numbered_list_item': {
        numberedListCount++;
        const prefix = '  '.repeat(depth) + numberedListCount + '. ';
        md += prefix + richTextToMd(block.numbered_list_item.rich_text) + '\n';
        if (block.has_children) {
          const children = await getAllBlocks(block.id);
          md += await blocksToMd(children, imagesDir, pageSlug, depth + 1);
        }
        break;
      }
      case 'code': {
        const lang = block.code.language || '';
        const code = richTextToMd(block.code.rich_text);
        md += '```' + lang + '\n' + code + '\n```\n\n';
        break;
      }
      case 'image': {
        imageIndex++;
        const imgData = block.image;
        const imgUrl = imgData.type === 'external' ? imgData.external.url : imgData.file.url;
        const ext = getImageExt(imgUrl);
        const filename = `${pageSlug}-img-${imageIndex}.${ext}`;
        const destPath = path.join(imagesDir, filename);
        
        let caption = '';
        if (imgData.caption && imgData.caption.length > 0) {
          caption = richTextToMd(imgData.caption);
        }
        
        try {
          await downloadFile(imgUrl, destPath);
          imageDownloads.push(filename);
          md += `![${caption}](/images/${filename})\n\n`;
        } catch(e) {
          imageFailures.push({ filename, url: imgUrl, error: e.message });
          md += `<!-- Image failed to download: ${filename} -->\n\n`;
        }
        break;
      }
      case 'callout': {
        const text = richTextToMd(block.callout.rich_text);
        const emoji = block.callout.icon?.emoji || '💡';
        md += `> ${emoji} ${text}\n\n`;
        break;
      }
      case 'divider': {
        md += '---\n\n';
        break;
      }
      case 'quote': {
        const text = richTextToMd(block.quote.rich_text);
        md += '> ' + text + '\n\n';
        break;
      }
      case 'toggle': {
        const text = richTextToMd(block.toggle.rich_text);
        md += '**' + text + '**\n\n';
        if (block.has_children) {
          const children = await getAllBlocks(block.id);
          md += await blocksToMd(children, imagesDir, pageSlug, depth);
        }
        break;
      }
      case 'table': {
        if (block.has_children) {
          const rows = await getAllBlocks(block.id);
          let tableLines = [];
          rows.forEach((row, ri) => {
            const cells = row.table_row?.cells || [];
            const cellTexts = cells.map(c => richTextToMd(c));
            tableLines.push('| ' + cellTexts.join(' | ') + ' |');
            if (ri === 0) {
              tableLines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
            }
          });
          md += tableLines.join('\n') + '\n\n';
        }
        break;
      }
      case 'column_list': {
        if (block.has_children) {
          const columns = await getAllBlocks(block.id);
          for (const col of columns) {
            if (col.has_children) {
              const colBlocks = await getAllBlocks(col.id);
              md += await blocksToMd(colBlocks, imagesDir, pageSlug, depth);
            }
          }
        }
        break;
      }
      case 'embed': {
        const url = block.embed?.url || '';
        md += `[Embedded content](${url})\n\n`;
        break;
      }
      case 'video': {
        const vidData = block.video;
        const vidUrl = vidData?.type === 'external' ? vidData.external.url : (vidData?.file?.url || '');
        md += `[Video](${vidUrl})\n\n`;
        break;
      }
      case 'bookmark': {
        const bUrl = block.bookmark?.url || '';
        const caption = richTextToMd(block.bookmark?.caption || []);
        md += `[${caption || bUrl}](${bUrl})\n\n`;
        break;
      }
      case 'link_preview': {
        const lUrl = block.link_preview?.url || '';
        md += `[${lUrl}](${lUrl})\n\n`;
        break;
      }
      default: {
        unsupportedBlocks.push(type);
        md += `<!-- Unsupported block type: ${type} -->\n\n`;
      }
    }
  }
  return md;
}

async function processPage(pageId, slug, outputDir, imagesDir, type = 'post') {
  console.log(`\nProcessing: ${slug} (${pageId})`);
  
  const page = await getPage(pageId);
  const blocks = await getAllBlocks(pageId);
  
  // Get title
  const titleProp = page.properties?.title || page.properties?.Name;
  let title = '';
  if (titleProp?.title) {
    title = titleProp.title.map(t => t.plain_text).join('');
  }
  
  // Get date
  const createdDate = page.created_time ? page.created_time.split('T')[0] : '';
  const lastEditedDate = page.last_edited_time ? page.last_edited_time.split('T')[0] : '';
  const date = createdDate || lastEditedDate;
  
  // Get cover image
  let heroPath = '';
  if (page.cover) {
    const coverUrl = page.cover.type === 'external' ? page.cover.external.url : page.cover.file.url;
    const ext = getImageExt(coverUrl);
    const heroFilename = `${slug}-hero.${ext}`;
    const heroDest = path.join(imagesDir, heroFilename);
    try {
      await downloadFile(coverUrl, heroDest);
      heroPath = `/images/${heroFilename}`;
      imageDownloads.push(heroFilename);
      console.log(`  ✓ Hero image: ${heroFilename}`);
    } catch(e) {
      imageFailures.push({ filename: heroFilename, url: coverUrl, error: e.message });
      console.log(`  ✗ Hero image failed: ${e.message}`);
    }
  }
  
  // Convert blocks to markdown
  const bodyMd = await blocksToMd(blocks, imagesDir, slug);
  
  // Get description (first paragraph)
  let description = '';
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const text = richTextToMd(block.paragraph.rich_text);
      if (text.trim()) {
        description = text.trim().substring(0, 200).replace(/"/g, '\\"');
        break;
      }
    }
  }
  
  // Build frontmatter
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: "${slug}"`,
    `date: "${date}"`,
    heroPath ? `hero: "${heroPath}"` : '',
    `description: "${description}"`,
    `type: "${type}"`,
    '---',
  ].filter(l => l !== '').join('\n');
  
  const content = frontmatter + '\n\n' + bodyMd;
  
  const filename = `${slug}.mdx`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, content);
  console.log(`  ✓ Written: ${outputPath}`);
  
  return { title, slug, date, heroPath, description };
}

// Main
const projectDir = '/home/node/.openclaw/workspace/macklin-site';
const postsDir = path.join(projectDir, 'src/content/posts');
const talksDir = path.join(projectDir, 'src/content/talks');
const imagesDir = path.join(projectDir, 'public/images');

fs.mkdirSync(postsDir, { recursive: true });
fs.mkdirSync(talksDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const posts = [
  { id: '793c80ac-a658-4720-8f59-bcdb2326c23e', slug: 'classes-in-typescript' },
  { id: '4f70a47c-130b-43fc-9b30-25fb8442dc8c', slug: 'everything-i-used-to-build-this-website' },
  { id: '049c6c14-ebb7-4824-ba9c-43e870d938ee', slug: '7-useful-tools-for-monitoring-web-performance-user-experience' },
  { id: '1b7d1269-f591-42e0-9621-76d3709fa0ad', slug: 'share-aws-route-53-subdomains-across-multiple-accounts' },
  { id: '7eaa91e1-8d58-4b5a-9ecb-3a5000d4432d', slug: 'understanding-and-managing-the-node-js-application-lifecycle' },
  { id: '8d9c85ac-c527-49b2-ac57-b51ea5833b8b', slug: 'configure-access-management-amazon-eks-iam-roles-for-service-accounts-cloudformation' },
];

const talks = [
  { id: '6aedcfa1-408b-4b8b-b1c3-c755e67e53e0', slug: 'talk-just-in-time-architecture' },
  { id: 'a55329b4-06d4-4b23-bc3d-da6fbd85224d', slug: 'talk-how-fast-is-your-website-really' },
  { id: '77121a2c-2e33-470c-94b6-7b871a7a89f9', slug: 'web-accessibility-in-practice' },
  { id: '66a11222-ba75-40a4-a0d0-fde465a4b2ea', slug: 'every-good-outage-starts-with-a-queue' },
  { id: 'c2a9541f-71ab-4200-8d72-287cc28c39ff', slug: 'everything-is-a-feature-toggle' },
];

const results = { posts: [], talks: [], imageDownloads: [], imageFailures: [], unsupportedBlocks: [] };

for (const post of posts) {
  try {
    const meta = await processPage(post.id, post.slug, postsDir, imagesDir, 'post');
    results.posts.push(meta);
  } catch(e) {
    console.error(`ERROR processing post ${post.slug}:`, e.message);
  }
}

for (const talk of talks) {
  try {
    const meta = await processPage(talk.id, talk.slug, talksDir, imagesDir, 'talk');
    results.talks.push(meta);
  } catch(e) {
    console.error(`ERROR processing talk ${talk.slug}:`, e.message);
  }
}

results.imageDownloads = imageDownloads;
results.imageFailures = imageFailures;
results.unsupportedBlocks = [...new Set(unsupportedBlocks)];

fs.writeFileSync(
  path.join(projectDir, 'scripts/fetch-results.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n=== DONE ===');
console.log('Posts:', results.posts.map(p => p.title));
console.log('Talks:', results.talks.map(t => t.title));
console.log('Images downloaded:', imageDownloads.length);
console.log('Image failures:', imageFailures.length);
console.log('Unsupported block types:', results.unsupportedBlocks);
