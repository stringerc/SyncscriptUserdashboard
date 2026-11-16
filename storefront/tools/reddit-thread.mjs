import { chromium } from 'playwright-core';
const link = process.argv[2];
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages().find(p => p.url().includes('reddit.com'));
await page.goto('https://www.reddit.com'+link, {waitUntil:'domcontentloaded'});
await page.waitForTimeout(4000);
const data = await page.evaluate(() => {
  const post = document.querySelector('shreddit-post');
  const comments = [...document.querySelectorAll('shreddit-comment')].slice(0,10).map(c => ({
    author: c.getAttribute('author'), body: (c.querySelector('[slot=comment]')?.innerText || c.innerText || '').slice(0,500)
  }));
  return { title: post?.getAttribute('post-title'), body: (post?.querySelector('[slot=text-body]')?.innerText||'').slice(0,1200), comments };
});
console.log(JSON.stringify(data,null,1).slice(0,6000));
await browser.close();
