const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 動画ファイルの静的配信
app.use('/videos', express.static('videos', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
    }
  }
}));

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: '無効なURLです' });
  }

  const id = ytdl.getVideoID(url);
  const outputPath = path.join(__dirname, 'videos', `${id}.mp4`);

  if (fs.existsSync(outputPath)) {
    // すでにファイルが存在すればキャッシュを返す
    return res.json({ success: true, cached: true, videoUrl: `/videos/${id}.mp4` });
  }

  // cookies.txtのパス
  const cookiesPath = path.join(__dirname, 'cookies.txt');
  const cmd = `./yt-dlp -v --cookies ${cookiesPath} -f "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4 -o videos/${id}.mp4 ${url}`;

  // 非同期でダウンロード（返答は先に返す）
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`yt-dlp error: ${stderr}`);
    } else {
      console.log(`Downloaded: ${id}`);
    }
  });

  res.json({ success: true, cached: false, videoUrl: `/videos/${id}.mp4` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
