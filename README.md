# SOBES.RU — Кофе за видео-резюме

## Что это

Лендинг + Telegram-бот для акции: человек записывает видео-резюме → получает промокод на кофе в Миндайк.

## Состав проекта

### 1. Лендинг (`index.html`)
GitHub Pages → https://art009bas.github.io/sobes-ru/

Страницы-экраны:
- Приветствие
- Ввод телефона
- Задание (записать видео)
- Ожидание проверки
- Промокод

### 2. Бэкенд (`backend.gs`)
Google Apps Script. Нужен для:
- Хранения заявок в Google Sheets
- Генерации промокодов
- Уведомлений в Telegram

**Как развернуть:**
1. Создай Google Таблицу: https://sheets.new
2. Extensions → Apps Script
3. Скопируй содержимое `backend.gs`
4. Deploy → New deployment → Web app
5. Скопируй URL веб-приложения
6. Вставь URL в `index.html` (строка `API_URL`)
7. Настрой триггер: Edit → Triggers → `processModeratorCommands` → every 1 minute

### 3. Telegram-бот (`moderator_bot.js`)
Полноценный Node.js бот для модерации.

**Команды:**
- `/start` — справка
- `/approve +7xxx` — одобрить
- `/reject +7xxx` — отклонить
- `/status +7xxx` — проверить
- `/list` — список заявок

**Запуск** (нужен сервер):
```bash
node moderator_bot.js
```

Или через `pm2`:
```bash
pm2 start moderator_bot.js --name sobes-bot
```

## Как всё работает

```
Человек                    Система                    Модератор
   │                          │                          │
   ├─ QR → лендинг ──────────►│                          │
   ├─ вводит телефон ────────►│ запись в Sheets          │
   ├─ видит задание ───────── │                          │
   ├─ жмёт «Выполнил» ──────►│ статус: review ──────────►│ уведомление
   │                          │                          ├─ проверяет
   │                          │◄── /approve или /reject ──┤
   │◄── промокод или отказ ───│                          │
```

## Настройка домена (когда понадобится)

Регистрация на `nsk.ru`:
- A-записи: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- CNAME: www → art009bas.github.io.

## Токены

- Telegram бот: 7949630793:AAHmdOmSer6igd93mMuBu4w_w2BjIviTDLs
- Бот в группе: @MolotokNskBot (moderator)

## TODO

- [ ] Развернуть Google Apps Script
- [ ] Настроить VPS/хостинг для бота (или Timeweb)
- [ ] Подключить реальный API на лендинге
- [ ] Купить домен sobes.ru / sobes.nsk.ru
- [ ] Дизайн листовки с QR (можно через Canva)
