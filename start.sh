#!/bin/bash
# yt-dlpがない場合はインストール（Renderで動かすため）
if ! command -v yt-dlp &> /dev/null; then
  pip install yt-dlp
fi

node index.js
