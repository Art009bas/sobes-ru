/*
 * SOBES.RU — Backend (Google Apps Script)
 * Привязывается к Google Sheets и Telegram Bot
 * 
 * Как установить:
 * 1. Создай Google Таблицу (docs.google.com/spreadsheets)
 * 2. Extensions → Apps Script
 * 3. Вставь этот код, сохрани
 * 4. Настрой триггер (см. ниже)
 * 5. Разверни как веб-приложение (Deploy → New deployment → Web app)
 */

// === НАСТРОЙКИ ===
const CONFIG = {
  SHEET_NAME: 'Заявки',
  PROMO_SHEET: 'Промокоды',
  TG_BOT_TOKEN: '7949630793:AAHmdOmSer6igd93mMuBu4w_w2BjIviTDLs',  // бот модератора
  TG_MODERATOR_CHAT: '476689983',  // твой chat_id для уведомлений
  TG_GROUP_CHAT: '-4937769961',    // группа для ленты заявок
  SOBES_LANDING: 'https://art009bas.github.io/sobes-ru/'
};

// === СТРУКТУРА ТАБЛИЦЫ ===
// Колонки в "Заявки":
// A: ID          B: Телефон    C: Статус      D: Промокод
// E: Дата        F: Время       G: Ссылка

// === ВЕБХУК (вызывается с лендинга) ===
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'register';

    if (action === 'register') {
      return registerUser(data.phone);
    }
    if (action === 'done') {
      return markDone(data.phone);
    }
    if (action === 'moderate') {
      return moderateUser(data.phone, data.status);
    }
    if (action === 'check') {
      return checkStatus(data.phone);
    }
    return respond(400, { error: 'Unknown action' });
  } catch(err) {
    return respond(500, { error: err.message });
  }
}

// === GET (проверка статуса с лендинга) ===
function doGet(e) {
  const phone = e.parameter.phone;
  if (!phone) return respond(400, { error: 'Phone required' });
  return checkStatus(phone);
}

// === РЕГИСТРАЦИЯ ===
function registerUser(phone) {
  const sheet = getSheet();
  const existing = findUser(phone);

  if (existing) {
    return respond(200, { status: 'exists', id: existing[0], phone: phone });
  }

  const id = 'U' + Date.now().toString(36).toUpperCase();
  const now = new Date();

  sheet.appendRow([
    id,
    phone,
    'new',           // статус: new, review, approved, rejected
    '',               // промокод
    Utilities.formatDate(now, 'Asia/Novosibirsk', 'dd.MM.yyyy'),
    Utilities.formatDate(now, 'Asia/Novosibirsk', 'HH:mm:ss'),
    ''                // ссылка на видео (заполнит модератор)
  ]);

  sendTelegram(CONFIG.TG_GROUP_CHAT,
    `📋 <b>Новый участник</b>\n👤 Телефон: ${phone}\n🔗 ${CONFIG.SOBES_LANDING}?moderate=${id}\n🆔 ${id}`
  );

  return respond(200, { status: 'registered', id: id, phone: phone });
}

// === ВЫПОЛНИЛ ===
function markDone(phone) {
  const sheet = getSheet();
  const row = findUserRow(phone);
  if (!row) return respond(404, { error: 'User not found' });

  sheet.getRange(row, 3).setValue('review');

  sendTelegram(CONFIG.TG_MODERATOR_CHAT,
    `🕐 <b>Ожидает проверки</b>\n📞 ${phone}\n\nПроверить видео по номеру телефона.\n/approve ${phone}\n/reject ${phone}`
  );

  return respond(200, { status: 'review' });
}

// === МОДЕРАЦИЯ ===
function moderateUser(phone, status) {
  const sheet = getSheet();
  const row = findUserRow(phone);
  if (!row) return respond(404, { error: 'User not found' });

  if (status === 'approved') {
    const code = generatePromoCode();
    sheet.getRange(row, 3).setValue('approved');
    sheet.getRange(row, 4).setValue(code);

    logPromoCode(code, phone);

    sendTelegram(CONFIG.TG_GROUP_CHAT,
      `✅ <b>Заявка одобрена</b>\n📞 ${phone}\n🎟 Промокод: <b>${code}</b>`
    );

    return respond(200, { status: 'approved', promo: code });
  }

  if (status === 'rejected') {
    sheet.getRange(row, 3).setValue('rejected');

    sendTelegram(CONFIG.TG_GROUP_CHAT,
      `❌ <b>Заявка отклонена</b>\n📞 ${phone}`
    );

    return respond(200, { status: 'rejected' });
  }

  return respond(400, { error: 'Invalid status' });
}

// === ПРОВЕРКА СТАТУСА ===
function checkStatus(phone) {
  const sheet = getSheet();
  const row = findUserRow(phone);
  if (!row) return respond(404, { error: 'User not found' });

  const data = sheet.getRange(row, 1, 1, 7).getValues()[0];

  return respond(200, {
    status: data[2],
    promo: data[3] || null,
    id: data[0],
    phone: data[1]
  });
}

// === УТИЛИТЫ ===
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['ID', 'Телефон', 'Статус', 'Промокод', 'Дата', 'Время', 'Ссылка']);
  }
  return sheet;
}

function findUser(phone) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === phone) return data[i];
  }
  return null;
}

function findUserRow(phone) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === phone) return i + 1;
  }
  return null;
}

function generatePromoCode() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const num = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  return 'SR-' + day + month + '-' + num;
}

function logPromoCode(code, phone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.PROMO_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.PROMO_SHEET);
    sheet.appendRow(['Промокод', 'Телефон', 'Дата', 'Статус']);
  }
  const now = new Date();
  sheet.appendRow([
    code,
    phone,
    Utilities.formatDate(now, 'Asia/Novosibirsk', 'dd.MM.yyyy HH:mm'),
    'активен'
  ]);
}

function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}

function respond(code, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// === ТРИГГЕР для Telegram бота ===
// Этот скрипт НЕ может принимать вебхуки Telegram (Apps Script не умеет в long polling).
// Поэтому ставим триггер:每分钟 запускает обработку команд модератора.
// Либо используем отдельного бота на VPS.

function processModeratorCommands() {
  // Получает последние сообщения из бота и обрабатывает команды
  // /approve +7xxx или /reject +7xxx
  const url = `https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/getUpdates`;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());

  if (!data.ok || !data.result) return;

  const updates = data.result.filter(u => {
    return u.message && u.message.text && u.message.chat.id == CONFIG.TG_MODERATOR_CHAT;
  });

  for (const update of updates) {
    const text = update.message.text.trim();
    let phone, status;

    if (text.startsWith('/approve ')) {
      phone = text.replace('/approve ', '').trim();
      status = 'approved';
    } else if (text.startsWith('/reject ')) {
      phone = text.replace('/reject ', '').trim();
      status = 'rejected';
    } else {
      continue;
    }

    moderateUser(phone, status);

    // Подтверждение модератору
    sendTelegram(CONFIG.TG_MODERATOR_CHAT,
      `✅ ${status === 'approved' ? 'Одобрено' : 'Отклонено'}: ${phone}`
    );
  }
}
