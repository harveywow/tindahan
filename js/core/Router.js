/**
 * @file Hash-based router (#tinda, #listahan, ...).
 * Depends on: nothing (receives the window object for testability).
 *
 * Why hash routing: the app is static files with no server, so changing the
 * part after "#" switches screens without reloading and keeps the back button working.
 */

export class Router {
  /**
   * @param {Object<string, function(): void>} routes - Route name → handler.
   * @param {string} defaultRoute - Used when the hash is empty or unknown.
   * @param {Window} [windowRef]
   */
  constructor(routes, defaultRoute, windowRef = globalThis.window) {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
    this.windowRef = windowRef;
    this.currentRoute = '';
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  /** Starts listening and renders the current route. */
  start() {
    this.windowRef.addEventListener('hashchange', this.handleHashChange);
    this.handleHashChange();
  }

  /**
   * @returns {string} Route name from the URL, or the default route when unknown.
   */
  resolveRoute() {
    const routeName = this.windowRef.location.hash.replace(/^#\/?/, '');
    return Object.hasOwn(this.routes, routeName) ? routeName : this.defaultRoute;
  }

  /** Runs the handler for the current hash. */
  handleHashChange() {
    this.currentRoute = this.resolveRoute();
    this.routes[this.currentRoute]();
  }

  /**
   * Navigates to a route.
   * @param {string} routeName
   */
  navigate(routeName) {
    if (this.windowRef.location.hash === `#${routeName}`) {
      this.handleHashChange();
      return;
    }
    this.windowRef.location.hash = routeName;
  }
}
