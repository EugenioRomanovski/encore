# Encore — дневник концертов

Веб-приложение (PWA) для воспоминаний о концертах, планов и билетов. Интерфейс на русском, данные хранятся только на устройстве (IndexedDB).

Дизайн — `docs/design/Encore.dc.html` (прототип из Claude Design). Отличия от прототипа: убраны города и все карты, вместо них — концертные площадки.

## Что умеет

- **Воспоминания** — лента по годам, поиск, карточка концерта: фото и видео, сет-лист с бисом, заметки, оценка, с кем ходили, жанры, привязанный билет. Дата и время подставляются из EXIF фотографий.
- **Скоро** — обратный отсчёт до ближайшего концерта, список планов со статусом билета, напоминания через календарь (`.ics`: за день и за 2 часа до дверей). Прошедший план предлагает «Превратить в воспоминание» — билет переезжает вместе с ним.
- **Билеты** — кошелёк со стопкой карточек; импорт PDF (страницы рендерятся, из текста читаются сектор/ряд/место и совпадение с артистом), картинки, скан бумажного билета камерой с ручной обрезкой по углам, исправлением перспективы и фильтрами. На экране билета экран не гаснет (Wake Lock).
- **Профиль** — статистика (концерты, артисты, площадки), самый частый артист, любимые площадки, тёмная/светлая тема, резервная копия в ZIP-архив (внутри обычные `.jpg`/`.mp4`/`.pdf` по папкам и `data.json`) и восстановление из него (старые `.json`-копии тоже читаются), демо-данные.
- Работает офлайн и ставится на главный экран как приложение (PWA).

## Запуск

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # сборка в dist/
npm run preview   # проверить сборку
```

## Деплой на Vercel

1. На [vercel.com](https://vercel.com) → **Add New… → Project** → импортировать репозиторий `encore`.
2. Vercel сам определит Vite: Build Command `npm run build`, Output `dist` (уже прописано в `vercel.json` вместе с SPA-rewrite).
3. **Deploy**. Каждый пуш в `main` будет выкатываться автоматически.

Камера для сканирования работает только по HTTPS — на Vercel это есть из коробки.

## Стек

React 18 · TypeScript · Vite · React Router · Dexie (IndexedDB) · Zustand · pdf.js · exifr · lucide-react · vite-plugin-pwa. Шрифты: Anton (латиница) + Oswald (кириллица) для заголовков, Inter, IBM Plex Mono.

```
src/
  screens/      экраны (Memories, MemoryDetail, MemoryForm, Upcoming, EventDetail, EventForm,
                Tickets, TicketDetail, TicketAssign, TicketScan, TicketReview, Profile, Onboarding)
  components/   таббар, шторки, обложки, звёзды, корешок билета, просмотр фото
  lib/          db (схема IndexedDB), format (даты по-русски), media (EXIF, превью),
                pdf, scan (перспектива и фильтры), ics, backup, demo
  store/ui.ts   UI-состояние: тема, шторки, тосты, черновик билета
```

## Дальше: упаковка в App Store и Google Play

План — [Capacitor](https://capacitorjs.com): то же приложение в нативной оболочке.

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Encore app.encore --web-dir=dist
npm run build && npx cap add ios && npx cap add android
npx cap sync
```

Что заменить на нативные плагины при упаковке:
- `@capacitor/local-notifications` — настоящие напоминания вместо `.ics`;
- `@capacitor/camera` и сканер документов (ML Kit / VisionKit) — автоопределение краёв билета;
- биометрия (Face ID / отпечаток) — блокировка раздела «Билеты»;
- `@capacitor/share`, `@capacitor/filesystem` — шаринг и резервные копии;
- яркость экрана на билете — плагин screen-brightness.
