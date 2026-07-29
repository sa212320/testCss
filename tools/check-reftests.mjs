/* 驗證測試頁本身寫對了 —— 在一個「全部支援」的現代引擎上跑，
   所有 reftest 的左右兩側必須一致、所有「引擎宣稱」必須是支援。
   有任何一項不成立，就是測試頁自己寫錯，不是被測引擎的問題。

   刻意不放進 testCss/：這是開發期的一次性工具，專案本身要維持零建置。 */

import { chromium } from 'playwright';

const PAGES = ['index.html', '01-baseline.html', '02-gap.html', '03-fn.html',
               '04-viewport.html', '05-visual.html', '06-modern.html'];

// 06-modern 是探索頁，刻意包含連 Chrome 都很新的語法，所以在這支腳本用的
// Chromium 上本來就可能有幾項是紅的 —— 那一頁的「宣稱全綠」不是通過標準。
const EXPLORATORY = new Set(['06-modern.html']);
const OUT = process.argv[2] || '.';
const URLBASE = process.argv[3] || 'http://127.0.0.1:8765';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G950F Build/R16NW; wv) ' +
             'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ' +
             'Chrome/151.0.0.0 Mobile Safari/537.36',
});

const report = [];

for (const p of PAGES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(`${URLBASE}/${p}`, { waitUntil: 'load' });
  await page.waitForTimeout(250);   // 讓 fingerprint.js 的 scrollTop 生效

  const data = await page.evaluate(() => {
    const out = { claims: [], items: [], fp: null };

    // 指紋是否真的被寫進去了（空的代表 JS 沒跑）
    const fp = document.getElementsByClassName('fp-env')[0];
    out.fp = fp ? fp.textContent.trim().slice(0, 120) : '(沒有 fp-env 元素)';

    // 「引擎宣稱」：讀 ::before 的 content
    const claims = document.getElementsByClassName('claim');
    for (const c of claims) {
      const txt = getComputedStyle(c, '::before').content;
      const cls = [...c.classList].find(x => x.startsWith('cl-')) || '(無 cl- class)';
      if (txt && txt !== 'none' && txt !== 'normal') {
        out.claims.push({ cls, says: txt.replace(/^"|"$/g, '') });
      }
    }

    // 每個測項卡片：比對兩側 cell 的幾何
    const items = document.getElementsByClassName('item');
    for (const it of items) {
      const cells = it.getElementsByClassName('ref-cell');
      if (cells.length !== 2) continue;

      const title = (it.querySelector('h2')?.textContent || '').replace(/\s+/g, ' ').trim();

      const measure = (cell) => {
        const base = cell.getBoundingClientRect();
        // 葉節點（沒有子元素的）相對於 cell 的位置與尺寸
        const leaves = [];
        // 所有實際畫出來的背景色 —— 顏色類測項（var / :is / :has / color-mix）
        // 全靠顏色判讀，而幾何量測完全抓不到顏色錯誤
        const colors = new Set();
        cell.querySelectorAll('*').forEach(el => {
          if (el.classList.contains('ref-label')) return;
          const cs = getComputedStyle(el);
          if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            colors.add(cs.backgroundColor);
          }
          if (el.children.length === 0) {
            const r = el.getBoundingClientRect();
            leaves.push([
              Math.round(r.left - base.left), Math.round(r.top - base.top),
              Math.round(r.width), Math.round(r.height),
            ]);
          }
        });
        const inner = cell.children[1] || cell.children[0];
        return {
          leaves,
          colors: [...colors].sort(),
          h: inner ? Math.round(inner.getBoundingClientRect().height) : 0,
          w: inner ? Math.round(inner.getBoundingClientRect().width) : 0,
        };
      };

      const L = measure(cells[0]), R = measure(cells[1]);
      out.items.push({ title, L, R });
    }

    // 單欄的自我證明測項（沒有並排，靠「疊加 fallback + 刺眼錯誤色」判讀）
    out.special = {};
    const grad = document.querySelector('.t-grad');
    if (grad) {
      const cs = getComputedStyle(grad);
      out.special.gradient = {
        image: cs.backgroundImage.slice(0, 60),
        color: cs.backgroundColor,
        hasGradient: cs.backgroundImage.indexOf('gradient') > -1,
      };
    }
    const bdf = document.querySelector('.bdf-glass');
    if (bdf) {
      const cs = getComputedStyle(bdf);
      out.special.backdrop = cs.backdropFilter || cs.webkitBackdropFilter || '(無)';
    }
    const blend = document.querySelector('.blend-top');
    if (blend) out.special.blend = getComputedStyle(blend).mixBlendMode;

    return out;
  });

  await page.screenshot({ path: `${OUT}/${p.replace('.html', '')}.png`, fullPage: true });
  await page.close();

  report.push({ page: p, errors, exploratory: EXPLORATORY.has(p), ...data });
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
