import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_ID,
  COOLING_CENTRAL,
  COOLING_NONE,
  HOUSE_FIELDS,
  NO,
  PROJECT_AREAS,
  PROJECT_NEED,
  PROJECT_NO_CHANGE,
  PROJECT_WANT,
  SCHEMA_VERSION,
  STATUS_AVAILABLE,
  STATUS_SOLD,
  STATUS_UNDER_CONTRACT,
  STORAGE_KEY,
  UNREADABLE_KEY,
  VIEW_KEY,
  LADDER_KEY,
  YES,
  projectFieldName,
  setProject,
  addPriceEntry,
  backupFileName,
  canDeletePriceEntry,
  defaultStatusDate,
  deleteHouse,
  deletePriceEntry,
  createEmptyData,
  createHouse,
  createPoi,
  normalizePois,
  validatePoi,
  defaultSettings,
  defaultLadderPrefs,
  defaultViewPrefs,
  isDateString,
  findHouse,
  isFieldApplicable,
  isFieldKnown,
  isMlsNumber,
  isUsableHouse,
  listingUrl,
  loadData,
  loadLadderPrefs,
  loadViewPrefs,
  migrate,
  mlsNumberError,
  normalizeHouse,
  normalizeSettings,
  parseData,
  parseNumberInput,
  parseProjectFieldName,
  renameLadderHidden,
  projectsAnswered,
  projectsProgress,
  saveData,
  saveLadderPrefs,
  saveViewPrefs,
  serializeData,
  setListingDate,
  setStatus,
  updatePriceEntry,
  saveHouse,
  sectionProgress,
  toggleNone,
  toggleOption,
  validateHouse,
  validateListingDate,
  validatePriceEntry,
  validateStatus,
  validateNewHouse,
  validateSettings,
} from '../scripts/data.js';

/**
 * Makes an id generator that always gives the same id.
 * @param {string} id - The id to give.
 * @returns {function(): string} A generator for createHouse or addPriceEntry.
 */
function fixedId(id) {
  /**
   * Gives the fixed id.
   * @returns {string} The id.
   */
  function next() {
    return id;
  }
  return next;
}

/**
 * Makes an id generator that gives each listed id in turn.
 * @param {string[]} ids - Ids to give, in order.
 * @returns {function(): string} A generator for createHouse or addPriceEntry.
 */
function idSequence(ids) {
  const remaining = [...ids];
  /**
   * Gives the next id.
   * @returns {string} The id.
   */
  function next() {
    return remaining.shift();
  }
  return next;
}

/**
 * Builds an in-memory stand-in for localStorage.
 * @param {Object<string, string>} [initial] - Items the storage starts with.
 * @returns {{ items: Object<string, string>, getItem: Function, setItem: Function }} Fake storage.
 */
function fakeStorage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    /**
     * Reads a stored item.
     * @param {string} key - Storage key.
     * @returns {string|null} Stored text, or null when absent.
     */
    getItem(key) {
      return key in items ? items[key] : null;
    },
    /**
     * Writes a stored item.
     * @param {string} key - Storage key.
     * @param {string} value - Text to store.
     */
    setItem(key, value) {
      items[key] = value;
    },
  };
}

/**
 * Builds storage whose every access throws, like a blocked or full browser store.
 * @returns {{ getItem: Function, setItem: Function }} Storage that always fails.
 */
function brokenStorage() {
  return {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('full');
    },
  };
}

/**
 * Builds a counter-based id generator so created houses are predictable.
 * @returns {function(): string} Generator returning "id-1", "id-2", and so on.
 */
function sequentialIds() {
  let count = 0;
  /**
   * Produces the next id in the sequence.
   * @returns {string} The next id.
   */
  return function next() {
    count += 1;
    return `id-${count}`;
  };
}

/**
 * Creates a sample house the way the Add House form would.
 * @returns {object} A new house at 742 Example Ave listed for $475,000.
 */
function sampleHouse() {
  return createHouse(
    { mlsNumber: ' 1000001 ', address: ' 742 Example Ave ', listingPrice: 475000, listingDate: '2026-10-02', imageUrl: '' },
    sequentialIds(),
  );
}

/* --------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------- */

test('default settings seed lender assumptions and leave financing terms blank', () => {
  const settings = defaultSettings();
  assert.equal(settings.interestRate, null);
  assert.equal(settings.pointsPercent, null);
  assert.equal(settings.loanTermYears, 30);
  assert.equal(settings.downPaymentPercent, 20);
  assert.equal(settings.plannedRecastPrincipal, 0);
  assert.equal(settings.fixedLenderFee, 1075);
  assert.equal(settings.titleInsurance, 1300);
  assert.equal(settings.prepaidInterestDays, 12);
  assert.equal(settings.fallbackAnnualInsurance, 1080);
  assert.equal(settings.fallbackPropertyTaxRate, 0.55);
  assert.equal(settings.comfortableMonthlyCost, null);
  assert.equal(settings.maximumMonthlyCost, null);
  assert.equal(settings.comfortableCashToClose, null);
  assert.equal(settings.maximumCashToClose, null);
  assert.equal(settings.maximumPurchasePrice, null);
});

test('normalizeSettings keeps valid values and blank financing terms', () => {
  const settings = normalizeSettings({ interestRate: 6.5, pointsPercent: null, titleInsurance: 1400 });
  assert.equal(settings.interestRate, 6.5);
  assert.equal(settings.pointsPercent, null);
  assert.equal(settings.titleInsurance, 1400);
  assert.equal(settings.loanTermYears, 30);
});

test('normalizeSettings treats a zero interest rate as known, not blank', () => {
  assert.equal(normalizeSettings({ interestRate: 0 }).interestRate, 0);
});

test('normalizeSettings replaces invalid values with the initial value', () => {
  const settings = normalizeSettings({
    loanTermYears: 'thirty',
    fixedLenderFee: -5,
    titleInsurance: null,
    interestRate: 'abc',
    downPaymentPercent: 10,
  });
  assert.equal(settings.loanTermYears, 30);
  assert.equal(settings.fixedLenderFee, 1075);
  assert.equal(settings.titleInsurance, 1300);
  assert.equal(settings.interestRate, null);
  assert.equal(settings.downPaymentPercent, 20, 'a down payment below 20% is not allowed');
});

test('normalizeSettings survives garbage input', () => {
  assert.deepEqual(normalizeSettings(null), defaultSettings());
  assert.deepEqual(normalizeSettings('nope'), defaultSettings());
  assert.deepEqual(normalizeSettings([]), defaultSettings());
});

test('parseNumberInput reads plain and formatted numbers', () => {
  assert.deepEqual(parseNumberInput('6.875'), { valid: true, value: 6.875 });
  assert.deepEqual(parseNumberInput('$400,000'), { valid: true, value: 400000 });
  assert.deepEqual(parseNumberInput(' 20 % '), { valid: true, value: 20 });
  assert.deepEqual(parseNumberInput('.55'), { valid: true, value: 0.55 });
  assert.deepEqual(parseNumberInput('12.'), { valid: true, value: 12 });
  assert.deepEqual(parseNumberInput('0'), { valid: true, value: 0 });
});

test('parseNumberInput reads blank as unknown, never as zero', () => {
  assert.deepEqual(parseNumberInput(''), { valid: true, value: null });
  assert.deepEqual(parseNumberInput('   '), { valid: true, value: null });
});

test('parseNumberInput rejects text that is not a number', () => {
  for (const text of ['abc', '1.2.3', '12k', '.', '1e5', '-', '5-']) {
    assert.deepEqual(parseNumberInput(text), { valid: false, value: null }, text);
  }
});

test('parseNumberInput reads a negative number so validation can say why it is wrong', () => {
  assert.deepEqual(parseNumberInput('-5'), { valid: true, value: -5 });
  assert.deepEqual(parseNumberInput('-$1,200'), { valid: true, value: -1200 });
});

test('negative amounts are explained, not called "not a number"', () => {
  const house = createHouse({ mlsNumber: '2100002', address: '1 Sign St', listingPrice: 400000, listingDate: '2026-10-01' });
  assert.equal(validateHouse({ ...house, squareFeet: -5 }).errors.squareFeet, 'Must be 0 or more.');
  assert.equal(validateHouse(setProject(house, 'roof', { state: PROJECT_NEED, cost: -100 })).errors['project-roof-cost'], 'Must be 0 or more.');
  assert.equal(validateSettings({ ...defaultSettings(), fixedLenderFee: -1 }).errors.fixedLenderFee, 'Must be 0 or more.');
  assert.equal(validateNewHouse({ mlsNumber: '1', address: 'x', listingPrice: -1, listingDate: '2026-10-01' }, []).errors.listingPrice, 'Must be 0 or more.');
  assert.equal(validatePriceEntry(house, { price: -1, date: '2026-10-02' }).errors.price, 'Must be 0 or more.');
  assert.equal(validateHouse({ ...house, squareFeet: NaN }).errors.squareFeet, 'Enter a number.');
});

test('version 1 data drops its cash-to-acquire targets instead of reusing them for cash to close', () => {
  const settings = { ...defaultSettings(), comfortableMonthlyCost: 2500, comfortableCashToAcquire: 100000, maximumCashToAcquire: 150000 };
  delete settings.comfortableCashToClose;
  delete settings.maximumCashToClose;
  delete settings.maximumPurchasePrice;
  const text = JSON.stringify({ app: APP_ID, schemaVersion: 1, settings, houses: [] });
  const result = parseData(text);
  assert.equal(result.ok, true);
  assert.equal(result.data.settings.comfortableMonthlyCost, 2500, 'other settings are kept');
  assert.equal(result.data.settings.comfortableCashToClose, null);
  assert.equal(result.data.settings.maximumCashToClose, null);
  assert.equal(result.data.settings.maximumPurchasePrice, null);
  assert.equal('comfortableCashToAcquire' in result.data.settings, false);
});

test('the initial settings are valid to save', () => {
  assert.deepEqual(validateSettings(defaultSettings()), { ok: true, errors: {} });
});

test('validateSettings lets blank-by-default settings stay blank but not the others', () => {
  const result = validateSettings({ ...defaultSettings(), interestRate: null, loanTermYears: null, titleInsurance: null });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors), ['loanTermYears', 'titleInsurance']);
});

test('validateSettings rejects a down payment below 20% or above 100%', () => {
  assert.ok(validateSettings({ ...defaultSettings(), downPaymentPercent: 19.9 }).errors.downPaymentPercent);
  assert.ok(validateSettings({ ...defaultSettings(), downPaymentPercent: 101 }).errors.downPaymentPercent);
  assert.equal(validateSettings({ ...defaultSettings(), downPaymentPercent: 20 }).ok, true);
  assert.equal(validateSettings({ ...defaultSettings(), downPaymentPercent: 100 }).ok, true);
});

test('validateSettings flags unreadable and out-of-range values', () => {
  const result = validateSettings({ ...defaultSettings(), interestRate: NaN, loanTermYears: 0, pointsPercent: 250 });
  assert.equal(result.errors.interestRate, 'Enter a number.');
  assert.equal(result.errors.loanTermYears, 'Must be at least 1.');
  assert.equal(result.errors.pointsPercent, 'Must be 100 or less.');
});

test('validateSettings accepts a zero interest rate and zero points', () => {
  assert.equal(validateSettings({ ...defaultSettings(), interestRate: 0, pointsPercent: 0 }).ok, true);
});

test('validateSettings requires Maximum to exceed Comfortable', () => {
  const equal = validateSettings({ ...defaultSettings(), comfortableMonthlyCost: 2500, maximumMonthlyCost: 2500 });
  assert.equal(equal.errors.maximumMonthlyCost, 'Maximum must be greater than Comfortable.');
  const lower = validateSettings({ ...defaultSettings(), comfortableCashToClose: 90000, maximumCashToClose: 80000 });
  assert.ok(lower.errors.maximumCashToClose);
  const fine = validateSettings({ ...defaultSettings(), comfortableMonthlyCost: 2500, maximumMonthlyCost: 3200 });
  assert.equal(fine.ok, true);
});

test('validateSettings allows a half-filled target pair', () => {
  assert.equal(validateSettings({ ...defaultSettings(), comfortableMonthlyCost: 2500 }).ok, true);
  assert.equal(validateSettings({ ...defaultSettings(), maximumCashToClose: 120000 }).ok, true);
});

/* --------------------------------------------------------------------------
   Creating a house
   -------------------------------------------------------------------------- */

test('createHouse identifies the house by its MLS number and sets the first price entry', () => {
  const house = sampleHouse();
  assert.equal(house.id, '1000001', 'the MLS number is the id, trimmed and kept as text');
  assert.equal('mlsNumber' in house, false, 'the MLS number is stored once, as the id');
  assert.equal(house.address, '742 Example Ave');
  assert.equal(house.listingDate, '2026-10-02');
  assert.deepEqual(house.priceHistory, [{ id: 'id-1', price: 475000, date: '2026-10-02' }]);
  assert.equal('modeledPurchasePrice' in house, false, 'there is one price: the listing price');
  assert.equal(house.status, STATUS_AVAILABLE);
  assert.equal(house.statusDate, null);
});

test('a new house has every observation unknown, never false or zero', () => {
  const house = sampleHouse();
  const preset = ['address', 'imageUrl', 'sellerCredits', 'lenderCredits'];
  for (const [name, field] of Object.entries(HOUSE_FIELDS)) {
    if (preset.includes(name)) continue;
    if (field.kind === 'text') assert.equal(house[name], '', name);
    else assert.equal(house[name], null, name);
  }
  assert.equal(house.sellerCredits, 0);
  assert.equal(house.lenderCredits, 0);
});

test('a new house has every project area untouched, with no reviewed flag', () => {
  const house = sampleHouse();
  assert.equal('projectsReviewed' in house, false);
  assert.equal(projectsAnswered(house), false);
  assert.deepEqual(Object.keys(house.projects), PROJECT_AREAS);
  for (const area of PROJECT_AREAS) {
    assert.deepEqual(house.projects[area], { state: null, note: '', cost: null, excited: null }, area);
  }
});

test('a new house is already normalized', () => {
  const house = sampleHouse();
  assert.deepEqual(normalizeHouse(house), house);
});

/* --------------------------------------------------------------------------
   Normalizing a house
   -------------------------------------------------------------------------- */

test('normalizeHouse never turns booleans or junk into an answer', () => {
  const raw = { ...sampleHouse(), cornerLot: false, megacouchFits: true, hoa: 0, garagePower: 'maybe' };
  const house = normalizeHouse(raw);
  assert.equal(house.cornerLot, null);
  assert.equal(house.megacouchFits, null);
  assert.equal(house.hoa, null);
  assert.equal(house.garagePower, null);
});

test('normalizeHouse keeps real yes/no answers', () => {
  const raw = { ...sampleHouse(), cornerLot: NO, megacouchFits: YES, irrigation: 'na' };
  const house = normalizeHouse(raw);
  assert.equal(house.cornerLot, NO);
  assert.equal(house.megacouchFits, YES);
  assert.equal(house.irrigation, 'na');
});

test('normalizeHouse clears invalid selects and numbers to unknown', () => {
  const raw = { ...sampleHouse(), propertyType: 'castle', trainMinutes: -3, exteriorSteps: '4', bedrooms: NaN };
  const house = normalizeHouse(raw);
  assert.equal(house.propertyType, null);
  assert.equal(house.trainMinutes, null);
  assert.equal(house.exteriorSteps, null);
  assert.equal(house.bedrooms, null);
});

test('normalizeHouse keeps a known zero distinct from unknown', () => {
  const raw = { ...sampleHouse(), exteriorSteps: 0, hoaDues: 0 };
  const house = normalizeHouse(raw);
  assert.equal(house.exteriorSteps, 0);
  assert.equal(house.hoaDues, 0);
});

test('map coordinates start unknown and a house saved before them loads with them unknown', () => {
  assert.equal(sampleHouse().latitude, null);
  assert.equal(sampleHouse().longitude, null);
  const { latitude, longitude, ...older } = sampleHouse();
  assert.equal(latitude, null);
  assert.equal(longitude, null);
  const house = normalizeHouse(older);
  assert.equal(house.latitude, null);
  assert.equal(house.longitude, null);
});

test('map coordinates keep negative values and their full precision', () => {
  const house = normalizeHouse({ ...sampleHouse(), latitude: 40.771234567, longitude: -111.930112345 });
  assert.equal(house.latitude, 40.771234567);
  assert.equal(house.longitude, -111.930112345);
});

test('map coordinates outside the globe become unknown, and other numbers still refuse negatives', () => {
  const house = normalizeHouse({ ...sampleHouse(), latitude: 91, longitude: -180.5, squareFeet: -5 });
  assert.equal(house.latitude, null);
  assert.equal(house.longitude, null);
  assert.equal(house.squareFeet, null);
  assert.equal(normalizeHouse({ ...sampleHouse(), latitude: -90, longitude: 180 }).latitude, -90);
});

test('validateHouse accepts real coordinates and explains impossible ones', () => {
  const house = sampleHouse();
  assert.deepEqual(validateHouse({ ...house, latitude: 40.7712, longitude: -111.9301 }).errors, {});
  assert.equal(validateHouse({ ...house, latitude: -91 }).errors.latitude, 'Must be at least -90.');
  assert.equal(validateHouse({ ...house, longitude: 181 }).errors.longitude, 'Must be 180 or less.');
  assert.equal(validateHouse({ ...house, longitude: NaN }).errors.longitude, 'Enter a number.');
  // One coordinate without the other only keeps the house off the map.
  assert.deepEqual(validateHouse({ ...house, latitude: 40.7712 }).errors, {});
});

test('cleared seller and lender credits return to their $0 default', () => {
  const raw = { ...sampleHouse(), sellerCredits: null, lenderCredits: 'lots' };
  const house = normalizeHouse(raw);
  assert.equal(house.sellerCredits, 0);
  assert.equal(house.lenderCredits, 0);
});

test('multi-selects keep untouched, answered-None, and selected states apart', () => {
  assert.equal(normalizeHouse({ ...sampleHouse(), parking: null }).parking, null);
  assert.deepEqual(normalizeHouse({ ...sampleHouse(), parking: [] }).parking, []);
  assert.deepEqual(normalizeHouse({ ...sampleHouse(), parking: ['attachedGarage'] }).parking, ['attachedGarage']);
});

test('multi-selects drop unknown options and duplicates, in canonical order', () => {
  const raw = { ...sampleHouse(), parking: ['street', 'attachedGarage', 'helipad', 'attachedGarage'] };
  assert.deepEqual(normalizeHouse(raw).parking, ['attachedGarage', 'street']);
});

test('a non-array multi-select becomes untouched rather than None', () => {
  const raw = { ...sampleHouse(), bathroomStorage: 'vanity', safeOutdoor: undefined };
  const house = normalizeHouse(raw);
  assert.equal(house.bathroomStorage, null);
  assert.equal(house.safeOutdoor, null);
});

test('normalizeHouse drops Status Date while a house is Available', () => {
  const raw = { ...sampleHouse(), status: STATUS_AVAILABLE, statusDate: '2026-10-10' };
  assert.equal(normalizeHouse(raw).statusDate, null);
});

test('normalizeHouse keeps Status Date for a house that left Available', () => {
  const raw = { ...sampleHouse(), status: STATUS_SOLD, statusDate: '2026-10-10' };
  const house = normalizeHouse(raw);
  assert.equal(house.status, STATUS_SOLD);
  assert.equal(house.statusDate, '2026-10-10');
});

test('normalizeHouse falls back to Available for an unknown status', () => {
  const raw = { ...sampleHouse(), status: 'haunted' };
  assert.equal(normalizeHouse(raw).status, STATUS_AVAILABLE);
});

test('normalizeHouse orders price history by date and drops invalid entries', () => {
  const raw = {
    ...sampleHouse(),
    priceHistory: [
      { id: 'b', price: 460000, date: '2026-10-09' },
      { id: 'x', price: 'free', date: '2026-10-05' },
      { id: 'y', price: 450000, date: '2026-13-40' },
      { id: 'a', price: 475000, date: '2026-10-02' },
    ],
  };
  assert.deepEqual(normalizeHouse(raw).priceHistory, [
    { id: 'a', price: 475000, date: '2026-10-02' },
    { id: 'b', price: 460000, date: '2026-10-09' },
  ]);
});

test('normalizeHouse drops a reviewed flag and leaves untouched areas unknown', () => {
  const house = normalizeHouse({ ...sampleHouse(), projectsReviewed: true });
  assert.equal('projectsReviewed' in house, false);
  assert.equal(house.projects.kitchen.state, null);
});

test('normalizeHouse fills in missing project areas and cleans project values', () => {
  const raw = {
    ...sampleHouse(),
    projects: { kitchen: { state: PROJECT_WANT, note: 'New counters', cost: 12000, excited: YES }, roof: { state: 'x' } },
  };
  const house = normalizeHouse(raw);
  assert.deepEqual(house.projects.kitchen, { state: PROJECT_WANT, note: 'New counters', cost: 12000, excited: YES });
  assert.deepEqual(house.projects.roof, { state: null, note: '', cost: null, excited: null });
  assert.deepEqual(Object.keys(house.projects), PROJECT_AREAS);
});

test('normalizeHouse is idempotent', () => {
  const raw = { ...sampleHouse(), parking: ['street', 'attachedGarage'], coolingType: COOLING_NONE, cornerLot: true };
  const once = normalizeHouse(raw);
  assert.deepEqual(normalizeHouse(once), once);
});

test('cooling type is recorded without creating or changing any project', () => {
  const house = normalizeHouse({ ...sampleHouse(), coolingType: COOLING_NONE });
  assert.equal(house.coolingType, COOLING_NONE);
  assert.deepEqual(house.projects.hvac, { state: null, note: '', cost: null, excited: null });
});

/* --------------------------------------------------------------------------
   Dates and usability
   -------------------------------------------------------------------------- */

test('isDateString accepts only real calendar dates', () => {
  assert.equal(isDateString('2026-10-13'), true);
  assert.equal(isDateString('2024-02-29'), true);
  assert.equal(isDateString('2026-02-29'), false);
  assert.equal(isDateString('2026-13-01'), false);
  assert.equal(isDateString('10/13/2026'), false);
  assert.equal(isDateString(null), false);
});

test('isUsableHouse requires an id, an address, and a listing price', () => {
  const house = sampleHouse();
  assert.equal(isUsableHouse(house), true);
  assert.equal(isUsableHouse({ ...house, address: '   ' }), false);
  assert.equal(isUsableHouse({ ...house, priceHistory: [] }), false);
  assert.equal(isUsableHouse({ ...house, id: '' }), false);
  assert.equal(isUsableHouse(null), false);
});

/* --------------------------------------------------------------------------
   Serializing and parsing
   -------------------------------------------------------------------------- */

test('data survives a serialize and parse round trip unchanged', () => {
  const settings = { ...defaultSettings(), interestRate: 6.875 };
  const house = sampleHouse();
  house.parking = [];
  house.foodStorage = ['pantry'];
  house.cornerLot = NO;
  house.exteriorSteps = 0;
  house.projects.roof = { state: PROJECT_NO_CHANGE, note: '', cost: null, excited: null };
  const pois = [{ id: 'p1', title: 'Library', latitude: 40.76054321, longitude: -111.8910 }];
  const data = { settings, houses: [house, { ...sampleHouse(), id: '1000002' }], pois };
  const result = parseData(serializeData(data));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, data);
});

test('unknown values are stored as null, never as false or zero', () => {
  const stored = JSON.parse(serializeData({ settings: defaultSettings(), houses: [sampleHouse()] }));
  const house = stored.houses[0];
  assert.equal(house.cornerLot, null);
  assert.equal(house.parking, null);
  assert.equal(house.trainMinutes, null);
  assert.equal(house.projects.roof.cost, null);
  assert.equal(stored.settings.interestRate, null);
  assert.equal(stored.app, APP_ID);
  assert.equal(stored.schemaVersion, SCHEMA_VERSION);
});

test('parseData rejects text that is not JSON', () => {
  assert.equal(parseData('not json at all').error, 'notJson');
});

test('parseData rejects JSON that is not a Houz backup', () => {
  assert.equal(parseData('[]').error, 'notHouz');
  assert.equal(parseData('{"houses":[]}').error, 'notHouz');
  assert.equal(parseData(JSON.stringify({ app: 'other', schemaVersion: 1, houses: [] })).error, 'notHouz');
});

test('parseData rejects a backup from a newer version', () => {
  const text = JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION + 1, settings: {}, houses: [] });
  assert.equal(parseData(text).error, 'newer');
});

test('parseData rejects a backup with no houses list or an unusable house', () => {
  const noList = JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, settings: {} });
  assert.equal(parseData(noList).error, 'invalid');
  const badHouse = JSON.stringify({
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    settings: {},
    houses: [{ id: 'a', address: '', priceHistory: [] }],
  });
  assert.equal(parseData(badHouse).error, 'invalid');
});

test('parseData rejects a backup in which two houses share an MLS number', () => {
  const text = JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, settings: {}, houses: [sampleHouse(), sampleHouse()] });
  const result = parseData(text);
  assert.equal(result.error, 'invalid');
  assert.equal(result.message, 'This backup contains two houses with the same MLS number.');
});

test('a house saved before MLS numbers loads unchanged, under its generated id', () => {
  const legacy = { ...normalizeHouse(sampleHouse()), id: 'mv7cgdl9-m8hdjof7', bedrooms: 3 };
  const result = parseData(JSON.stringify({ app: APP_ID, schemaVersion: 4, settings: defaultSettings(), houses: [legacy] }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.houses, [legacy]);
});

test('parseData cleans imported houses and settings', () => {
  const text = JSON.stringify({
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    settings: { interestRate: 7, loanTermYears: 'x' },
    houses: [{ ...sampleHouse(), cornerLot: true, coolingType: COOLING_NONE }],
  });
  const result = parseData(text);
  assert.equal(result.ok, true);
  assert.equal(result.data.settings.interestRate, 7);
  assert.equal(result.data.settings.loanTermYears, 30);
  assert.equal(result.data.houses[0].cornerLot, null);
  assert.equal(result.data.houses[0].projects.hvac.state, null, 'cooling type does not create a project');
});

test('backupFileName includes the date', () => {
  assert.equal(backupFileName('2026-10-13'), 'houz-backup-2026-10-13.json');
});

/* --------------------------------------------------------------------------
   Migration
   -------------------------------------------------------------------------- */

test('migrate applies each upgrade step in order', () => {
  const migrations = {
    /**
     * Upgrades a version 1 document by adding a marker.
     * @param {object} envelope - Version 1 document.
     * @returns {object} Document with the first marker.
     */
    1(envelope) {
      return { ...envelope, steps: ['one'] };
    },
    /**
     * Upgrades a version 2 document by adding a second marker.
     * @param {object} envelope - Version 2 document.
     * @returns {object} Document with both markers.
     */
    2(envelope) {
      return { ...envelope, steps: [...envelope.steps, 'two'] };
    },
  };
  const result = migrate({ schemaVersion: 1, houses: [] }, migrations, 3);
  assert.equal(result.schemaVersion, 3);
  assert.deepEqual(result.steps, ['one', 'two']);
});

test('migrate leaves a current document untouched', () => {
  const envelope = { schemaVersion: SCHEMA_VERSION, houses: [] };
  assert.equal(migrate(envelope), envelope);
});

test('migrate reports a missing upgrade step instead of guessing', () => {
  assert.equal(migrate({ schemaVersion: 0, houses: [] }), null);
});

/* --------------------------------------------------------------------------
   Storage
   -------------------------------------------------------------------------- */

test('loading from empty storage gives fresh data with no problem', () => {
  const loaded = loadData(fakeStorage());
  assert.equal(loaded.problem, null);
  assert.deepEqual(loaded.data, createEmptyData());
});

test('saved data loads back unchanged', () => {
  const storage = fakeStorage();
  const data = { settings: { ...defaultSettings(), interestRate: 6.5 }, houses: [sampleHouse()], pois: [] };
  assert.equal(saveData(storage, data), true);
  const loaded = loadData(storage);
  assert.equal(loaded.problem, null);
  assert.deepEqual(loaded.data, data);
});

test('unreadable stored text is set aside, not lost', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{"half":' });
  const loaded = loadData(storage);
  assert.equal(loaded.problem, 'unreadable');
  assert.deepEqual(loaded.data, createEmptyData());
  assert.equal(storage.items[UNREADABLE_KEY], '{"half":');
});

test('data from a newer version is set aside rather than overwritten', () => {
  const newer = JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION + 1, settings: {}, houses: [] });
  const storage = fakeStorage({ [STORAGE_KEY]: newer });
  assert.equal(loadData(storage).problem, 'unreadable');
  assert.equal(storage.items[UNREADABLE_KEY], newer);
});

test('blocked storage loads fresh data and reports it', () => {
  const loaded = loadData(brokenStorage());
  assert.equal(loaded.problem, 'unavailable');
  assert.deepEqual(loaded.data, createEmptyData());
});

test('missing storage is handled like blocked storage', () => {
  assert.equal(loadData(null).problem, 'unavailable');
  assert.equal(saveData(null, createEmptyData()), false);
});

test('a failed save reports false instead of throwing', () => {
  assert.equal(saveData(brokenStorage(), createEmptyData()), false);
});

/* --------------------------------------------------------------------------
   Editing a house
   -------------------------------------------------------------------------- */

test('conditional fields apply only when their parent answer is given', () => {
  const house = sampleHouse();
  assert.equal(isFieldApplicable(house, 'garagePower'), false, 'parking untouched');
  assert.equal(isFieldApplicable({ ...house, parking: ['driveway'] }, 'garagePower'), false);
  assert.equal(isFieldApplicable({ ...house, parking: ['attachedGarage'] }, 'garagePower'), true);
  assert.equal(isFieldApplicable({ ...house, parking: ['attachedGarage'] }, 'garageStalls'), true);
  assert.equal(isFieldApplicable({ ...house, hoa: NO }, 'hoaDues'), false);
  assert.equal(isFieldApplicable({ ...house, hoa: YES }, 'hoaDues'), true);
  assert.equal(isFieldApplicable({ ...house, solarStatus: 'owned' }, 'solarPayment'), false);
  assert.equal(isFieldApplicable({ ...house, solarStatus: 'financed' }, 'solarPayment'), true);
  assert.equal(isFieldApplicable({ ...house, coolingType: COOLING_NONE }, 'coolingYear'), false);
  assert.equal(isFieldApplicable({ ...house, coolingType: COOLING_CENTRAL }, 'coolingYear'), true);
  assert.equal(isFieldApplicable(house, 'megacouchFits'), true, 'unconditional field');
});

test('isFieldKnown treats blank, null, and unreadable numbers as not known', () => {
  const house = { ...sampleHouse(), cornerLot: NO, exteriorSteps: 0, parking: [], bedrooms: NaN, hoaNotes: '  ' };
  assert.equal(isFieldKnown(house, 'cornerLot'), true, 'an explicit no is known');
  assert.equal(isFieldKnown(house, 'exteriorSteps'), true, 'zero is known');
  assert.equal(isFieldKnown(house, 'parking'), true, 'answered None is known');
  assert.equal(isFieldKnown(house, 'address'), true);
  assert.equal(isFieldKnown(house, 'bedrooms'), false);
  assert.equal(isFieldKnown(house, 'hoaNotes'), false);
  assert.equal(isFieldKnown(house, 'megacouchFits'), false);
  assert.equal(isFieldKnown(house, 'foodStorage'), false, 'untouched multi-select');
});

test('sectionProgress counts known fields among the applicable ones', () => {
  const names = ['parking', 'garageStalls', 'garagePower', 'garageWorkspace', 'coveredRoute', 'exteriorSteps'];
  const house = sampleHouse();
  assert.deepEqual(sectionProgress(house, names), { known: 0, total: 3 });
  assert.deepEqual(sectionProgress({ ...house, parking: ['driveway'], exteriorSteps: 2 }, names), { known: 2, total: 3 });
  const detached = { ...house, parking: ['detachedGarage'], garagePower: YES };
  assert.deepEqual(sectionProgress(detached, names), { known: 2, total: 6 });
  // An attached garage is itself the covered route, so that question drops out.
  const attached = { ...house, parking: ['attachedGarage'], garagePower: YES };
  assert.deepEqual(sectionProgress(attached, names), { known: 2, total: 5 });
});

test('garage questions apply to either garage type; covered route only without an attached garage', () => {
  const house = sampleHouse();
  for (const parking of [['attachedGarage'], ['detachedGarage'], ['attachedGarage', 'detachedGarage']]) {
    assert.equal(isFieldApplicable({ ...house, parking }, 'garageStalls'), true, parking.join('+'));
    assert.equal(isFieldApplicable({ ...house, parking }, 'garageWorkspace'), true, parking.join('+'));
  }
  assert.equal(isFieldApplicable({ ...house, parking: ['carport'] }, 'garagePower'), false);
  assert.equal(isFieldApplicable({ ...house, parking: null }, 'coveredRoute'), true, 'asked until answered');
  assert.equal(isFieldApplicable({ ...house, parking: ['detachedGarage', 'driveway'] }, 'coveredRoute'), true);
  assert.equal(isFieldApplicable({ ...house, parking: ['attachedGarage'] }, 'coveredRoute'), false);
});

test('fireplace and bay window are yes/no/unknown fields that start unknown', () => {
  const house = createHouse({ mlsNumber: '2100003', address: '1 Hearth Ln', listingPrice: 400000, listingDate: '2026-10-01' });
  assert.equal(house.fireplace, null);
  assert.equal(house.bayWindow, null);
  assert.equal(normalizeHouse({ ...house, fireplace: YES, bayWindow: true }).bayWindow, null, 'booleans are not answers');
});

test('version 2 data turns Garage into Detached garage and keeps every other parking answer', () => {
  const stored = normalizeHouse({ ...sampleHouse() });
  const old = { ...stored, parking: ['garage', 'driveway', 'street'], garagePower: YES, garageStalls: 2 };
  const untouched = { ...stored, id: 'other', parking: ['carport'] };
  const text = JSON.stringify({ app: APP_ID, schemaVersion: 2, settings: defaultSettings(), houses: [old, untouched] });
  const result = parseData(text);
  assert.equal(result.ok, true);
  const [first, second] = result.data.houses;
  assert.deepEqual(first.parking, ['detachedGarage', 'driveway', 'street']);
  assert.equal(first.garagePower, YES);
  assert.equal(first.garageStalls, 2);
  assert.deepEqual(second.parking, ['carport']);
});

test('toggleOption adds and removes options and returns to untouched when empty', () => {
  assert.deepEqual(toggleOption(null, 'attachedGarage'), ['attachedGarage']);
  assert.deepEqual(toggleOption(['attachedGarage'], 'driveway'), ['attachedGarage', 'driveway']);
  assert.deepEqual(toggleOption(['attachedGarage', 'driveway'], 'attachedGarage'), ['driveway']);
  assert.equal(toggleOption(['attachedGarage'], 'attachedGarage'), null, 'clearing the last option is not the same as None');
});

test('choosing an option replaces a None answer', () => {
  assert.deepEqual(toggleOption([], 'street'), ['street']);
});

test('toggleNone answers None, clearing other options, and toggles back to untouched', () => {
  assert.deepEqual(toggleNone(null), []);
  assert.deepEqual(toggleNone(['attachedGarage', 'driveway']), []);
  assert.equal(toggleNone([]), null);
});

test('toggle functions do not modify the selection they are given', () => {
  const selection = ['attachedGarage'];
  toggleOption(selection, 'driveway');
  toggleNone(selection);
  assert.deepEqual(selection, ['attachedGarage']);
});

test('validateNewHouse requires only an MLS number, an address, a listing price, and a listing date', () => {
  const valid = { mlsNumber: '1000001', address: '742 Example Ave', listingPrice: 475000, listingDate: '2026-10-02' };
  assert.deepEqual(validateNewHouse(valid, []), { ok: true, errors: {} });
  assert.equal(validateNewHouse({ ...valid, mlsNumber: ' ' }, []).errors.mlsNumber, 'Enter the MLS number.');
  assert.equal(validateNewHouse({ ...valid, address: '  ' }, []).errors.address, 'Enter an address.');
  assert.equal(validateNewHouse({ ...valid, listingPrice: null }, []).errors.listingPrice, 'Enter the listing price.');
  assert.equal(validateNewHouse({ ...valid, listingPrice: NaN }, []).errors.listingPrice, 'Enter a number.');
  assert.equal(validateNewHouse({ ...valid, listingDate: '' }, []).errors.listingDate, 'Enter the listing date.');
  assert.equal(validateNewHouse({ ...valid, listingDate: '2026-02-30' }, []).errors.listingDate, 'Enter the listing date.');
});

test('a new house cannot reuse a stored house\'s MLS number', () => {
  const valid = { mlsNumber: '1000001', address: '742 Example Ave', listingPrice: 475000, listingDate: '2026-10-02' };
  assert.equal(validateNewHouse(valid, [sampleHouse()]).errors.mlsNumber, 'Another house already has this MLS number.');
  assert.equal(validateNewHouse({ ...valid, mlsNumber: ' 1000001 ' }, [sampleHouse()]).errors.mlsNumber, 'Another house already has this MLS number.');
});

test('an MLS number is digits only, kept as text', () => {
  assert.equal(isMlsNumber('1000001'), true);
  assert.equal(isMlsNumber('0012'), true);
  assert.equal(isMlsNumber('mv7cgdl9-m8hdjof7'), false, 'a generated id is never an MLS number');
  assert.equal(isMlsNumber('2,188,783'), false);
  assert.equal(isMlsNumber(''), false);
  assert.equal(isMlsNumber(1000001), false);
  assert.equal(mlsNumberError([], '21 88'), 'Use digits only.');
  assert.equal(mlsNumberError([], '1000001'), null);
});

test('a house may keep its own MLS number while another may not take it', () => {
  const houses = [sampleHouse(), { ...sampleHouse(), id: '1000002' }];
  assert.equal(mlsNumberError(houses, '1000001', '1000001'), null);
  assert.equal(mlsNumberError(houses, '1000002', '1000001'), 'Another house already has this MLS number.');
  assert.equal(mlsNumberError(houses, '1000002', 'mv7cgdl9-m8hdjof7'), 'Another house already has this MLS number.');
});

test('the UtahRealEstate.com listing address is built from the MLS number', () => {
  assert.equal(listingUrl(sampleHouse()), 'https://www.utahrealestate.com/1000001');
  assert.equal(listingUrl({ ...sampleHouse(), id: 'mv7cgdl9-m8hdjof7' }), null, 'a house without an MLS number has no listing link');
});

test('validateHouse never blocks a save for missing information', () => {
  assert.deepEqual(validateHouse(sampleHouse()), { ok: true, errors: {} });
});

test('validateHouse blocks a blank address and unreadable or out-of-range numbers', () => {
  const result = validateHouse({ ...sampleHouse(), address: '', bedrooms: NaN, downPaymentPercent: 15, pointsPercent: 150 });
  assert.equal(result.ok, false);
  assert.equal(result.errors.address, 'Enter an address.');
  assert.equal(result.errors.bedrooms, 'Enter a number.');
  assert.equal(result.errors.downPaymentPercent, 'Must be at least 20.');
  assert.equal(result.errors.pointsPercent, 'Must be 100 or less.');
});

test('normalizeHouse drops a down-payment override below 20%', () => {
  assert.equal(normalizeHouse({ ...sampleHouse(), downPaymentPercent: 10 }).downPaymentPercent, null);
  assert.equal(normalizeHouse({ ...sampleHouse(), downPaymentPercent: 25 }).downPaymentPercent, 25);
});

test('findHouse and saveHouse add, find, and replace by id', () => {
  const first = sampleHouse();
  const second = { ...sampleHouse(), id: '1000002', address: '846 N Nocturne Dr' };
  let data = saveHouse(createEmptyData(), first);
  data = saveHouse(data, second);
  assert.equal(data.houses.length, 2);
  assert.equal(findHouse(data, '1000002').address, '846 N Nocturne Dr');
  assert.equal(findHouse(data, 'missing'), null);

  const edited = { ...first, bedrooms: 4 };
  const after = saveHouse(data, edited);
  assert.equal(after.houses.length, 2);
  assert.equal(findHouse(after, first.id).bedrooms, 4);
  assert.equal(findHouse(data, first.id).bedrooms, null, 'earlier data is not modified');
});

test('a place needs a trimmed title and both coordinates within the house coordinate bounds', () => {
  assert.equal(validatePoi({ title: ' Library ', latitude: 40.76, longitude: -111.89 }).ok, true);
  const blank = validatePoi({ title: '   ', latitude: null, longitude: null });
  assert.deepEqual(blank.errors, { title: 'Enter a title.', latitude: 'Enter a value.', longitude: 'Enter a value.' });
  const outside = validatePoi({ title: 'Far', latitude: 91, longitude: -181 });
  assert.equal(outside.errors.latitude, 'Must be 90 or less.');
  assert.equal(outside.errors.longitude, 'Must be at least -180.');
  assert.equal(validatePoi({ title: 'Typo', latitude: NaN, longitude: 0 }).errors.latitude, 'Enter a number.');
});

test('createPoi trims the title, keeps the coordinates exactly, and keeps an existing id', () => {
  const poi = createPoi({ title: '  Work ', latitude: 40.7518423, longitude: -111.81605 }, fixedId('new'));
  assert.deepEqual(poi, { id: 'new', title: 'Work', latitude: 40.7518423, longitude: -111.81605 });
  assert.equal(createPoi({ ...poi, id: 'kept' }, fixedId('new')).id, 'kept');
});

test('data saved before places existed loads with none, and unusable places are dropped quietly', () => {
  const text = JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, settings: defaultSettings(), houses: [] });
  const result = parseData(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.pois, []);
  const kept = { id: 'a', title: 'Work', latitude: 45, longitude: -100 };
  const cleaned = normalizePois([kept, { ...kept, title: 'Duplicate' }, { id: 'b', title: '', latitude: 1, longitude: 1 },
    { id: 'c', title: 'Far', latitude: 95, longitude: 0 }, { title: 'No id', latitude: 1, longitude: 1 }, 'junk']);
  assert.deepEqual(cleaned, [kept], 'a valid place outside the map area is kept');
  assert.deepEqual(normalizePois('junk'), []);
});

test('entering an MLS number renames a house in place, keeping everything it knows', () => {
  const legacy = { ...sampleHouse(), id: 'mv7cgdl9-m8hdjof7', bedrooms: 3 };
  const other = { ...sampleHouse(), id: '1000002' };
  const data = { settings: defaultSettings(), houses: [legacy, other] };
  const after = saveHouse(data, { ...legacy, id: '1000001' }, legacy.id);
  assert.deepEqual(after.houses.map((house) => house.id), ['1000001', '1000002'], 'same position, new id');
  assert.equal(findHouse(after, 'mv7cgdl9-m8hdjof7'), null);
  assert.deepEqual(findHouse(after, '1000001'), { ...legacy, id: '1000001' });
});

/* --------------------------------------------------------------------------
   Projects
   -------------------------------------------------------------------------- */

test('setProject changes one project without touching the house it was given', () => {
  const house = sampleHouse();
  const next = setProject(house, 'kitchen', { state: PROJECT_WANT, note: 'Open it up', excited: YES });
  assert.deepEqual(next.projects.kitchen, { state: PROJECT_WANT, note: 'Open it up', cost: null, excited: YES });
  assert.equal(house.projects.kitchen.state, null);
  assert.equal(next.projects.roof, house.projects.roof);
});

test('setting one project leaves the other areas untouched', () => {
  const house = setProject(sampleHouse(), 'roof', { state: PROJECT_NEED, cost: 18000 });
  assert.equal(house.projects.kitchen.state, null);
  assert.equal(projectsAnswered(house), false);
});

test('Projects progress counts each area, plus cost for work and excitement for optional work', () => {
  let house = sampleHouse();
  assert.deepEqual(projectsProgress(house), { known: 0, total: PROJECT_AREAS.length });
  house = setProject(house, 'roof', { state: PROJECT_NEED, cost: 18000 });
  house = setProject(house, 'kitchen', { state: PROJECT_WANT });
  house = setProject(house, 'yard', { state: PROJECT_NO_CHANGE });
  // Roof: state and cost. Kitchen: state known, cost and excitement unknown. Yard: state.
  assert.deepEqual(projectsProgress(house), { known: 4, total: PROJECT_AREAS.length + 3 });
});

test('Projects are answered once every area has a state', () => {
  let house = sampleHouse();
  for (const area of PROJECT_AREAS) house = setProject(house, area, { state: PROJECT_NO_CHANGE });
  assert.equal(projectsAnswered(house), true);
  assert.deepEqual(projectsProgress(house), { known: PROJECT_AREAS.length, total: PROJECT_AREAS.length });
});

test('a version 3 document keeps what Reviewed meant: untouched areas of reviewed houses become No change', () => {
  const reviewed = { ...sampleHouse(), id: 'r', projectsReviewed: true };
  reviewed.projects = { ...reviewed.projects, roof: { state: PROJECT_NEED, note: '', cost: 9000, excited: null } };
  const unreviewed = { ...sampleHouse(), id: 'u', projectsReviewed: false };
  const result = migrate({ schemaVersion: 3, settings: {}, houses: [reviewed, unreviewed] });
  const [first, second] = result.houses;
  assert.equal('projectsReviewed' in first, false);
  assert.equal('projectsReviewed' in second, false);
  assert.equal(first.projects.roof.state, PROJECT_NEED);
  assert.equal(first.projects.kitchen.state, PROJECT_NO_CHANGE);
  assert.equal(projectsAnswered(normalizeHouse(first)), true);
  assert.equal(second.projects.kitchen.state, null);
});

test('the HVAC project is set like any other project, whatever the cooling type', () => {
  const house = { ...sampleHouse(), coolingType: COOLING_NONE };
  assert.equal(setProject(house, 'hvac', { state: PROJECT_NO_CHANGE }).projects.hvac.state, PROJECT_NO_CHANGE);
  assert.equal(setProject(house, 'hvac', { state: PROJECT_WANT }).projects.hvac.state, PROJECT_WANT);
  const central = { ...sampleHouse(), coolingType: COOLING_CENTRAL };
  assert.deepEqual(setProject(central, 'hvac', { state: PROJECT_NEED, cost: 14500 }).projects.hvac.cost, 14500);
});

test('validateHouse flags an unreadable project cost by its control name', () => {
  const house = setProject(sampleHouse(), 'roof', { state: PROJECT_NEED, cost: NaN });
  const result = validateHouse(house);
  assert.equal(result.ok, false);
  assert.equal(result.errors[projectFieldName('roof', 'cost')], 'Enter a number.');
  assert.equal(projectFieldName('roof', 'cost'), 'project-roof-cost');
});

test('a project control name reads back as its area and part', () => {
  for (const area of PROJECT_AREAS) {
    for (const part of ['state', 'note', 'cost', 'excited']) {
      assert.deepEqual(parseProjectFieldName(projectFieldName(area, part)), { area, part });
    }
  }
  for (const name of ['hoaDues', 'project-roof', 'project-roof-price', 'listingDate']) {
    assert.equal(parseProjectFieldName(name), null, name);
  }
});

test('validateHouse ignores a field the form hides because it does not apply', () => {
  const house = { ...sampleHouse(), hoa: NO, hoaDues: NaN };
  assert.deepEqual(validateHouse(house), { ok: true, errors: {} });
  assert.equal(validateHouse({ ...house, hoa: YES }).errors.hoaDues, 'Enter a number.');
});

test('validateHouse ignores a project cost the form hides because the area has no work', () => {
  for (const state of [null, PROJECT_NO_CHANGE]) {
    const house = setProject(sampleHouse(), 'roof', { state, cost: NaN });
    assert.deepEqual(validateHouse(house), { ok: true, errors: {} }, String(state));
  }
  const wanted = setProject(sampleHouse(), 'roof', { state: PROJECT_WANT, cost: NaN });
  assert.equal(validateHouse(wanted).errors[projectFieldName('roof', 'cost')], 'Enter a number.');
});

/* --------------------------------------------------------------------------
   Collection view preferences
   -------------------------------------------------------------------------- */

test('the collection starts with everything shown and best fit first', () => {
  assert.deepEqual(defaultViewPrefs(), { sort: 'fitHigh', grouped: true, hidden: [] });
  assert.deepEqual(loadViewPrefs(fakeStorage()), defaultViewPrefs());
});

test('view preferences are remembered on this device', () => {
  const storage = fakeStorage();
  assert.equal(saveViewPrefs(storage, { sort: 'priceLow', grouped: false, hidden: ['sold'] }), true);
  assert.deepEqual(loadViewPrefs(storage), { sort: 'priceLow', grouped: false, hidden: ['sold'] });
});

test('view preferences are kept apart from house data and backups', () => {
  const storage = fakeStorage();
  saveData(storage, createEmptyData());
  saveViewPrefs(storage, { sort: 'fitLow', hidden: ['underContract'] });
  assert.ok(VIEW_KEY in storage.items);
  assert.equal(JSON.parse(storage.items[STORAGE_KEY]).view, undefined);
  assert.equal(serializeData(loadData(storage).data).includes('fitLow'), false);
});

test('preferences saved before Group by status existed keep the grouped order', () => {
  const old = loadViewPrefs(fakeStorage({ [VIEW_KEY]: JSON.stringify({ sort: 'priceLow', hidden: [] }) }));
  assert.equal(old.grouped, true);
  assert.equal(loadViewPrefs(fakeStorage({ [VIEW_KEY]: JSON.stringify({ grouped: 'no' }) })).grouped, true);
});

test('invalid view preferences fall back to the defaults', () => {
  assert.deepEqual(loadViewPrefs(fakeStorage({ [VIEW_KEY]: '{oops' })), defaultViewPrefs());
  const odd = loadViewPrefs(fakeStorage({ [VIEW_KEY]: JSON.stringify({ sort: 'random', hidden: ['sold', 'gone', 'sold'] }) }));
  assert.deepEqual(odd, { sort: 'fitHigh', grouped: true, hidden: ['sold'] });
  assert.deepEqual(loadViewPrefs(brokenStorage()), defaultViewPrefs());
  assert.deepEqual(loadViewPrefs(null), defaultViewPrefs());
  assert.equal(saveViewPrefs(brokenStorage(), defaultViewPrefs()), false);
});

/* --------------------------------------------------------------------------
   Price Ladder view preferences
   -------------------------------------------------------------------------- */

test('the Price Ladder starts with no house hidden', () => {
  assert.deepEqual(defaultLadderPrefs(), { hidden: [] });
  assert.deepEqual(loadLadderPrefs(fakeStorage()), defaultLadderPrefs());
});

test('houses hidden from the ladder are remembered on this device, apart from house data and backups', () => {
  const storage = fakeStorage();
  saveData(storage, createEmptyData());
  assert.equal(saveLadderPrefs(storage, { hidden: ['house-a', 'house-b'] }), true);
  assert.deepEqual(loadLadderPrefs(storage), { hidden: ['house-a', 'house-b'] });
  assert.ok(LADDER_KEY in storage.items);
  assert.equal(serializeData(loadData(storage).data).includes('house-a'), false);
});

test('invalid ladder preferences fall back to the defaults, keeping each id once', () => {
  assert.deepEqual(loadLadderPrefs(fakeStorage({ [LADDER_KEY]: '{oops' })), defaultLadderPrefs());
  const odd = loadLadderPrefs(fakeStorage({ [LADDER_KEY]: JSON.stringify({ hidden: ['a', 7, '', 'a', 'b'] }) }));
  assert.deepEqual(odd, { hidden: ['a', 'b'] });
  assert.deepEqual(loadLadderPrefs(brokenStorage()), defaultLadderPrefs());
  assert.deepEqual(loadLadderPrefs(null), defaultLadderPrefs());
  assert.equal(saveLadderPrefs(brokenStorage(), defaultLadderPrefs()), false);
});

test('a hidden house stays hidden when its MLS number is entered or corrected', () => {
  const prefs = { hidden: ['mv7cgdl9-m8hdjof7', '1000002'] };
  assert.deepEqual(renameLadderHidden(prefs, 'mv7cgdl9-m8hdjof7', '1000001'), { hidden: ['1000001', '1000002'] });
  assert.deepEqual(renameLadderHidden(prefs, '1000003', '1000004'), prefs, 'a house that was not hidden stays shown');
  assert.deepEqual(prefs, { hidden: ['mv7cgdl9-m8hdjof7', '1000002'] }, 'the preferences passed in are not modified');
});

test('a stored modeled purchase price from an older version is dropped', () => {
  const house = normalizeHouse({ ...sampleHouse(), modeledPurchasePrice: 400000 });
  assert.equal('modeledPurchasePrice' in house, false);
});

/* --------------------------------------------------------------------------
   Listing price history, Listing Date, status, and deleting
   -------------------------------------------------------------------------- */

/**
 * Builds a house listed at $400,000 on October 1, 2026.
 * @param {object} [overrides] - House fields to change.
 * @returns {object} A new house whose initial price entry has the id "first".
 */
function listedHouse(overrides = {}) {
  const house = createHouse({ mlsNumber: '2100004', address: '1 Listing Ln', listingPrice: 400000, listingDate: '2026-10-01' }, idSequence(['first']));
  return { ...house, ...overrides };
}

/**
 * Lists the ids of a house's price entries in stored order.
 * @param {object} house - House with a listing-price history.
 * @returns {string[]} Entry ids, oldest first.
 */
function entryIds(house) {
  const ids = [];
  for (const entry of house.priceHistory) ids.push(entry.id);
  return ids;
}

/**
 * Lists each price entry's id and date in stored order.
 * @param {object} house - House with a listing-price history.
 * @returns {Array<string[]>} Pairs of id and date, oldest first.
 */
function entryDates(house) {
  const pairs = [];
  for (const entry of house.priceHistory) pairs.push([entry.id, entry.date]);
  return pairs;
}

test('a price change needs a price and an entered date on or after the listing date', () => {
  const house = listedHouse();
  assert.deepEqual(validatePriceEntry(house, { price: null, date: '' }).errors, {
    price: 'Enter the listing price.',
    date: 'Enter the date the price took effect.',
  });
  assert.equal(validatePriceEntry(house, { price: NaN, date: '2026-10-05' }).errors.price, 'Enter a number.');
  assert.equal(validatePriceEntry(house, { price: 390000, date: '2026-09-30' }).errors.date, 'Must be on or after the listing date.');
  assert.equal(validatePriceEntry(house, { price: 390000, date: '2026-10-01' }).ok, true);
});

test('adding a price change keeps every earlier entry, ordered by date', () => {
  let house = listedHouse();
  house = addPriceEntry(house, { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  house = addPriceEntry(house, { price: 395000, date: '2026-10-05' }, fixedId('late'));
  assert.deepEqual(entryIds(house), ['first', 'late', 'cut']);
});

test('correcting an entry replaces it in place and can reorder the history', () => {
  let house = addPriceEntry(listedHouse(), { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  house = updatePriceEntry(house, 'cut', { price: 385000, date: '2026-10-11' });
  assert.deepEqual(house.priceHistory[1], { id: 'cut', price: 385000, date: '2026-10-11' });
  house = updatePriceEntry(house, 'first', { price: 401000, date: '2026-10-20' });
  assert.deepEqual(entryIds(house), ['cut', 'first']);
});

test('the last remaining price entry can be edited but not deleted', () => {
  let house = addPriceEntry(listedHouse(), { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  assert.equal(canDeletePriceEntry(house), true);
  house = deletePriceEntry(house, 'first');
  assert.deepEqual(entryIds(house), ['cut']);
  assert.equal(canDeletePriceEntry(house), false);
  assert.equal(deletePriceEntry(house, 'cut'), house);
  assert.equal(updatePriceEntry(house, 'cut', { price: 380000, date: '2026-10-12' }).priceHistory[0].price, 380000);
});

test('changing the listing date moves the initial price entry with it', () => {
  let house = addPriceEntry(listedHouse(), { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  house = setListingDate(house, '2026-09-25');
  assert.equal(house.listingDate, '2026-09-25');
  assert.deepEqual(entryDates(house), [
    ['first', '2026-09-25'],
    ['cut', '2026-10-12'],
  ]);
});

test('an initial entry already moved off the listing date stays put', () => {
  let house = updatePriceEntry(listedHouse(), 'first', { price: 400000, date: '2026-10-03' });
  house = setListingDate(house, '2026-09-28');
  assert.equal(house.priceHistory[0].date, '2026-10-03');
});

test('the listing date cannot pass the status date or the first price change', () => {
  const house = addPriceEntry(listedHouse(), { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  assert.equal(validateListingDate(house, '').errors.listingDate, 'Enter the listing date.');
  assert.equal(validateListingDate(house, '2026-10-13').errors.listingDate, 'Must be on or before the first price change.');
  assert.equal(validateListingDate(house, '2026-10-12').ok, true);
  const pending = { ...house, status: STATUS_UNDER_CONTRACT, statusDate: '2026-10-08' };
  assert.equal(validateListingDate(pending, '2026-10-09').errors.listingDate, 'Must be on or before the status date.');
});

test('the status date defaults to today on each move off the market and keeps a saved date', () => {
  const house = listedHouse();
  assert.equal(defaultStatusDate(house, STATUS_AVAILABLE, '2026-10-15'), null);
  assert.equal(defaultStatusDate(house, STATUS_UNDER_CONTRACT, '2026-10-15'), '2026-10-15');
  const pending = setStatus(house, STATUS_UNDER_CONTRACT, '2026-10-09');
  assert.equal(defaultStatusDate(pending, STATUS_UNDER_CONTRACT, '2026-10-15'), '2026-10-09');
  // Under Contract to Sold is a new status, so its date starts at today.
  assert.equal(defaultStatusDate(pending, STATUS_SOLD, '2026-10-30'), '2026-10-30');
});

test('under contract and sold need a status date on or after the listing date', () => {
  const house = listedHouse();
  assert.equal(validateStatus(house, STATUS_SOLD, null).errors.statusDate, 'Enter the status date.');
  assert.equal(validateStatus(house, STATUS_SOLD, '2026-09-30').errors.statusDate, 'Must be on or after the listing date.');
  assert.equal(validateStatus(house, STATUS_SOLD, '2026-10-01').ok, true);
  assert.equal(validateStatus(house, STATUS_AVAILABLE, null).ok, true);
  assert.equal(validateStatus(house, 'pending', null).ok, false);
});

test('returning to available clears the status date', () => {
  const pending = setStatus(listedHouse(), STATUS_UNDER_CONTRACT, '2026-10-09');
  assert.equal(pending.statusDate, '2026-10-09');
  const back = setStatus(pending, STATUS_AVAILABLE, '2026-10-09');
  assert.equal(back.status, STATUS_AVAILABLE);
  assert.equal(back.statusDate, null);
});

test('price and status changes survive normalizing', () => {
  let house = addPriceEntry(listedHouse(), { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  house = setStatus(house, STATUS_SOLD, '2026-11-02');
  assert.deepEqual(normalizeHouse(house), house);
});

test('deleting a house removes only that house', () => {
  const data = { settings: defaultSettings(), houses: [listedHouse(), { ...listedHouse(), id: '2100005' }] };
  const after = deleteHouse(data, '2100004');
  assert.deepEqual(after.houses.length, 1);
  assert.equal(after.houses[0].id, '2100005');
  assert.equal(data.houses.length, 2);
});
