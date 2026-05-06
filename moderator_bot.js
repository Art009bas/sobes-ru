/**
 * SOBES.RU — Telegram Bot Moderator
 * 
 * Запуск: node moderator_bot.js
 * 
 * Команды:
 * /start — приветствие
 * /approve +7xxxxxxxxxx — одобрить заявку
 * /reject +7xxxxxxxxxx — отклонить
 * /status +7xxxxxxxxxx — проверить статус
 * /list — все заявки (последние 10)
 */

// HTTP-сервер для Render с Telegram webhook
const http = require('http');
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        if (update.message && update.message.text) {
          await handleCommand(update.message);
        }
        if (update.callback_query) {
          const q = update.callback_query;
          const data = q.data;
          await fetch(`${TG_API}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: q.id })
          });
          const [action, phone] = data.split(':');
          const cmd = action === 'approve' ? '/approve ' : '/reject ';
          await handleCommand({ chat: { id: q.message.chat.id }, text: cmd + phone });
        }
      } catch (e) {
        console.error('Webhook error:', e.message);
      }
      res.writeHead(200);
      res.end('OK');
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('SOBES.RU Moderator Bot is running');
  }
});
server.listen(process.env.PORT || 10000, () => {
  console.log('Server listening on port', process.env.PORT || 10000);
});

const TELEGRAM_TOKEN = '7949630793:AAHmdOmSer6igd93mMuBu4w_w2BjIviTDLs';
const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Разрешённые модераторы (chat_id)
const MODERATORS = ['476689983'];

// Данные (в продакшене — Google Sheets API)
const db = {
  users: new Map(),
  nextId: 1,
  add(phone) {
    const id = this.nextId++;
    const user = {
      id,
      phone,
      status: 'new',    // new → review → approved | rejected
      promo: null,
      createdAt: new Date(),
      updatedAt: null
    };
    this.users.set(phone, user);
    return user;
  },
  get(phone) { return this.users.get(phone); },
  getAll() {
    const arr = [];
    for (const [phone, user] of this.users) {
      arr.push(user);
    }
    return arr.sort((a,b) => b.id - a.id);
  },
  approve(phone) {
    const user = this.users.get(phone);
    if (!user) return null;
    user.status = 'approved';
    user.updatedAt = new Date();
    user.promo = generatePromoCode();
    return user;
  },
  reject(phone) {
    const user = this.users.get(phone);
    if (!user) return null;
    user.status = 'rejected';
    user.updatedAt = new Date();
    return user;
  }
};

function generatePromoCode() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2,'0');
  const m = String(now.getMonth()+1).padStart(2,'0');
  const n = String(Math.floor(Math.random()*999)).padStart(3,'0');
  return 'SR-' + d + m + '-' + n;
}

// === TELEGRAM API ===
async function sendMessage(chatId, text, opts = {}) {
  const body = { chat_id: chatId, text };
  if (opts.parse_mode) body.parse_mode = opts.parse_mode;
  if (opts.reply_markup) body.reply_markup = opts.reply_markup;

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function getUpdates(offset) {
  const params = new URLSearchParams({
    timeout: 30,
    allowed_updates: JSON.stringify(['message', 'callback_query'])
  });
  if (offset) params.set('offset', offset);
  const res = await fetch(`${TG_API}/getUpdates?${params}`);
  const data = await res.json();
  return data.ok ? data.result : [];
}

// === ОБРАБОТЧИК КОМАНД ===
async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Проверка модератора
  if (!MODERATORS.includes(String(chatId))) {
    return sendMessage(chatId, '⛔ У вас нет доступа к этому боту.');
  }

  // /start
  if (text === '/start') {
    return sendMessage(chatId,
      `🤖 <b>SOBES.RU — Модератор</b>\n\n` +
      `Команды:\n` +
      `/approve +7xxx — одобрить заявку\n` +
      `/reject +7xxx — отклонить\n` +
      `/status +7xxx — проверить статус\n` +
      `/list — все активные заявки\n\n` +
      `Для каждой заявки приходит уведомление с кнопками.`,
      { parse_mode: 'HTML' }
    );
  }

  // /approve +7xxxxxxxxxx
  if (text.startsWith('/approve ')) {
    const phone = text.replace('/approve ', '').trim();
    const user = db.approve(phone);
    if (!user) return sendMessage(chatId, `❌ Пользователь ${phone} не найден`);

    return sendMessage(chatId,
      `✅ <b>Заявка одобрена</b>\n` +
      `📞 ${phone}\n` +
      `🎟 Промокод: <code>${user.promo}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  // /reject +7xxxxxxxxxx
  if (text.startsWith('/reject ')) {
    const phone = text.replace('/reject ', '').trim();
    const user = db.reject(phone);
    if (!user) return sendMessage(chatId, `❌ Пользователь ${phone} не найден`);

    return sendMessage(chatId, `❌ Заявка отклонена: ${phone}`);
  }

  // /status +7xxxxxxxxxx
  if (text.startsWith('/status ')) {
    const phone = text.replace('/status ', '').trim();
    const user = db.get(phone);
    if (!user) return sendMessage(chatId, `❌ Пользователь ${phone} не найден`);

    const statusMap = {
      new: '🆕 Новая',
      review: '🕐 На проверке',
      approved: '✅ Одобрена',
      rejected: '❌ Отклонена'
    };
    return sendMessage(chatId,
      `<b>Статус заявки</b>\n` +
      `📞 ${phone}\n` +
      `📊 ${statusMap[user.status] || user.status}\n` +
      (user.promo ? `🎟 Промокод: <code>${user.promo}</code>` : ''),
      { parse_mode: 'HTML' }
    );
  }

  // /list
  if (text === '/list') {
    const all = db.getAll().slice(0, 10);
    if (!all.length) return sendMessage(chatId, 'Нет заявок');

    const lines = all.map(u => {
      const icon = u.status === 'approved' ? '✅' :
                   u.status === 'rejected' ? '❌' :
                   u.status === 'review' ? '🕐' : '🆕';
      return `${icon} ${u.phone} — ${u.status}`;
    });
    return sendMessage(chatId, `<b>Последние заявки:</b>\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  }

  // Неизвестная команда
  return sendMessage(chatId, 'Неизвестная команда. Используйте /start');
}

// === ОСНОВНОЙ ЦИКЛ ===
// Webhook-based — сервер принимает обновления от Telegram
console.log('🤖 SOBES.RU Moderator Bot started (webhook mode)');
console.log('Webhook URL: https://sobes-ru-bot.onrender.com');
console.log('Waiting for Telegram updates...');
