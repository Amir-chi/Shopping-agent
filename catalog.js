'use strict';
// Original layout and tokens live in styles.css. Commercial data comes only from /api.
const $ = (q, root = document) => root.querySelector(q);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa = value => new Intl.NumberFormat('fa-IR-u-nu-arabext').format(value);
const localNumbers = value => String(value??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const money = value => value == null ? 'قیمت معتبر ثبت نشده' : fa(value) + ' تومان';
// Persian keyboards type ۰-۹; type="number" silently drops them, so money fields are text and normalized here.
const digits = value => String(value ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
const moneyWords = n => n >= 1e9 ? fa(Math.round(n / 1e8) / 10) + ' میلیارد تومان' : n >= 1e6 ? fa(Math.round(n / 1e5) / 10) + ' میلیون تومان' : fa(n) + ' تومان';
// Exact Persian words for an amount, so «۲۶۵۰۰۰۰۰» also reads as «بیست و شش میلیون و پانصد هزار».
const amountWords = n => {
  const ones=['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه'],teens=['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
  const tens=['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'],hundreds=['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'],scales=['','هزار','میلیون','میلیارد','هزار میلیارد'];
  const small=x=>[hundreds[Math.floor(x/100)],x%100>=10&&x%100<20?teens[x%100-10]:[tens[Math.floor(x%100/10)],ones[x%10]].filter(Boolean).join(' و ')].filter(Boolean).join(' و ');
  if(!n)return 'صفر';
  const parts=[];
  for(let i=0;n>0;i++,n=Math.floor(n/1000)){const g=n%1000;if(g)parts.unshift(g===1&&i===1?'هزار':(small(g)+' '+scales[i]).trim());}
  return parts.join(' و ');
};
// The amount a shopper means by «۲۶٬۵۰۰٬۰۰۰», «26500000» or «۲۶٫۵ میلیون»; null for anything else.
const parseAmount = value => {
  const v=String(value??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫/]/g,'.').trim();
  const m=v.match(/^(\d{1,3}(?:[,،٬]\d{3})+|\d+(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?\s*(?:تومان|تومن)?$/);
  return m?Math.round(Number(m[1].replace(/[,،٬]/g,''))*({'میلیارد':1e9,'میلیون':1e6,'هزار':1e3}[m[2]]||1)):null;
};
function moneyInput(name, id, value, placeholder = 'بدون محدودیت', min = 1000, max = 1e10) {
  const n = Number(digits(value));
  return `<input id="${id}" name="${name}" type="text" inputmode="numeric" autocomplete="off" data-money data-min="${min}" data-max="${max}" aria-describedby="${id}-hint" value="${n ? fa(n) : ''}" placeholder="${esc(placeholder)}"><span class="money-hint" id="${id}-hint" aria-live="polite">${n ? amountWords(n) + ' تومان' : ''}</span>`;
}
// Soft duotone set on a 24px grid: each entry is [tone, line]. The tone is a tinted body drawn under a
// rounded 1.6px line; plain strings are path data, strings starting with '<' are SVG markup.
const ring = '<circle cx="12" cy="12" r="9"/>';
const iconSet = Object.freeze({
  home: ['M4.5 10 12 4.2 19.5 10v9a1.6 1.6 0 0 1-1.6 1.6H6.1A1.6 1.6 0 0 1 4.5 19z', 'M3.5 10.8 12 4.2l8.5 6.6M5.5 9.5v9.5a1.6 1.6 0 0 0 1.6 1.6h9.8a1.6 1.6 0 0 0 1.6-1.6V9.5M10 20.6v-4.6a2 2 0 0 1 4 0v4.6'],
  search: ['<circle cx="11" cy="11" r="6.5"/>', '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.9-3.9"/>'],
  plan: ['<rect x="5" y="4.5" width="14" height="16.5" rx="3"/>', '<rect x="5" y="4.5" width="14" height="16.5" rx="3"/><path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5M9 13l2.2 2.2 4-4.4"/>'],
  bookmark: ['M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.1a.6.6 0 0 1-.95.5L12 17l-5.55 3.6a.6.6 0 0 1-.95-.5V5A1.5 1.5 0 0 1 7 3.5z', 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.1a.6.6 0 0 1-.95.5L12 17l-5.55 3.6a.6.6 0 0 1-.95-.5V5A1.5 1.5 0 0 1 7 3.5z'],
  mic: ['<rect x="9" y="3" width="6" height="11" rx="3"/>', '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9.5 21h5"/>'],
  back: ['', 'M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5'],
  next: ['', 'M19 12H5.5M11 6.5 5.5 12l5.5 5.5'],
  chev: ['', 'm14.5 6.5-5.5 5.5 5.5 5.5'],
  check: ['', 'm5 12.5 4.5 4.5L19 7.5'],
  checkCircle: [ring, ring + '<path d="m8.3 12.4 2.6 2.6 4.8-5.2"/>'],
  xCircle: [ring, ring + '<path d="m9.2 9.2 5.6 5.6m0-5.6-5.6 5.6"/>'],
  x: ['', 'm6.5 6.5 11 11m0-11-11 11'],
  minus: [ring, ring + '<path d="M8.5 12h7"/>'],
  clock: [ring, ring + '<path d="M12 7.5V12l3 1.8"/>'],
  alert: ['M10.3 4.6 3 17.2a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z', 'M10.3 4.6 3 17.2a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0zM12 9.5v4M12 16.8h.01'],
  phone: ['M6.2 3.8h2.4a1 1 0 0 1 .94.66l1.1 3.1a1 1 0 0 1-.3 1.1L8.6 10a11.5 11.5 0 0 0 5.4 5.4l1.34-1.74a1 1 0 0 1 1.1-.3l3.1 1.1a1 1 0 0 1 .66.94v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 6a2 2 0 0 1 2-2.2z', 'M6.2 3.8h2.4a1 1 0 0 1 .94.66l1.1 3.1a1 1 0 0 1-.3 1.1L8.6 10a11.5 11.5 0 0 0 5.4 5.4l1.34-1.74a1 1 0 0 1 1.1-.3l3.1 1.1a1 1 0 0 1 .66.94v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 6a2 2 0 0 1 2-2.2z'],
  phoneOff: ['M6.2 3.8h2.4a1 1 0 0 1 .94.66l1.1 3.1a1 1 0 0 1-.3 1.1L8.6 10a11.5 11.5 0 0 0 5.4 5.4l1.34-1.74a1 1 0 0 1 1.1-.3l3.1 1.1a1 1 0 0 1 .66.94v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 6a2 2 0 0 1 2-2.2z', 'M6.2 3.8h2.4a1 1 0 0 1 .94.66l1.1 3.1a1 1 0 0 1-.3 1.1L8.6 10a11.5 11.5 0 0 0 5.4 5.4l1.34-1.74a1 1 0 0 1 1.1-.3l3.1 1.1a1 1 0 0 1 .66.94v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 6a2 2 0 0 1 2-2.2zM15.5 3.5l5 5m0-5-5 5'],
  nav: ['M4.1 10.5 19.3 4.3a.3.3 0 0 1 .4.4L13.5 19.9a.4.4 0 0 1-.76-.05L11 13l-6.85-1.74a.4.4 0 0 1-.05-.76z', 'M4.1 10.5 19.3 4.3a.3.3 0 0 1 .4.4L13.5 19.9a.4.4 0 0 1-.76-.05L11 13l-6.85-1.74a.4.4 0 0 1-.05-.76z'],
  pin: ['M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z', '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'],
  map: ['M9 4.5 3.8 6.3a1 1 0 0 0-.8 1v11.4a.8.8 0 0 0 1.05.76L9 17.8l6 2 5.2-1.8a1 1 0 0 0 .8-1V5.6a.8.8 0 0 0-1.05-.76L15 6.5z', 'M9 4.5 3.8 6.3a1 1 0 0 0-.8 1v11.4a.8.8 0 0 0 1.05.76L9 17.8l6 2 5.2-1.8a1 1 0 0 0 .8-1V5.6a.8.8 0 0 0-1.05-.76L15 6.5zM9 4.5v13.3M15 6.5v13.3'],
  list: ['<rect x="3" y="4.5" width="3.5" height="3" rx="1.5"/><rect x="3" y="10.5" width="3.5" height="3" rx="1.5"/><rect x="3" y="16.5" width="3.5" height="3" rx="1.5"/>', 'M9.5 6h10M9.5 12h10M9.5 18h10M4.8 6h.01M4.8 12h.01M4.8 18h.01'],
  store: ['M4.5 10.5h15V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19z', 'M3.2 9.2 5 4.8a1.5 1.5 0 0 1 1.4-1h11.2a1.5 1.5 0 0 1 1.4 1l1.8 4.4a2.6 2.6 0 0 1-4.7 1.9 2.6 2.6 0 0 1-4.1 0 2.6 2.6 0 0 1-4.1 0 2.6 2.6 0 0 1-4.7-1.9zM4.5 11.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-7.5M10 20.5v-4a2 2 0 0 1 4 0v4'],
  walk: ['<circle cx="13" cy="4.5" r="1.8"/>', '<circle cx="13" cy="4.5" r="1.8"/><path d="m9.5 21 2.2-6 2.3 2v4M7 12.5l2.2-4 3.8-1 2 3 3 1M11.7 15l1-6.5"/>'],
  car: ['M5 12.2 6.8 7.4a1.5 1.5 0 0 1 1.4-.9h7.6a1.5 1.5 0 0 1 1.4.9l1.8 4.8V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z', '<path d="M5 12.2 6.8 7.4a1.5 1.5 0 0 1 1.4-.9h7.6a1.5 1.5 0 0 1 1.4.9l1.8 4.8V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM5 12.2h14M7.5 17v2M16.5 17v2"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/>'],
  card: ['<rect x="3" y="5" width="18" height="14" rx="2.5"/>', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.8h18M7 15h4"/>'],
  info: [ring, ring + '<path d="M12 11v5M12 8h.01"/>'],
  copy: ['<rect x="8" y="8" width="12" height="12" rx="2.5"/>', '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'],
  message: ['M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-8l-5.7 4.1a.5.5 0 0 1-.8-.4V7A2.5 2.5 0 0 1 6 4.5z', 'M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-8l-5.7 4.1a.5.5 0 0 1-.8-.4V7A2.5 2.5 0 0 1 6 4.5z'],
  help: [ring, ring + '<path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>'],
  refresh: ['', 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5V9H15'],
  wifiOff: ['', 'm3.5 3.5 17 17M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.5-2.6M19 13a10 10 0 0 0-2.4-1.7M2.5 9.5a15 15 0 0 1 4.4-2.7M12 20h.01'],
  compare: ['<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/>', '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/>'],
  plus: ['', 'M12 5.5v13M5.5 12h13'],
  edit: ['M4 20l.8-3.9L15.6 5.3a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L7.9 19.2z', 'M4 20l.8-3.9L15.6 5.3a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L7.9 19.2zM13.8 7.1l3.1 3.1'],
  shield: ['M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6z', 'M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6zM9 12l2.1 2.1 4-4.2'],
  box: ['M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z', 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9'],
  building: ['<rect x="5" y="3" width="14" height="18" rx="2"/>', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2m-5 6v-2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21"/>'],
  layers: ['M12 3.5 3 8l9 4.5L21 8z', 'M12 3.5 3 8l9 4.5L21 8zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5'],
  target: ['<circle cx="12" cy="12" r="7"/>', '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5"/>'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  camera: ['M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.6-2.2a1.5 1.5 0 0 1 1.2-.6h3.4a1.5 1.5 0 0 1 1.2.6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z', '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.6-2.2a1.5 1.5 0 0 1 1.2-.6h3.4a1.5 1.5 0 0 1 1.2.6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><circle cx="12" cy="13.2" r="3.4"/>'],
  battery: ['<rect x="3" y="7" width="16" height="10" rx="2.5"/>', '<rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21.5 10.5v3M6.5 10v4M9.5 10v4"/>'],
  gamepad: ['<rect x="2.5" y="7" width="19" height="11" rx="5.5"/>', '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/>'],
  briefcase: ['<rect x="3" y="7" width="18" height="13" rx="2.5"/>', '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>'],
  phoneDev: ['<rect x="6" y="2.5" width="12" height="19" rx="3"/>', '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/>'],
  drop: ['M12 3.2s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z', 'M12 3.2s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z'],
  chat: ['M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-8l-5.7 4.1a.5.5 0 0 1-.8-.4V7A2.5 2.5 0 0 1 6 4.5z', 'M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-8l-5.7 4.1a.5.5 0 0 1-.8-.4V7A2.5 2.5 0 0 1 6 4.5zM8 9h8M8 12.2h5'],
  award: ['<circle cx="12" cy="9" r="6"/>', '<circle cx="12" cy="9" r="6"/><path d="m8.6 13.9-1.4 6.6 4.8-2.8 4.8 2.8-1.4-6.6"/>'],
  trash: ['M6 7.5h12l-.9 11.6a1.5 1.5 0 0 1-1.5 1.4H8.4a1.5 1.5 0 0 1-1.5-1.4z', 'M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6 7.5l.9 11.6a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 7.5M10 11v5.5m4-5.5v5.5'],
  send: ['M20.6 3.4 3.8 10a.5.5 0 0 0 0 .93l6.6 2.6 2.6 6.6a.5.5 0 0 0 .93 0z', 'M20.6 3.4 3.8 10a.5.5 0 0 0 0 .93l6.6 2.6 2.6 6.6a.5.5 0 0 0 .93 0zM10.4 13.6l4.2-4.2'],
  spinner: ['', 'M12 3.5a8.5 8.5 0 1 0 8.5 8.5'],
  dot: ['<circle cx="12" cy="12" r="5"/>', '<circle cx="12" cy="12" r="5"/>'],
  tag: ['M3.5 11.6V5A1.5 1.5 0 0 1 5 3.5h6.6a1.5 1.5 0 0 1 1.06.44l7.9 7.9a1.5 1.5 0 0 1 0 2.12l-6.6 6.6a1.5 1.5 0 0 1-2.12 0l-7.9-7.9a1.5 1.5 0 0 1-.44-1.06z', '<path d="M3.5 11.6V5A1.5 1.5 0 0 1 5 3.5h6.6a1.5 1.5 0 0 1 1.06.44l7.9 7.9a1.5 1.5 0 0 1 0 2.12l-6.6 6.6a1.5 1.5 0 0 1-2.12 0l-7.9-7.9a1.5 1.5 0 0 1-.44-1.06z"/><circle cx="8" cy="8" r="1.4"/>'],
  calendar: ['<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/>', '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4m8-4v4"/>'],
  wallet: ['M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z', 'M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 7.5v-1A2.5 2.5 0 0 1 6.5 4H16v3.5M16 13.8h.01'],
  tune: ['<circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>', '<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'],
  shirt: ['M8.2 3.5 3 6.8a1 1 0 0 0-.3 1.3l2 3.4a1 1 0 0 0 1.4.3L8 10.6V19.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8.9l1.9 1.2a1 1 0 0 0 1.4-.3l2-3.4a1 1 0 0 0-.3-1.3l-5.2-3.3c-.5 3.3-7.1 3.3-7.6 0z', 'M8.2 3.5 3 6.8a1 1 0 0 0-.3 1.3l2 3.4a1 1 0 0 0 1.4.3L8 10.6V19.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8.9l1.9 1.2a1 1 0 0 0 1.4-.3l2-3.4a1 1 0 0 0-.3-1.3l-5.2-3.3c-.5 3.3-7.1 3.3-7.6 0z'],
  outfit: ['M6.2 3.5 2.6 6a.8.8 0 0 0-.2 1.1l1.4 2.1a.8.8 0 0 0 1.1.2L6 8.8V14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8.8l1.1.6a.8.8 0 0 0 1.1-.2l1.4-2.1A.8.8 0 0 0 15.4 6l-3.6-2.5c-.4 2.6-5.2 2.6-5.6 0zM16.5 12h4.8a.7.7 0 0 1 .7.8l-.9 8.6a.7.7 0 0 1-.7.6h-.9a.7.7 0 0 1-.7-.6L18.9 17l-.7 4.4a.7.7 0 0 1-.7.6h-.9a.7.7 0 0 1-.7-.6l-.9-8.6a.7.7 0 0 1 .7-.8z', 'M6.2 3.5 2.6 6a.8.8 0 0 0-.2 1.1l1.4 2.1a.8.8 0 0 0 1.1.2L6 8.8V14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8.8l1.1.6a.8.8 0 0 0 1.1-.2l1.4-2.1A.8.8 0 0 0 15.4 6l-3.6-2.5c-.4 2.6-5.2 2.6-5.6 0zM16.5 12h4.8a.7.7 0 0 1 .7.8l-.9 8.6a.7.7 0 0 1-.7.6h-.9a.7.7 0 0 1-.7-.6L18.9 17l-.7 4.4a.7.7 0 0 1-.7.6h-.9a.7.7 0 0 1-.7-.6l-.9-8.6a.7.7 0 0 1 .7-.8z'],
  beauty: ['<rect x="3" y="12" width="7" height="9" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="2.5"/>', '<rect x="3" y="12" width="7" height="9" rx="1.5"/><path d="M4.5 12V6.6a1 1 0 0 1 .5-.86L8.5 3.6V12M15 8v3m4-3v3"/><rect x="14" y="5" width="6" height="3" rx="1"/><rect x="13" y="11" width="8" height="10" rx="2.5"/><path d="M16 16h2"/>'],
  palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z', '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="11" r=".9"/><circle cx="10" cy="6.6" r=".9"/><circle cx="15" cy="6.6" r=".9"/><circle cx="17.8" cy="10.6" r=".9"/>'],
  laptop: ['<rect x="4" y="4.5" width="16" height="11.5" rx="2"/>', '<rect x="4" y="4.5" width="16" height="11.5" rx="2"/><path d="M2.5 19.5h19M10 16v1.5m4-1.5v1.5"/>'],
  appliance: ['<rect x="5" y="3" width="14" height="18" rx="2.5"/>', '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M5 8h14M8 5.5h.01M11 5.5h.01"/><circle cx="12" cy="14" r="4"/><path d="M8.5 14.5c1.8-1.4 5.2 1.4 7 0"/>'],
  sofa: ['M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z', 'M4.5 11V8.5a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5V11M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM4.5 18v2m15-2v2'],
  gem: ['M7 4h10l4 5.5L12 20 3 9.5z', 'M7 4h10l4 5.5L12 20 3 9.5zM3 9.5h18M9.5 4 8 9.5l4 10.5 4-10.5L14.5 4'],
  sparkle: ['M11 3.5 12.9 9l5.6 2-5.6 2-1.9 5.5L9.1 13l-5.6-2 5.6-2z', 'M11 3.5 12.9 9l5.6 2-5.6 2-1.9 5.5L9.1 13l-5.6-2 5.6-2zM18.5 3v4m-2-2h4'],
  bulb: ['M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z', 'M9 18.2h6m-5 2.8h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'],
  plug: ['M6 7h12v4a6 6 0 0 1-12 0z', 'M9 2.5V7m6-4.5V7M6 7h12v4a6 6 0 0 1-12 0zm6 10v4.5'],
  tool: ['M14.5 6.5a5 5 0 0 0-6.3 6.3l-4.7 4.7a2.1 2.1 0 0 0 3 3l4.7-4.7a5 5 0 0 0 6.3-6.3L14 13l-3-3z', 'M14.5 6.5a5 5 0 0 0-6.3 6.3l-4.7 4.7a2.1 2.1 0 0 0 3 3l4.7-4.7a5 5 0 0 0 6.3-6.3L14 13l-3-3z'],
  heart: ['M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z', 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z'],
  ball: [ring, ring + '<path d="m12 7 4.8 3.5-1.8 5.6H9l-1.8-5.6zM12 3v4m4.8 3.5 3.8-1.2M15 16.1l2.3 3.2M9 16.1l-2.3 3.2m.5-8.8L3.4 9.3"/>'],
  toy: ['<circle cx="12" cy="11" r="6"/>', '<circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><circle cx="12" cy="11" r="6"/><path d="M10 10h.01M14 10h.01M11 13.2h2M8.5 17l-1.8 3.5M15.5 17l1.8 3.5M8 21h8"/>'],
  book: ['M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-1.5H4zm16 0h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-1.5h6z', 'M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-1.5H4zm16 0h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-1.5h6z'],
  basket: ['M3.5 9h17l-1.8 10a1.5 1.5 0 0 1-1.5 1.2H6.8a1.5 1.5 0 0 1-1.5-1.2z', 'M3 9h18M3.5 9l1.8 10a1.5 1.5 0 0 0 1.5 1.2h10.4a1.5 1.5 0 0 0 1.5-1.2L20.5 9M8 9l3-5.5M16 9l-3-5.5M9 13v3.5m6-3.5v3.5'],
  grid: ['<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>', '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'],
  headset: ['<rect x="3" y="13.5" width="4" height="6.5" rx="1.8"/><rect x="17" y="13.5" width="4" height="6.5" rx="1.8"/>', '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4" height="6.5" rx="1.8"/><rect x="17" y="13.5" width="4" height="6.5" rx="1.8"/><path d="M19 20a4 4 0 0 1-4 2h-2"/>'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 1.5a.6.6 0 0 1-.4 1H4.9a.6.6 0 0 1-.4-1z', 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 1.5a.6.6 0 0 1-.4 1H4.9a.6.6 0 0 1-.4-1zM10 21a2 2 0 0 0 4 0'],
  bag: ['M5.5 8h13a.5.5 0 0 1 .5.55l-1 11.1a1.5 1.5 0 0 1-1.5 1.35h-9a1.5 1.5 0 0 1-1.5-1.35l-1-11.1A.5.5 0 0 1 5.5 8z', 'M5.5 8h13a.5.5 0 0 1 .5.55l-1 11.1a1.5 1.5 0 0 1-1.5 1.35h-9a1.5 1.5 0 0 1-1.5-1.35l-1-11.1A.5.5 0 0 1 5.5 8zM9 8V6.5a3 3 0 0 1 6 0V8'],
});
// Older names stay as aliases so existing calls keep working.
const icons = Object.freeze({...iconSet, arrow: iconSet.next, chevron: iconSet.chev, close: iconSet.x, route: iconSet.nav, mobile: iconSet.phoneDev});
function icon(name, size) {
  const key = Object.hasOwn(icons, name) ? name : 'info';
  const [tone, line] = icons[key];
  const markup = s => s[0] === '<' ? s : `<path d="${s}"/>`;
  const sizing = Number.isFinite(size) && size > 0 ? ` style="--od-icon-size:${size}px"` : '';
  return `<svg class="od-icon" data-icon="${key}"${sizing} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${tone ? `<g class="od-tone" fill="currentColor" stroke="none">${markup(tone)}</g>` : ''}${markup(line)}</svg>`;
}
const themes={pop:{name:'پاپ',description:'فیروزه‌ای، مرجانی، بنفش الکتریک و زرد؛ پیش‌فرض'},poplilac:{name:'پاپ یاسی',description:'یاسی، هلویی، سبزآبی و لیمویی'},popyellow:{name:'پاپ زرد',description:'زرد آفتابی، صورتی، آبی رویال و نعنایی'},ink:{name:'جوهری',description:'روشن، سرمه‌ای و نارنجی'},teal:{name:'فیروزه',description:'روشن با تأکید فیروزه‌ای'},olive:{name:'زیتونی',description:'روشن با تأکید زیتونی'},brown:{name:'قهوه‌ای',description:'روشن با تأکید قهوه‌ای'},night:{name:'شب',description:'تیره، برای شب و نور کم'}};
// The marketplace look is the default; a saved choice of another palette is kept.
const resolveTheme=value=>Object.hasOwn(themes,value)?value:'pop';
function currentTheme(){return resolveTheme(document.documentElement?.dataset.theme);}
function themeButton(compact=false){return `<button class="${compact?'icon-button':'theme-button'}" data-action="theme" aria-label="تغییر رنگ‌بندی؛ رنگ فعلی: ${themes[currentTheme()].name}" title="تغییر رنگ‌بندی">${icon('palette')}${compact?'':'<span>رنگ‌بندی</span>'}</button>`;}
function themeOptions(){return `<p class="theme-intro">همان سرراه، با رنگ دلخواه تو. تغییر رنگ، انتخاب‌ها و اطلاعات خرید را عوض نمی‌کند.</p><div class="theme-options" role="group" aria-label="رنگ‌بندی‌های سرراه">${Object.entries(themes).map(([id,t])=>`<button class="theme-option" data-action="set-theme" data-id="${id}" aria-pressed="${currentTheme()===id}"><span class="theme-preview" data-palette="${id}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="theme-option-copy"><strong>${t.name}</strong><small>${t.description}</small></span><span class="theme-check">${icon('check')}</span></button>`).join('')}</div><p class="helper" id="theme-feedback" role="status"></p>`;}
function applyTheme(value){
  const id=resolveTheme(value);
  document.documentElement.dataset.theme=id;
  let saved=true;
  try{localStorage.setItem('nazdika-theme-v4',id);}catch{saved=false;}
  const meta=$('meta[name="theme-color"]');if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelectorAll('[data-action="set-theme"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
  document.querySelectorAll('[data-action="theme"]').forEach(b=>b.setAttribute('aria-label','تغییر رنگ‌بندی؛ رنگ فعلی: '+themes[id].name));
  const feedback=$('#theme-feedback');if(feedback)feedback.textContent='رنگ‌بندی '+themes[id].name+' انتخاب شد.'+(saved?'':' ذخیره‌سازی مرورگر در دسترس نیست؛ انتخاب تا پایان این صفحه فعال است.');
  return id;
}
const btn = (label, action, cls = 'btn-secondary', attrs = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (text, type = '', symbol = 'info') => `<span class="badge ${type}">${icon(symbol)}${esc(text)}</span>`;
const note = (text = 'قیمت و موجودی را پیش از رفتن بپرس.') => `<div class="sample-note">${icon('info')}<p>${esc(text)}</p></div>`;
let state;
try { state = JSON.parse(localStorage.getItem('nazdika-catalog-v1') || '{}'); } catch { state = {}; }
state = {query:'', answers:{}, compare:[], saved:[], filters:[], sort:'nearest', neighborhood:'', intent:'guided', city:'tehran', group:'', ...state};
state.compare=[...new Set((Array.isArray(state.compare)?state.compare:[]).filter(id=>typeof id==='string'&&/^product_[a-zA-Z0-9]+$/.test(id)))].slice(0,3);
// Precise location stays in memory; only an explicitly selected neighborhood is saved.
let origin = null, boot, list = [], total = 0, parsedQuery = {}, selectedShop = null, storeList = [], shopProducts = [], shopTotal = 0;
let homeData = null, recentRail = null, shopFacets = [], shopProductCount = 0, shopFilters = {shop:'', category:'', sort:'', q:''}, contactShop = null;
let homeWarning='', storePage=0, storePageKey='';
function homeWarningPanel(){return `<div class="warning home-warning" role="status"><p>${esc(homeWarning)}</p>${btn('دریافت دوباره','retry-home','btn-secondary')}</div>`;}
function priceSpread(p){
  if(!(p.high>p.price&&p.price>0))return '';
  return p.high/p.price>3?`<details class="price-spread"><summary>اختلاف زیاد بین پیشنهادها</summary><p>از ${money(p.price)} تا ${money(p.high)}؛ مدل، گارانتی و شرایط هر پیشنهاد را بررسی کن.</p></details>`:`<span class="price-range">تا ${money(p.high)}</span>`;
}
function storePagination(items){
  const key=[state.product,state.sort,[...state.filters].sort().join(','),items.map(s=>s.id).join(',')].join('|');
  if(storePageKey!==key){storePageKey=key;storePage=0;}
  const pages=Math.max(1,Math.ceil(items.length/6));storePage=Math.min(storePage,pages-1);
  return {items:items.slice(storePage*6,(storePage+1)*6),pages,controls:pages>1?`<nav class="store-pagination" aria-label="صفحه‌های فروشگاه‌ها">${btn('قبلی','store-page','btn-secondary',`data-page="${storePage-1}" ${storePage===0?'disabled':''}`)}<span role="status">صفحهٔ ${fa(storePage+1)} از ${fa(pages)}</span>${btn('بعدی','store-page','btn-secondary',`data-page="${storePage+1}" ${storePage===pages-1?'disabled':''}`)}</nav>`:''};
}
function readTarget(target) {
  const [name, query] = target.split('?');
  const params = new URLSearchParams(query || '');
  // A bare 'category' (sort or filter change) keeps the current subcategory; only a link with params picks a new one.
  if (name === 'category' && query) { state.group = params.get('g') || state.group; state.category = params.get('c') || ''; }
  const pid = params.get('id'), sid = params.get('shop');
  if (pid && /^product_[a-zA-Z0-9]+$/.test(pid)) { state.product=pid;state.shop=null;state.directoryDetail=false; }
  if (sid && /^shop_[a-zA-Z0-9]+$/.test(sid)) { state.shop=sid;state.directoryDetail=name==='store'&&!pid; }
  const seed=params.get('seed');
  if(seed&&/^product_[a-zA-Z0-9]+$/.test(seed))state.outfitSeed=seed;
  return name || 'home';
}
let busy = true, failure = '', route = readTarget(location.hash.slice(1)), generation = 0, toastTimer;
let directory = [], directoryTotal = 0, directoryQuery = '', directoryArea = '', directoryInstallment = false;
const productCache = new Map(), shopCache = new Map();
function persist() { try { localStorage.setItem('nazdika-catalog-v1', JSON.stringify(state)); } catch { toast('ذخیره‌سازی مرورگر در دسترس نیست.'); } }
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 4200); }
const offlineMessage='آفلاین هستی و این بخش هنوز روی این دستگاه ذخیره نشده است.';
async function api(path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null));
  const retry=['/api/bootstrap','/api/home'].includes(path);
  for(let attempt=0;attempt<(retry?2:1);attempt++){
    try{
      // The service worker never stores responses for a precise device location.
      const response=await fetch(path+(query.size?'?'+query:''),origin?.precise&&query.has('lat')?{headers:{'X-Nazdika-Location':'precise'}}:undefined);
      if(!response.ok){const error=new Error(!navigator.onLine?offlineMessage:response.status===404?'این مورد پیدا نشد.':response.status===429?'درخواست‌ها زیاد شده؛ کمی بعد تلاش کن.':'دریافت اطلاعات انجام نشد. دوباره تلاش کن.');error.status=response.status;throw error;}
      return await response.json();
    }catch(error){if(!error.status&&!navigator.onLine)error.message=offlineMessage;if(!retry||attempt||error.status&&error.status<500)throw error;}
  }
}
function cacheProducts(items) { items.forEach(p => productCache.set(p.id, p)); return items; }
function comparisonItems(){return state.compare.map(id=>productCache.get(id)).filter(Boolean);}
function comparable(items=comparisonItems()){return items.length>=2&&items.length===state.compare.length&&items.every(p=>p.category&&p.category===items[0].category);}
function compareSelection(items=comparisonItems()){
  return `<div class="tray-chips" style="--selection-count:${state.compare.length||1}">${state.compare.map(id=>{const p=items.find(p=>p.id===id);return `<button class="tray-chip" data-action="compare-toggle" data-id="${esc(id)}" aria-label="حذف ${esc(p?.name||'این کالا')} از مقایسه" title="${esc(p?.name||'انتخاب قبلی')}"><span>${esc(p?.name||'انتخاب قبلی')}</span>${icon('close')}</button>`;}).join('')}</div>`;
}
function compareManager(){
  const items=comparisonItems(),mixed=new Set(items.map(p=>p.category)).size>1;
  return `<section class="panel compare-manager"><h2>${mixed?'انتخاب‌های قبلی از دسته‌های متفاوت‌اند':'انتخاب‌های مقایسه'}</h2><p>${mixed?'برای مقایسه، یک دسته را نگه دار یا کالاهای نامرتبط را حذف کن. هیچ کالایی خودکار اضافه نمی‌شود.':'دو یا سه کالای هم‌دسته را خودت انتخاب کن. با دکمهٔ حذف می‌توانی هر انتخاب را برداری.'}</p><div class="compare-selection-list">${items.map(p=>`<article>${image(p)}<div><a href="#product?id=${p.id}">${esc(p.name)}</a><span class="small muted">${esc(p.category)}</span></div>${btn(icon('close')+'حذف','compare-toggle','btn-secondary',`data-id="${p.id}" aria-label="حذف ${esc(p.name)} از مقایسه"`)}</article>`).join('')}</div><div class="compare-tools">${mixed?[...new Set(items.map(p=>p.category))].map(category=>btn('فقط '+esc(category),'compare-keep','btn-secondary',`data-category="${esc(category)}"`)).join(''):items.length?btn('انتخاب کالای هم‌دسته','compare-browse','btn-secondary'):btn('انتخاب از دسته‌ها','categories','btn-secondary')}${state.compare.length?btn('پاک‌کردن انتخاب‌ها','compare-clear','btn-quiet'):''}</div></section>`;
}
async function restoreComparison(){
  await Promise.all(state.compare.map(async id=>{try{await getProduct(id);}catch(error){if(error.status===404)state.compare=state.compare.filter(x=>x!==id);}}));
  persist();
}
let comparisonChanging=false;
async function toggleComparison(el){
  if(comparisonChanging)return;
  comparisonChanging=true;
  try{
    const id=el.dataset.id;
    if(state.compare.includes(id))state.compare=state.compare.filter(x=>x!==id);
    else{
      const next=productCache.get(id)||await getProduct(id);
      await restoreComparison();
      if(comparisonItems().length!==state.compare.length)throw new Error('انتخاب‌های قبلی دریافت نشدند؛ دوباره تلاش کن یا فهرست مقایسه را پاک کن.');
      if(state.compare.length&&comparisonItems().some(p=>p.category!==next.category)){
        showDialog('مقایسهٔ جدید برای '+next.category,`<p>انتخاب‌های قبلی مربوط به دستهٔ دیگری هستند. برای مقایسهٔ «${esc(next.name)}»، یک فهرست جدید از «${esc(next.category)}» شروع کن.</p><p class="small muted">شروع مقایسهٔ جدید فقط انتخاب‌های مقایسهٔ قبلی را پاک می‌کند؛ ذخیره‌شده‌ها و برنامهٔ خرید تغییری نمی‌کنند.</p><div class="compare-tools">${btn('شروع مقایسهٔ جدید','compare-replace','btn-primary',`data-id="${id}"`)}${btn('دیدن و اصلاح انتخاب‌های قبلی','compare-manage','btn-secondary')}${btn('انصراف','close-dialog','btn-quiet')}</div>`);
        return;
      }
      if(state.compare.length>=3){showDialog('سه کالا انتخاب شده',compareManager());return;}
      state.compare.push(id);
    }
    persist();
    if($('#dialog')?.open)closeDialog();
    if(route==='compare')await go('compare',{keepScroll:true});else render();
    toast(state.compare.includes(id)?'به مقایسه اضافه شد؛ انتخاب‌ها را در نوار پایین ببین.':'از مقایسه حذف شد.');
  }finally{comparisonChanging=false;}
}
async function getProduct(id) {
  if (!id) return null;
  productCache.set(id, await api('/api/products/' + encodeURIComponent(id)));
  return productCache.get(id);
}
function product() { return productCache.get(state.product); }
function locParams() { return origin ? {lat:origin.lat, lon:origin.lon} : {}; }
function verificationFor(s = selectedShop) { return s && state.verifications?.[state.product + ':' + s.id]; }
function verified(s) { const v = verificationFor(s); return v?.status === 'confirmed' && Date.now() - Date.parse(v.time) < 86400000; }
function originLabel() { return origin?.label || 'محدوده‌ای انتخاب نشده'; }
function priceAge(date) {
  if (!date || date === 'null' || !Number.isFinite(Date.parse(date))) return 'زمان تغییر قیمت ثبت نشده';
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000));
  return days === 0 ? 'آخرین تغییر قیمت: امروز' : 'آخرین تغییر قیمت: ' + fa(days) + ' روز پیش';
}
function dateText(value) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fa-IR', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(value)) : 'ثبت نشده'; }
function image(p, cls = 'product-image') {
  const url = (p.images || []).find(u => /^https:\/\//.test(u)) || '/assets/placeholder.svg';
  return `<div class="${cls}"><img class="od-media" src="${esc(url)}" width="360" height="300" alt="${esc(p.name)}" loading="lazy"></div>`;
}
document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && !e.target.src.endsWith('/assets/placeholder.svg')) e.target.src = '/assets/placeholder.svg'; }, true);
// Only the toolbar stays sticky; the subtitle scrolls away so small screens keep their content area.
function heading(title, sub = '', extra = '') { return `<header class="page-heading"><div class="page-toolbar">${btn(icon('back')+'<span>بازگشت</span>','back','back-button','aria-label="بازگشت"')}<h1>${esc(title)}</h1></div></header>${sub||extra?`<div class="page-intro">${sub?'<p>'+esc(sub)+'</p>':''}${extra?'<div class="heading-actions">'+extra+'</div>':''}</div>`:''}`; }
function empty(title, sub, action = 'home', label = 'شروع جست‌وجو', symbol = 'search') { return `<div class="empty-state">${icon(symbol)}<h2>${esc(title)}</h2><p>${esc(sub)}</p>${btn(label,action,'btn-primary')}</div>`; }
function skeleton() {
  const card = '<div class="skeleton-card"><span class="sk sk-media"></span><span class="sk-lines"><span class="sk"></span><span class="sk sk-short"></span><span class="sk sk-price"></span></span></div>';
  if (route==='assistant' && state.query) return `<div class="page loading-page assistant-loading" role="status"><div class="ai-thinking-card"><span class="ai-orb">${icon('sparkle')}</span><h1>دستیار در حال بررسی…</h1><p>«${esc(state.query)}»</p><ol>${['فهمیدن دسته، بودجه و اولویت‌ها','فیلتر کالاها در پایگاه داده','مقایسه نامزدها و انتخاب بهترین‌ها'].map((t,i)=>`<li style="--i:${i}">${t}</li>`).join('')}</ol></div></div>`;
  return `<div class="page loading-page" role="status"><span class="sr-only">در حال دریافت اطلاعات…</span>${route==='home'?'':'<div class="sk sk-toolbar"></div>'}<div class="sk sk-title"></div><div class="skeleton-grid">${card.repeat(route==='home'?2:4)}</div></div>`;
}
function cityLabel() { return state.city==='isfahan' ? 'اصفهان · به‌زودی' : origin?.label || 'تهران'; }
function nav() {
  const links = [['home','home','خانه'],['categories','grid','دسته‌ها'],['ask','sparkle','دستیار'],['saved','list','فهرست من'],['messages','chat','پیام‌ها']];
  // The phone bar follows the redesign: three tabs; categories and the assistant are reached from home.
  const tabs = links.filter(([id])=>['home','saved','messages'].includes(id));
  const active = ({category:'categories',outfits:'categories',discovery:'ask',assistant:'ask',plan:'saved',route:'saved',shared:'saved',compare:'saved'})[route] || route;
  // Five general mobile tabs; outfit building belongs to the fashion department.
  const make = mobile => (mobile?tabs:links).map(([id,i,text])=>`<a href="#${id}" ${active===id?'class="active" aria-current="page"':''}>${mobile ? '<span class="nav-icon-wrap">'+icon(i)+'</span>' : ''}<span>${text}</span></a>`).join('');
  $('#site-header').innerHTML = `<div class="header-inner"><a class="brand" href="#home" aria-label="سرراه، خانه"><svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect width="48" height="48" rx="14" fill="var(--primary)"/><path d="M13 34c4-13 15-7 20-20" stroke="var(--surface)" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="14" r="4" fill="var(--accent)"/></svg><span class="brand-name">سرراه</span></a><form class="header-search" id="header-search" role="search"><label class="sr-only" for="header-q">جست‌وجوی کالا</label>${icon('search')}<input id="header-q" name="q" type="search" maxlength="200" autocomplete="off" placeholder="جست‌وجوی کالا، برند یا مدل" value="${route==='recommendations'?esc(state.query):''}"></form><div class="header-end"><button class="location-button od-touch" data-action="location" aria-label="شهر و محدوده: ${esc(cityLabel())}">${icon('pin')}<span>${esc(cityLabel())}</span></button><button class="avatar-button" data-action="settings" aria-label="تنظیمات نمایش">${icon('palette')}</button><button class="avatar-button" data-action="privacy" aria-label="حریم خصوصی">${icon('shield')}</button></div></div><nav class="desktop-nav" aria-label="پیمایش اصلی"><div class="desktop-nav-inner">${make(false)}</div></nav>`;
  $('#bottom-nav').innerHTML = make(true);
  $('#bottom-nav a[href="#messages"]')?.classList.toggle('has-unread',typeof unreadMessages==='function'&&unreadMessages()>0);
}
function searchForm() { return `<form id="search-form" class="search-panel"><label class="search-label" for="shopping-query">${state.intent==='known'&&route!=='discovery'?'اسم یا مدل کالا':'چه چیزی لازم داری و برای چه کاری؟'} <span class="required-label">ضروری</span></label><div class="search-input-row">${icon('search')}<textarea id="shopping-query" class="search-input" rows="2" name="query" placeholder="${state.intent==='known'&&route!=='discovery'?'مثلاً گلکسی A55 یا یخچال ساید بای ساید':'مثلاً گوشی با دوربین خوب تا ۳۰ میلیون'}" required maxlength="200" autocomplete="off">${esc(state.query)}</textarea></div>${route==='discovery'?`<div class="catalog-fields"><label for="guide-budget">حداکثر بودجه (اختیاری، تومان)</label>${moneyInput('max_price','guide-budget',state.answers.max_price,'مثلاً ۳۰٬۰۰۰٬۰۰۰')}<label class="check-field"><input name="installment" type="checkbox" ${state.answers.installment?'checked':''}> فقط اقساط حضوری ثبت‌شده</label></div>`:''}<button class="btn btn-primary search-submit" type="submit"><span>${route==='discovery'||state.intent!=='known'?'از دستیار بپرس':'جست‌وجوی محصول'}</span>${icon('arrow')}</button><p class="search-help"><span class="key-hint"><bdi>Enter</bdi> برای جست‌وجو؛ <bdi>Shift+Enter</bdi> برای خط جدید.</span></p></form>`; }
function querySuggestions() {
  const recent = (state.recent || []).slice(0, 4);
  const chips = (items, cls = '') => items.map(q=>`<button class="chip ${cls}" data-action="suggest" data-query="${esc(q)}">${cls?icon('clock'):''}${esc(q)}</button>`).join('');
  return `${recent.length?`<div class="suggestion-group" role="group" aria-labelledby="recent-label"><div class="suggestion-heading"><span id="recent-label">جست‌وجوهای اخیر</span>${btn('پاک کردن','clear-recent','section-link')}</div><div class="suggestions">${chips(recent,'recent-chip')}</div></div>`:''}<div class="suggestion-group" role="group" aria-labelledby="suggest-label"><div class="suggestion-heading"><span id="suggest-label">پیشنهاد برای شروع</span></div><div class="suggestions">${chips(['گوشی تا ۳۰ میلیون','کفش پیاده‌روی','لپ‌تاپ دانشجویی'])}</div></div>`;
}
function railCard(p) {
  return `<a class="rail-card" href="#product?id=${p.id}">${image(p,'rail-image')}<span class="rail-name">${esc(p.name)}</span><span class="rail-price">${p.price==null?'<small>قیمت ثبت نشده</small>':'<small>از</small> '+fa(p.price)+' <small>تومان</small>'}</span><span class="rail-meta">${icon('store')}${fa(p.stores)} فروشگاه</span></a>`;
}
// Digikala-style horizontal rail: native scroll-snap plus buttons for mouse and keyboard users.
function rail(r) {
  return `<section class="rail" aria-labelledby="rail-${esc(r.id)}"><div class="rail-head"><div><h2 id="rail-${esc(r.id)}">${esc(r.title)}</h2>${r.subtitle||r.count?`<p>${esc(r.subtitle||fa(r.count)+' کالا')}</p>`:''}</div>${r.link?`<a class="section-link" href="${r.link}">مشاهده همه ${icon('arrow')}</a>`:''}</div><div class="rail-viewport"><button class="rail-nav rail-prev" data-action="rail-scroll" data-dir="1" aria-label="کالاهای قبلی">${icon('back')}</button><div class="rail-track" role="list">${r.items.map((p,i)=>`<div role="listitem" style="--i:${Math.min(i,8)}">${railCard(p)}${saveMini(p)}</div>`).join('')}</div><button class="rail-nav rail-next" data-action="rail-scroll" data-dir="-1" aria-label="کالاهای بعدی">${icon('next')}</button></div></section>`;
}
function departmentGrid(groups, limit = groups.length) {
  return `<div class="dept-grid">${groups.slice(0,limit).map((g,i)=>`<a class="dept" style="--i:${i}" href="#category?g=${g.id}"><span class="dept-icon">${icon(g.icon)}</span><span class="dept-name">${esc(g.name)}</span></a>`).join('')}${limit<groups.length?`<a class="dept" style="--i:${limit}" href="#categories"><span class="dept-icon">${icon('grid')}</span><span class="dept-name">همه دسته‌ها</span></a>`:''}</div>`;
}
function fashionOutfitEntry(compact=false){
  return `<a class="fashion-outfit-entry ${compact?'compact':''}" href="#outfits">${icon('outfit',28)}<span><strong>ست‌ساز</strong>${compact?'': '<small>از استایل و رنگ‌های دلخواهت بگو؛ یک ست متناسب با سلیقه‌ات پیدا کن.</small>'}</span>${icon('next')}</a>`;
}
function cityNotice() {
  return state.city==='isfahan'?`<div class="city-notice">${icon('pin')}<div><strong>سرراه به‌زودی در اصفهان</strong><p>فعلاً فروشگاه‌ها و قیمت‌های تهران را می‌بینی.</p></div>${btn('بیشتر','location','btn-text')}</div>`:'';
}
// Home, as design C of the redesign: one bold line and one search box (photo search on its button), four
// colour tiles for the helpers, a strip with honest numbers, the last product you looked at, and departments.
// Every home search goes to «همین الان» (askNow in shopping.js): where to get it, here and now.
function homeSearch(){
  return `<form id="home-search" class="home-search" role="search"><label class="sr-only" for="shopping-query">جست‌وجوی کالا یا سؤال</label>${icon('search')}<input id="shopping-query" name="query" type="search" maxlength="200" required autocomplete="off" enterkeyhint="search" data-typing placeholder="دنبال چی می‌گردی؟"><a class="home-search-photo" href="#photo" aria-label="جست‌وجو با عکس">${icon('camera')}</a><button class="sr-only" type="submit">جست‌وجو</button></form>`;
}
function home() {
  const groups=homeData?.groups||[], counts=boot?.counts||{}, last=state.lastSeen;
  const tiles=[['#outfits','outfit','ست لباس','tone-yellow'],['#dowry','box','جهیزیه','tone-pink'],['#gift','heart','هدیه','tone-blue'],['#ask','sparkle','همین الان کجا؟','tone-white']];
  const strip=[Number.isFinite(counts.shops)?fa(counts.shops)+' فروشگاه در تهران':'',  'قیمت‌ها ثبت‌شده‌اند، قبل رفتن بپرس', Number.isFinite(counts.products)?fa(Math.round(counts.products/1000))+' هزار کالا':''].filter(Boolean);
  return `<div class="page home-page">${cityNotice()}${homeWarning?homeWarningPanel():''}<section class="home-intro" aria-labelledby="home-title"><h1 class="home-title" id="home-title">ارزون‌ترین، <mark>سر راهت.</mark></h1>${homeSearch()}</section><section class="home-block" aria-labelledby="help-title"><div class="block-head"><h2 id="help-title" class="sr-only">کمکم کن</h2><a href="#helpers">همه ابزارها</a></div><div class="help-tiles">${tiles.map(([h,i,t,tone])=>`<a class="help-tile ${tone}" href="${h}"><span class="help-icon">${icon(i)}</span><strong>${t}</strong></a>`).join('')}</div></section><a class="home-strip" href="#shops">${strip.map(t=>`<span>${t}</span>`).join('<span class="strip-star" aria-hidden="true">✦</span>')}</a>${last?.id?`<a class="continue-card" href="#product?id=${esc(last.id)}"><span class="continue-image">${image(last,'continue-img')}</span><span class="continue-copy"><small class="continue-tag">آخرین کالایی که دیدی</small><strong>${esc(last.name)}</strong>${last.stores?`<span>${fa(last.stores)} فروشگاه</span>`:''}</span>${last.price?`<span class="price-sticker small"><strong>${fa(Math.round(last.price/1e5)/10)} م</strong></span>`:''}</a>`:''}${groups.length?`<section class="home-block" aria-labelledby="dept-title"><div class="block-head"><h2 id="dept-title">دسته‌ها</h2><a href="#categories">همه ${fa(groups.length)} دسته</a></div><div class="dept-card">${groups.slice(0,7).map(g=>`<a href="#category?g=${g.id}">${icon(g.icon)}<span>${esc(g.name)}</span></a>`).join('')}<a href="#categories">${icon('grid')}<span>بقیه</span></a></div></section>`:''}</div>`;
}
// One save toggle wherever a product appears, so its saved state is always visible.
function saveMini(p){const on=state.saved.includes(p.id);return `<button class="save-mini ${on?'saved':''}" data-action="save-product" data-id="${p.id}" aria-pressed="${on}" aria-label="${on?'حذف از':'افزودن به'} ذخیره‌شده‌ها، ${esc(p.name)}">${icon('bookmark')}</button>`;}
// Compare buttons show on any product until something is picked, then only on products of the same category.
function compareOpen(p){const first=comparisonItems()[0];return !first||first.category===p.category;}
function gridCard(p) {
  const selected=state.compare.includes(p.id);
  return `<article class="grid-card">${railCard(p)}${saveMini(p)}${compareOpen(p)?`<button class="compare-mini ${selected?'selected':''}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${selected}" aria-label="${selected?'حذف از':'افزودن به'} مقایسه، ${esc(p.name)}">${icon(selected?'check':'compare')}</button>`:''}</article>`;
}
function categoriesPage() {
  const groups=homeData?.groups||[];
  return `<div class="page">${heading('دسته‌بندی کالاها',fa(groups.length)+' دسته اصلی')}<div class="dept-list">${groups.map(g=>`<section class="panel dept-panel"><a class="dept-panel-head" href="#category?g=${g.id}"><span class="dept-icon">${icon(g.icon)}</span><span class="od-field od-fill"><strong>${esc(g.name)}</strong><small>${fa(g.count)} کالا</small></span>${icon('arrow')}</a>${g.id==='fashion'?fashionOutfitEntry(true):''}<details class="department-children"><summary>زیردسته‌های ${esc(g.name)} ${icon('chevron')}</summary><div class="leaf-chips">${g.leaves.slice(0,6).map(l=>`<a class="chip" href="#category?g=${g.id}&c=${encodeURIComponent(l.name)}">${esc(l.name)}</a>`).join('')}</div><a class="section-link" href="#category?g=${g.id}">انتخاب از همهٔ ${fa(g.leaves.length)} زیردسته</a></details></section>`).join('')}</div></div>`;
}
// Same-category products to compare with, fetched once per category and offered in the compare bar.
let compareSuggest={category:'',items:[],loading:''};
function compareSuggestions(){
  const items=comparisonItems(),cat=items[0]?.category;
  if(!cat||state.compare.length>=3||items.some(p=>p.category!==cat))return '';
  if(compareSuggest.category!==cat){loadCompareSuggestions(cat);return '';}
  // Leaves are noisy (a headset filed under consoles), so offer only items priced like the ones being compared.
  const prices=items.map(p=>p.price).filter(Boolean).sort((a,b)=>a-b),mid=prices[prices.length>>1];
  const list=compareSuggest.items.filter(p=>!state.compare.includes(p.id)&&(!mid||p.price==null||(p.price>=mid/3&&p.price<=mid*3))).slice(0,8);
  return list.length?`<div class="compare-suggest"><span class="compare-suggest-title">با این‌ها مقایسه کن</span><div class="compare-suggest-track">${list.map(p=>`<button class="compare-suggest-item" data-action="compare-toggle" data-id="${p.id}" aria-label="افزودن ${esc(p.name)} به مقایسه">${image(p,'compare-suggest-image')}<span class="od-clamp-2">${esc(p.name)}</span><strong>${p.price==null?'':fa(p.price)+' <small>تومان</small>'}</strong></button>`).join('')}</div></div>`:'';
}
async function loadCompareSuggestions(cat){
  if(compareSuggest.loading===cat)return;
  compareSuggest.loading=cat;
  try{
    const data=await api('/api/products',{category:cat,limit:24,sort:'stores',with_images:'1'});
    if(compareSuggest.loading!==cat)return;
    compareSuggest={category:cat,items:cacheProducts(data.items),loading:''};
    const bar=$('.recommendation-bar');if(bar)bar.outerHTML=compareBar();
  }catch{if(compareSuggest.loading===cat)compareSuggest.loading='';}
}
function compareBar() {
  const items=comparisonItems(),ready=comparable(items),mixed=new Set(items.map(p=>p.category)).size>1;
  return state.compare.length?`<section class="action-bar recommendation-bar" aria-label="انتخاب‌های مقایسه"><div class="compare-tray"><strong>${fa(state.compare.length)} کالا برای مقایسه</strong>${btn('ویرایش','compare-manage','btn-quiet')}${btn('پاک‌کردن','compare-clear','btn-quiet')}${compareSelection(items)}</div>${compareSuggestions()}<span class="tray-help">${mixed?'انتخاب‌های قبلی هم‌دسته نیستند':state.compare.length<2?'یک کالای دیگر از «'+esc(items[0]?.category||'همین دسته')+'» انتخاب کن':'فقط کالاهایی که خودت انتخاب کرده‌ای'}</span>${btn((mixed?'اصلاح انتخاب‌ها':'مقایسهٔ انتخاب‌ها')+' '+icon('compare'),mixed?'compare-manage':'compare','btn-primary',!ready&&!mixed?'disabled':'')}</section>`:'';
}
function categoryPage() {
  const g=(homeData?.groups||[]).find(x=>x.id===state.group);
  if(!g)return `<div class="page">${heading('دسته‌بندی')}${empty('این دسته پیدا نشد','از فهرست دسته‌ها انتخاب کن.','categories','همه دسته‌ها','grid')}</div>`;
  const sorts=[['stores','بیشترین فروشگاه'],['price','ارزان‌ترین'],['price_desc','گران‌ترین']];
  return `<div class="page ${state.compare.length?'has-action':''}">${heading(state.category||g.name,state.category?g.name:fa(g.count)+' کالا')}<nav class="breadcrumb" aria-label="مسیر دسته"><a href="#categories">دسته‌ها</a>${icon('chevron')}<a href="#category?g=${g.id}">${esc(g.name)}</a>${state.category?icon('chevron')+'<span aria-current="page">'+esc(state.category)+'</span>':''}</nav>${g.id==='fashion'?fashionOutfitEntry():''}<label class="catalog-field leaf-picker">انتخاب زیردسته<select id="leaf-category"><option value="">همهٔ ${esc(g.name)}</option>${g.leaves.map(l=>`<option value="${esc(l.name)}" ${state.category===l.name?'selected':''}>${esc(l.name)} (${fa(l.count)})</option>`).join('')}</select></label><div class="results-context"><span>${fa(total)} نتیجه</span><label class="inline-select">مرتب‌سازی<select id="category-sort">${sorts.map(([v,t])=>`<option value="${v}" ${(state.productSort||'stores')===v?'selected':''}>${t}</option>`).join('')}</select></label></div>${list.length?`<div class="browse-grid">${list.map(gridCard).join('')}</div>${list.length<total?btn('نمایش کالاهای بیشتر','more-products','btn-secondary full load-more'):''}`:empty('کالایی در این دسته نیست','زیردسته دیگری را انتخاب کن.','categories','همه دسته‌ها','grid')}${compareBar()}</div>`;
}
function discovery() {
  return `<div class="page narrow">${heading('بیا انتخاب را ساده کنیم')}<div class="discovery-progress" aria-label="گام اول: نیاز تو؛ سپس انتخاب کالا و فروشگاه"><b>نیاز تو</b><span></span>کالا<span></span>فروشگاه</div>${searchForm()}${''}</div>`;
}
function productCard(p) {
  const features=(p.specs||[]).filter(s=>s.key&&s.value).slice(0,2);
  const selected = state.compare.includes(p.id), saved = state.saved.includes(p.id);
  return `<article class="product-card" id="${p.id}"><div class="product-top"><span class="product-category">${esc(p.category)}</span><button class="icon-button ${saved?'saved':''}" data-action="save-product" data-id="${p.id}" aria-label="${saved?'حذف از':'افزودن به'} ذخیره‌شده‌ها، ${esc(p.name)}" aria-pressed="${saved}">${icon('bookmark')}</button></div><div class="product-lead"><a href="#product?id=${p.id}" aria-label="مشخصات ${esc(p.name)}">${image(p)}</a><div class="product-lead-info"><a class="product-name-link" href="#product?id=${p.id}"><h3 class="product-title">${esc(p.name)}</h3></a>${p.brand?'<p class="product-model">'+esc(p.brand)+'</p>':''}<div class="price-block"><span class="price-label">از قیمت ثبت‌شده</span><strong class="product-price">${p.price==null?money(null):fa(p.price)+' <small>تومان</small>'}</strong>${priceSpread(p)}</div></div></div><div class="product-content">${features.length?'<ul class="product-facts">'+features.map(f=>'<li>'+icon('check')+'<span>'+esc(f.key)+': '+esc(f.value)+'</span></li>').join('')+'</ul>':''}<div class="product-availability">${icon('store')} ${fa(p.stores)} فروشگاه <span>· موجودی نیازمند تماس</span></div><div class="product-actions">${btn(icon('store')+' دیدن فروشگاه‌ها','product-stores','btn-secondary full',`data-id="${p.id}"`)}${compareOpen(p)?`<button class="compare-button ${selected?'selected':''}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${selected}"><span class="compare-check">${selected?icon('check'):''}</span>${selected?'در مقایسه':'افزودن به مقایسه'}</button>`:''}</div></div></article>`;
}
function categoryField(id='category-list') {
  return `<label class="catalog-field">دسته‌بندی<input name="category" list="${id}" value="${esc(state.category||'')}" placeholder="نام دسته را تایپ کن" autocomplete="off"><datalist id="${id}">${boot.categories.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}</datalist></label>`;
}
function activeProductFilters() {
  const filters=[['category',state.category],['budget',state.answers.max_price?'تا '+money(state.answers.max_price):''],['installment',state.answers.installment?'اقساط حضوری':'']].filter(([,label])=>label);
  return filters.length?`<div class="active-filters" aria-label="فیلترهای فعال">${filters.map(([id,label])=>`<button class="chip selected" data-action="remove-product-filter" data-id="${id}" aria-label="حذف فیلتر ${esc(label)}">${esc(label)} ${icon('close')}</button>`).join('')}${btn('پاک کردن همه','clear-product-filters','section-link')}</div>`:'';
}
function recommendations() {
  const filterCount=Number(!!state.category)+Number(!!state.answers.max_price)+Number(!!state.answers.installment);
  return `<div class="page ${state.compare.length?'has-action':''}">${heading('انتخاب‌های تو',`${fa(total)} محصول${parsedQuery?.corrected?' برای «'+parsedQuery.corrected+'» (به‌جای «'+state.query+'»)':state.query?' برای «'+state.query+'»':''}`)}<form id="refine-form" class="panel results-search"><div class="result-query"><label class="catalog-field">محصول یا مدل<input name="q" value="${esc(state.query)}" maxlength="200" type="search" placeholder="نام کالا، مدل یا نیازت"></label><button class="btn btn-primary" type="submit">${icon('search')} جست‌وجو</button></div><details class="search-filters"><summary>${icon('tune')}<span>فیلتر و مرتب‌سازی</span>${filterCount?`<span class="filter-counter">${fa(filterCount)} فعال</span>`:'<small>بودجه، دسته و اقساط</small>'}${icon('chevron')}</summary><div class="refine-grid">${categoryField()}<label class="catalog-field">حداکثر قیمت (تومان)${moneyInput('max_price','refine-budget',state.answers.max_price)}</label><label class="catalog-field">مرتب‌سازی<select name="sort"><option value="stores" ${state.productSort==='stores'?'selected':''}>بیشترین فروشگاه</option><option value="price" ${state.productSort==='price'?'selected':''}>قیمت کمتر</option><option value="price_desc" ${state.productSort==='price_desc'?'selected':''}>قیمت بیشتر</option></select></label><label class="check-field"><input type="checkbox" name="installment" ${state.answers.installment?'checked':''}> اقساط حضوری ثبت‌شده</label></div><button class="btn btn-primary" type="submit">اعمال فیلترها</button></details></form>${activeProductFilters()}<div class="results-context"><span>${fa(total)} نتیجه</span><span>قیمت ثبت‌شده؛ موجودی نیازمند تماس</span></div>${parsedQuery.relaxed&&total?note('همهٔ کلمه‌ها پیدا نشد؛ این‌ها نزدیک‌ترین نتیجه‌ها هستند.'):''}${parsedQuery.max_price?badge('بودجه در جست‌وجو: '+money(parsedQuery.max_price)):''}${parsedQuery.installment?badge('اقساط در عبارت جست‌وجو'):''}${list.length?`<div class="product-grid">${list.map(productCard).join('')}</div>${list.length<total?btn('نمایش محصولات بیشتر','more-products','btn-secondary full load-more'):''}`:empty('محصولی با این شرایط پیدا نشد','عبارت کوتاه‌تری بنویس یا بودجه و فیلتر اقساط را تغییر بده.','reset-search','نمایش همه محصولات')}${note()}${compareBar()}</div>`;
}
let compareExpanded = false;
function compare() {
  const items = comparisonItems();
  if (!comparable(items)) return `<div class="page">${heading('مقایسهٔ انتخاب‌های تو','فقط کالاهای هم‌دسته مقایسه می‌شوند.')}${compareManager()}</div>`;
  const keys = [...new Set(items.flatMap(p=>p.specs.map(s=>s.key)))];
  const rows = [['قیمت ثبت‌شده',p=>money(p.price)],['دسته و برند',p=>esc(p.category)+' · '+esc(p.brand || 'ثبت نشده')],['تعداد فروشگاه',p=>fa(p.stores)],...keys.map(k=>[k,p=>esc(p.specs.find(s=>s.key===k)?.value || 'ثبت نشده')])];
  // Identical rows hide by default so the differences are what the shopper reads first; price always stays.
  const differing = rows.filter(([,value],i)=>i===0 || new Set(items.map(value)).size>1), hidden = rows.length-differing.length;
  // One compact table, names once: price first, then specs every product has, then specs some lack; the long tail waits behind a button.
  const missing = ([,value])=>items.some(p=>value(p)==='ثبت نشده');
  const shown = state.compareAll?rows:differing, ordered = [shown[0],...shown.slice(1).filter(r=>!missing(r)),...shown.slice(1).filter(missing)];
  const visible = compareExpanded?ordered:ordered.slice(0,8), more = ordered.length-visible.length;
  return `<div class="page comparison-triple" style="--compare-count:${items.length}">${heading('تفاوت انتخاب‌ها را ببین')}<div class="compare-tools">${btn('افزودن کالای هم‌دسته','compare-browse','btn-secondary',items.length>=3?'disabled':'')}${btn('پاک‌کردن انتخاب‌ها','compare-clear','btn-quiet')}</div><div class="compare-intro">${items.map(p=>`<article class="compare-product">${image(p)}<h2>${esc(p.name)}</h2>${btn(icon('close')+'حذف از مقایسه','compare-toggle','btn-quiet',`data-id="${p.id}"`)}${btn('فروشگاه‌ها','product-stores','btn-primary full',`data-id="${p.id}"`)}</article>`).join('')}</div><!--insight-->${hidden?`<div class="compare-toggle"><span>${state.compareAll?fa(rows.length)+' ویژگی':fa(differing.length)+' تفاوت · '+fa(hidden)+' ویژگی یکسان پنهان است'}</span><button class="chip ${state.compareAll?'':'selected'}" data-action="compare-all" aria-pressed="${!state.compareAll}">${state.compareAll?'':icon('check')}فقط تفاوت‌ها</button></div>`:''}<section class="compare-section"><div class="compare-table" role="table" aria-label="مقایسهٔ مشخصات"><div class="compare-row compare-head" role="row"><span role="columnheader">ویژگی</span>${items.map(p=>`<span role="columnheader">${esc(p.name)}</span>`).join('')}</div>${visible.map(([title,value])=>`<div class="compare-row" role="row"><span role="rowheader">${esc(title)}</span>${items.map(p=>`<span role="cell">${value(p)}</span>`).join('')}</div>`).join('')}</div>${more?btn('نمایش '+fa(more)+' ویژگی دیگر'+icon('chevron'),'compare-more','btn-secondary full'):ordered.length>8?btn('نمایش خلاصه','compare-more','btn-quiet full'):''}</section>${note()}</div>`;
}
function filteredStores() {
  const blocked = s => ['out','closed','no-response'].includes(verificationFor(s)?.status);
  return storeList.filter(s=>(!state.filters.includes('open')||s.opening.open===true)&&(!state.filters.includes('installment')||s.installment)&&(!state.filters.includes('verified')||verified(s)))
    .sort((a,b)=>Number(blocked(a))-Number(blocked(b)) || (state.sort==='cheapest' ? (a.price ?? Infinity)-(b.price ?? Infinity) : (a.distance_km ?? Infinity)-(b.distance_km ?? Infinity)) || (a.price ?? Infinity)-(b.price ?? Infinity) || a.name.localeCompare(b.name,'fa'));
}
// Nearest metro by straight-line distance from an OpenStreetMap station snapshot; walking routes can be longer.
function metroLine(s) { if (!s.metro) return ''; const km=s.metro.distance_km; return `<p class="store-metro">${icon('walk')}<span>نزدیک‌ترین مترو: ${esc(s.metro.name)} · ${km<1?fa(Math.max(50,Math.round(km*20)*50))+' متر':fa(km)+' کیلومتر'} فاصلهٔ مستقیم</span></p>`; }
function storeCard(s, directoryMode = false) {
  const v = verificationFor(s), status = verified(s)?'طبق گزارش شما موجود است':v?({'out':'طبق گزارش شما ناموجود','closed':'طبق گزارش شما بسته','no-response':'طبق گزارش شما پاسخ نداد','unverified':'هنوز تأیید نشده'}[v.status] || 'موجودی تأیید نشده'):'موجودی تأیید نشده';
  return `<article class="store-card ${verified(s)?'preferred':''}" id="${s.id}"><div class="store-card-heading"><div class="store-identity"><div class="store-avatar">${icon('store')}</div><div class="od-field"><h2>${esc(s.name)}</h2>${s.name_synthetic?'<span class="small muted">نام تأییدنشده</span>':''}<span class="muted small">${esc(s.area)}</span></div></div>${badge(localNumbers(s.opening.label),'','clock')}</div>${!directoryMode?`<div class="store-key-facts"><div class="od-field"><span class="fact-label">کمترین قیمت ثبت‌شده</span><strong class="store-main-price">${money(s.price)}</strong></div><div class="od-field store-main-distance"><span class="fact-label">فاصله مستقیم</span><strong>${s.distance_km==null?'محدوده را انتخاب کن':fa(s.distance_km)+' کیلومتر'}</strong></div></div><div class="freshness-line">${icon('clock')}<span>${priceAge(s.price_changed_at)}</span></div>`:''}<div class="store-statuses">${!directoryMode?badge(status,verified(s)?'good':'warn','shield'):''}${badge(s.installment?'اقساط حضوری ثبت‌شده':s.payments.length?'اعتباری؛ نوع پذیرش نیازمند سؤال':'اقساط ثبت نشده','','card')}</div><p class="store-address">${icon('pin')}<span>${esc(localNumbers(s.address))}</span></p>${metroLine(s)}${directoryMode&&s.product_count?`<div class="store-stock">${(s.samples||[]).length?`<div class="store-samples" aria-hidden="true">${s.samples.map(x=>`<img src="${esc(/^https:\/\//.test(x.image||'')?x.image:'/assets/placeholder.svg')}" alt="" width="52" height="52" loading="lazy">`).join('')}</div>`:''}<span>${fa(s.product_count)} کالا در ویترین</span></div>`:''}<div class="card-actions">${btn('ویترین فروشگاه '+icon('arrow'),directoryMode?'directory-detail':'store-detail','btn-secondary',`data-id="${s.id}"`)}${btn(icon('chat')+'ارتباط','contact','btn-soft',`data-id="${s.id}" aria-label="ارتباط با ${esc(s.name)}"`)}</div></article>`;
}
// One place (a storefront, a plan stop) needs no picker; lists of several get one to switch the map.
function mapPanel(items) {
  if (!items.length) return '';
  const s = items.find(x=>x.id===state.mapShop) || items[0];
  const area = ['curated_guide','dataset_cluster'].includes(s.source);
  const bbox = [s.lon-.012,s.lat-.008,s.lon+.012,s.lat+.008].join(',');
  return `<div class="map-panel live-map"><iframe title="موقعیت ${esc(s.name)} روی نقشه" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${s.lat},${s.lon}" referrerpolicy="no-referrer"></iframe>${items.length>1?`<div class="map-selector"><label for="map-store">${area?'نمایش محدوده روی نقشه':'نمایش فروشگاه روی نقشه'}</label><select id="map-store">${items.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`:''}<p class="map-caption">${area?'مرکز تقریبی محدوده پیشنهادی':'مختصات ثبت‌شده فروشگاه'} · فاصله، مستقیم است و زمان مسیر محاسبه نشده.</p></div>`;
}
function storesPage() {
  const p=product(), items=filteredStores(), page=storePagination(items);
  if(!p)return `<div class="page">${heading('فروشگاه‌ها')}${empty('اول محصولت را انتخاب کن','بعد فروشگاه‌های همان کالا را می‌بینی.')}</div>`;
  return `<div class="page">${heading('فروشگاه‌های این محصول',p.name+' · '+originLabel())}<div class="store-toolbar"><div class="segmented"><button data-action="view" data-value="list" class="${state.view!=='map'?'active':''}">${icon('list')}لیست</button><button data-action="view" data-value="map" class="${state.view==='map'?'active':''}">${icon('map')}نقشه</button></div>${btn(icon('pin')+'محدوده','location','btn-secondary compact')}</div><div class="store-controls"><div class="control-row" role="group" aria-label="مرتب‌سازی"><div class="segmented">${[['nearest','نزدیک‌ترین'],['cheapest','کمترین قیمت ثبت‌شده']].map(([id,label])=>`<button data-action="filter" data-id="${id}" class="${state.sort===id?'active':''}" aria-pressed="${state.sort===id}">${label}</button>`).join('')}</div></div><details><summary>${icon('tune')} فیلتر فروشگاه‌ها ${icon('chevron')}</summary><div class="filters od-cluster">${[['open','باز طبق برنامه'],['installment','اقساط حضوری'],['verified','طبق گزارش من موجود است']].map(([id,label])=>{const on=state.filters.includes(id);return `<button class="chip ${on?'selected':''}" data-action="filter" data-id="${id}" aria-pressed="${on}">${on?icon('check'):''}${label}</button>`;}).join('')}</div></details></div><p class="filter-count" id="store-list-start">${fa(items.length)} فروشگاه مطابق شرایط؛ نمایش ${fa(page.items.length)} مورد در این صفحه</p>${!origin?note('برای دیدن نزدیک‌ترین فروشگاه، محدوده‌ات را انتخاب کن.'):''}<div class="store-layout ${state.view==='map'?'map-mode':''}"><div><div class="store-list">${items.length?page.items.map(s=>storeCard(s)).join(''):empty('فروشگاهی با این شرایط نیست','فیلتر را تغییر بده.','clear-filters','پاک کردن فیلترها')}</div>${page.controls}</div>${state.view==='map'?'<aside>'+mapPanel(items)+'</aside>':''}</div>${note()}</div>`;
}
function safeLink(url, label) { return /^https?:\/\//i.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : ''; }
function phones(s) { shopCache.set(s.id,s); return btn(icon('chat')+'ارتباط با فروشنده','contact','btn-secondary',`data-id="${s.id}"`); }
function hours(s) { return [['sat','شنبه'],['sun','یکشنبه'],['mon','دوشنبه'],['tue','سه‌شنبه'],['wed','چهارشنبه'],['thu','پنجشنبه'],['fri','جمعه']].map(([key,name])=>{const d=s.hours[key];let value='ثبت نشده';if(d?.status==='closed')value='تعطیل';else if(d?.status==='declared')value=d.shifts.filter(x=>x.start_time!==x.end_time).map(x=>x.start_time.slice(0,5)+' تا '+x.end_time.slice(0,5)).join('، ') || 'ساعت مبهم؛ تماس بگیر';return `<div class="hour-row"><span>${name}</span><span>${esc(localNumbers(value))}</span></div>`;}).join(''); }
function offerList(s) { return (s.offers || []).map(o=>`<article class="offer-row"><h3>${esc(o.seller_title)}</h3><strong>${money(o.valid_price)}</strong>${o.valid_price==null&&o.price_toman?'<p class="field-error">قیمت خام اطلاعات ثبت‌شده قابل اتکا نیست و در مقایسه استفاده نمی‌شود: '+esc(o.price_toman)+'</p>':''}<p class="small muted">${priceAge(o.last_price_changed_at)} · ${dateText(o.last_price_changed_at)}</p>${o.description?'<p>'+esc(o.description)+'</p>':''}<p>گارانتی: ${esc(o.warranty || 'ثبت نشده')}</p></article>`).join(''); }
function shopProductCard(p) {
  return `<article class="shop-product"><a class="shop-product-link" href="#product?id=${p.id}&shop=${selectedShop.id}">${image(p)}<span class="shop-product-name">${esc(p.name)}</span></a><strong class="shop-product-price">${p.shop_price==null?'<small>قیمت معتبر ثبت نشده</small>':fa(p.shop_price)+' <small>تومان</small>'}</strong><span class="shop-product-category">${esc(p.category)}</span></article>`;
}
function storeDetail() {
  const s=selectedShop;
  if (!s) return `<div class="page">${heading('ویترین فروشگاه')}${empty('فروشگاه انتخاب نشده','از نتایج یا فهرست فروشگاه‌ها انتخاب کن.','shops','فهرست فروشگاه‌ها','store')}</div>`;
  shopCache.set(s.id,s);
  const alt=storeList.find(x=>x.id!==s.id && x.opening.open!==false && !['out','closed','no-response'].includes(verificationFor(x)?.status));
  const matching=storeList.some(x=>x.id===s.id) && !state.directoryDetail;
  const sorts=[['','الفبایی'],['price','ارزان‌ترین'],['price_desc','گران‌ترین']];
  return `<div class="page ${matching?'has-action':''}">${heading(s.name,s.area)}<section class="panel store-hero"><div class="detail-title"><div class="store-avatar">${icon('store')}</div><div><h2>${esc(s.name)}</h2>${s.name_synthetic?'<span class="small muted">نام تأییدنشده</span>':''}<p class="muted">${esc(s.area)} · ${fa(shopProductCount)} کالا در ویترین</p></div></div>${metroLine(s)}<div class="store-statuses">${badge(localNumbers(s.opening.label),'','clock')}${s.installment?badge('اقساط حضوری؛ شرایط را بپرس','','card'):''}${matching?badge(verified(s)?'طبق گزارش شما موجود':'موجودی امروز نیازمند پرسش','warn','shield'):''}</div><div class="detail-actions">${btn(icon('chat')+'ارتباط با فروشنده','contact','btn-primary',`data-id="${s.id}"`)}${btn(icon('route')+'مسیریابی','directions','btn-secondary')}</div></section>${matching?`<section class="panel matched-offer"><span class="section-kicker">کالایی که دنبالش بودی</span><div class="plan-product">${image(product())}<div><h2>${esc(product()?.name)}</h2><p class="product-price">${money(s.price)}</p><p class="small muted">${priceAge(s.price_changed_at)}</p></div></div><details class="offer-extras"><summary><span>همه پیشنهادهای این فروشنده برای این کالا (${fa(s.offers.length)})</span>${icon('chevron')}</summary>${offerList(s)}</details></section>`:''}<section class="store-products" aria-labelledby="shop-products-title"><div class="section-heading"><div><h2 id="shop-products-title">ویترین فروشگاه</h2><p>${fa(shopTotal)} کالا${shopFilters.category?' در «'+esc(shopFilters.category)+'»':''}</p></div></div><form id="shop-search" class="shop-search" role="search"><label class="sr-only" for="shop-q">جست‌وجو در این فروشگاه</label><input id="shop-q" name="q" type="search" maxlength="100" value="${esc(shopFilters.q)}" placeholder="جست‌وجو در کالاهای این فروشگاه"><button class="btn btn-secondary" type="submit" aria-label="جست‌وجو">${icon('search')}</button></form><div class="shop-tools">${shopFacets.length>1?`<div class="leaf-chips scroll-chips" role="group" aria-label="دسته‌های این فروشگاه"><button class="chip ${shopFilters.category?'':'selected'}" data-action="shop-category" data-value="" aria-pressed="${!shopFilters.category}">همه</button>${shopFacets.slice(0,14).map(f=>`<button class="chip ${shopFilters.category===f.name?'selected':''}" data-action="shop-category" data-value="${esc(f.name)}" aria-pressed="${shopFilters.category===f.name}">${esc(f.name)} <small>${fa(f.count)}</small></button>`).join('')}</div>`:''}<label class="inline-select">مرتب‌سازی<select id="shop-sort">${sorts.map(([v,t])=>`<option value="${v}" ${shopFilters.sort===v?'selected':''}>${t}</option>`).join('')}</select></label></div>${shopProducts.length?`<div class="shop-grid">${shopProducts.map(shopProductCard).join('')}</div>${shopProducts.length<shopTotal?btn('کالاهای بیشتر','more-shop-products','btn-secondary full load-more'):''}`:`<p class="empty-inline">${shopFilters.q||shopFilters.category?'کالایی با این شرایط در این فروشگاه نیست.':'برای این فروشگاه، کالایی در اطلاعات ثبت‌شده ثبت نشده است.'}</p>`}</section><div class="store-detail-grid"><div><section class="panel"><h2 class="detail-section-title">نشانی فروشگاه</h2><p class="real-address">${esc(localNumbers(s.address))}</p>${safeLink(s.website,'وب‌سایت فروشگاه')}</section>${s.payments.length?`<section class="panel"><h2 class="detail-section-title">پرداخت اعتباری</h2>${s.payments.map(p=>`<div class="payment-row">${badge(p.provider_name,p.channel==='in_person'?'good':'warn','card')}<p>${p.channel==='in_person'?'پذیرش حضوری ثبت شده':'نوع پذیرش مشخص نیست؛ حضوری را بپرس'}${p.min_price_toman>0?' · حداقل '+money(p.min_price_toman):''}${p.max_price_toman>0?' · سقف '+money(p.max_price_toman):''}</p></div>`).join('')}</section>`:''}${matching?`<section class="panel"><h2 class="detail-section-title">قبل از حرکت بپرس</h2><p class="quote">${esc(question())}</p>${btn(icon('copy')+'کپی متن سؤال','copy-question','btn-secondary full')}</section>`:''}</div><aside><section class="panel"><h2 class="detail-section-title">ساعات کاری ثبت‌شده</h2><div class="hours">${hours(s)}</div>${s.metro?'<p class="helper">مترو: © OpenStreetMap</p>':''}</section>${mapPanel([s])}${alt&&matching?`<section class="panel"><h2 class="detail-section-title">گزینه جایگزین همین کالا</h2><p>${esc(alt.name)}</p>${btn('ویترین جایگزین','store-detail','btn-secondary full',`data-id="${alt.id}"`)}</section>`:''}</aside></div>${note()}${matching?`<div class="action-bar">${btn('ساخت برنامه خرید','create-plan','btn-secondary')}${btn('ثبت پاسخ فروشنده','verify','btn-primary')}</div>`:''}</div>`;
}
// Dataset phone numbers are synthetic, so the flow is shown end to end without dialing anyone real.
const contactChannels=[['phone','تماس تلفنی','مستقیم با فروشنده صحبت کن'],['chat','واتس‌اپ','پیام آماده درباره همین کالا'],['send','تلگرام','پیام آماده درباره همین کالا'],['headset','پشتیبانی سرراه','ما از فروشنده می‌پرسیم و نتیجه را خبر می‌دهیم']];
function contactSteps(step) { return `<ol class="contact-steps">${['راه ارتباط','پیام آماده','ثبت پاسخ'].map((t,i)=>`<li class="${i<step?'done':i===step?'current':''}" ${i===step?'aria-current="step"':''}><span>${fa(i+1)}</span>${t}</li>`).join('')}</ol>`; }
function contactDialog(s) {
  contactShop=s;
  showDialog('ارتباط با '+s.name,`${contactSteps(0)}<div class="contact-channels">${contactChannels.map(([i,t,d],k)=>`<button class="contact-channel" data-action="contact-channel" data-value="${k}"><span class="tool-icon">${icon(i)}</span><span class="od-field od-fill"><strong>${t}</strong><small>${d}</small></span>${icon('arrow')}</button>`).join('')}</div><p class="demo-note">${icon('info')}<span>تماس مستقیم فعال نیست؛ «استعلام سریع» را بزن.</span></p>`);
}
function contactMessage() { return `سلام، از سرراه پیام می‌دهم. ${product()&&storeList.some(x=>x.id===contactShop?.id)?question():'درباره کالاهای فروشگاه «'+(contactShop?.name||'')+'» سؤال دارم؛ موجودی و قیمت امروز را می‌فرمایید؟'}`; }
function contactChannelStep(k) {
  const [i,t]=contactChannels[k], support=k===3, canVerify=product()&&storeList.some(x=>x.id===contactShop?.id);
  showDialog(t+' · '+contactShop.name,`${contactSteps(1)}<label for="contact-text" class="search-label">${support?'درخواست تو برای پشتیبانی':'پیام آماده برای فروشنده'}</label><textarea id="contact-text" rows="4" maxlength="600">${esc(contactMessage())}</textarea><div class="contact-actions">${btn(icon('copy')+'کپی پیام','copy-contact','btn-secondary')}<button class="btn btn-primary" disabled aria-describedby="contact-demo">${icon(i)}${support?'ارسال به پشتیبانی':'باز کردن '+t}</button></div><p class="demo-note" id="contact-demo">${icon('info')}<span>${support?'ارسال به پشتیبانی هنوز فعال نیست.':'ارسال خودکار از طریق '+t+' در حال حاضر فعال نیست؛ متن آماده را کپی کن.'}</span></p>${canVerify?`<div class="contact-next">${contactSteps(2)}<p>بعد از گرفتن جواب، پاسخ فروشنده را ثبت کن تا در برنامه خریدت بماند.</p>${btn('ثبت پاسخ فروشنده','contact-verify','btn-primary full')}</div>`:''}${btn('راه دیگری انتخاب کن','contact-back','btn-text full')}`);
}
function question() { return `سلام، «${product()?.name || 'این محصول'}» با همین مشخصات موجود است؟ قیمت امروز، گارانتی و ساعت کاری شما چیست؟${state.answers.installment?' خرید اقساطی حضوری هم دارید؟':''}`; }
function verification() {
  if (!selectedShop || !product()) return `<div class="page">${heading('ثبت پاسخ فروشگاه')}${empty('اول یک محصول و فروشگاه انتخاب کن','پاسخ تماس برای همان محصول و همان فروشگاه ثبت می‌شود.')}</div>`;
  return `<div class="page narrow">${heading('ثبت پاسخ فروشگاه',selectedShop.name)}<section class="panel"><p class="quote">${esc(question())}</p><div class="detail-actions">${phones(selectedShop)}</div><p class="helper">تماس خودکار انجام نمی‌شود. پس از تماس، چیزی را که فروشنده گفته اینجا ثبت کن. این گزارش فقط در مرورگر خودت می‌ماند.</p><form id="verification-form" class="catalog-fields"><label for="verification-status">پاسخ فروشگاه</label><select id="verification-status" name="status" required><option value="">انتخاب کن</option><option value="confirmed">موجودی را تأیید کرد</option><option value="out">موجود نبود</option><option value="no-response">پاسخ نداد</option><option value="closed">بسته بود</option><option value="unverified">هنوز تماس نگرفته‌ام</option></select><label for="confirmed-price">قیمت اعلام‌شده (اختیاری، تومان)</label>${moneyInput('price','confirmed-price','','اگر فروشنده گفت',1)}<label for="verification-notes">توضیح پاسخ (اختیاری)</label><textarea id="verification-notes" name="notes" rows="3" maxlength="1000" placeholder="مثلاً رنگ، گارانتی یا ساعت کاری جدید"></textarea><button class="btn btn-primary full" type="submit">ثبت پاسخ</button></form></section></div>`;
}
function planPage() {
  const plan=state.plan;
  if(!plan) return `<div class="page">${heading('برنامه خرید تو')}${empty('هنوز برنامه‌ای نساخته‌ای','یک محصول و فروشگاه انتخاب کن تا نشانی و اطلاعات خرید را همراه داشته باشی.')}</div>`;
  const p=plan.product, s=plan.shop, v=plan.verification;
  return `<div class="page has-action">${heading('برنامه خریدت آماده است')}<div class="plan-grid"><div><section class="panel"><div class="plan-product">${image(p)}<div><h2>${esc(p.name)}</h2><p class="product-price">${money(v?.price || s.price)}</p><p class="muted small">${v?.price?'قیمت اعلام‌شده طبق گزارش شما':'قیمت ثبت‌شده؛ پیش از خرید تأیید کن'}</p></div></div></section><section class="panel"><h2>${esc(s.name)}</h2>${s.name_synthetic?'<span class="small muted">نام تأییدنشده</span>':''}<p class="real-address">${esc(localNumbers(s.address))}</p>${phones(s)}<p>${esc(localNumbers(s.opening.label))}</p><p class="helper">${priceAge(s.price_changed_at)}</p></section>${plan.backup?`<section class="panel"><h2>گزینه جایگزین: ${esc(plan.backup.name)}</h2><p>${esc(plan.backup.address)}</p><p>موجودی و قیمت نیازمند بررسی است.</p>${btn('جزئیات جایگزین','plan-backup','btn-secondary')}</section>`:note('فروشگاه جایگزین دیگری برای همین محصول با شرایط فعلی پیدا نشد.')}<section class="panel"><h2>گزارش تماس</h2><p>${v?esc(({confirmed:'طبق گزارش شما موجود بوده',out:'طبق گزارش شما ناموجود بوده','no-response':'پاسخ نداده',closed:'بسته بوده',unverified:'تأیید نشده'})[v.status]):'هنوز تماسی ثبت نشده'}</p>${v?'<p>'+dateText(v.time)+'</p><p>'+esc(v.notes || '')+'</p>':''}</section></div><aside><section class="panel"><h2 class="detail-section-title">قبل از بیرون رفتن</h2><div class="checklist">${['تطبیق مدل و ویژگی‌ها','تأیید قیمت و موجودی','بررسی روش پرداخت','دریافت فاکتور و گارانتی'].map((text,i)=>`<label><input type="checkbox" data-check="${i}" ${plan.checks?.[i]?'checked':''}>${text}</label>`).join('')}</div></section>${mapPanel([s])}</aside></div>${note()}<div class="action-bar">${btn(state.savedPlan?'برنامه ذخیره شده':'ذخیره برنامه خرید','save-plan','btn-secondary')}${btn(icon('route')+'شروع مسیریابی','plan-directions','btn-primary')}</div></div>`;
}
function savedPage() { const items=state.saved.map(id=>productCache.get(id)).filter(Boolean);return `<div class="page">${heading('فهرست من')} ${state.savedPlan?'<section class="panel"><h2>'+esc(state.savedPlan.product.name)+'</h2>'+btn('دیدن برنامه ذخیره‌شده','open-plan','btn-secondary')+'</section>':''}${items.length?'<div class="product-grid">'+items.map(productCard).join('')+'</div>':empty('محصولی ذخیره نکرده‌ای','روی نشان ذخیره در کارت محصول بزن.','recommendations','دیدن محصول‌ها')}</div>`; }
function shopsPage() { return `<div class="page">${heading('فروشگاه‌ها',fa(directoryTotal)+' فروشگاه مطابق فیلتر')}<form id="directory-form" class="panel refine-grid"><label class="catalog-field">نام فروشگاه یا محله<input name="q" value="${esc(directoryQuery)}" maxlength="100"></label><label class="catalog-field">محله<select name="area"><option value="">همه محله‌ها</option>${boot.areas.map(a=>`<option ${directoryArea===a.name?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" name="installment" ${directoryInstallment?'checked':''}> اقساط حضوری</label><button class="btn btn-primary" type="submit">جست‌وجوی فروشگاه</button></form><div class="directory-grid">${directory.length?directory.map(s=>storeCard(s,true)).join(''):empty('فروشگاهی پیدا نشد','نام یا محله را تغییر بده.','shops','همه فروشگاه‌ها')}</div>${directory.length<directoryTotal?btn('فروشگاه‌های بیشتر','more-shops','btn-secondary full'):''}${''}</div>`; }
const views={home,discovery,recommendations,compare,stores:storesPage,store:storeDetail,verify:verification,plan:planPage,saved:savedPage,shops:shopsPage,categories:categoriesPage,category:categoryPage};
let shownPage='';
function render() {
  nav();
  document.body.dataset.view=route;
  $('#main').dataset.route=route;
  $('#main').setAttribute('aria-busy',String(busy));
  $('#main').innerHTML=busy?skeleton():failure?`<div class="page narrow">${empty('اطلاعات دریافت نشد',failure,'retry','تلاش دوباره','alert')}</div>`:(views[route]||home)();
  // Animate only arrival on a new page, never the rerenders caused by toggles on the same page.
  if(!busy&&shownPage!==generation){shownPage=generation;$('#main>.page')?.classList.add('page-enter');}
  $('#announcer').textContent=$('#main h1')?.textContent || '';
  document.title=($('#main h1')?.textContent || 'همراه خرید حضوری تو')+' | سرراه';
  driftRails();
}
// Home rails drift one card every few seconds. Hover or focus pauses a rail; scrolling it sideways yourself
// (finger, wheel, arrow buttons) stops it for good. A vertical page swipe that starts on a rail does not.
let railTimer=0;
function driftRails() {
  clearInterval(railTimer);
  if(route!=='home'||busy||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let tick=0;
  // Rails take turns (each moves every ~3.6s) so the page never jumps all at once.
  railTimer=setInterval(()=>{
    if(document.hidden)return;
    tick++;
    document.querySelectorAll('.home-page .rail-track').forEach((track,i)=>{
      const end=track.scrollWidth-track.clientWidth;
      if((tick+i)%3||track.hasAttribute('data-held')||end<8||track.matches(':hover,:focus-within'))return;
      // RTL tracks scroll toward negative scrollLeft.
      track.driftAt=Date.now();
      if(Math.abs(track.scrollLeft)>=end-8)track.scrollTo({left:0,behavior:'smooth'});
      else track.scrollBy({left:-(track.firstElementChild.offsetWidth+12),behavior:'smooth'});
    });
  },1200);
}
document.addEventListener('scroll',e=>{const t=e.target;if(t.classList?.contains('rail-track')&&!(Date.now()-(t.driftAt||0)<1500))t.setAttribute('data-held','');},{passive:true,capture:true});
document.addEventListener('keydown',e=>e.target.closest?.('.rail')?.querySelector('.rail-track')?.setAttribute('data-held',''),true);
async function loadProducts(append=false) {
  const token=generation;
  const params=route==='category'?{group:state.group,category:state.category || ''}:{q:state.query,category:state.category || '',max_price:state.answers.max_price,installment:state.answers.installment?'1':''};
  const data=await api('/api/products',{...params,sort:state.productSort || 'stores',offset:append?list.length:0});
  if(token!==generation)return;
  cacheProducts(data.items); list=append?list.concat(data.items):data.items;total=data.total;parsedQuery=data.parsed;
}
async function loadDirectory(append=false) { const token=generation;const data=await api('/api/shops',{q:directoryQuery,area:directoryArea,installment:directoryInstallment?'1':'',offset:append?directory.length:0});if(token!==generation)return;directory=append?directory.concat(data.items):data.items;directoryTotal=data.total;data.items.forEach(s=>shopCache.set(s.id,s)); }
async function loadStoreProducts(append=false) {
  const token=generation;
  if(shopFilters.shop!==selectedShop.id)shopFilters={shop:selectedShop.id,category:'',sort:'',q:''};
  const data=await api('/api/shops/'+selectedShop.id+'/products',{limit:6,offset:append?shopProducts.length:0,category:shopFilters.category,sort:shopFilters.sort,q:shopFilters.q});
  if(token!==generation)return;
  cacheProducts(data.items);shopProducts=append?shopProducts.concat(data.items):data.items;shopTotal=data.total;shopFacets=data.categories;shopProductCount=data.product_count;
}
async function loadRoute() {
  const token=generation;
  if (['home','categories','category'].includes(route) && !homeData){
    try{homeData=await api('/api/home');homeWarning='';}
    catch(error){if(route!=='home')throw error;homeWarning='پیشنهادها فعلاً دریافت نشدند؛ جست‌وجو و انتخاب‌هایت در دسترس‌اند.';homeData={groups:[],rails:boot.featured?.length?[{id:'available',title:'کالاهای ثبت‌شده',items:boot.featured}]:[]};}
  }
  if (route==='home' && state.recent?.[0] && recentRail?.query!==state.recent[0]) {
    try{const data=await api('/api/products',{q:state.recent[0],with_images:'1',limit:12});if(token===generation)recentRail={query:state.recent[0],items:cacheProducts(data.items)};}
    catch{homeWarning='پیشنهادهای جست‌وجوی اخیر دریافت نشد؛ بخش‌های دیگر قابل استفاده‌اند.';}
  }
  if (route==='recommendations' || route==='category') await loadProducts();
  if (route==='compare') await restoreComparison();
  if (route==='saved') await Promise.all(state.saved.map(getProduct));
  if (route==='shops') await loadDirectory();
  if (['stores','store','verify'].includes(route) && state.product) {
    await getProduct(state.product);
    if(token!==generation)return;
    const data=await api('/api/products/'+state.product+'/stores',locParams());
    if(token!==generation)return;
    storeList=data.items;
  }
  if (['store','verify'].includes(route) && state.shop) {
    selectedShop=!state.directoryDetail?storeList.find(s=>s.id===state.shop):null;
    const shop=selectedShop || await api('/api/shops/'+state.shop,locParams());
    if(token!==generation)return;
    selectedShop=shop;
    await loadStoreProducts();
  }
}
// The in-page Back is "up one level" (product -> its category -> all categories -> home), not every page visited.
function parentTarget(){
  const family=['stores','store','verify'];
  if(route==='store'&&state.directoryDetail)return 'shops';
  if(family.includes(route)&&state.product)return 'product';
  if(route==='product'){const p=productCache.get(state.product);return p?.group?'category?g='+p.group+'&c='+encodeURIComponent(p.category):'categories';}
  if(route==='category')return state.category?'category?g='+state.group:'categories';
  return 'home';
}
function goUp(){
  const parent=parentTarget(),from=history.state?.nazdika?history.state.from:null,fromRoute=from?.split('?')[0];
  // Reuse the browser entry when the previous page is the natural way back, so its scroll position comes back too.
  const viaHistory=from&&(from===parent||(route==='product'&&!['product','stores','store','verify'].includes(fromRoute))
    ||(['stores','store','verify'].includes(route)&&fromRoute==='product')||(['compare','plan'].includes(route)&&fromRoute!==route)||(parent==='home'&&fromRoute==='home'));
  return viaHistory?history.back():go(parent,{replace:true});
}
// A slow answer that arrives after the shopper left its page is kept, with a way back to it.
let readyTarget='';
function notifyReady(text,target){
  const onPage=route===target.split('?')[0];
  if(onPage&&!document.hidden)return;
  if(document.hidden&&!document.title.startsWith('● '))document.title='● '+document.title;
  try{if(document.hidden&&window.isSecureContext&&Notification.permission==='granted')new Notification('سرراه',{body:text,tag:'nazdika-ready'});}catch{}
  if(onPage)return;
  readyTarget=target;
  let box=$('#ready-notice');
  if(!box){document.body.insertAdjacentHTML('beforeend','<div id="ready-notice" class="ready-notice" role="status"></div>');box=$('#ready-notice');}
  box.innerHTML=`${icon('checkCircle')}<span>${esc(text)}</span>${btn('مشاهده','open-ready','btn-primary')}<button class="icon-button" data-action="close-ready" aria-label="بستن اعلان">${icon('close')}</button>`;
  box.hidden=false;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.title.startsWith('● '))document.title=document.title.slice(2);});
async function go(to, options={}) {
  if($('#dialog')?.open)closeDialog();
  if(!('restore' in options)&&!busy)scrollMemory.set(location.hash,window.scrollY);
  const requested=readTarget(to),from=route,fromTarget=location.hash.slice(1)||'home';
  route=views[requested]?requested:'home';const token=++generation;failure='';busy=true;
  let target=route;
  if(route==='store'&&state.directoryDetail&&state.shop)target+='?shop='+state.shop;
  else if(['product','stores','store','verify'].includes(route)&&state.product)target+='?id='+state.product+(state.shop?'&shop='+state.shop:'');
  else if(route==='outfits'&&state.outfitSeed)target+='?seed='+state.outfitSeed;
  else if(route==='shared'&&sharedIds.length)target+='?ids='+sharedIds.join(',');
  else if(route==='category'&&state.group)target+='?g='+state.group+(state.category?'&c='+encodeURIComponent(state.category):'');
  // Filters and sorting on the same page replace its entry; only a new page adds one, so Back never steps through filters.
  if(location.hash!=='#'+target){
    if(options.replace||(from===route&&!['product','store'].includes(route)))history.replaceState({...history.state,nazdika:true},'','#'+target);
    else history.pushState({nazdika:true,from:fromTarget},'','#'+target);
  }
  persist();render();
  try { if(!options.local) await loadRoute(); } catch(e) { if(token===generation) failure=e.message; }
  if(token!==generation)return;
  busy=false;render();if(!options.keepScroll){window.scrollTo({top:options.restore || 0,behavior:'instant'});$('#main').focus({preventScroll:true});}
}
// Back/forward returns to where the shopper was in a list, instead of the top of the page.
const scrollMemory=new Map();
if(window.history)history.scrollRestoration='manual';
window.addEventListener('scroll',()=>{if(!busy)scrollMemory.set(location.hash,window.scrollY);},{passive:true});
function showDialog(title, body) { const d=$('#dialog');if(d.open)d.close();d.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close-dialog" aria-label="بستن">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;d.showModal(); }
// A tap on the dimmed backdrop dismisses the sheet, as on native bottom sheets.
document.addEventListener('click',e=>{const d=$('#dialog');if(e.target!==d||!d.open)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
function closeDialog() { $('#dialog').close(); }
function locationDialog() {
  const city=state.city||'tehran';
  showDialog('شهر و محدوده خرید',`<div class="segmented city-switch" role="group" aria-label="شهر">${[['tehran','تهران'],['isfahan','اصفهان']].map(([id,n])=>`<button data-action="city" data-value="${id}" class="${city===id?'active':''}" aria-pressed="${city===id}">${n}${id==='isfahan'?' <small>به‌زودی</small>':''}</button>`).join('')}</div>${city==='isfahan'?`<div class="city-soon"><span class="tool-icon">${icon('pin')}</span><h3>سرراه به‌زودی در اصفهان</h3><p>پوشش فعلی سرراه مربوط به تهران است. تا فعال شدن اصفهان، کالاها و قیمت‌های تهران را می‌بینی.</p>${btn(icon('bell')+(state.isfahanInterest?'علاقه‌ات ثبت شده':'می‌خواهم اصفهان زودتر فعال شود'),'isfahan-interest',state.isfahanInterest?'btn-soft full':'btn-primary full')}${btn(icon('store')+'فروشنده اصفهانی هستم','join-shop','btn-secondary full')}${btn('ادامه با فروشگاه‌های تهران','city','btn-text full','data-value="tehran"')}</div>`:`<label for="neighborhood">محله در تهران</label><select id="neighborhood">${boot.areas.map(a=>`<option value="${esc(a.name)}" ${state.neighborhood===a.name?'selected':''}>${esc(a.name)} (${fa(a.count)} فروشگاه)</option>`).join('')}</select>${btn('انتخاب این محله','set-location','btn-primary full')}${btn(icon('map')+'انتخاب نقطه روی نقشه','locate','btn-secondary full')+btn(icon('pin')+'استفاده از موقعیت من','geolocate','btn-secondary full')}<p id="location-feedback" class="helper" role="status">موقعیت دقیق در مرورگر ذخیره نمی‌شود و فقط برای محاسبه فاصله به سرور همین برنامه ارسال می‌شود.</p>`}`);
}
function directions(s) { showDialog('مسیریابی به '+s.name,`<p>${esc(localNumbers(s.address))}</p><a class="btn btn-primary full" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking" target="_blank" rel="noopener noreferrer">مسیر پیاده در نقشه</a><a class="btn btn-secondary full" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving" target="_blank" rel="noopener noreferrer">مسیر با خودرو در نقشه</a>${note('طبقه و واحد را از فروشنده بپرس.')}`); }
async function startSearch(query, to) { query=String(query || '').trim();if(!query){toast('نام محصول یا نیازت را بنویس.');$('#shopping-query')?.focus();return;}state.query=query;state.category='';state.recent=[query,...(state.recent||[]).filter(q=>q!==query)].slice(0,4);await go(to||((route==='home'&&state.intent==='guided')||route==='discovery'||route==='assistant'?'assistant':'recommendations')); }
async function productInfo(id) { const p=await getProduct(id);showDialog(p.name,`<p>دسته: ${esc(p.category)} · برند: ${esc(p.brand || 'ثبت نشده')}</p><p>مدل: ${esc(p.model || 'ثبت نشده')}</p><div class="product-gallery">${p.images.filter(u=>/^https:\/\//.test(u)).map(u=>`<img src="${esc(u)}" alt="${esc(p.name)}" loading="lazy">`).join('')}</div><div class="spec-list">${p.specs.length?p.specs.map(s=>`<div class="spec-row"><span>${esc(s.section)} · ${esc(s.key)}</span><strong>${esc(s.value)}</strong></div>`).join(''):'<p>مشخصات تکمیلی ثبت نشده است.</p>'}</div>${note()}`); }
const actions={
  home:()=>go('home'),recommendations:()=>go('recommendations'),shops:()=>{directoryQuery='';directoryArea='';directoryInstallment=false;return go('shops');},retry:()=>boot?go(route):initialize(),back:goUp,
  intent:el=>{state.query=$('#shopping-query')?.value || state.query;state.intent=el.dataset.value;persist();render();},suggest:el=>startSearch(el.dataset.query),
  'reset-search':()=>{state.query='';state.category='';state.answers={};return go('recommendations');},
  'remove-product-filter':el=>{if(el.dataset.id==='category')state.category='';if(el.dataset.id==='budget')state.answers.max_price='';if(el.dataset.id==='installment')state.answers.installment=false;return go('recommendations');},
  'clear-product-filters':()=>{state.category='';state.answers={};return go('recommendations');},
  'more-products':async()=>{await loadProducts(true);render();},'more-shops':async()=>{await loadDirectory(true);render();},'more-shop-products':async()=>{await loadStoreProducts(true);render();},
  'product-info':el=>productInfo(el.dataset.id),
  'product-stores':el=>{state.product=el.dataset.id;state.filters=(state.answers.installment||parsedQuery.installment)?['installment']:[];state.directoryDetail=false;state.shop=null;return go('stores');},
  'compare-toggle':toggleComparison,
  compare:()=>go('compare'),'compare-all':()=>{state.compareAll=!state.compareAll;persist();render();},'compare-more':()=>{compareExpanded=!compareExpanded;render();},
  'compare-manage':()=>showDialog('ویرایش مقایسه',compareManager()),
  'compare-clear':()=>{state.compare=[];persist();if($('#dialog')?.open)closeDialog();render();toast('انتخاب‌های مقایسه پاک شد.');},
  'compare-keep':el=>{state.compare=comparisonItems().filter(p=>p.category===el.dataset.category).map(p=>p.id);persist();if($('#dialog')?.open)closeDialog();return go('compare');},
  'compare-replace':async el=>{await getProduct(el.dataset.id);state.compare=[el.dataset.id];persist();closeDialog();render();toast('مقایسهٔ جدید شروع شد؛ یک کالای هم‌دستهٔ دیگر انتخاب کن.');},
  'compare-browse':()=>{const first=comparisonItems()[0];if($('#dialog')?.open)closeDialog();if(!first)return go('categories');state.query='';state.category=first.category;state.answers={};return go('recommendations');},
  'clear-recent':()=>{state.recent=[];persist();render();$('#shopping-query')?.focus();},
  'open-ready':()=>{$('#ready-notice').hidden=true;return go(readyTarget);},'close-ready':()=>{$('#ready-notice').hidden=true;},
  'save-product':el=>{
    const id=el.dataset.id,on=!state.saved.includes(id);state.saved=on?state.saved.concat(id):state.saved.filter(x=>x!==id);persist();
    // Update every toggle for this product in place; a full render would reset rail scroll positions.
    if(route==='saved')render();
    else document.querySelectorAll(`[data-action="save-product"][data-id="${id}"]`).forEach(b=>{b.classList.toggle('saved',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',b.getAttribute('aria-label').replace(on?'افزودن به':'حذف از',on?'حذف از':'افزودن به'));const t=b.querySelector('.save-label');if(t)t.textContent=on?'ذخیره شد':'ذخیره';});
    toast(on?'محصول ذخیره شد.':'محصول از ذخیره‌شده‌ها حذف شد.');
  },
  location:locationDialog,'close-dialog':closeDialog,
  city:el=>{state.city=el.dataset.value;persist();nav();if(state.city==='tehran'&&$('#dialog').open&&!$('#neighborhood'))closeDialog();else locationDialog();if(route==='home')render();},
  'isfahan-interest':()=>{state.isfahanInterest=true;persist();locationDialog();toast('ثبت شد؛ این علاقه در همین مرورگر نگه داشته می‌شود.');},
  'join-shop':()=>showDialog('همکاری فروشگاه‌های اصفهان',`<p>فروشگاه‌ها می‌توانند قیمت و موجودی را با خوراک امن فروشنده به سرراه بفرستند؛ هر فروشگاه فقط کالاهای خودش را به‌روز می‌کند.</p>${contactSteps(0)}<p class="demo-note">${icon('info')}<span>ثبت عضویت فروشنده از این بخش هنوز فعال نیست.</span></p>`),
  'rail-scroll':el=>{const track=el.closest('.rail').querySelector('.rail-track');track.scrollBy({left:Number(el.dataset.dir)*track.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},
  contact:el=>{const s=shopCache.get(el.dataset.id)||storeList.find(x=>x.id===el.dataset.id)||directory.find(x=>x.id===el.dataset.id)||(selectedShop?.id===el.dataset.id?selectedShop:null);if(s)contactDialog(s);},
  'contact-channel':el=>contactChannelStep(Number(el.dataset.value)),'contact-back':()=>contactDialog(contactShop),
  'copy-contact':async()=>{const text=$('#contact-text').value;try{await navigator.clipboard.writeText(text);toast('پیام کپی شد.');}catch{$('#contact-text').select();toast('متن انتخاب شد؛ کپی کن.');}},
  'contact-verify':()=>{closeDialog();state.shop=contactShop.id;state.directoryDetail=false;return go('verify');},
  'shop-category':async el=>{shopFilters.category=el.dataset.value;await loadStoreProducts();render();},
  theme:()=>showDialog('رنگ‌بندی سرراه',themeOptions()),'set-theme':el=>applyTheme(el.dataset.id),
  privacy:()=>showDialog('اطلاعات تو چگونه استفاده می‌شود؟','<p>انتخاب‌ها، جست‌وجوهای اخیر، گزارش تماس و برنامه خرید در همین مرورگر ذخیره می‌شوند. عبارت جست‌وجو و در صورت درخواست، مختصات برای پردازش به سرور همین برنامه ارسال می‌شوند. تصاویر محصول از ترب و نقشه از OpenStreetMap دریافت می‌شوند.</p>'),
  'set-location':()=>{const a=boot.areas.find(a=>a.name===$('#neighborhood').value);if(!a)return;state.neighborhood=a.name;origin={lat:a.lat,lon:a.lon,label:a.name+' (مرکز تقریبی)'};closeDialog();return go(route);},
  geolocate:()=>{const feedback=$('#location-feedback');if(!navigator.geolocation){feedback.textContent='موقعیت در این مرورگر در دسترس نیست؛ محله را دستی انتخاب کن.';return;}feedback.textContent='در انتظار اجازه دسترسی به موقعیت…';navigator.geolocation.getCurrentPosition(p=>{origin={lat:p.coords.latitude,lon:p.coords.longitude,label:'موقعیت فعلی من',precise:true};closeDialog();go(route);},()=>{feedback.textContent='موقعیت دریافت نشد. محله را دستی انتخاب کن.';},{timeout:10000,maximumAge:60000});},
  filter:el=>{const id=el.dataset.id;if(['nearest','cheapest'].includes(id))state.sort=id;else state.filters=state.filters.includes(id)?state.filters.filter(x=>x!==id):state.filters.concat(id);persist();render();},
  'clear-filters':()=>{state.filters=[];persist();render();},view:el=>{state.view=el.dataset.value;persist();render();},
  'store-detail':el=>{state.shop=el.dataset.id;state.directoryDetail=false;return go('store');},
  'directory-detail':el=>{state.shop=el.dataset.id;state.directoryDetail=true;return go('store');},
  verify:()=>go('verify'),directions:()=>directions(selectedShop),'plan-directions':()=>directions(state.plan.shop),
  'copy-question':async()=>{try{await navigator.clipboard.writeText(question());toast('متن سؤال کپی شد.');}catch{showDialog('متن آماده برای تماس',`<textarea id="copy-text" readonly>${esc(question())}</textarea>`);$('#copy-text').select();}},
  'create-plan':()=>{const s=selectedShop;if(!s||!product())return;state.plan={product:product(),shop:s,verification:verificationFor(s)||null,backup:filteredStores().find(x=>x.id!==s.id&&x.opening.open!==false&&!['out','closed','no-response'].includes(verificationFor(x)?.status))||null,checks:{}};state.savedPlan=null;persist();return go('plan');},
  'save-plan':()=>{state.savedPlan=structuredClone(state.plan);persist();render();toast('برنامه خرید ذخیره شد.');},
  'open-plan':()=>{state.plan=structuredClone(state.savedPlan);return go('plan');},
  'plan-backup':()=>{state.product=state.plan.product.id;state.shop=state.plan.backup.id;state.directoryDetail=false;return go('store');}
};
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');
  if(el){e.preventDefault();const action=actions[el.dataset.action];if(!action||el.disabled)return;const previousRoute=route;el.disabled=true;el.setAttribute('aria-busy','true');el.classList.add('is-pending');try{await action(el);}catch(error){toast(error.message);}finally{if(el.isConnected){el.disabled=false;el.removeAttribute('aria-busy');el.classList.remove('is-pending');}else if(route===previousRoute){const replacement=[...document.querySelectorAll('[data-action]')].find(x=>x.dataset.action===el.dataset.action&&x.dataset.id===el.dataset.id&&x.dataset.value===el.dataset.value);replacement?.focus({preventScroll:true});}}return;}
  const link=e.target.closest('a[href^="#"]');if(link){e.preventDefault();const id=link.hash.slice(1),section=!views[id]&&document.getElementById(id);if(link.hash==='#main')$('#main').focus();else if(section&&$('#main').contains(section))section.scrollIntoView({block:'start'});else go(id);}
});
// Capture phase: validate and normalize money fields before any form handler reads FormData.
document.addEventListener('submit',e=>{
  for(const input of e.target.querySelectorAll('[data-money]')){
    const n=Number(digits(input.value)),hint=$('#'+input.id+'-hint');
    if(input.value.trim()&&(!n||n<Number(input.dataset.min)||n>Number(input.dataset.max))){
      e.preventDefault();e.stopPropagation();
      input.setAttribute('aria-invalid','true');hint.classList.add('field-error');
      hint.textContent='مبلغ را به تومان و بین '+moneyWords(Number(input.dataset.min))+' تا '+moneyWords(Number(input.dataset.max))+' بنویس.';
      input.focus();return;
    }
    input.value=n?String(n):'';
  }
},true);
// Every amount field (moneyInput's data-money, free-text data-amount): thousands separators while typing digits,
// and the amount in Persian words underneath, so 26500000 can't be misread as 2.65 or 265 million.
function amountHint(input){
  if(!input.id)input.id='amount-'+(input.name||'field');
  let hint=document.getElementById(input.id+'-hint');
  if(!hint){hint=document.createElement('span');hint.className='money-hint';hint.id=input.id+'-hint';hint.setAttribute('aria-live','polite');(input.closest('.search-input-row')||input).after(hint);input.setAttribute('aria-describedby',hint.id);}
  const n=parseAmount(input.value);
  input.removeAttribute('aria-invalid');hint.classList.remove('field-error');
  hint.textContent=n?amountWords(n)+' تومان':input.value.trim()?'مبلغ را به تومان بنویس؛ مثلاً ۲۶٬۵۰۰٬۰۰۰ یا ۲۶٫۵ میلیون':'';
}
document.addEventListener('input',e=>{
  const input=e.target;if(!input.matches?.('[data-money],[data-amount]'))return;
  // Only plain digits are regrouped; text such as «۲۶٫۵ میلیون» stays exactly as typed.
  if(/^[\d۰-۹٠-٩,،٬\s]*$/.test(input.value)){
    const caret=digits(input.value.slice(0,input.selectionStart??input.value.length)).length,raw=digits(input.value);
    input.value=raw?fa(Number(raw)):'';
    let pos=0;for(let seen=0;pos<input.value.length&&seen<caret;pos++)if(/[۰-۹]/.test(input.value[pos]))seen++;
    input.setSelectionRange?.(pos,pos);
  }
  amountHint(input);
});
document.addEventListener('focusin',e=>{if(e.target.matches?.('[data-amount]')&&e.target.value)amountHint(e.target);});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.target.id==='shopping-query'){e.preventDefault();e.target.form.requestSubmit();}});
document.addEventListener('submit',async e=>{
  const form=e.target;e.preventDefault();const f=new FormData(form);
  if(form.id==='header-search')return startSearch(f.get('q'),'recommendations');
  if(form.id==='home-search'){const q=String(f.get('query')||'').trim();if(!q){toast('بنویس چی لازم داری.');return;}return askNow(q);}
  if(form.id==='search-form'){if(route==='discovery'){state.answers.max_price=f.get('max_price');state.answers.installment=f.has('installment');}return startSearch(f.get('query')+(route==='discovery'&&state.answers.max_price?' تا '+state.answers.max_price+' تومان':'')+(route==='discovery'&&state.answers.installment?' اقساطی':''));}
  if(form.id==='refine-form'){state.query=f.get('q').trim();state.category=f.get('category');state.answers.max_price=f.get('max_price');state.answers.installment=f.has('installment');state.productSort=f.get('sort');return go('recommendations');}
  if(form.id==='shop-search'){shopFilters.q=f.get('q').trim();await loadStoreProducts();render();$('#shop-q')?.focus();return;}
  if(form.id==='directory-form'){directoryQuery=f.get('q');directoryArea=f.get('area');directoryInstallment=f.has('installment');return go('shops');}
  if(form.id==='verification-form'){
    const v={status:f.get('status'),price:f.get('price')?Number(f.get('price')):null,notes:f.get('notes').trim(),time:new Date().toISOString()};
    state.verifications=state.verifications || {};state.verifications[state.product+':'+selectedShop.id]=v;persist();
    if(['out','closed','no-response'].includes(v.status)){toast('پاسخ ثبت شد؛ فروشگاه‌های جایگزین همین محصول را ببین.');return go('stores');}
    toast('گزارش تماس شما ثبت شد.');return go('store');
  }
});
document.addEventListener('change',async e=>{if(e.target.id==='category-sort'){state.productSort=e.target.value;persist();go('category',{keepScroll:true});}if(e.target.id==='shop-sort'){shopFilters.sort=e.target.value;await loadStoreProducts();render();}if(e.target.id==='map-store'){state.mapShop=e.target.value;render();}if(e.target.dataset.check!=null&&state.plan){state.plan.checks[e.target.dataset.check]=e.target.checked;persist();}});
window.addEventListener('popstate',()=>go(location.hash.slice(1)||'home',{restore:scrollMemory.get(location.hash)}));
window.addEventListener('online',()=>$('#offline-banner').hidden=true);
window.addEventListener('offline',()=>$('#offline-banner').hidden=false);
async function initialize() {
  applyTheme(currentTheme());
  busy=true;failure='';render();
  try{
    try{boot=await api('/api/bootstrap');}
    catch{boot=boot||{counts:{},areas:[],categories:[],featured:[]};homeWarning='بخشی از اطلاعات اولیه دریافت نشد؛ جست‌وجو همچنان در دسترس است.';}
    cacheProducts(boot.featured);
    await restoreComparison();
    const a=state.neighborhood&&boot.areas.find(a=>a.name===state.neighborhood);
    if(a&&a.name.trim())origin={lat:a.lat,lon:a.lon,label:a.name+' (مرکز تقریبی)'};
    await go(route);
  }catch(e){busy=false;failure=e.message;render();}
}
actions.settings=()=>showDialog('تنظیمات نمایش',themeOptions());
actions['retry-home']=async()=>{homeData=null;homeWarning='';await initialize();};
actions['store-page']=el=>{const page=Number(el.dataset.page);if(!Number.isInteger(page)||page<0)return;storePage=page;render();$('#store-list-start')?.scrollIntoView({block:'start',behavior:'instant'});};
document.addEventListener('change',e=>{if(e.target.id==='leaf-category')go('category?g='+state.group+(e.target.value?'&c='+encodeURIComponent(e.target.value):''));});
initialize();
