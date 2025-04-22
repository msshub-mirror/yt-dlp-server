const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');

app.use(cors()); // CORS対応
app.use(bodyParser.json());
app.use('/videos', express.static('videos', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
    }
  }
}));

app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // cookies.txtのパスを設定
  const cookiesPath = path.join(__dirname, 'cookies.txt');

  // yt-dlpコマンドにcookies.txtのパスを渡す
  const cmd = `./yt-dlp -v --cookies ${cookiesPath} -f "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4 -o videos/sample.mp4 ${url}`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: stderr });
    }

    console.log(stdout);
    return res.json({ success: true, videoUrl: '/videos/sample.mp4' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
