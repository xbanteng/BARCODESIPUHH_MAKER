const { cmd } = require('../lib/redis');
const data = require('../protected/app.json');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Metode tidak diizinkan.');
  try {
    const t = String((req.body && req.body.token) || '');
    if (!/^[a-f0-9]{48}$/.test(t)) return res.status(401).send('Sesi tidak valid.');
    const ok = await cmd('GET', 'sess:' + t);
    if (!ok) return res.status(401).send('Sesi berakhir. Minta kode baru.');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(data.html);
  } catch (e) {
    return res.status(500).send('Kesalahan server.');
  }
};
