const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/videos', express.static('videos'));

app.post('/download', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const cmd = `yt-dlp -f bestvideo+bestaudio --merge-output-format mp4 -o videos/sample.mp4 ${url}`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: 'Failed to download video' });
    }
    console.log(stdout);
    return res.json({ success: true, videoUrl: '/videos/sample.mp4' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
