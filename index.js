/* -------------------------------------------------
   yt-dlp サーバー  (バックエンド)
   ------------------------------------------------- */
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const { exec }   = require('child_process');
const path       = require('path');
const WebSocket  = require('ws');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- 基本ミドルウェア ---------- */
app.use(cors());
app.use(bodyParser.json());
app.use('/videos', express.static(path.join(__dirname, 'videos')));

/* -------------------------------------------------
   /download  ― 動画を非同期ダウンロード
   ------------------------------------------------- */
app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ success: false, error: 'URL is required' });

  const id   = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)[1];
  const out  = `videos/${id}.%(ext)s`;

  // yt-dlp を非同期で実行
  const cmd = `yt-dlp --newline -f bestvideo+bestaudio --merge-output-format mp4 -o ${out} ${url}`;

  const child = exec(cmd);

  /* WebSocket へ進捗を送出 -------------------- */
  sockets[id]?.forEach(ws => {
    child.stdout.on('data', line => ws.send(JSON.stringify({ progress: line })));
  });

  child.on('exit', code => {
    const success = code === 0;
    sockets[id]?.forEach(ws => ws.send(JSON.stringify({
      done   : true,
      success: success,
      videoUrl: success ? `/${out.replace(/%\(ext\)s$/, 'mp4')}` : null
    })));
    delete sockets[id];
  });

  res.json({ success: true });
});

/* -------------------------------------------------
   /info  ― メタデータ＋コメント取得
   ------------------------------------------------- */
app.post('/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ success: false, error: 'URL is required' });

  // コメントも含め単一 JSON で取得
  const cmd = `yt-dlp --dump-single-json --skip-download --get-comments --no-playlist "${url}"`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
    if (err) return res.json({ success: false, error: stderr });

    let json;
    try { json = JSON.parse(stdout); }
    catch (e) { return res.json({ success: false, error: 'JSON parse error' }); }

    /* 必要部分だけ返却 ------------------------ */
    res.json({
      success: true,
      info: {
        title       : json.title,
        description : json.description,
        view_count  : json.view_count,
        upload_date : json.upload_date,       // yyyymmdd
        channel     : json.channel,
        channel_url : json.channel_url,
        uploader    : json.uploader,
        subscriber_count: json.subscriber_count,
        like_count  : json.like_count,
        comments    : (json.comments || []).slice(0, 20).map(c => ({
          author   : c.author,
          text     : c.text,
          likes    : c.like_count,
          published: c.time
        }))
      }
    });
  });
});

/* ---------- WebSocket サーバー ---------- */
const server = app.listen(PORT, () =>
  console.log(`yt-dlp server listening on ${PORT}`));

const wss = new WebSocket.Server({ server });
const sockets = {};      // { videoId: Set<WebSocket> }

wss.on('connection', ws => {
  ws.on('message', msg => {
    const { id } = JSON.parse(msg);
    sockets[id] = sockets[id] || new Set();
    sockets[id].add(ws);

    ws.on('close', () => sockets[id]?.delete(ws));
  });
});
