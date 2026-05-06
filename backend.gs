/*
 * SOBES.RU — Backend (Google Apps Script)
 * Google Sheets + Telegram Bot + JSONP support
 */

// === НАСТРОЙКИ ===
const CONFIG = {
  SHEET_NAME: 'Заявки',
  PROMO_SHEET: 'Промокоды',
  TG_BOT_TOKEN: '7949630793:AAHmdOmSer6igd93mMuBu4w_w2BjIviTDLs',
  TG_MODERATOR_CHAT: '476689983',
  TG_GROUP_CHAT: '-4937769961',
  SOBES_LANDING: 'https://art009bas.github.io/sobes-ru/'
};

// === DO GET (все через GET для CORS-free работы) ===
function doGet(e) {
  try {
    const action = e.parameter.action || 'check';
    const phone = e.parameter.phone;
    const cb = e.parameter.callback;
    var result;

    if (!phone) {
      result = { error: 'Phone required' };
    } else if (action === 'register') {
      result = registerUser(phone);
    } else if (action === 'done') {
      result = markDone(phone);
    } else {
      result = checkStatus(phone);
    }

    var json = JSON.stringify(result);
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errJson = JSON.stringify({ error: err.message });
    return ContentService.createTextOutput(errJson)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === DO POST ===
function doPost(e) {
  var data;
  try {
    if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch(er) { data = e.parameter; }
    } else { data = e.parameter; }
    return doGet(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === РЕГИСТРАЦИЯ ===
function registerUser(phone) {
  var sheet = getSheet_();
  var existing = findUser_(phone);
  if (existing) {
    return { status: 'exists', id: existing[0], phone: phone };
  }

  var id = 'U' + Date.now().toString(36).toUpperCase();
  var now = new Date();

  sheet.appendRow([
    id, phone, 'new', '',
    Utilities.formatDate(now, 'Asia/Novosibirsk', 'dd.MM.yyyy'),
    Utilities.formatDate(now, 'Asia/Novosibirsk', 'HH:mm:ss'), ''
  ]);

  tgSend(CONFIG.TG_GROUP_CHAT,
    '📋 <b>Новый участник</b>\n👤 ' + phone + '\n🆔 ' + id
  );

  return { status: 'registered', id: id, phone: phone };
}

// === ВЫПОЛНИЛ ===
function markDone(phone) {
  var sheet = getSheet_();
  var row = findUserRow_(phone);
  if (!row) return { error: 'User not found' };

  sheet.getRange(row, 3).setValue('review');

  tgSend(CONFIG.TG_MODERATOR_CHAT,
    '🕐 <b>Ожидает проверки</b>\n📞 ' + phone + '\n/approve ' + phone + '\n/reject ' + phone
  );

  return { status: 'review' };
}

// === МОДЕРАЦИЯ ===
function moderateUser(phone, status) {
  var sheet = getSheet_();
  var row = findUserRow_(phone);
  if (!row) return { error: 'User not found' };

  if (status === 'approved') {
    var code = genCode_();
    sheet.getRange(row, 3).setValue('approved');
    sheet.getRange(row, 4).setValue(code);
    logCode_(code, phone);

    tgSend(CONFIG.TG_GROUP_CHAT,
      '✅ <b>Одобрено</b>\n📞 ' + phone + '\n🎟 Промокод: <b>' + code + '</b>'
    );
    return { status: 'approved', promo: code, phone: phone };
  }

  if (status === 'rejected') {
    sheet.getRange(row, 3).setValue('rejected');
    tgSend(CONFIG.TG_GROUP_CHAT, '❌ <b>Отклонено</b>\n📞 ' + phone);
    return { status: 'rejected', phone: phone };
  }

  return { error: 'Invalid status' };
}

// === ПРОВЕРКА СТАТУСА ===
function checkStatus(phone) {
  var sheet = getSheet_();
  var row = findUserRow_(phone);
  if (!row) return { error: 'User not found' };

  var data = sheet.getRange(row, 1, 1, 7).getValues()[0];
  return { status: data[2], promo: data[3] || null, id: data[0], phone: data[1] };
}

// === УТИЛИТЫ ===
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!s) {
    s = ss.insertSheet(CONFIG.SHEET_NAME);
    s.appendRow(['ID', 'Телефон', 'Статус', 'Промокод', 'Дата', 'Время', 'Ссылка']);
  }
  return s;
}

function findUser_(phone) {
  var s = getSheet_();
  var d = s.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    if (d[i][1] == phone) return d[i];
  }
  return null;
}

function findUserRow_(phone) {
  var s = getSheet_();
  var d = s.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    if (d[i][1] == phone) return i + 1;
  }
  return null;
}

function genCode_() {
  var now = new Date();
  var d = ('0' + now.getDate()).slice(-2);
  var m = ('0' + (now.getMonth() + 1)).slice(-2);
  var n = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  return 'SR-' + d + m + '-' + n;
}

function logCode_(code, phone) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(CONFIG.PROMO_SHEET);
  if (!s) {
    s = ss.insertSheet(CONFIG.PROMO_SHEET);
    s.appendRow(['Промокод', 'Телефон', 'Дата', 'Статус']);
  }
  s.appendRow([
    code, phone,
    Utilities.formatDate(new Date(), 'Asia/Novosibirsk', 'dd.MM.yyyy HH:mm'),
    'активен'
  ]);
}

function tgSend(chatId, text) {
  var url = 'https://api.telegram.org/bot' + CONFIG.TG_BOT_TOKEN + '/sendMessage';
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

// === СПИСОК ЗАЯВОК ===
function getListText() {
  var s = getSheet_();
  var d = s.getDataRange().getValues();
  if (d.length < 2) return 'Нет заявок';

  var lines = [];
  var start = Math.max(1, d.length - 10);
  for (var i = start; i < d.length; i++) {
    var icon = d[i][2] == 'approved' ? '✅' : d[i][2] == 'rejected' ? '❌' : d[i][2] == 'review' ? '🕐' : '🆕';
    lines.push(icon + ' ' + d[i][1] + ' — ' + d[i][2]);
  }
  return '<b>Последние заявки:</b>\n' + lines.join('\n');
}

// === ТРИГГЕР (команды модератора) ===
function processModeratorCommands() {
  var url = 'https://api.telegram.org/bot' + CONFIG.TG_BOT_TOKEN + '/getUpdates';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  if (!data.ok || !data.result) return;

  for (var i = 0; i < data.result.length; i++) {
    var u = data.result[i];
    if (!u.message || !u.message.text) continue;
    if (u.message.chat.id != CONFIG.TG_MODERATOR_CHAT) continue;

    var text = u.message.text.trim();
    var phone, status;

    if (text === '/list') {
      tgSend(CONFIG.TG_MODERATOR_CHAT, getListText());
    } else if (text.startsWith('/approve ')) {
      phone = text.replace('/approve ', '').trim();
      var r = moderateUser(phone, 'approved');
      tgSend(CONFIG.TG_MODERATOR_CHAT, r.error ? '❌ ' + r.error : '✅ Одобрено: ' + phone);
    } else if (text.startsWith('/reject ')) {
      phone = text.replace('/reject ', '').trim();
      var r = moderateUser(phone, 'rejected');
      tgSend(CONFIG.TG_MODERATOR_CHAT, r.error ? '❌ ' + r.error : '✅ Отклонено: ' + phone);
    } else if (text.startsWith('/status ')) {
      phone = text.replace('/status ', '').trim();
      var r = checkStatus(phone);
      tgSend(CONFIG.TG_MODERATOR_CHAT,
        '📊 <b>Статус:</b> ' + phone + '\n📌 ' + (r.status || 'не найден') + (r.promo ? '\n🎟 ' + r.promo : '')
      );
    }
  }
}
