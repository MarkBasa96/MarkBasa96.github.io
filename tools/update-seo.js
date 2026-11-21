// Regenerates the SEO files from data/*.json. No npm needed: node tools/update-seo.js
// Updates: llms.txt (project list), sitemap.xml (lastmod), index.html (<noscript> project list).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, s) => { if (rd(f) !== s) { fs.writeFileSync(path.join(root, f), s); console.log('updated', f); } };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pj = JSON.parse(rd('data/projects.json'));
const live = pj.projects.filter(p => p.visibility === 'public' && p.status === 'live' && p.url);

// llms.txt: replace the "## Live projects" section
let t = rd('llms.txt').replace(/\r\n/g, '\n');
t = t.replace(/## Live projects\n[\s\S]*?\n\n/, '## Live projects\n' + live.map(p => `- [${p.name}](${p.url}): ${p.one_liner}`).join('\n') + '\n\n');
wr('llms.txt', t);

// sitemap lastmod
wr('sitemap.xml', rd('sitemap.xml').replace(/<lastmod>.*?<\/lastmod>/, `<lastmod>${pj.last_updated}</lastmod>`));

// noscript project list
let h = rd('index.html');
h = h.replace(/(<noscript>[\s\S]*?<h2>Live projects<\/h2>\s*<ul>\n)[\s\S]*?(\n\s*<\/ul>)/,
  (m, a, b) => a + live.map(p => `      <li><a href="${p.url}">${esc(p.name)}</a>: ${esc(p.one_liner)}</li>`).join('\n') + b);
wr('index.html', h);
