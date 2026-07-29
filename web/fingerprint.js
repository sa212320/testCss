/* ==========================================================================
   fingerprint.js —— 環境指紋 + 兩個測項的必要輔助
   ------------------------------------------------------------------------
   硬規則：只用 ES5。不准出現 let / const / 箭頭函式 / 模板字串 /
          ?. / ?? / class / Promise / fetch。
   理由：目標引擎是 Chromium 57~65。任何 ES2016+ 語法會讓整個檔案
        SyntaxError，頁面上就什麼指紋都不會出現，一輪測試白費。

   這支檔案只做三件事，刻意不碰任何判定邏輯（判定靠人眼）：
     1. 把環境指紋寫進頁首與頁尾 —— 讓每張截圖自帶可信度證據
     2. 把 sticky 測項的容器預先捲動 —— 對方不必手動滑，截圖即可判讀
     3. 印出 env(safe-area-inset-top) 的 computed 值 —— 這個特性沒辦法
        單靠肉眼分辨（未支援與 inset=0 看起來一樣）
   ========================================================================== */

(function () {
  var ua = navigator.userAgent;

  function pick(re, fallback) {
    var m = ua.match(re);
    return m ? m[1] : fallback;
  }

  function setAll(cls, html) {
    var els = document.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      els[i].innerHTML = html;
    }
  }

  /* ---------- 引擎與殼的判別 ----------
     三種環境要能從截圖一眼分辨：
       Capacitor 殼  → UA 含 "; wv)"        → 系統 WebView
       GeckoView 殼  → UA 含 Firefox/Gecko  → 自帶引擎
       對方用 Chrome → 都不含               → 對照組
     這是驗證矩陣左右兩欄的分辨依據，弄錯會把兩欄的截圖搞混。      */

  var engine, ver, shell;

  if (ua.indexOf('Firefox/') > -1 || ua.indexOf('Gecko/') > -1) {
    engine = 'Gecko';
    ver = pick(/(?:Firefox\/|rv:)(\d+)/, '?');
    shell = 'GeckoView（自帶引擎）';
  } else {
    engine = 'Chromium';
    ver = pick(/Chrome\/(\d+)/, '?');
    shell = ua.indexOf('; wv)') > -1 ? '系統 WebView' : 'Chrome 瀏覽器';
  }

  var android = pick(/Android (\d+(?:\.\d+)*)/, '非 Android');
  var dpr = window.devicePixelRatio || 1;

  var short = engine + ' ' + ver +
              ' · Android ' + android +
              ' · ' + shell +
              ' · 寬 ' + window.innerWidth +
              ' · DPR ' + dpr;

  setAll('fp-env', short);
  setAll('fp-ua', ua);

  /* ---------- sticky 測項：預先捲動 ----------
     position:sticky 要捲動才看得出來。與其在頁面上寫「請往下滑再截一張」
     （對方多一個步驟就多一個出錯機會），直接把測試側與參考側都捲到同一位置，
     讓靜態截圖就能左右對比。 */

  var scrollers = document.getElementsByClassName('scroll-70');
  for (var s = 0; s < scrollers.length; s++) {
    scrollers[s].scrollTop = 70;
  }

  /* ---------- env(safe-area) 的 computed 值 ----------
     probe 的 CSS 用了疊加 fallback：
         padding-left: 50px;
         padding-left: env(safe-area-inset-left);
     支援 env    → 第二條生效 → 讀到實際 inset（直立手機幾乎總是 0px）
     不支援 env  → 第二條被丟棄 → 保留 50px
     所以讀到 "50px" 就是不支援。

     為什麼要印數值：支援但 inset=0 的畫面，跟「完全沒套用 padding」的畫面
     長得一模一樣，肉眼分不出來。這一項是全部測項裡唯一非看數值不可的。 */

  var probe = document.getElementById('env-probe');
  if (probe && window.getComputedStyle) {
    var pl = window.getComputedStyle(probe).paddingLeft;
    setAll('fp-env-value',
      'env(safe-area-inset-left) 實測 = <b>' + pl +
      '</b> —— 讀到 50px 就是不支援，0px 就是支援');
  }

  /* ---------- dvh 的實測像素值 ----------
     dvh 這一項的參考只能用 vh，但在有網址列的瀏覽器裡 dvh 與 vh 的值
     本來就不相等（vh 對最大視窗、dvh 對當前視窗）。所以肉眼判讀的標準是
     「左邊還在不在」而不是「左右等高」。這裡把兩個實測高度都印出來，
     讓落差（支援）與 0px（不支援）不會被讀成同一件事。 */

  var dt = document.getElementById('dvh-test');
  var dr = document.getElementById('dvh-ref');
  if (dt && dr) {
    setAll('fp-dvh-value',
      'dvh 實測高 = <b>' + dt.offsetHeight + 'px</b>' +
      ' ／ vh 參考高 = <b>' + dr.offsetHeight + 'px</b>' +
      ' —— 左邊 0px 就是不支援');
  }
})();
