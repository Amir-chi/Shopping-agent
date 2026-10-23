// The icon registry is data in catalog.js: [tone, line] pairs rendered as self-contained duotone SVG.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('catalog.js', 'utf8');
const context = vm.createContext({});
const start = source.indexOf('const ring =');
const end = source.indexOf('const themes=');
assert.ok(start > 0 && end > start, 'one centralized icon registry');
vm.runInContext(source.slice(start, end), context);
const aliases = {arrow:'next', chevron:'chev', close:'x', route:'nav', mobile:'phoneDev'};
for (const [name, original] of Object.entries(aliases)) {
  assert.equal(vm.runInContext(`icons.${name} === iconSet.${original}`, context), true, name + ' aliases ' + original);
}
const names = vm.runInContext('Object.keys(icons)', context);
assert.notEqual(vm.runInContext('icons.outfit', context), vm.runInContext('icons.shirt', context), 'outfit builder is distinct from clothing');
assert.notEqual(vm.runInContext('icons.beauty', context), vm.runInContext('icons.sparkle', context), 'cosmetics is distinct from the AI assistant');
const outfitEntry = source.slice(source.indexOf('function fashionOutfitEntry('), source.indexOf('function cityNotice('));
assert.ok(outfitEntry.includes("icon('outfit'"), 'fashion outfit entry uses its dedicated glyph');
assert.equal(vm.runInContext('Object.isFrozen(icons) && Object.isFrozen(iconSet)', context), true);
let toned = 0;
for (const name of names) {
  const html = vm.runInContext('icon(' + JSON.stringify(name) + ')', context);
  for (const attribute of ['viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"',
    'stroke-width="1.6"', 'stroke-linecap="round"', 'stroke-linejoin="round"',
    'aria-hidden="true"', 'focusable="false"']) assert.ok(html.includes(attribute), name + ': ' + attribute);
  assert.ok(!/undefined|NaN|<script|onload=|https?:/.test(html), name + ' is a self-contained SVG');
  const inner = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</svg>'));
  assert.ok(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/.test(inner), name + ' has a real glyph');
  if (html.includes('od-tone')) {
    toned++;
    assert.ok(html.includes('<g class="od-tone" fill="currentColor" stroke="none">'), name + ' tone is a fill-only layer');
  }
}
assert.ok(toned >= 60, 'most glyphs carry the soft tinted body');
for (const name of ['constructor', '__proto__', '<img src=x>', 'not-an-icon']) {
  assert.equal(vm.runInContext('icon(' + JSON.stringify(name) + ')', context), vm.runInContext('icon("info")', context));
}
assert.ok(vm.runInContext('icon("home", 24)', context).includes('--od-icon-size:24px'));
assert.ok(!vm.runInContext('icon("home", "bad")', context).includes('style='));
for (const file of ['catalog.js', 'shopping.js', 'reviews.js']) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/\bicon\(\s*['"]([a-zA-Z0-9]+)['"]/g)) {
    assert.ok(names.includes(match[1]), file + ' references a registered icon: ' + match[1]);
  }
}
const taxonomy = fs.readFileSync('catalog/taxonomy.py', 'utf8');
const groups = [...taxonomy.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)];
assert.equal(groups.find(group => group[1] === 'fashion')[3], 'shirt', 'fashion retains its clothing glyph');
assert.equal(groups.find(group => group[1] === 'beauty')[3], 'beauty', 'all beauty department entries use the dedicated cosmetics glyph');
assert.equal(groups.length, 17, 'all current department icons checked');
for (const group of groups) assert.ok(names.includes(group[3]), group[1] + ' has its own department glyph');
const heading = source.slice(source.indexOf('function heading('), source.indexOf('function empty('));
assert.ok(heading.includes("icon('back')"), 'RTL back uses the reference right arrow');
const rail = source.slice(source.indexOf('function rail(r)'), source.indexOf('function departmentGrid'));
assert.ok(rail.includes("icon('back')") && rail.includes("icon('next')"), 'rail directions are explicit');
const css = fs.readFileSync('ui.css', 'utf8');
assert.ok(css.includes('details[open]>summary>.od-icon:last-child{transform:rotate(-90deg)}'), 'left chevron expands down');
assert.ok(css.includes('.od-tone{opacity:'), 'tone layer is styled');
assert.ok(!/\.rail-next \.od-icon\{transform:scaleX/.test(css), 'no double mirror on next arrow');
console.log(`Icons: ${names.length} registered names, ${toned} duotone glyphs, 17 departments and RTL/accessibility checks passed.`);
