/* Capacitor 殼的 loader 用這支檔案探測連線。
   內容不重要 —— 能不能載入才重要。

   為什麼要探測而不是直接跳轉：loader 若無條件 location.replace()，
   一旦網路不通或憑證不被裝置信任，WebView 會導航到自己的錯誤頁，
   loader 頁就離開了，上面的「離線版」連結永遠點不到。
   用 <script> 而不是 XHR，是因為 script 載入不受 CORS 限制，
   而 GitHub Pages 沒有送 CORS header，XHR 探測一定失敗。 */
window.__probeOk = 1;
