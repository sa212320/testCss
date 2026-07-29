/* 驗證 Capacitor 殼打包的 ES5 loader：
     1. 它會不會真的跳到線上測試頁
     2. 跳轉時有沒有帶上 timestamp（沒有就繞不過 WebView 快取）
     3. 離線時會不會停在 loader 頁，讓「離線版」連結還點得到

   loader 只有幾行，但它是整條鏈路的單點故障：跳轉壞了，對方看到的是
   一個停住的白畫面，而我們會誤以為是 CSS 問題。 */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const arg = process.argv[2] || '../shell-capacitor/www/index.html';
const LOADER = /^(file|https?):/.test(arg) ? arg : pathToFileURL(resolve(arg)).href;

const browser = await chromium.launch();

// ---- 情境一：正常連線 ----
{
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(LOADER);
  await page.waitForURL(/sa212320\.github\.io/, { timeout: 15000 }).catch(() => {});
  const url = page.url();
  const t = new URL(url).searchParams.get('t');
  console.log('【正常連線】');
  console.log('  最終網址 :', url);
  console.log('  帶 timestamp :', t ? `是（${t}）` : '否 ← 繞不過快取，是問題');
  console.log('  JS 錯誤 :', errors.length ? errors : '無');
  // 用 URL 判斷，不能用 title —— loader 自己的 title 也含 "CSS"，會誤報成功
  const arrived = url.includes('sa212320.github.io') &&
                  (await page.locator('.hero-main').count()) > 0;
  console.log('  抵達測試頁 :', arrived ? '是（看到指紋區塊）' : '否');
  await page.close();
}

// ---- 情境二：斷網（模擬 TLS 失敗 / 無網路）----
{
  const ctx = await browser.newContext({ offline: true });
  const page = await ctx.newPage();
  await page.goto(LOADER).catch(() => {});
  await page.waitForTimeout(2500);
  const stillLoader = page.url().startsWith('file://');
  const link = await page.locator('a.btn').first();
  const visible = await link.isVisible().catch(() => false);
  const href = await link.getAttribute('href').catch(() => null);
  console.log('\n【斷網】');
  console.log('  仍停在 loader 頁 :', stillLoader ? '是' : `否（跑到 ${page.url()}）`);
  console.log('  離線版連結可見 :', visible ? `是（href=${href}）` : '否 ← fallback 失效');
  await ctx.close();
}

await browser.close();
