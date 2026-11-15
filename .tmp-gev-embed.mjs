import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const msgs = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) console.log('['+m.type()+']', m.text().slice(0,200)); });
page.on('pageerror', e => console.log('[PAGEERR]', String(e).slice(0,300)));
page.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url().slice(0,140)); });
await page.evaluateOnNewDocument(() => {
  window.addEventListener('message', e => { if (e.data?.type?.startsWith('gev:')) window.__gevMsgs = [...(window.__gevMsgs||[]), e.data.type]; });
});
await page.goto('http://127.0.0.1:5180/?embed=1', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 12000));
const st = await page.evaluate(() => ({ msgs: window.__gevMsgs || [], text: document.body.innerText.slice(0,200) }));
console.log('GEV MSGS:', JSON.stringify(st.msgs), '| text:', st.text.slice(0,120));
await browser.close();
