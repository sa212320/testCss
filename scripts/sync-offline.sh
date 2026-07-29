#!/bin/sh
# 把 web/ 複製成 Capacitor 殼的離線 fallback。
#
# 為什麼需要離線 fallback：Android 7.1.1 以下不信任 Let's Encrypt 的
# ISRG Root X1（給舊 Android 的交叉簽相容鏈已於 2024 停止），而 GitHub Pages
# 用的正是 Let's Encrypt。若目標裝置落在那個範圍，loader 的跳轉會因為
# TLS 握手失敗而白畫面 —— 那一輪測試就完全白費。有離線版時，
# 對方至少還能點 loader 頁上的連結，拿到完整測項。
#
# 本機與 CI 共用這一支腳本，避免兩邊的複製邏輯 drift。
#
# 注意執行順序：必須先把 web/ 裡的 __BUILD__ 換成時間戳，再跑這支腳本，
# 這樣線上版與離線版帶的是同一個 build 標記，收到截圖時才分辨得出版本。

set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST="$ROOT/shell-capacitor/www/offline"

rm -rf "$DEST"
mkdir -p "$DEST"
cp "$ROOT"/web/*.html "$ROOT"/web/*.css "$ROOT"/web/*.js "$DEST"/

echo "離線 fallback 已同步 → $DEST"
ls -1 "$DEST"
