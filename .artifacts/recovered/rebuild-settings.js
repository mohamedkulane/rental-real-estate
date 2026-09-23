const fs = require('fs');
const path = require('path');
const transcript = process.argv[1];
const outDir = process.argv[2];
const currentPath = 'C:/Users/maxam/real-estate-rental-system/apps/web/src/features/admin/pages/settings-panel.tsx';

const lines = fs.readFileSync(transcript, 'utf8').split(/\n/);
const patches = [];
let lineNo = 0;
for (const line of lines) {
  lineNo++;
  if (!line.trim()) continue;
  let obj;
  try { obj = JSON.parse(line); } catch { continue; }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const part of content) {
    if (part?.type !== 'tool_use') continue;
    const p = (part.input?.path || '').replace(/\\/g, '/');
    if (!p.endsWith('/settings-panel.tsx')) continue;
    if (p.includes('/worktrees/')) continue;
    if (part.name === 'StrReplace') {
      patches.push({
        lineNo,
        old: part.input.old_string || '',
        neu: part.input.new_string || '',
        replaceAll: !!part.input.replace_all,
      });
    }
  }
}

let file = fs.readFileSync(currentPath, 'utf8');
const p1927 = patches.find((p) => p.lineNo === 1927);
if (!p1927) { console.error('no 1927'); process.exit(1); }

// Replace return block: find "  return (" that belongs to SettingsPanel (last major return)
const marker = '\nexport function SettingsPanel';
const fnIdx = file.indexOf(marker);
if (fnIdx < 0) { console.error('no SettingsPanel'); process.exit(1); }
const retIdx = file.indexOf('\n  return (', fnIdx);
if (retIdx < 0) { console.error('no return'); process.exit(1); }

// Inject Sunday return (old at 1927) — this is the clean screenshot layout
file = file.slice(0, retIdx + 1) + p1927.old;
if (!file.trimEnd().endsWith('}')) {
  if (file.trimEnd().endsWith(');')) file = file.trimEnd() + '\n}\n';
}
fs.writeFileSync(path.join(outDir, 'step1.tsx'), file);
console.log('step1', file.length, 'hasLogo', file.includes('logoUrl'));

// Apply patches >= 1927
for (const p of patches.filter((x) => x.lineNo >= 1927)) {
  const idx = file.indexOf(p.old);
  if (idx < 0) {
    console.log('FAIL', p.lineNo, p.old.length, p.neu.length, 'probe', file.includes(p.old.slice(0, 60)));
    continue;
  }
  file = file.slice(0, idx) + p.neu + file.slice(idx + p.old.length);
  console.log('OK', p.lineNo);
}

// Also slim SETTINGS_SECTIONS to company/security/notifications if still fat
if ((file.match(/key: '/g) || []).length > 5) {
  const slim = `export type SettingsSectionKey =
  | 'company'
  | 'security'
  | 'notifications';

export const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'company',
    label: 'Organization & Branding',
    description: 'Company identity, logo, colors, and reporting defaults.',
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Change your password and protect your account.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Viewing schedules and operational alerts.',
  },
];`;
  const typeStart = file.indexOf('export type SettingsSectionKey');
  const typeEnd = file.indexOf('export function isSettingsSectionKey');
  if (typeStart >= 0 && typeEnd > typeStart) {
    file = file.slice(0, typeStart) + slim + '\n\n' + file.slice(typeEnd);
    console.log('slimmed sections');
  }
}

// Ensure CompanySettings has logoMetadata
if (!file.includes('logoMetadata?:')) {
  file = file.replace(
    /export type CompanySettings = \{[\s\S]*?active\?: boolean;\n\};/,
    (m) => m.replace('active?: boolean;', 'active?: boolean;\n  logoMetadata?: {\n    url?: string | null;\n    primaryColor?: string | null;\n    accentColor?: string | null;\n  } | null;')
  );
  console.log('added logoMetadata type');
}

fs.writeFileSync(path.join(outDir, 'settings-RECONSTRUCTED.tsx'), file);
console.log('final', file.length);
console.log('logoUrl', file.includes('logoUrl'));
console.log('Organization', file.includes('Organization'));
console.log('custom branding not available', file.includes('not available in this release'));
