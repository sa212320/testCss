# testCss —— 舊 Android WebView 的 CSS 支援度測試

一份靜態測試頁，加上兩個載入它的 Android 殼，用來回答一個具體問題：

> 主專案在某台 Android 11 的裝置上顯示異常。
> 是要回頭改 CSS，還是換掉瀏覽器引擎就能解決？
>
> 要改的處數取決於那台裝置的 WebView 究竟卡在哪一版 ——
> **約 107 處到約 805 處之間，差一個量級**。這個數字由指紋頁決定，
> 見下面「一個尚未解開的矛盾」。

## 為什麼需要這個專案

那台裝置的狀況已經確認：

- **Android System WebView 更新不了**（廠商 ROM 不維護），但另外裝的 Chrome 開同樣頁面是正常的 → WebView 版本是不可變的硬約束
- Capacitor 7 的 APK 裝得上、跑得動，minSdk 不是問題
- 裝置是 **Android 11**（API 30）
- 實測 **`display:grid` 支援（≥ Ch 57）、`gap` 不支援（< Ch 66）** → 指向 WebView 卡在 **Chromium 57~65**（2017-03 ~ 2018-04）

### ⚠ 一個尚未解開的矛盾

上面最後兩點對不起來。**Android 11 是 2020-09 出的，出廠的 WebView 大約是
Chromium 83~85，不是 57~65。** 可能的解釋有幾種：廠商 ROM 塞了舊版 WebView、
WebView provider 被指到別的實作、或者當初那次 `gap` 實測的條件跟現在不同。

這個矛盾很值錢，因為兩種情境的工作量差一個量級：

| 特性 | 需要 Ch | 用量 | 若 WebView 是 58 | 若是 83~85 |
|---|---|---|---|---|
| `gap`（grid） | 66 | 36 | ❌ | ✅ |
| `env(safe-area)` | 69 | 209 | ❌ | ✅ |
| `min()` / `max()` | 79 | 87 | ❌ | ✅ |
| **`gap`（flex）** | **84** | **319** | ❌ | **剛好在邊界** |
| `aspect-ratio` / `:is()` | 88 | 11 | ❌ | ❌ |
| `dvh` | 108 | 96 | ❌ | ❌ |
| **要改的處數** | | | **約 805** | **約 107** |

若 WebView 其實是 83~85，要改的從約 805 處掉到約 107 處，而最大一筆的
flex gap（319 處）剛好卡在 84 這條線上 —— 是「全滅」還是「剛好過關」，
差別極大。

**不要再推測，指紋頁一開就有確切的 Chromium 版本號。** 下面那份
「模擬器實測基準」是 Chromium 58 的情境，也就是最壞情況；
若實機的版本更高，照上表往好的方向修正。

主專案的 382 個樣式檔（**無任何 browserslist 設定**）掃出來的用量：

| 特性 | 需要 Chromium | 用量 | 判定 |
|---|---|---|---|
| `var(--x)` | 49 | 414 | 安全 |
| `position:sticky` | 56 | 7 | 大概安全 |
| `display:grid` | 57 | 108 | 已實測支援 |
| `gap`（flex 容器） | **84** | **319** | 壞，**無舊語法可救**，只能改 margin |
| `gap`（grid 容器） | 66 | 36 | 壞，但雙寫 `grid-gap` 可救 |
| `gap`（同塊未寫 display） | — | 47 | 待人工判斷，樣本多為 flex |
| `env(safe-area-inset-*)` | 69 | 209 | 壞 |
| `min()` / `max()` | 79 | 87 | 壞 |
| `aspect-ratio` | 88 | 9 | 壞 |
| `:is()` | 88 | 2 | 壞 |
| `dvh` | **108** | **96** | 壞，首要嫌犯 |

**約 805 處，其中只有 36 處（4.5%）有低成本解法。** 而且最致命的寫法是
`height: calc(100dvh - env(safe-area-inset-top) - ...)` —— `calc()` 裡任一 token
不認得，**整條宣告會被丟棄**，不是退化成部分正確，是高度直接消失、版面塌掉。

所以這個專案要在一輪之內同時量出兩件事：

- **左欄**：改 CSS 適配舊引擎，實際要付多少價
- **右欄**：自帶引擎能不能救

兩欄都拿到，才能決定投哪條路。**這一輪不估 plugin 重接成本** —— 若右欄也壞，根本不用估。

## 結構

```
web/                  測試頁本體（純靜態、零建置、部署到 GitHub Pages）
  index.html          首屏：環境指紋 + 目錄 + 操作說明
  01-baseline.html    Ch 49~57   基準對照（預期全綠）
  02-gap.html         Ch 57~69   關鍵頁：三種 gap 寫法 + safe-area
  03-fn.html          Ch 79~88   min() clamp() aspect-ratio :is()
  04-viewport.html    Ch 105~111 :has() dvh svh color-mix()
  05-visual.html      Ch 26~76   漸層 blur clip-path 混色 毛玻璃
  base.css            版面（不含任何被測特性）
  claims.css          @supports 宣稱偵測
  fingerprint.js      環境指紋（純 ES5）

shell-capacitor/      殼 A：Capacitor 7，走系統 WebView
  www/index.html      ES5 loader（timestamp cache-bust + 離線 fallback 連結）
  www/offline/        web/ 的複本，由 scripts/sync-offline.sh 產生（不進版控）

shell-geckoview/      殼 B：極簡 Kotlin Activity + GeckoView（自帶引擎）

scripts/sync-offline.sh   本機與 CI 共用的離線複製腳本
.github/workflows/
  pages.yml           改測項 → push → 自動部署（APK 不用重建）
  apk.yml             手動觸發 → 建兩個 APK → 發成 GitHub Release
```

## 設計上的硬規則

這幾條是刻意的，改動前請先讀理由：

**測試頁自己不准用任何被測特性。** `base.css` 的版面只用
`display:table` / `float` / `margin` / `px` / `%` / `vh`。若版面踩到被測特性，
測試頁在舊 WebView 上會自己爛掉，就分不出是測項壞還是工具壞。

**JS 只用 ES5。** 目標引擎是 Chromium 57~65。Vite/Vue 的產出含 `?.` `??`
會直接 SyntaxError → 白畫面 → 對方回報「什麼都沒有」→ 你不知道是 CSS 壞還是 JS 壞。
以「一台機器、不方便常接」的前提，這種模糊回報要付一整輪的代價。

**頁尾用 static，不用 `position: fixed`。** 每頁都比一個螢幕高，對方必須用捲動截圖，
而 fixed 元素在捲動截圖裡會停在中間擋掉內容（實測擋掉了一整個測項）。
另外舊 WebView 的 `position: fixed` 本身就不穩定 —— 版面不該依賴一個自己也在被懷疑的特性。

**判定靠人眼，不寫自動斷言。** 使用場景是交給不懂 CSS 的人截圖回傳，
所以每個測項都必須自我解釋。多數測項是 reftest 並排（左「測試」、右「參考」，
參考用保守 CSS 畫出必定正確的同一個圖形），對方只要回答「左右一不一樣」。

**GeckoView 用當下最新的 153。** 裝置是 Android 11（API 30），遠高於 153 要求的
minSdk 26，沒有遷就舊版的理由。這裡有兩件查證過的事，記下來免得下次又走冤枉路：

**GeckoView 沒有 ESR 通道。** Mozilla Maven 上只有 `geckoview`（release）、
`geckoview-beta`、`geckoview-omni`；`geckoview-esr*` 全是 404。而且每個主版本
只有 2~3 個 build 且全是 `.0` 結尾，拿不到 `140.1.x` 那種 ESR 長期安全更新。
所以「挑 ESR 換長期支援」在 GeckoView 上根本不存在 —— 選版準則就是
「minSdk 相容的最新版」，然後定期升。

**minSdk 的分界在 144 / 145 之間**（直接讀各版 AAR 的 AndroidManifest 查出來的）：

| Gecko | minSdk |
|---|---|
| 128 / 132 / 136 / 140 / 141 / **144** | **21** |
| **145** / 148 / 153 | **26** |

所以哪天真要支援 API 21~25 的裝置，天花板是 `144.0.20251027123126`（2025-10），
不是原先誤以為的 128 —— 那個誤判讓我一度以為得停在 2024-07 的版本。

（兩個附帶的版本相依：GeckoView 的依賴鏈要求 `compileSdk 36`，超過 AGP 8.7.2 的
上限，所以這個殼用 AGP 8.10.1；另外 GeckoView 153 依賴 `kotlin-stdlib 2.3.21`，
配 Kotlin plugin 2.1.0 會出現 `metadata is 2.3.0, expected 2.1.0` 並連帶觸發
編譯器內部錯誤 `source must not be null` —— 看起來像程式碼壞了，其實是版本不匹配，
所以 Kotlin plugin 也升到 2.3.21。兩個殼是各自獨立的 Gradle 專案，
版本不同沒問題，仍共用同一個 JDK 21。）

**離線 fallback 是必需的，不是可選的。** Android 7.1.1 以下不信任 Let's Encrypt 的
ISRG Root X1（給舊 Android 的交叉簽相容鏈已於 2024 停止），而 GitHub Pages 用的正是它。
若目標裝置落在那個範圍，線上版會因 TLS 握手失敗而白畫面。
（順帶：GeckoView 自帶 NSS，不依賴系統憑證庫，所以殼 B 不受這個問題影響。
若出現「系統版連不上、自帶版連得上」，那本身就是有價值的發現。）

## 日常迭代

改測項**不需要重建 APK**：

```
改 web/ 裡的檔案 → git push → 對方重開 app
```

loader 頁每次開啟都帶新的 `?t=<timestamp>`，URL 每次都不同，繞過所有快取層。
這是刻意不用 `capacitor.config` 的 `server.url` 的原因 —— `server.url` 只換起始網址，
完全沒碰 WebView 的 HTTP cache，結果就是改了看不到、得刪掉 app 重裝。

## 本機驗證

測試頁：

```sh
cd web && python3 -m http.server 8765
# 用現代瀏覽器開 http://127.0.0.1:8765/
# 應該：所有 reftest 左右一致、所有「引擎宣稱」都顯示支援
```

若有任何一項左右不一致，是**測試頁自己寫錯**，不是引擎的問題 —— 先修測試頁。

肉眼看 18 組 reftest 很容易漏，所以 `tools/` 有兩支可選的檢查腳本（測試頁本身零建置，這些只在開發時用）：

```sh
cd tools && npm i && npx playwright install chromium --only-shell

npm run check          # 對本機 server：量每組 reftest 兩側的幾何與顏色、讀所有「引擎宣稱」、順便截圖
npm run check:live     # 對線上部署版跑同一套
npm run check:loader   # 驗 loader：正常連線會不會帶 timestamp 跳轉、斷網會不會留在頁面讓 fallback 可點
```

改完測項就跑一次 `npm run check`。這兩支腳本抓到過兩個實際的 bug：
一是實測數值那行誤用了 `.claim` class，畫面上會先印「引擎宣稱：不支援」再接上數值，
對方讀到的是自相矛盾的一行；二是 loader 原本無條件 `location.replace()`，
斷網時 WebView 會跳到自己的錯誤頁，離線版連結永遠點不到。
兩個都不是肉眼看得出來的。

建 APK（本機）：

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"

./scripts/sync-offline.sh

cd shell-capacitor && npm ci && npx cap sync android
cd android && ./gradlew assembleDebug

cd ../../shell-geckoview && ./gradlew assembleDebug
```

需要 SDK platform **android-35**（Capacitor 殼）與 **android-36**（GeckoView 殼）。
給對方的正式版一律走 CI，本機建置只用於除錯。

## 用模擬器重現目標環境

**API 26 的 system image 內建 WebView 就是 Chromium 58**，正好落在目標裝置
推測的 57~65 區間，所以不需要另外去 APKMirror 找舊版 WebView APK。
Apple Silicon 上也有 arm64 image（原生速度）。

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

yes | "$SDKM" "system-images;android-26;google_apis;arm64-v8a"
echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" \
  create avd -n css26 -k "system-images;android-26;google_apis;arm64-v8a" -d pixel

"$ANDROID_HOME/emulator/emulator" -avd css26 -no-window -no-audio -no-boot-anim &
adb wait-for-device
adb shell dumpsys package com.android.webview | grep versionName   # 應該是 58.x
```

**要用 `google_apis`，不要用 `default`（AOSP）。** API 26 的 AOSP arm64 image
雖然 `/system/app/webview/webview.apk` 存在（74MB、版本 58.0.3029.125），
但它的 framework 白名單（`dumpsys webviewupdate` 的 `WebView packages:`）是空的，
任何套件都不能當 WebView provider —— `pm enable` 有效、重開機也沒用、
`cmd webviewupdate set-webview-implementation` 直接回
`Failed to switch to com.android.webview`。app 一開就是
`WebViewFactory: Chromium WebView package does not exist`。

裝 APK 並看畫面：

```sh
adb install -r shell-capacitor/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n live.goer.csstest.system/.MainActivity
adb exec-out screencap -p > shot.png
```

## 模擬器實測基準（Chromium 58）

已經在 Android 8.0 + WebView `58.0.3029.125` 的模擬器上跑完一輪。
**Chromium 58 是推測區間 57~65 的下限，所以這是最壞情況** ——
實機若版本更高，結果只會更好，不會更差。

| 特性 | 需要 Ch | 用量 | 殼 A 宣稱 | 殼 A 實際渲染 | 殼 B |
|---|---|---|---|---|---|
| `var(--x)` | 49 | 414 | 支援 | ✅ 支援 | ✅ |
| `position:sticky` | 56 | 7 | 支援 | ✅ 支援（標題列黏頂端） | ✅ |
| `display:grid` | 57 | 108 | 支援 | ✅ 支援（三塊橫排） | ✅ |
| **`grid-gap` 舊語法** | 57 | 0 | 支援 | ✅ **支援（有間距）** | ✅ 實測 |
| `gap`（grid） | 66 | 36 | 不支援 | ❌ 方塊黏在一起 | ✅ **實測轉綠** |
| `env(safe-area-inset-*)` | 69 | 209 | 不支援 | ❌ 實測讀到 `50px` | ✅ 推定 |
| `min()` / `max()` | 79 | 87 | 不支援 | ❌ 撐滿容器 | ✅ 推定 |
| `clamp()` | 79 | 0 | 不支援 | ❌ 撐滿容器 | ✅ 推定 |
| **`gap`（flex）** | 84 | **319** | 不支援 | ❌ 三塊完全黏在一起 | ✅ 推定 |
| `aspect-ratio` | 88 | 9 | 不支援 | ❌ 方塊完全消失 | ✅ 推定 |
| `:is()` | 88 | 2 | 不支援 | ❌ 留在灰色 | ✅ 推定 |
| `:has()` | 105 | 0 | 不支援 | （依版本推定） | ✅ 推定 |
| **`dvh`** | 108 | **96** | 不支援 | ❌ **高度歸零** | ✅ 推定 |
| `svh` | 108 | — | 不支援 | ❌ 高度歸零（與 `dvh` 一致） | ✅ 推定 |
| `color-mix()` | 111 | 0 | 不支援 | （依版本推定） | ✅ 推定 |
| **`calc()` 混 `env()`** | — | 10 | 不支援 | ❌ **整條丟棄、高度歸零** | ✅ 推定 |

殼 A = Capacitor（系統 WebView 58）／殼 B = GeckoView（Gecko 128）。

殼 B 只實測了 `grid-gap` 與 `gap`（grid）—— 後者在殼 A 是紅色、在殼 B 轉綠，
**對照關係成立**。其餘標「推定」是依 Firefox 128 的支援門檻推得
（`dvh` 需 Fx 101、`:has()` 需 121、`color-mix()` 需 113，128 全數涵蓋），
不是實測。要完整填滿殼 B 這一欄，就是實機那一輪的事。

**收到殼 B 的截圖時注意：GeckoView 的 UA 把系統版本凍結成 Android 10**
（Firefox 的隱私措施）。模擬器實際是 Android 8.0，指紋卻顯示 Android 10 ——
所以殼 B 截圖上的 Android 版本不可信，要看 Android 版本請看殼 A 的截圖。

三個有直接行動意義的結論：

1. **`grid-gap` 舊語法可用** → 那 36 處 grid gap 靠雙寫就能救。
2. **flex gap 的 319 處沒有捷徑** → 只能改 margin。這是最大一筆工作量。
3. **`calc()` 混 `env()` / `dvh` 會讓高度直接歸零** → 這是版面整體塌掉的主因，
   而不是「某個間距不見了」這種局部問題。主專案那 96 處 `dvh`
   加上 10 處 `calc(100dvh - env(...))` 就足以解釋災情規模。

`min()`/`max()` 沒有單獨截圖，但引擎宣稱不支援，且同一批實作的 `clamp()`
實測確認不支援 —— 這兩項本來就設計成互為交叉驗證。

## Gecko 128 對新語法的支援度（選配頁的實測）

`06-modern.html` 是額外的探索頁，測 2020~2025 的新語法。
系統 WebView 58 那邊這一整頁必然全紅，不列。

**下面這份結果是在 Gecko 128 上測的**，而殼現在已經換成 153 —— 也就是說
實際出貨的引擎比這張表新了兩年，表裡那些 ❌ 有一部分在 153 上應該已經是 ✅。
留著這張表的價值在於它標出了「2024-07 那條線」，要重測只需重跑一次選配頁。

| 年份（Chrome 首發） | 特性 | Gecko 128 | 依據 |
|---|---|---|---|
| 2020 | `@property` | ✅ 支援 | 並排實測 |
| 2022 | `@container` | ✅ 支援 | 並排實測 |
| 2023 | **`subgrid`** | ✅ 支援 | 並排實測 |
| 2023 | `oklch()` | ✅ 支援 | 並排實測 |
| 2023 | CSS 巢狀 `&` | ✅ 支援 | 並排實測 |
| 2023 | `text-wrap: balance` | ✅ 支援 | 宣稱 |
| 2023 | `:popover-open` | ✅ 支援 | 宣稱 |
| 2023 | **`@scope`** | ❌ 不支援 | 並排實測 |
| 2023 | `animation-timeline: scroll()` | ❌ 不支援 | 宣稱 |
| 2024 | `light-dark()` | ✅ 支援 | 並排實測 |
| 2024 | `anchor-name` 錨點定位 | ❌ 不支援 | 宣稱 |
| 2024 | `field-sizing` | ❌ 不支援 | 宣稱 |
| 2024 | `calc-size()` | ❌ 不支援 | 宣稱 |
| 2025 | `text-box-trim` | ❌ 不支援 | 宣稱 |
| 2025 | `shape()` | ❌ 不支援 | 宣稱 |
| 2025 | `corner-shape` | ❌ 不支援 | 宣稱 |
| 2025 | `if()` | ❌ 不支援 | 宣稱 |
| 2025 | `reading-flow` | ❌ 不支援 | 宣稱 |

**分界線落在 2024 上半**：2023 及之前幾乎全支援（例外是 `@scope` 與捲動驅動動畫），
2024 只過了 `light-dark()`，2025 那批全滅。這符合 128 是 2024-07 ESR 的定位。

`subgrid` 是刻意留的反例：**Firefox 2019 就支援、Chrome 晚到 2023** ——
「新語法 = Chrome 才有」不成立，兩邊各有領先的項目。

對決策的意義：主專案目前最新的需求是 `dvh`（2022），
**Gecko 128 遠遠超過所需**，換引擎在 CSS 能力上完全沒有問題，
還順帶多出 `@property` / `@container` / `subgrid` / `oklch()` / 巢狀可以用。

### 這一頁順便暴露了 `@supports` 的第二種騙人方式

`@property` 與 `@container` 一開始都顯示「引擎宣稱：不支援」，但並排的實際渲染是支援的。
原因是我用了 `@supports at-rule(@property)` —— **`at-rule()` 這個偵測語法本身是 2025 年
才加進 `@supports` 的，比被偵測的特性還新**。Gecko 128 不認得它，條件就成了 false。

**偵測方法不被支援 ≠ 被偵測的特性不被支援。** 這跟 flex gap 的
「宣稱支援但實際壞掉」剛好是反方向 —— 兩個方向都只有 reftest 並排抓得到。
已改成 `@container` 用屬性偵測（`container-type`），`@property` 與 `@scope`
沒有可靠的 CSS-only 偵測方式，頁面上直接標明只看並排。

## 收到截圖之後

先看每頁的 `build` 時間戳對不對；不對就請對方重開 app，不要浪費時間懷疑測項。

然後填這張表：

| 特性 | 需要 Ch | 主專案用量 | 系統 WebView（殼 A） | GeckoView（殼 B） |
|---|---|---|---|---|
| `var(--x)` | 49 | 414 | | |
| `position:sticky` | 56 | 7 | | |
| `display:grid` | 57 | 108 | ✓ 已知 | |
| `grid-gap` 舊語法 | 57 | 0（救援方案） | | |
| `gap`（grid） | 66 | 36 | ✗ 已知 | |
| `env(safe-area)` | 69 | 209 | | |
| `min()` / `max()` | 79 | 87 | | |
| `gap`（flex） | 84 | 319 | | |
| `aspect-ratio` | 88 | 9 | | |
| `:is()` | 88 | 2 | | |
| `:has()` | 105 | 0 | | |
| `dvh` | 108 | 96 | | |
| `color-mix()` | 111 | 0 | | |

左欄給出改 主專案的真實工作量，右欄回答自帶引擎可不可行。
兩者一起，才能決定下一步。

指紋頁的 Chromium 版本號其實會直接告訴你答案，但仍然要跑測項 ——
UA 可能被 ROM 改過，而廠商 ROM 也可能有 backport 或閹割的部分實作。
`min()`/`clamp()` 和 `dvh`/`svh` 各是同一批實作，結果理論上必須一致；
若不一致，就是這種被動過的引擎，整份版本推論都要重新檢視。
