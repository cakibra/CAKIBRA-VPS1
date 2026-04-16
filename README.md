# CAKIBRA SBP

Современный Windows desktop-конфигуратор и менеджер подключений на базе Tauri 2 + React + TypeScript + Rust.

## Что умеет
- подписки: добавление, ручное обновление, кэширование, ETag/Last-Modified;
- импорт конфигов: ссылка, буфер обмена, файл, ручное создание/редактирование;
- протоколы: VLESS, VMess, Trojan, Shadowsocks, Socks, Hysteria2;
- измерение latency TCP connect;
- отображение страны, флага, статуса, источника, последнего теста, избранного;
- Connect / Disconnect через sidecar `sing-box`;
- системный proxy для Windows;
- автопереподключение;
- логирование в файл;
- хранение профилей/подписок/настроек/истории в AppData;
- премиальный dark UI, light theme, анимации, skeleton, empty/error states.

## Сборка
1. Установите Node.js 20+, Rust stable, Microsoft C++ Build Tools и WebView2 Runtime.
2. Запустите `build.bat`.
3. Готовый installer `.exe` появится в `src-tauri\target\release\bundle\nsis\`.

## Dev
```bash
npm install
npm run tauri dev
```


## Browser-only build without installing anything locally

If you do not want to install Node.js, Rust, Visual Studio Build Tools or Tauri prerequisites on your PC, you can build the Windows EXE directly in GitHub Actions:

1. Create a new GitHub repository in the browser.
2. Upload this project as-is.
3. Open the **Actions** tab.
4. Run **Build Windows EXE**.
5. Download the finished installer from the workflow artifacts.

The workflow file is already included at `.github/workflows/build-windows.yml`.
