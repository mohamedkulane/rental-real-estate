const fs = require('fs');
const path = require('path');
const transcript = process.argv[1];
const outDir = process.argv[2];
const lines = fs.readFileSync(transcript, 'utf8').split(/\n/);
let lineNo = 0;
const hits = [];
for (const line of lines) {
  lineNo++;
  if (!line.includes('settings-panel')) continue;
  if (!line.includes('SETTINGS_SECTIONS') && !line.includes('Organization')) continue;
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const part of content) {
    if (part?.type !== 'tool_use') continue;
    if (!['Write','StrReplace'].includes(part.name)) continue;
    const p = part.input?.path || '';
    if (!p.includes('settings-panel')) continue;
    const ns = part.input?.new_string || part.input?.contents || '';
    if (ns.includes('Organization') || ns.includes('SETTINGS_SECTIONS')) {
      const name = `settings-org-${lineNo}-${part.name}.txt`;
      fs.writeFileSync(path.join(outDir, name), ns);
      hits.push({ lineNo, name: part.name, len: ns.length, hasOrg: ns.includes('Organization'), hasLogo: ns.includes('logoUrl') });
    }
  }
}
console.log(JSON.stringify(hits, null, 2));
