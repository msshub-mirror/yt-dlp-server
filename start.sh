#!/bin/bash

# yt-dlp バイナリがなければダウンロード
if [ ! -f yt-dlp ]; then
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
  chmod +x yt-dlp
fi

# Node.js 実行
node index.js
