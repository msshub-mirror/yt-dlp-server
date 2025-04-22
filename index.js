const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ytdl = require('ytdl-core');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/videos', express.static('videos', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
    }
  }
}));

// WebSocketサーバー
const wss = new WebSocket.Server({ noServer: true });
const clients = new Map(); // id => ws

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const id = params.get('id');
  if (id) {
    clients.set(id, ws);
    ws.on('close', () => clients.delete(id));
  }
});

// 非同期ダウンロード
app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const id = ytdl.getVideoID(url);
  const outputPath = path.join(__dirname, 'videos', `${id}.mp4`);

  if (!fs.existsSync(outputPath)) {
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    const cmd = './yt-dlp';
    const args = [
      '--cookies', cookiesPath,
      '-f', 'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]',
      '--merge-output-format', 'mp4',
      '-o', `videos/${id}.mp4`,
      url
    ];

    const proc = spawn(cmd, args);

    proc.stderr.on('data', (data) => {
      const message = data.toString();
      const match = message.match(/(\d{1,3}\.\d)%/); // 進捗 例:  23.4%
      if (match && clients.has(id)) {
        const ws = clients.get(id);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ progress: parseFloat(match[1]) }));
        }
      }
    });

    proc.on('close', (code) => {
      const ws = clients.get(id);
      if (code === 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ done: true, url: `/videos/${id}.mp4` }));
      }
    });
  }

  res.json({ id });
});

// WebSocket Upgrade
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});
