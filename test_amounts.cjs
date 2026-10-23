// Amount fields: Persian words, parsing of every way a price is typed, and which inputs get the live hint. No server.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({Intl,URLSearchParams,Date,Map,Set,JSON,console,structuredClone,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  location:{hash:'#home',protocol:'http:'},localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{},
  document:{addEventListener:()=>{},querySelector:()=>null},window:{addEventListener:()=>{}}});
for(const file of ['catalog.js','shopping.js','reviews.js','seller.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/initialize\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context);

for(const [n,words] of [[0,'صفر'],[7,'هفت'],[15,'پانزده'],[26,'بیست و شش'],[105,'صد و پنج'],[1000,'هزار'],[2500,'دو هزار و پانصد'],
  [26500000,'بیست و شش میلیون و پانصد هزار'],[1001000,'یک میلیون و هزار'],[300000000,'سیصد میلیون'],[1200000000,'یک میلیارد و دویست میلیون'],
  [999999,'نهصد و نود و نه هزار و نهصد و نود و نه']])
  assert.equal(run(`amountWords(${n})`),words,String(n));

for(const [text,n] of [['۲۶٬۵۰۰٬۰۰۰',26500000],['26,500,000',26500000],['۲۶۵۰۰۰۰۰',26500000],['۲۶٫۵ میلیون',26500000],['26.5 میلیون تومان',26500000],
  ['۱٫۲ میلیارد',1200000000],['۸۰۰ هزار',800000],['ارزان',null],['',null],['۲۶ و نیم',null]])
  assert.equal(run(`parseAmount(${JSON.stringify(text)})`),n,text);

assert.ok(run("moneyInput('budget','b','26500000')").includes('value="۲۶٬۵۰۰٬۰۰۰"')&&run("moneyInput('budget','b','26500000')").includes('بیست و شش میلیون و پانصد هزار تومان'),'prefilled money fields show separators and words');
const source=['shopping.js','seller.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
for(const field of ['id="price-check-input"','id="dowry-budget"','name="budget_other"','id="sp-price"','id="pp-']){
  const at=source.indexOf(field),tag=at<0?'':source.slice(source.lastIndexOf('<input',at),source.indexOf('>',at));
  assert.ok(tag.includes('data-amount'),field+' gets the live amount hint');
}
console.log('Amounts: Persian number words, typed price formats, prefilled separators and live hints on every amount field passed.');
