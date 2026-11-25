const crypto = require('crypto');
const { cmd } = require('../lib/redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  try {
    // Batas: 1 permintaan per menit, maksimal 10 per jam
    const ok = await cmd('SET', 'otp:rl', '1', 'EX', '60', 'NX');
    if (!ok) return res.status(429).json({ error: 'Tunggu 1 menit sebelum meminta kode lagi.' });
    const n = await cmd('INCR', 'otp:hr');
    if (n === 1) await cmd('EXPIRE', 'otp:hr', '3600');
    if (n > 10) return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await cmd('SET', 'otp:current', code, 'EX', '300'); // berlaku 5 menit
    await cmd('DEL', 'otp:tries');

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Generator Label <onboarding@resend.dev>',
        to: [process.env.OWNER_EMAIL],
        subject: 'Kode OTP Generator Label: ' + code,
        html:
          '<div style="font-family:Arial,sans-serif;font-size:16px">' +
          '<p>Ada yang meminta akses ke Generator Label.</p>' +
          '<p style="font-size:32px;letter-spacing:6px;font-weight:bold">' + code + '</p>' +
          '<p>Berlaku 5 menit dan hanya bisa dipakai sekali. Abaikan email ini jika tidak ingin memberi akses.</p></div>',
      }),
    });
    if (!r.ok) {
      await cmd('DEL', 'otp:current');
      return res.status(502).json({ error: 'Gagal mengirim email. Periksa pengaturan Resend.' });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
};
