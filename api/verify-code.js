const crypto = require('crypto');
const { cmd } = require('../lib/redis');

const SESSION_SECONDS = 1800; // sesi 30 menit setelah kode benar
const MAX_TRIES = 5;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  try {
    const input = String((req.body && req.body.code) || '').trim();
    const cur = await cmd('GET', 'otp:current');
    if (!cur) return res.status(400).json({ error: 'Kode tidak ada atau sudah kedaluwarsa. Minta kode baru.' });

    const tries = await cmd('INCR', 'otp:tries');
    if (tries === 1) await cmd('EXPIRE', 'otp:tries', '300');
    if (tries > MAX_TRIES) {
      await cmd('DEL', 'otp:current');
      return res.status(429).json({ error: 'Terlalu banyak percobaan salah. Minta kode baru.' });
    }

    const a = Buffer.from(input);
    const b = Buffer.from(String(cur));
    const same = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!same) return res.status(401).json({ error: 'Kode salah.' });

    // DEL mengembalikan 1 hanya untuk satu pemakai pertama: kode benar-benar sekali pakai
    const deleted = await cmd('DEL', 'otp:current');
    if (deleted !== 1) return res.status(400).json({ error: 'Kode sudah dipakai. Minta kode baru.' });
    await cmd('DEL', 'otp:tries');

    const token = crypto.randomBytes(24).toString('hex');
    await cmd('SET', 'sess:' + token, '1', 'EX', String(SESSION_SECONDS));
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
};
