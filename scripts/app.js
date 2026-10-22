// Boot, hash router, and the in-memory store. The shell and navigation are static markup in index.html.

import { findHouse, loadData, loadLadderPrefs, loadViewPrefs, saveData, saveLadderPrefs, saveViewPrefs } from './data.js';
import { houseActions, renderAddHouse, renderHouseForm, renderSettings } from './forms.js';
import { MAP_STYLESHEET, loadStylesheets, renderCompare, renderHouseDetail, renderHouses, renderLadder, renderNotFound } from './render.js';

const APP_NAME = 'Houz';
const STATUS_VISIBLE_MS = 4000;

const STORAGE_NOTICES = {
  unavailable: 'This browser is blocking storage, so nothing you enter here will be kept after you close the page.',
  unreadable:
    'Your saved data could not be read and has been set aside untouched. Import a backup in Settings to restore your houses.',
};

/**
 * Resolves a location hash to a route.
 * @param {string} hash - Location hash such as "#/settings".
 * @returns {{ name: string, title: string, nav: string|null, houseId?: string, houseIds?: string[] }} Route, title, nav href, and house ids (MLS numbers).
 */
export function matchRoute(hash) {
  let path = (hash || '').replace(/^#/, '') || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');

  if (path === '/') return { name: 'houses', title: 'Houses', nav: '#/' };
  if (path === '/ladder') return { name: 'ladder', title: 'Price Ladder', nav: '#/ladder' };
  if (path === '/add') return { name: 'add', title: 'Add House', nav: '#/add' };
  if (path === '/settings') return { name: 'settings', title: 'Settings', nav: '#/settings' };

  const houseMatch = path.match(/^\/house\/([^/]+)(\/edit)?$/);
  if (houseMatch) {
    const houseId = decodeURIComponent(houseMatch[1]);
    if (houseMatch[2]) return { name: 'houseEdit', title: 'Edit house', nav: '#/', houseId };
    return { name: 'house', title: 'House', nav: '#/', houseId };
  }

  // A comparison is always of exactly two different houses.
  const compareMatch = path.match(/^\/compare\/([^/]+)\/([^/]+)$/);
  if (compareMatch) {
    const houseIds = [decodeURIComponent(compareMatch[1]), decodeURIComponent(compareMatch[2])];
    if (houseIds[0] !== houseIds[1]) return { name: 'compare', title: 'Compare', nav: '#/', houseIds };
  }
  return { name: 'notFound', title: 'Page not found', nav: null };
}

/**
 * Finds the browser's local storage without throwing when it is blocked.
 * @returns {Storage|null} localStorage, or null when the browser refuses access.
 */
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Creates the store that holds app data in memory and persists every update.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @returns {{ get: Function, update: Function, subscribe: Function, problem: string|null }} Store and load problem.
 */
function createStore(storage) {
  const loaded = loadData(storage);
  const listeners = [];
  let data = loaded.data;

  /**
   * Reads the current app data.
   * @returns {{ settings: object, houses: object[], pois: object[] }} Current settings, houses, and places.
   */
  function get() {
    return data;
  }

  /**
   * Replaces the app data, saves it, and notifies subscribers.
   * @param {{ settings: object, houses: object[], pois: object[] }} next - New app data.
   * @returns {boolean} True when the data was written to storage.
   */
  function update(next) {
    data = next;
    const saved = saveData(storage, data);
    for (const listener of listeners) listener();
    return saved;
  }

  /**
   * Registers a function to call after every update.
   * @param {Function} listener - Called with no arguments after data changes.
   */
  function subscribe(listener) {
    listeners.push(listener);
  }

  return { get, update, subscribe, problem: loaded.problem };
}

/**
 * Gives today's date in the user's own time zone.
 * @returns {string} Today's date as YYYY-MM-DD.
 */
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Connects the Houses view's compare selection to the app: what is ticked, and going to the comparison.
 * @param {object} app - App context holding the selection.
 * @returns {{ selection: string[]|null, onSelectionChange: Function, onCompare: Function }} Selection and handlers.
 */
function houseCompare(app) {
  return {
    selection: app.compareSelection,
    /**
     * Remembers the ticked houses while the Houses view is open.
     * @param {string[]|null} selection - Ticked ids, or null when not comparing.
     */
    onSelectionChange(selection) {
      app.compareSelection = selection;
    },
    /**
     * Opens the comparison of two houses, ending the selection.
     * @param {string} idA - House for the first column.
     * @param {string} idB - House for the second column.
     */
    onCompare(idA, idB) {
      app.compareSelection = null;
      app.navigate(`#/compare/${idA}/${idB}`);
    },
  };
}

/**
 * Connects the Houses view's Cards or Map choice, and the house selected on the map, to the app.
 * @param {object} app - App context holding the choice.
 * @returns {{ mode: string, selected: string|null, onChange: Function }} Current choice and its handler.
 */
function houseLayout(app) {
  return {
    ...app.housesLayout,
    /**
     * Remembers the choice while the app is open, so returning from a house finds the map as it was left.
     * @param {{ mode: string, selected: string|null }} layout - Cards or Map, and the selected house's id or null.
     */
    onChange(layout) {
      app.housesLayout = layout;
    },
  };
}

// Each view's own stylesheets, loaded the first time it is shown; styles/styles.css is in index.html.
export const VIEW_STYLESHEETS = {
  houses: ['styles/houses.css'],
  add: ['styles/forms.css'],
  houseEdit: ['styles/forms.css'],
  house: ['styles/forms.css', 'styles/house-detail.css'],
  compare: ['styles/compare.css'],
  ladder: ['styles/ladder.css'],
  settings: ['styles/forms.css', 'styles/settings.css'],
};

/**
 * Lists the stylesheets a route's view needs beyond the global one.
 * @param {{ name: string }} route - Route returned by matchRoute.
 * @param {object} app - App context; Houses also needs the map's styles when it reopens on the map.
 * @returns {string[]} Stylesheet addresses, such as "styles/settings.css".
 */
function viewStylesheets(route, app) {
  const sheets = VIEW_STYLESHEETS[route.name] || [];
  if (route.name === 'houses' && app.housesLayout.mode === 'map') return [...sheets, MAP_STYLESHEET];
  return sheets;
}

/**
 * Builds the view for a route.
 * @param {{ name: string, houseId?: string, houseIds?: string[] }} route - Route returned by matchRoute.
 * @param {object} app - App context passed to views that edit data.
 * @returns {HTMLElement} Root element of the view.
 */
function renderView(route, app) {
  const data = app.store.get();
  const house = route.houseId === undefined ? null : findHouse(data, route.houseId);
  switch (route.name) {
    case 'houses':
      return renderHouses(data, app.viewPrefs, app.setViewPrefs, app.today(), houseCompare(app), houseLayout(app));
    case 'compare': {
      // show() has already sent a comparison with a missing house back to Houses.
      const houseA = findHouse(data, route.houseIds[0]);
      const houseB = findHouse(data, route.houseIds[1]);
      return renderCompare(houseA, houseB, data.settings, app.today(), function changeHouses() {
        app.compareSelection = route.houseIds;
        app.navigate('#/');
      });
    }
    case 'ladder':
      return renderLadder(data, app.ladderPrefs, app.setLadderPrefs, app.announce);
    case 'add':
      return renderAddHouse(app);
    case 'settings':
      return renderSettings(app);
    case 'house':
      return house === null ? renderNotFound() : renderHouseDetail(house, data.settings, app.today(), houseActions(app, house), app.housesLayout.mode);
    case 'houseEdit':
      return house === null ? renderNotFound() : renderHouseForm(app, house);
    default:
      return renderNotFound();
  }
}

/**
 * Loads stored data, starts the router, and renders the view for the current address.
 */
function init() {
  const main = document.querySelector('.shell > main');
  const links = document.querySelectorAll('.shell > header nav a');
  const notice = document.querySelector('.shell .notice');
  const status = document.querySelector('.announcement');
  const dialog = document.querySelector('dialog.confirm');
  const storage = getStorage();
  const store = createStore(storage);

  let leaveGuard = null;
  let currentHash = window.location.hash || '#/';
  let statusTimer = null;
  let askedForPersistence = false;
  // Counts calls to show(), so a view whose stylesheets finish loading late is not drawn over a newer one.
  let showCount = 0;

  /**
   * Shows a short confirmation or error message that clears itself.
   * @param {string} message - Text to show and announce to screen readers.
   */
  function announce(message) {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = window.setTimeout(function clearStatus() {
      status.textContent = '';
    }, STATUS_VISIBLE_MS);
  }

  /**
   * Asks the user to confirm or cancel an action in a modal dialog.
   * @param {{ title: string, text: string, confirmLabel: string, cancelLabel: string }} options - Dialog wording.
   * @returns {Promise<boolean>} Resolves true when confirmed, false when cancelled or dismissed.
   */
  function confirm(options) {
    dialog.querySelector('h2').textContent = options.title;
    dialog.querySelector('p').textContent = options.text;
    dialog.querySelector('button[value="cancel"]').textContent = options.cancelLabel;
    dialog.querySelector('button[value="confirm"]').textContent = options.confirmLabel;
    dialog.returnValue = '';
    dialog.showModal();
    /**
     * Settles the promise when a button is chosen or the dialog is dismissed.
     * @param {function(boolean): void} resolve - Promise resolver.
     */
    function waitForAnswer(resolve) {
      const listeners = new AbortController();
      /**
       * Resolves with the chosen button when the dialog's form is submitted.
       * @param {SubmitEvent} event - Submit event from the dialog's form.
       */
      function handleSubmit(event) {
        listeners.abort();
        resolve(event.submitter !== null && event.submitter.value === 'confirm');
      }
      function handleDismiss() {
        listeners.abort();
        resolve(false);
      }
      dialog.querySelector('form').addEventListener('submit', handleSubmit, { signal: listeners.signal });
      // Escape and the Android back gesture dismiss the dialog without choosing a button.
      dialog.addEventListener('cancel', handleDismiss, { signal: listeners.signal });
    }
    return new Promise(waitForAnswer);
  }

  /**
   * Registers the check that says whether the current view has unsaved changes.
   * @param {(function(): boolean)|null} guard - Returns true when leaving would lose edits; null for none.
   */
  function setLeaveGuard(guard) {
    leaveGuard = guard;
  }

  /**
   * Checks whether the current view has unsaved changes.
   * @returns {boolean} True when leaving would lose edits.
   */
  function hasUnsavedChanges() {
    return leaveGuard !== null && leaveGuard();
  }

  /**
   * Goes to another view.
   * @param {string} hash - Address to go to, such as "#/" or "#/house/1000001/edit".
   */
  function navigate(hash) {
    window.location.hash = hash;
  }

  /**
   * Remembers how the Houses collection is shown on this device.
   * @param {{ sort: string, grouped: boolean, hidden: string[] }} prefs - Sort choice, status grouping, and hidden statuses.
   */
  function setViewPrefs(prefs) {
    app.viewPrefs = prefs;
    saveViewPrefs(storage, prefs);
  }

  /**
   * Remembers which houses are hidden from the Price Ladder on this device.
   * @param {{ hidden: string[] }} prefs - Ids of the hidden houses.
   */
  function setLadderPrefs(prefs) {
    app.ladderPrefs = prefs;
    saveLadderPrefs(storage, prefs);
  }

  // compareSelection holds the houses ticked for comparison while Houses is open; null when not comparing.
  // housesLayout is Cards or Map and the house selected on the map; it is not stored, so Houses opens on Cards.
  const app = {
    store,
    announce,
    confirm,
    navigate,
    setLeaveGuard,
    setLadderPrefs,
    setViewPrefs,
    today,
    viewPrefs: loadViewPrefs(storage),
    ladderPrefs: loadLadderPrefs(storage),
    compareSelection: null,
    housesLayout: { mode: 'cards', selected: null },
  };

  /**
   * Sends a comparison whose houses are not all still stored back to Houses, with the rest ticked.
   * @param {{ name: string, houseIds?: string[] }} route - Route about to be shown.
   * @returns {object} The route to show instead: Houses when a house is missing, otherwise the same route.
   */
  function checkComparison(route) {
    if (route.name !== 'compare') return route;
    const remaining = [];
    for (const id of route.houseIds) {
      if (findHouse(store.get(), id) !== null) remaining.push(id);
    }
    if (remaining.length === 2) return route;
    // Replacing the address, rather than adding one, keeps Back from returning to the broken comparison.
    app.compareSelection = remaining;
    currentHash = '#/';
    window.history.replaceState(null, '', currentHash);
    announce(remaining.length === 1 ? 'That house is no longer in Houz.' : 'Those houses are no longer in Houz.');
    return matchRoute(currentHash);
  }

  /**
   * Renders the view for the current address, once its stylesheets have loaded.
   * @param {boolean} isNavigation - True when the address changed, false when only the data changed.
   */
  function show(isNavigation) {
    const route = checkComparison(matchRoute(window.location.hash));
    showCount += 1;
    const ticket = showCount;

    // The navigation is marked at once, so on a fresh load it is already marked when first drawn.
    for (const link of links) {
      if (link.getAttribute('href') === route.nav) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    const loading = loadStylesheets(viewStylesheets(route, app));
    if (loading === null) {
      renderRoute(route, isNavigation);
      return;
    }
    // Until the view's styles arrive the previous view stays up, so nothing is ever drawn unstyled.
    loading.then(function renderWhenLoaded() {
      // A newer address or data change has been shown meanwhile.
      if (ticket === showCount) renderRoute(route, isNavigation);
    });
  }

  /**
   * Replaces the view on screen with the one for a route.
   * @param {{ name: string, title: string, nav: string }} route - Route returned by matchRoute.
   * @param {boolean} isNavigation - True when the address changed, false when only the data changed.
   */
  function renderRoute(route, isNavigation) {
    leaveGuard = null;
    // The selection belongs to the Houses view, so leaving it ends the selection.
    if (route.name !== 'houses') app.compareSelection = null;
    main.replaceChildren(renderView(route, app));
    document.title = `${route.title} · ${APP_NAME}`;

    if (isNavigation) {
      window.scrollTo(0, 0);
      const heading = main.querySelector('h1');
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  /**
   * Follows an address change, first protecting unsaved edits.
   * @returns {Promise<void>} Resolves once the change has been followed or undone.
   */
  async function handleHashChange() {
    const target = window.location.hash || '#/';
    if (target === currentHash) return;

    if (hasUnsavedChanges()) {
      // Put the address back first; the view on screen has not changed.
      window.history.replaceState(null, '', currentHash);
      if (dialog.open) return;
      const discard = await confirm({
        title: 'Discard unsaved changes?',
        text: 'Your edits on this page have not been saved.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
      leaveGuard = null;
      window.location.hash = target;
      return;
    }

    currentHash = target;
    show(true);
  }

  /**
   * Makes the browser warn before closing or reloading with unsaved edits.
   * @param {BeforeUnloadEvent} event - The browser's before-unload event.
   */
  function handleBeforeUnload(event) {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  function handleDataChange() {
    // Ask once, after real data exists, for storage the browser will not clear on its own.
    if (!askedForPersistence && navigator.storage && navigator.storage.persist) {
      askedForPersistence = true;
      navigator.storage.persist();
    }
    show(false);
  }

  if (store.problem !== null) {
    notice.textContent = STORAGE_NOTICES[store.problem];
    notice.hidden = false;
  }

  store.subscribe(handleDataChange);
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  show(false);
}

// The tests import this module in Node, so the app only starts in a browser.
if (typeof document !== 'undefined') init();
