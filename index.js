const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/videos', express.static('videos', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
      res.set('Cache-Control', 'no-store');
    }
  }
}));

let clients = {};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const { id } = JSON.parse(message);
      clients[id] = ws;
    } catch (e) {
      console.error('Invalid message received:', message);
    }
  });
});

app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const idMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  if (!idMatch) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const videoId = idMatch[1];
  const outputPath = `videos/${videoId}.mp4`;
  const cookiesPath = path.join(__dirname, 'cookies.txt');

  // キャッシュ有効期間（ミリ秒）ここでは1日 = 86400000ms
  const cacheDuration = 24 * 60 * 60 * 1000;

  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const now = new Date();
    const fileAge = now - stats.mtime;

    if (fileAge < cacheDuration) {
      // キャッシュが新しいならそのまま返す
      return res.json({ success: true, videoUrl: `/videos/${videoId}.mp4` });
    } else {
      console.log(`キャッシュは古いため再ダウンロードします: ${videoId}`);
    }
  }

  // yt-dlpでダウンロード
  const cmd = `./yt-dlp -v --cookies ${cookiesPath} -f "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4 -o ${outputPath} ${url}`;
  const child = exec(cmd);

  child.stdout.on('data', data => {
    if (clients[videoId]) {
      clients[videoId].send(JSON.stringify({ progress: data }));
    }
  });

  child.stderr.on('data', data => {
    if (clients[videoId]) {
      clients[videoId].send(JSON.stringify({ progress: data }));
    }
  });

  child.on('exit', code => {
    if (clients[videoId]) {
      clients[videoId].send(JSON.stringify({
        done: true,
        success: code === 0,
        videoUrl: `/videos/${videoId}.mp4`
      }));
      delete clients[videoId];
    }
  });

  res.json({ success: true, videoId }); // WebSocketで進捗通知
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
