/**
 * @file Entry point: creates the app, connects views to routes and starts it.
 * Depends on: app/createApp.js, core/*, ui/*, utils/i18n.js.
 */
import { createApp } from './app/createApp.js';
import { EVENTS } from './core/EventBus.js';
import { Router } from './core/Router.js';
import { Basket } from './services/Basket.js';
import { AppShell, NAV_ITEMS } from './ui/AppShell.js';
import { Toast } from './ui/components/Toast.js';
import { installGlobalErrorHandler, showStartupFailure } from './ui/errorHandler.js';
import { AboutView } from './ui/views/AboutView.js';
import { ActivityLogView } from './ui/views/ActivityLogView.js';
import { CashierView } from './ui/views/CashierView.js';
import { ClosingView } from './ui/views/ClosingView.js';
import { CreditView } from './ui/views/CreditView.js';
import { DashboardView } from './ui/views/DashboardView.js';
import { ExpensesView } from './ui/views/ExpensesView.js';
import { InventoryView } from './ui/views/InventoryView.js';
import { ReportsView } from './ui/views/ReportsView.js';
import { RestockView } from './ui/views/RestockView.js';
import { SalesHistoryView } from './ui/views/SalesHistoryView.js';
import { SettingsView } from './ui/views/SettingsView.js';
import { setLanguage, t } from './utils/i18n.js';

/** Route name → view class. */
const VIEWS_BY_ROUTE = Object.freeze({
  bukas: DashboardView,
  tinda: CashierView,
  paninda: InventoryView,
  listahan: CreditView,
  benta: SalesHistoryView,
  pamilihan: RestockView,
  gastos: ExpensesView,
  sara: ClosingView,
  ulat: ReportsView,
  talaan: ActivityLogView,
  ayos: SettingsView,
  tungkol: AboutView,
});

/**
 * Tells the user once if saved data had to be repaired, or if the browser
 * won't keep data (private mode).
 * @param {import('./core/Storage.js').Storage} storage
 * @param {Toast} toast
 */
function reportStorageHealth(storage, toast) {
  if (storage.recoveredKeys.length > 0) {
    toast.show(
      t('errors.dataRecovered', { keys: [...new Set(storage.recoveredKeys)].join(', ') }),
      'error',
    );
  }
  if (!storage.isPersistent) {
    toast.show(t('settings.storageMemory'), 'info');
  }
}

/** Builds everything and shows the first screen. */
function start() {
  const main = document.getElementById('app-main');
  const toast = new Toast(document.getElementById('toast-region'));
  installGlobalErrorHandler(toast);
  const app = createApp();
  setLanguage(app.services.settingsService.get().language);
  const context = { ...app, toast, basket: new Basket(), router: null };
  const shell = new AppShell(context, {
    signboard: document.getElementById('signboard'),
    tools: document.getElementById('store-tools'),
    nav: document.getElementById('main-nav'),
    footer: document.getElementById('app-footer'),
  });

  let activeView = null;
  const showView = (route) => {
    activeView?.unmount();
    activeView = new VIEWS_BY_ROUTE[route](context);
    activeView.mount(main);
    shell.setActiveRoute(route);
    const navLabel = NAV_ITEMS.some((item) => item.route === route)
      ? t(`nav.${route}`)
      : t('nav.tungkol');
    document.title = `${navLabel} · ${app.services.settingsService.get().storeName}`;
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  };
  context.router = new Router(
    Object.fromEntries(Object.keys(VIEWS_BY_ROUTE).map((route) => [route, () => showView(route)])),
    'bukas',
  );
  app.bus.on(EVENTS.SETTINGS_CHANGED, (settings) =>
    setLanguage(settings?.language ?? app.services.settingsService.get().language),
  );
  shell.mount();
  context.router.start();
  reportStorageHealth(app.storage, toast);
}

try {
  start();
} catch (error) {
  showStartupFailure(document.getElementById('app-main'), error);
}
