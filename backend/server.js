const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// === FIREBASE ===
const serviceAccount = {
  projectId: 'sobes-ru',
  clientEmail: 'firebase-adminsdk-fbsvc@sobes-ru.iam.gserviceaccount.com',
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCXkk+FJe2csemH\ndm0RL0+VeRibIvVxZTeK76wnhei7a+tiP73uXttNhGwJUoSb7AoH/XlyX516th6Y\nHB2PTKWK1Ge/X9Wq8+7sU2ItotRvRNFR4vT9OGn0E167qHOdQEO80DP1XxWTV4eO\nqA3doS5KFDD1SyEKTu774ZHldxN4+cNLzKCIrxtNraT+yGW0Vhma94J31EXU+AOo\nzYL1//1CLI8jE2SPxnjyKkXfexXJ6Xli/CnKsqg3nNaLnMFCjqmtzj2XjRorgd22\nsT6LsU7uQfwIxF9Ldo0ya9tKTxPWWdpp0FRitAbdTV1VCDNszo9zAiLw15LfltHe\n2mHICZYHAgMBAAECggEANg1/3Uhi3eQWl2/0wlGgbHo0e7KyW/+QGLSTLL8U+a2p\nUi7QIW9jftfwHTz3vJEnHKVYx6BwjR/gdjdklUNsr79Cxl07Wg1G0bGEzCiK4Klm\ninDJFHqnUlsMCBkxLc2Kuo13UhRYIeTvm0C0PSrrUpCzyu5BeKcgk+Pj/zSBVb0T\n2Gc43p4w2/Pt84RXmSqVBBBT0xcxualUASaORBRLcgIDYiF/jVXHBA0eWkFMpeVY\n16pHXtHP2kEcQhteMu0VgDXSSmSosr1lGfYGxc2/sA9L/xqKb6DgD/hPKCGNfDUa\nCMlnAlT0DllGG58KdCB6OdiQlULtE+1jLF7CDUAgxQKBgQDF+8ieDD21XY8UoPte\nAIeM+EY82AwaUken/Blfef0kCn8ZdFY0eHKF8JsJn81EOTIRW5sF3OKlZmUxl4XQ\nEEIKY2BAg8kriF8eBsZ9YwFHI9F84hsbbEEGMoYufcVg/3+UzudrQAm7i5OdiuDZ\noXR67faLpxaOJ/4l9bZL4Qme0wKBgQDD/NFJVzSxr3aPXWA/3zPiPx8MnhQUbttj\nHL8ZODEZdN6szfaaqkbRTzq5fhnz5wTqkTH5YQOccewWPkbAOybxZSF6cXqK6ubx\nwHSV4isuTMlRbqF+QJUYOnpbSJm9HcUq1JpHFMP/c7BVyceYJp4GwjCojudFFOSu\nrHQq46EzfQKBgQC/IczSr9SfE9x+uM8TOAWklUcRlC1S994PkXRZVSaKNcvwIfzb\nGPDO17KE/w4mb+UjFsG5Tj5MGWdWEgbwD9IBv2B7x/5dFYFmNnpHMF5adHzYSFyN\nA9xehEY/+dGkS+S6H2kQhDkhIqV2sU1TLOiLiNG8jqlawcc8lFLSPEWSWwKBgGgd\n5xEPQu8iR9nhwUAtU2LeJaCOWhyAyAvfOaYsM+lSLPmgcWG5E+YeMRRZ6W+pSvNS\nLzpMT57M5p7qdquowQd8skxZ/L/QCuBjXYxCmq3+HPUl0KVBqfM1HctgxkuxhQ07\n5LneTkFnNEZe66no2gq9Hxxszm/kqZgiBZTDWOABAoGBALdzpEziJ0NfzS/PrgG2\nmuh771XuNhfn0bZOGUF+4DnbYz52+HkQ1gPla+MAqx8TVPKSE/vVwmApYMKad4za\nvvdN5XlSwN9X1GuO4ygOZS4U2ex+yTlss1zqRzf+4/29NGgs7XbKY8NcchQawydh\n7aormB1JTuDe0OafFpdYxqYg\n-----END PRIVATE KEY-----\n'
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL || 'https://sobes-ru-default-rtdb.europe-west1.firebasedatabase.app'
});

const db = admin.database();
const ref = db.ref('applications');

// === EXPRESS ===
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '8676936676:AAHBrDa0oJYMmZCx8iYYmNVPX1A25eO1htg';
const MODERATOR_CHAT = '476689983';

// === API ===

// Регистрация
app.get('/api/register', async (req, res) => {
  try {
    const phone = req.query.phone || req.body?.phone;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
    let existing = null;
    snapshot.forEach(child => { existing = child.val(); });
    if (existing) return res.json({ status: 'exists', id: existing.id, phone });

    const id = 'U' + Date.now().toString(36).toUpperCase();
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk' });

    await ref.child(id).set({
      id, phone, status: 'new', promo: '',
      date: now.split(',')[0].trim(),
      time: now.split(',')[1].trim(),
      created: Date.now()
    });

    res.json({ status: 'registered', id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Отметка "выполнил"
app.get('/api/done', async (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
    let key = null;
    snapshot.forEach(child => { key = child.key; });
    if (!key) return res.status(404).json({ error: 'User not found' });

    await ref.child(key).update({ status: 'review' });

    // Уведомление модератору
    const msg = `🕐 <b>Ожидает проверки</b>\n📞 ${phone}\n/approve ${phone}\n/reject ${phone}`;
    await sendTelegram(MODERATOR_CHAT, msg);

    res.json({ status: 'review' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Проверка статуса
app.get('/api/status', async (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
    let data = null;
    snapshot.forEach(child => { data = child.val(); });
    if (!data) return res.status(404).json({ error: 'User not found' });

    res.json({ status: data.status, promo: data.promo || null, id: data.id, phone: data.phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === HEALTH CHECK ===
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'sobes-ru-backend' });
});

// === START ===
app.listen(PORT, () => {
  console.log(`SOBES.RU backend running on port ${PORT}`);
  checkPendingApprovals();
});

// === TELEGRAM ===
async function sendTelegram(chatId, text) {
  const https = require('https');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true
    });
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// === Обработка команд модератора (polling) ===
let lastUpdateId = 0;

async function checkPendingApprovals() {
  const https = require('https');
  setInterval(async () => {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      if (!data.ok || !data.result) return;

      for (const update of data.result) {
        lastUpdateId = update.update_id;
        if (!update.message || !update.message.text) continue;
        if (update.message.chat.id.toString() !== MODERATOR_CHAT) continue;

        const text = update.message.text.trim();
        let phone;

        if (text === '/list') {
          const snapshot = await ref.orderByChild('status').once('value');
          let apps = [];
          snapshot.forEach(child => apps.push(child.val()));
          apps.reverse();

          let reply = '<b>Заявки (новые сверху):</b>\n';
          if (apps.length === 0) {
            reply = 'Нет заявок';
          } else {
            const recent = apps.slice(0, 10);
            for (const a of recent) {
              const icon = a.status === 'approved' ? '✅' : a.status === 'rejected' ? '❌' : a.status === 'review' ? '🕐' : '🆕';
              reply += `\n${icon} ${a.phone} — ${a.status}`;
            }
          }
          await sendTelegram(MODERATOR_CHAT, reply);

        } else if (text.startsWith('/approve ')) {
          phone = text.replace('/approve ', '').trim();
          await moderateUser(phone, 'approved');

        } else if (text.startsWith('/reject ')) {
          phone = text.replace('/reject ', '').trim();
          await moderateUser(phone, 'rejected');

        } else if (text.startsWith('/status ')) {
          phone = text.replace('/status ', '').trim();
          const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
          let d = null;
          snapshot.forEach(child => { d = child.val(); });
          if (!d) {
            await sendTelegram(MODERATOR_CHAT, `❌ ${phone} — не найден`);
          } else {
            const promo = d.promo ? `\n🎟 ${d.promo}` : '';
            await sendTelegram(MODERATOR_CHAT, `📊 <b>${phone}</b>\n📌 ${d.status}${promo}`);
          }
        }
      }
    } catch (e) {
      // silent
    }
  }, 3000); // каждые 3 секунды
}

async function moderateUser(phone, status) {
  const snapshot = await ref.orderByChild('phone').equalTo(phone).once('value');
  let key = null, data = null;
  snapshot.forEach(child => { key = child.key; data = child.val(); });
  if (!key) {
    await sendTelegram(MODERATOR_CHAT, `❌ ${phone} — не найден`);
    return;
  }

  if (status === 'approved') {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const n = String(Math.floor(Math.random() * 999)).padStart(3, '0');
    const code = 'SR-' + d + m + '-' + n;

    await ref.child(key).update({ status: 'approved', promo: code });
    await sendTelegram(MODERATOR_CHAT, `✅ Одобрено: ${phone}\n🎟 ${code}`);
  }

  if (status === 'rejected') {
    await ref.child(key).update({ status: 'rejected' });
    await sendTelegram(MODERATOR_CHAT, `✅ Отклонено: ${phone}`);
  }
}
