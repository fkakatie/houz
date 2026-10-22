// Data model, invariants, and persistence. No DOM access; storage is always passed in.
//
// Unknown is stored as null everywhere. Observations are never booleans, so an
// unanswered question can never be mistaken for "no".

export const APP_ID = 'houz';
export const SCHEMA_VERSION = 4;
export const STORAGE_KEY = 'houz';
export const UNREADABLE_KEY = 'houz.unreadable';
// How the Houses collection is shown on this device. Kept apart from house data and never backed up.
export const VIEW_KEY = 'houz.view';
// Houses hidden from the Price Ladder: a viewing choice on this device, never part of house data or backups.
export const LADDER_KEY = 'houz.ladder';

export const SORT_FIT_HIGH = 'fitHigh';
export const SORT_FIT_LOW = 'fitLow';
export const SORT_PRICE_LOW = 'priceLow';
export const SORT_PRICE_HIGH = 'priceHigh';
export const SORT_PER_SQFT_LOW = 'perSqftLow';
export const SORT_PER_SQFT_HIGH = 'perSqftHigh';
export const SORT_PER_LOT_SQFT_LOW = 'perLotSqftLow';
export const SORT_PER_LOT_SQFT_HIGH = 'perLotSqftHigh';
export const SORT_SQFT_HIGH = 'sqftHigh';
export const SORT_SQFT_LOW = 'sqftLow';
export const SORT_LOT_HIGH = 'lotHigh';
export const SORT_LOT_LOW = 'lotLow';
export const SORT_YEAR_NEWEST = 'yearNewest';
export const SORT_YEAR_OLDEST = 'yearOldest';
export const SORT_DAYS_LOW = 'daysLow';
export const SORT_DAYS_HIGH = 'daysHigh';
export const SORT_OPTIONS = [
  SORT_FIT_HIGH,
  SORT_FIT_LOW,
  SORT_PRICE_LOW,
  SORT_PRICE_HIGH,
  SORT_PER_SQFT_LOW,
  SORT_PER_SQFT_HIGH,
  SORT_PER_LOT_SQFT_LOW,
  SORT_PER_LOT_SQFT_HIGH,
  SORT_SQFT_HIGH,
  SORT_SQFT_LOW,
  SORT_LOT_HIGH,
  SORT_LOT_LOW,
  SORT_YEAR_NEWEST,
  SORT_YEAR_OLDEST,
  SORT_DAYS_LOW,
  SORT_DAYS_HIGH,
];
// Sorts that put the largest value first; every other sort puts the smallest first.
export const DESCENDING_SORTS = [SORT_FIT_HIGH, SORT_PRICE_HIGH, SORT_PER_SQFT_HIGH, SORT_PER_LOT_SQFT_HIGH, SORT_SQFT_HIGH, SORT_LOT_HIGH, SORT_YEAR_NEWEST, SORT_DAYS_HIGH];

export const YES = 'yes';
export const NO = 'no';
export const NA = 'na';

export const STATUS_AVAILABLE = 'available';
export const STATUS_UNDER_CONTRACT = 'underContract';
export const STATUS_SOLD = 'sold';
export const STATUSES = [STATUS_AVAILABLE, STATUS_UNDER_CONTRACT, STATUS_SOLD];

export const PROJECT_NO_CHANGE = 'noChange';
export const PROJECT_WANT = 'want';
export const PROJECT_NEED = 'need';
export const PROJECT_STATES = [PROJECT_NO_CHANGE, PROJECT_WANT, PROJECT_NEED];

export const PROJECT_AREAS = [
  'livingRoom',
  'kitchen',
  'primaryBedroom',
  'primaryBathroom',
  'office',
  'guestBedroom',
  'otherBathrooms',
  'yard',
  'garage',
  'roof',
  'hvac',
  'electrical',
  'plumbing',
  'sewer',
  'foundation',
  'other',
];

export const COOLING_CENTRAL = 'centralAc';
export const COOLING_MINI_SPLIT = 'miniSplit';
export const COOLING_EVAPORATIVE = 'evaporative';
export const COOLING_WINDOW = 'windowUnits';
export const COOLING_NONE = 'none';
export const COOLING_TYPES = [COOLING_CENTRAL, COOLING_MINI_SPLIT, COOLING_EVAPORATIVE, COOLING_WINDOW, COOLING_NONE];

export const PARKING_ATTACHED_GARAGE = 'attachedGarage';
export const PARKING_DETACHED_GARAGE = 'detachedGarage';
export const GARAGE_OPTIONS = [PARKING_ATTACHED_GARAGE, PARKING_DETACHED_GARAGE];
export const PARKING_OPTIONS = [PARKING_ATTACHED_GARAGE, PARKING_DETACHED_GARAGE, 'carport', 'driveway', 'dedicatedUncovered', 'street'];
export const FOOD_STORAGE_OPTIONS = ['pantry', 'cabinetry', 'other'];
export const WINDOW_EXPOSURE_OPTIONS = [
  'privateOutdoor',
  'street',
  'neighborProperty',
  'directNeighborWindow',
  'publicSidewalk',
];
export const BATHROOM_STORAGE_OPTIONS = ['vanity', 'medicineCabinet', 'linen'];
export const SAFE_OUTDOOR_OPTIONS = ['yard', 'balconyPatio', 'catio'];

// Kinds of house field: free text, a number, yes/no/unknown, one option, or several options.
export const TEXT = 'text';
export const NUMBER = 'number';
export const TRI = 'tri';
export const SELECT = 'select';
export const MULTI = 'multi';

// The lowest down payment v1 models, as a percent; below it the loan would need mortgage insurance.
export const MIN_DOWN_PAYMENT_PERCENT = 20;

const COOLING_TYPES_WITH_EQUIPMENT = [COOLING_CENTRAL, COOLING_MINI_SPLIT, COOLING_EVAPORATIVE, COOLING_WINDOW];
const WHEN_GARAGE = { field: 'parking', includesAny: GARAGE_OPTIONS };
// An attached garage is itself a covered route from car to house, so the question only applies without one.
const WHEN_NO_ATTACHED_GARAGE = { field: 'parking', excludes: PARKING_ATTACHED_GARAGE };
const WHEN_HOA = { field: 'hoa', equals: 'yes' };

// Every stored property field except identity, price history, status, and projects.
// A `when` rule names the answer another field must have for this field to apply.
// Multi-selects: null = untouched (unknown), [] = answered None, otherwise the selections.
export const HOUSE_FIELDS = {
  // Property basics
  address: { kind: TEXT },
  imageUrl: { kind: TEXT },
  bedrooms: { kind: NUMBER },
  bathrooms: { kind: NUMBER },
  squareFeet: { kind: NUMBER },
  lotAcres: { kind: NUMBER },
  yearBuilt: { kind: NUMBER },
  propertyType: { kind: SELECT, options: ['detached', 'townhouse', 'condo'] },
  cornerLot: { kind: TRI },
  // Delight features: not scored criteria; each Yes adds to the Overall Fit delight bonus.
  fireplace: { kind: TRI },
  bayWindow: { kind: TRI },

  // Location & travel
  // Decimal degrees, entered by hand; only the Houses map uses them.
  latitude: { kind: NUMBER, min: -90, max: 90 },
  longitude: { kind: NUMBER, min: -180, max: 180 },
  // Travel times, in minutes
  trainMinutes: { kind: NUMBER },
  groceryMinutes: { kind: NUMBER },
  freewayMinutes: { kind: NUMBER },
  parentsMinutes: { kind: NUMBER },
  airportMinutes: { kind: NUMBER },

  // Parking & arrival
  parking: { kind: MULTI, options: PARKING_OPTIONS },
  garageStalls: { kind: NUMBER, when: WHEN_GARAGE },
  garagePower: { kind: TRI, when: WHEN_GARAGE },
  garageWorkspace: { kind: TRI, when: WHEN_GARAGE },
  coveredRoute: { kind: TRI, when: WHEN_NO_ATTACHED_GARAGE },
  exteriorSteps: { kind: NUMBER },
  entryShoes: { kind: TRI },
  entryCoat: { kind: TRI },
  entryPurse: { kind: TRI },

  // Living room
  megacouchFits: { kind: TRI },
  tvAreaIsThoroughfare: { kind: TRI },
  tvBackToFrontDoor: { kind: TRI },
  tvBackToWindows: { kind: TRI },
  christmasTreeSpot: { kind: TRI },

  // Kitchen
  sinkStoveWorks: { kind: TRI },
  counterBesideSink: { kind: TRI },
  counterBesideStove: { kind: TRI },
  dishwasherBesideSink: { kind: TRI },
  foodStorage: { kind: MULTI, options: FOOD_STORAGE_OPTIONS },

  // Primary bedroom
  bedroomFloor: { kind: SELECT, options: ['upper', 'main', 'lower'] },
  bedroomWindowExposure: { kind: MULTI, options: WINDOW_EXPOSURE_OPTIONS },
  closetType: { kind: SELECT, options: ['reachIn', 'walkIn'] },

  // Primary bathroom & getting ready
  privatePrimaryBath: { kind: TRI },
  tubAvailability: { kind: SELECT, options: ['primary', 'elsewhere', 'none'] },
  skincareOnCounter: { kind: TRI },
  outletAtVanity: { kind: TRI },
  bathroomStorage: { kind: MULTI, options: BATHROOM_STORAGE_OPTIONS },

  // Guest bathroom usability
  guestFullBath: { kind: TRI },

  // Household storage
  storageVacuum: { kind: TRI },
  storageCleaning: { kind: TRI },
  storageTools: { kind: TRI },
  storageSeasonal: { kind: TRI },
  storageBulk: { kind: TRI },

  // Laundry
  laundrySameFloor: { kind: TRI },
  laundrySupplyStorage: { kind: TRI },
  laundryUsableSpace: { kind: TRI },

  // Eating
  diningTableSpace: { kind: TRI },
  counterSeating: { kind: TRI },

  // Salem
  litterBoxSpot: { kind: TRI },
  catTreeSpot: { kind: TRI },
  safeOutdoor: { kind: MULTI, options: SAFE_OUTDOOR_OPTIONS },
  fullyFenced: { kind: TRI },

  // Exterior & upkeep
  parkStrip: { kind: TRI },
  irrigation: { kind: SELECT, options: [YES, NO, NA] },
  sidewalkToShovel: { kind: TRI },
  matureTrees: { kind: TRI },

  // Cooling
  coolingType: { kind: SELECT, options: COOLING_TYPES },
  coolingYear: { kind: NUMBER, when: { field: 'coolingType', oneOf: COOLING_TYPES_WITH_EQUIPMENT } },

  // Major systems
  roofYear: { kind: NUMBER },
  roofStatus: { kind: SELECT, options: ['good', 'mediumTerm', 'soon', 'failed'] },
  furnaceYear: { kind: NUMBER },
  furnaceStatus: { kind: SELECT, options: ['good', 'older', 'soon', 'failed'] },
  waterHeaterYear: { kind: NUMBER },
  waterHeaterStatus: { kind: SELECT, options: ['good', 'older', 'soon', 'failed'] },
  electrical: { kind: SELECT, options: ['modern', 'older', 'significantIssue'] },
  plumbing: { kind: SELECT, options: ['modern', 'older', 'materialConcern', 'failure'] },
  sewer: { kind: SELECT, options: ['clear', 'minorIssue', 'significantIssue'] },
  foundation: { kind: SELECT, options: ['clear', 'minorIssue', 'significantIssue'] },
  waterIntrusion: { kind: SELECT, options: ['none', 'remediated', 'unresolved'] },

  // HOA and solar
  hoa: { kind: TRI },
  hoaDues: { kind: NUMBER, when: WHEN_HOA },
  hoaNotes: { kind: TEXT, when: WHEN_HOA },
  solarStatus: { kind: SELECT, options: ['owned', 'financed', 'none'] },
  solarPayment: { kind: NUMBER, when: { field: 'solarStatus', equals: 'financed' } },

  // Financial inputs. Override fields are null while the property inherits from Settings.
  downPaymentPercent: { kind: NUMBER, min: MIN_DOWN_PAYMENT_PERCENT, max: 100 },
  annualPropertyTax: { kind: NUMBER },
  annualInsurance: { kind: NUMBER },
  sellerCredits: { kind: NUMBER, initial: 0 },
  lenderCredits: { kind: NUMBER, initial: 0 },
  pointsPercent: { kind: NUMBER, max: 100 },
  fixedLenderFee: { kind: NUMBER },
  titleInsurance: { kind: NUMBER },
  prepaidInterestDays: { kind: NUMBER },

  // Tour reaction
  likeBeingHere: { kind: TRI },
  liveAsIsThreeYears: { kind: TRI },
  sadIfSold: { kind: TRI },
  wantToGoBack: { kind: TRI },
};

// Percentages are stored as percent numbers: 6.5 means 6.5%.
// A null initial value means "blank until configured" and may stay null.
export const SETTINGS_FIELDS = {
  interestRate: { initial: null, max: 100 },
  loanTermYears: { initial: 30, min: 1 },
  downPaymentPercent: { initial: 20, min: MIN_DOWN_PAYMENT_PERCENT, max: 100 },
  plannedRecastPrincipal: { initial: 0 },
  pointsPercent: { initial: null, max: 100 },
  fixedLenderFee: { initial: 1075 },
  titleInsurance: { initial: 1300 },
  prepaidInterestDays: { initial: 12 },
  appraisalFee: { initial: 600 },
  creditReportFee: { initial: 140 },
  floodCertificateFee: { initial: 6 },
  mersFee: { initial: 25 },
  processingFee: { initial: 1395 },
  taxMonitoringFee: { initial: 86 },
  escrowClosingFee: { initial: 450 },
  recordingFee: { initial: 90 },
  otherGovernmentFees: { initial: 0 },
  fallbackAnnualInsurance: { initial: 1080 },
  fallbackPropertyTaxRate: { initial: 0.55, max: 100 },
  prepaidInsuranceMonths: { initial: 12 },
  insuranceReserveMonths: { initial: 3 },
  propertyTaxReserveMonths: { initial: 3 },
  comfortableMonthlyCost: { initial: null },
  maximumMonthlyCost: { initial: null },
  comfortableCashToClose: { initial: null },
  maximumCashToClose: { initial: null },
  maximumPurchasePrice: { initial: null },
};

/**
 * Upgrades a version 1 document: drops the cash-to-acquire targets instead of reusing them.
 * @param {object} envelope - Stored document at schema version 1.
 * @returns {object} The document without the retired targets.
 */
function retireCashToAcquireTargets(envelope) {
  const settings = isObject(envelope.settings) ? { ...envelope.settings } : {};
  // Those targets covered closing plus required work; the cash-to-close targets mean less, so they start blank.
  delete settings.comfortableCashToAcquire;
  delete settings.maximumCashToAcquire;
  return { ...envelope, settings };
}

/**
 * Upgrades a version 2 document: the single Garage parking option becomes Detached garage.
 * @param {object} envelope - Stored document at schema version 2.
 * @returns {object} The document with garage selections renamed and every other selection kept.
 */
function splitGarageOption(envelope) {
  if (!Array.isArray(envelope.houses)) return envelope;
  const houses = [];
  for (const house of envelope.houses) {
    if (!isObject(house) || !Array.isArray(house.parking) || !house.parking.includes('garage')) {
      houses.push(house);
      continue;
    }
    // The type was never recorded; detached is the conservative reading and earns no delight bonus.
    const parking = [];
    for (const option of house.parking) parking.push(option === 'garage' ? PARKING_DETACHED_GARAGE : option);
    houses.push({ ...house, parking });
  }
  return { ...envelope, houses };
}

/**
 * Upgrades a version 3 document: the Projects reviewed flag is retired, and what it meant is kept in the areas.
 * @param {object} envelope - Stored document at schema version 3.
 * @returns {object} The document with untouched areas of reviewed houses set to No change, and no reviewed flags.
 */
function retireProjectsReviewed(envelope) {
  if (!Array.isArray(envelope.houses)) return envelope;
  const houses = [];
  for (const house of envelope.houses) {
    if (!isObject(house)) {
      houses.push(house);
      continue;
    }
    const { projectsReviewed, ...rest } = house;
    // Ticking Reviewed said every untouched area had no work, so those areas become No change.
    if (projectsReviewed === true) {
      const source = isObject(house.projects) ? house.projects : {};
      const projects = { ...source };
      for (const area of PROJECT_AREAS) {
        const project = isObject(source[area]) ? source[area] : {};
        if (!PROJECT_STATES.includes(project.state)) projects[area] = { ...project, state: PROJECT_NO_CHANGE };
      }
      rest.projects = projects;
    }
    houses.push(rest);
  }
  return { ...envelope, houses };
}

// Upgrade steps keyed by the version they upgrade from.
export const MIGRATIONS = { 1: retireCashToAcquireTargets, 2: splitGarageOption, 3: retireProjectsReviewed };

/* --------------------------------------------------------------------------
   Small validators
   -------------------------------------------------------------------------- */

/**
 * Checks whether a value is a plain object.
 * @param {*} value - Value to test.
 * @returns {boolean} True for non-null, non-array objects.
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks whether a value is a real calendar date written as YYYY-MM-DD.
 * @param {*} value - Value to test.
 * @returns {boolean} True when the value is a valid date string.
 */
export function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Keeps a finite, non-negative number and turns anything else into unknown.
 * @param {*} value - Value to clean.
 * @returns {number|null} The number, or null when unknown or invalid.
 */
function cleanNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Checks whether a field's bounds let it hold a negative number, as longitude does.
 * @param {{ min?: number }} field - House or settings field definition.
 * @returns {boolean} True when the field's minimum is below zero.
 */
function allowsNegative(field) {
  return field.min !== undefined && field.min < 0;
}

/**
 * Checks a number against a field's optional bounds.
 * @param {number} value - Number to check.
 * @param {{ min?: number, max?: number }} field - House or settings field definition.
 * @returns {boolean} True when the number is within both bounds that are set.
 */
function inRange(value, field) {
  return (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
}

/**
 * Keeps a yes/no answer and turns anything else, including booleans, into unknown.
 * @param {*} value - Value to clean.
 * @returns {string|null} YES, NO, or null when unknown.
 */
function cleanTri(value) {
  return value === YES || value === NO ? value : null;
}

/**
 * Keeps a value that is one of the allowed options.
 * @param {*} value - Value to clean.
 * @param {string[]} options - Allowed option values.
 * @returns {string|null} The option, or null when unknown or invalid.
 */
function cleanSelect(value, options) {
  return options.includes(value) ? value : null;
}

/**
 * Cleans a multi-select, preserving the untouched (null) and answered-None ([]) states.
 * @param {*} value - Value to clean.
 * @param {string[]} options - Allowed option values.
 * @returns {string[]|null} Selected options in canonical order, or null when untouched.
 */
function cleanMulti(value, options) {
  if (!Array.isArray(value)) return null;
  const selected = [];
  for (const option of options) {
    if (value.includes(option)) selected.push(option);
  }
  return selected;
}

/**
 * Cleans one house field according to its definition.
 * @param {*} value - Raw stored value.
 * @param {{ kind: string, options?: string[], initial?: number, min?: number, max?: number }} field - Field definition from HOUSE_FIELDS.
 * @returns {*} The cleaned value for that field kind.
 */
function cleanField(value, field) {
  switch (field.kind) {
    case TEXT:
      return typeof value === 'string' ? value : '';
    case NUMBER: {
      // Fields with a defined default, such as credits at $0, are never unknown.
      let number = cleanNumber(value);
      if (allowsNegative(field) && typeof value === 'number' && Number.isFinite(value)) number = value;
      if (number !== null && !inRange(number, field)) number = null;
      return number === null && field.initial !== undefined ? field.initial : number;
    }
    case TRI:
      return cleanTri(value);
    case SELECT:
      return cleanSelect(value, field.options);
    case MULTI:
      return cleanMulti(value, field.options);
    default:
      return null;
  }
}

/* --------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------- */

/**
 * Builds the initial app-level settings.
 * @returns {Object<string, number|null>} Settings with seeded values and blanks as null.
 */
export function defaultSettings() {
  const settings = {};
  for (const [name, field] of Object.entries(SETTINGS_FIELDS)) {
    settings[name] = field.initial;
  }
  return settings;
}

/**
 * Cleans stored settings, falling back to the initial value for anything invalid.
 * @param {*} raw - Settings object as stored or imported.
 * @returns {Object<string, number|null>} Complete, valid settings.
 */
export function normalizeSettings(raw) {
  const source = isObject(raw) ? raw : {};
  const settings = {};
  for (const [name, field] of Object.entries(SETTINGS_FIELDS)) {
    const value = cleanNumber(source[name]);
    if (value === null || !inRange(value, field)) {
      settings[name] = source[name] === null && field.initial === null ? null : field.initial;
    } else {
      settings[name] = value;
    }
  }
  return settings;
}

// Each pair is [comfortable, maximum]; maximum must exceed comfortable when both are set.
export const TARGET_PAIRS = [
  ['comfortableMonthlyCost', 'maximumMonthlyCost'],
  ['comfortableCashToClose', 'maximumCashToClose'],
];

/**
 * Reads a number typed into a form field, tolerating $, %, commas, and spaces.
 * @param {string} text - Text as typed.
 * @returns {{ valid: boolean, value: number|null }} The number, null for blank, or valid false when unreadable.
 */
export function parseNumberInput(text) {
  const cleaned = String(text).replace(/[$,%\s]/g, '');
  if (cleaned === '') return { valid: true, value: null };
  // A minus sign is read so a negative number can be told apart from text that is not a number.
  if (!/^-?(\d*\.?\d+|\d+\.)$/.test(cleaned)) return { valid: false, value: null };
  return { valid: true, value: Number(cleaned) };
}

/**
 * Words what is wrong with an entered amount that should be a number of zero or more.
 * @param {*} value - Entered value; NaN marks text that was not a number.
 * @returns {string|null} The message, or null when the value is a usable number.
 */
function numberError(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
  if (value < 0) return 'Must be 0 or more.';
  return null;
}

/**
 * Words what is wrong with an entered number for a field that may have bounds.
 * @param {*} value - Entered value; NaN marks text that was not a number.
 * @param {{ min?: number, max?: number }} field - House or settings field definition.
 * @returns {string|null} The message, or null when the value is a usable number within the bounds.
 */
function fieldError(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
  if (!allowsNegative(field) && value < 0) return numberError(value);
  if (field.min !== undefined && value < field.min) return `Must be at least ${field.min}.`;
  if (field.max !== undefined && value > field.max) return `Must be ${field.max} or less.`;
  return null;
}

/**
 * Checks edited settings before they are saved.
 * @param {Object<string, number|null>} candidate - Edited values; NaN marks text that was not a number.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message per invalid field.
 */
export function validateSettings(candidate) {
  const errors = {};
  for (const [name, field] of Object.entries(SETTINGS_FIELDS)) {
    const value = candidate[name];
    if (value === null || value === undefined) {
      // Only settings that start blank may stay blank.
      if (field.initial !== null) errors[name] = 'Enter a value.';
    } else if (fieldError(value, field) !== null) {
      errors[name] = fieldError(value, field);
    }
  }
  for (const [comfortableName, maximumName] of TARGET_PAIRS) {
    const comfortable = candidate[comfortableName];
    const maximum = candidate[maximumName];
    const bothValid = errors[comfortableName] === undefined && errors[maximumName] === undefined;
    if (bothValid && comfortable !== null && maximum !== null && maximum <= comfortable) {
      errors[maximumName] = 'Maximum must be greater than Comfortable.';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/* --------------------------------------------------------------------------
   Houses
   -------------------------------------------------------------------------- */

// A house's id is its MLS number, which is also how UtahRealEstate.com addresses its listing.
const LISTING_URL_BASE = 'https://www.utahrealestate.com/';

/**
 * Generates an identifier for a price-history entry or a map place.
 * @returns {string} A locally unique id.
 */
export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Checks whether a value is an MLS number: digits only, kept as text so leading zeros and length survive.
 * @param {*} value - Value to test.
 * @returns {boolean} True for a non-empty string of digits.
 */
export function isMlsNumber(value) {
  return typeof value === 'string' && /^\d+$/.test(value);
}

/**
 * Builds the address of a house's listing on UtahRealEstate.com from its MLS number.
 * @param {object} house - House to link to.
 * @returns {string|null} The listing URL, or null while the house has no MLS number.
 */
export function listingUrl(house) {
  // Houses added before MLS numbers keep a generated id until one is entered, and that id names no listing.
  return isMlsNumber(house.id) ? `${LISTING_URL_BASE}${house.id}` : null;
}

/**
 * Words what is wrong with an entered MLS number.
 * @param {object[]} houses - Stored houses, which must not already use the number.
 * @param {string} value - MLS number as typed.
 * @param {string|null} [currentId] - Id of the house being edited, which may keep its own number.
 * @returns {string|null} The message, or null when the number can be used.
 */
export function mlsNumberError(houses, value, currentId = null) {
  const number = typeof value === 'string' ? value.trim() : '';
  if (number === '') return 'Enter the MLS number.';
  if (!isMlsNumber(number)) return 'Use digits only.';
  for (const house of houses) {
    if (house.id === number && house.id !== currentId) return 'Another house already has this MLS number.';
  }
  return null;
}

/**
 * Builds an empty project record for one area.
 * @returns {{ state: null, note: string, cost: null, excited: null }} Project with every answer unknown.
 */
function emptyProject() {
  return { state: null, note: '', cost: null, excited: null };
}

/**
 * Creates a house from the initial creation form.
 * @param {{ mlsNumber: string, address: string, listingPrice: number, listingDate: string, imageUrl?: string }} input - Creation values.
 * @param {function(): string} [makeId] - Id generator for the initial price entry; defaults to createId.
 * @returns {object} A new house, identified by its MLS number, with every other observation unknown.
 */
export function createHouse(input, makeId = createId) {
  const house = {
    id: input.mlsNumber.trim(),
    listingDate: input.listingDate,
    priceHistory: [{ id: makeId(), price: input.listingPrice, date: input.listingDate }],
    status: STATUS_AVAILABLE,
    statusDate: null,
    projects: {},
  };
  for (const [name, field] of Object.entries(HOUSE_FIELDS)) {
    house[name] = cleanField(field.initial, field);
  }
  for (const area of PROJECT_AREAS) {
    house.projects[area] = emptyProject();
  }
  house.address = input.address.trim();
  house.imageUrl = (input.imageUrl || '').trim();
  return house;
}

/**
 * Cleans a listing-price history, dropping invalid entries and ordering by date.
 * @param {*} raw - Price history as stored or imported.
 * @returns {Array<{ id: string, price: number, date: string }>} Valid entries, oldest first.
 */
function normalizePriceHistory(raw) {
  const entries = [];
  if (!Array.isArray(raw)) return entries;
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (!isObject(entry) || cleanNumber(entry.price) === null || !isDateString(entry.date)) continue;
    const id = typeof entry.id === 'string' && entry.id !== '' ? entry.id : `price-${index}`;
    entries.push({ id, price: entry.price, date: entry.date });
  }
  // Array.prototype.sort is stable, so same-day entries keep their entered order.
  entries.sort(compareByDate);
  return entries;
}

/**
 * Orders two dated records by calendar date.
 * @param {{ date: string }} a - First record.
 * @param {{ date: string }} b - Second record.
 * @returns {number} Negative, zero, or positive as a is before, same as, or after b.
 */
function compareByDate(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return 0;
}

/**
 * Cleans the per-area project records, keeping every area present.
 * @param {*} raw - Projects object as stored or imported.
 * @returns {Object<string, { state: string|null, note: string, cost: number|null, excited: string|null }>} Projects by area.
 */
function normalizeProjects(raw) {
  const source = isObject(raw) ? raw : {};
  const projects = {};
  for (const area of PROJECT_AREAS) {
    const project = isObject(source[area]) ? source[area] : {};
    projects[area] = {
      state: cleanSelect(project.state, PROJECT_STATES),
      note: typeof project.note === 'string' ? project.note : '',
      cost: cleanNumber(project.cost),
      excited: cleanTri(project.excited),
    };
  }
  return projects;
}

/**
 * Checks whether a raw record has what a house needs to exist.
 * @param {*} raw - House as stored or imported.
 * @returns {boolean} True when it has an id, an address, and at least one valid listing price.
 */
export function isUsableHouse(raw) {
  return (
    isObject(raw) &&
    typeof raw.id === 'string' &&
    raw.id !== '' &&
    typeof raw.address === 'string' &&
    raw.address.trim() !== '' &&
    normalizePriceHistory(raw.priceHistory).length > 0
  );
}

/**
 * Cleans a house and enforces its invariants; safe to run repeatedly.
 * @param {object} raw - A usable house as stored, imported, or edited.
 * @returns {object} A complete, valid house.
 */
export function normalizeHouse(raw) {
  const priceHistory = normalizePriceHistory(raw.priceHistory);
  const status = cleanSelect(raw.status, STATUSES) || STATUS_AVAILABLE;
  const house = {
    id: raw.id,
    listingDate: isDateString(raw.listingDate) ? raw.listingDate : priceHistory[0].date,
    priceHistory,
    status,
    // Status Date only applies once a house has left Available.
    statusDate: status !== STATUS_AVAILABLE && isDateString(raw.statusDate) ? raw.statusDate : null,
    projects: normalizeProjects(raw.projects),
  };
  for (const [name, field] of Object.entries(HOUSE_FIELDS)) {
    const value = raw[name] === undefined ? field.initial : raw[name];
    house[name] = cleanField(value, field);
  }
  house.address = house.address.trim();
  house.imageUrl = house.imageUrl.trim();
  return house;
}

/* --------------------------------------------------------------------------
   Editing a house
   -------------------------------------------------------------------------- */

/**
 * Checks whether a selection contains at least one of several options.
 * @param {string[]} selection - Chosen options.
 * @param {string[]} options - Options to look for.
 * @returns {boolean} True when any of the options is chosen.
 */
export function includesAny(selection, options) {
  for (const option of options) {
    if (selection.includes(option)) return true;
  }
  return false;
}

/**
 * Checks whether a field applies to a house, given the answers it depends on.
 * @param {object} house - House or draft being edited.
 * @param {string} name - Field name from HOUSE_FIELDS.
 * @returns {boolean} True when the field has no condition or its condition is met.
 */
export function isFieldApplicable(house, name) {
  const when = HOUSE_FIELDS[name].when;
  if (when === undefined) return true;
  const answer = house[when.field];
  if (when.includesAny !== undefined) return Array.isArray(answer) && includesAny(answer, when.includesAny);
  // Untouched counts as not including it, so the field is asked until the answer rules it out.
  if (when.excludes !== undefined) return !Array.isArray(answer) || !answer.includes(when.excludes);
  if (when.oneOf !== undefined) return when.oneOf.includes(answer);
  return answer === when.equals;
}

/**
 * Checks whether a field holds real information, as opposed to being blank or unknown.
 * @param {object} house - House or draft being edited.
 * @param {string} name - Field name from HOUSE_FIELDS.
 * @returns {boolean} True when the field has a usable value.
 */
export function isFieldKnown(house, name) {
  const value = house[name];
  if (HOUSE_FIELDS[name].kind === TEXT) return typeof value === 'string' && value.trim() !== '';
  if (HOUSE_FIELDS[name].kind === NUMBER) return typeof value === 'number' && Number.isFinite(value);
  return value !== null && value !== undefined;
}

/**
 * Counts how many of a form section's applicable fields are known.
 * @param {object} house - House or draft being edited.
 * @param {string[]} names - Field names that count toward the section's progress.
 * @returns {{ known: number, total: number }} Known and applicable field counts.
 */
export function sectionProgress(house, names) {
  let known = 0;
  let total = 0;
  for (const name of names) {
    if (!isFieldApplicable(house, name)) continue;
    total += 1;
    if (isFieldKnown(house, name)) known += 1;
  }
  return { known, total };
}

/**
 * Counts how many of the Projects section's applicable answers are known, like any other section.
 * @param {object} house - House or draft being edited.
 * @returns {{ known: number, total: number }} Known and applicable counts: every area's state, plus cost for work and excitement for optional work.
 */
export function projectsProgress(house) {
  let known = 0;
  let total = 0;
  for (const area of PROJECT_AREAS) {
    const project = house.projects[area];
    const parts = [project.state];
    if (project.state === PROJECT_WANT || project.state === PROJECT_NEED) parts.push(project.cost);
    if (project.state === PROJECT_WANT) parts.push(project.excited);
    for (const part of parts) {
      total += 1;
      if (part !== null) known += 1;
    }
  }
  return { known, total };
}

/**
 * Checks whether every project area has been answered, so the house's projects are fully known.
 * @param {object} house - House with projects.
 * @returns {boolean} True when no area is left untouched.
 */
export function projectsAnswered(house) {
  for (const area of PROJECT_AREAS) {
    if (house.projects[area].state === null) return false;
  }
  return true;
}

/**
 * Toggles one option of a multi-select, returning to untouched when nothing is left selected.
 * @param {string[]|null} selection - Current value; null when untouched, [] when answered None.
 * @param {string} option - Option being switched on or off.
 * @returns {string[]|null} The new selection, or null when it is untouched again.
 */
export function toggleOption(selection, option) {
  const current = selection === null ? [] : selection;
  const next = [];
  for (const existing of current) {
    if (existing !== option) next.push(existing);
  }
  if (!current.includes(option)) next.push(option);
  return next.length === 0 ? null : next;
}

/**
 * Toggles the None answer of a multi-select.
 * @param {string[]|null} selection - Current value; null when untouched, [] when answered None.
 * @returns {string[]|null} [] to answer None, or null when None was already the answer.
 */
export function toggleNone(selection) {
  return Array.isArray(selection) && selection.length === 0 ? null : [];
}

/**
 * Checks the Add House form before a house is created.
 * @param {{ mlsNumber: string, address: string, listingPrice: number|null, listingDate: string }} input - Values; NaN price means unreadable text.
 * @param {object[]} houses - Stored houses, whose MLS numbers the new house must not repeat.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to create, and a message per invalid field.
 */
export function validateNewHouse(input, houses) {
  const errors = {};
  if (typeof input.address !== 'string' || input.address.trim() === '') errors.address = 'Enter an address.';
  if (mlsNumberError(houses, input.mlsNumber) !== null) errors.mlsNumber = mlsNumberError(houses, input.mlsNumber);
  if (input.listingPrice === null) errors.listingPrice = 'Enter the listing price.';
  else if (numberError(input.listingPrice) !== null) errors.listingPrice = numberError(input.listingPrice);
  if (!isDateString(input.listingDate)) errors.listingDate = 'Enter the listing date.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Checks an edited house before it is saved; missing information never blocks a save.
 * @param {object} draft - Edited house; NaN in a number field marks text that was not a number.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message per invalid field.
 */
export function validateHouse(draft) {
  const errors = {};
  if (typeof draft.address !== 'string' || draft.address.trim() === '') errors.address = 'Enter an address.';
  for (const [name, field] of Object.entries(HOUSE_FIELDS)) {
    // The form hides a field that does not apply, so its value can never block a save.
    if (field.kind !== NUMBER || !isFieldApplicable(draft, name)) continue;
    const value = draft[name];
    if (value === null || value === undefined) continue;
    if (fieldError(value, field) !== null) errors[name] = fieldError(value, field);
  }
  for (const area of PROJECT_AREAS) {
    const { state, cost } = draft.projects[area];
    // Only work has a cost; the form hides it for any other state.
    if (state !== PROJECT_WANT && state !== PROJECT_NEED) continue;
    if (cost === null || cost === undefined) continue;
    if (numberError(cost) !== null) errors[projectFieldName(area, 'cost')] = numberError(cost);
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Names the form control for one part of a project, such as its cost.
 * @param {string} area - Project area key such as "hvac".
 * @param {string} part - "state", "note", "cost", or "excited".
 * @returns {string} Control name such as "project-hvac-cost".
 */
export function projectFieldName(area, part) {
  return `project-${area}-${part}`;
}

/**
 * Reads which project and part a form control belongs to, the reverse of projectFieldName.
 * @param {string} name - Control name such as "project-hvac-cost".
 * @returns {{ area: string, part: string }|null} The area and part, or null when it is not a project control.
 */
export function parseProjectFieldName(name) {
  const match = /^project-(\w+)-(state|note|cost|excited)$/.exec(name);
  return match === null ? null : { area: match[1], part: match[2] };
}

/**
 * Changes one project's values.
 * @param {object} house - House or draft being edited; not modified.
 * @param {string} area - Project area key.
 * @param {{ state?: string|null, note?: string, cost?: number|null, excited?: string|null }} changes - Values to set.
 * @returns {object} A copy of the house with the project updated.
 */
export function setProject(house, area, changes) {
  const next = { ...house.projects[area], ...changes };
  return { ...house, projects: { ...house.projects, [area]: next } };
}

/**
 * Finds a house by id.
 * @param {{ houses: object[] }} data - Current app data.
 * @param {string} id - House id: its MLS number, or a generated id until one is entered.
 * @returns {object|null} The house, or null when there is none with that id.
 */
export function findHouse(data, id) {
  for (const house of data.houses) {
    if (house.id === id) return house;
  }
  return null;
}

/**
 * Adds a house, or replaces the stored house with the same id, in place.
 * @param {{ settings: object, houses: object[], pois: object[] }} data - Current app data.
 * @param {object} house - House to store.
 * @param {string} [previousId] - Id the house was stored under, when its MLS number is being entered or corrected.
 * @returns {{ settings: object, houses: object[], pois: object[] }} New app data containing the house.
 */
export function saveHouse(data, house, previousId = house.id) {
  const houses = [];
  let replaced = false;
  for (const existing of data.houses) {
    if (existing.id === previousId) {
      houses.push(house);
      replaced = true;
    } else {
      houses.push(existing);
    }
  }
  if (!replaced) houses.push(house);
  return { ...data, houses };
}

/**
 * Removes a house permanently.
 * @param {{ settings: object, houses: object[], pois: object[] }} data - Current app data.
 * @param {string} id - Id of the house to remove.
 * @returns {{ settings: object, houses: object[], pois: object[] }} New app data without that house.
 */
export function deleteHouse(data, id) {
  const houses = [];
  for (const existing of data.houses) {
    if (existing.id !== id) houses.push(existing);
  }
  return { ...data, houses };
}

/* --------------------------------------------------------------------------
   Map places (points of interest)
   -------------------------------------------------------------------------- */

/**
 * Checks a place before it is added or changed; it needs a title and both coordinates.
 * @param {{ title: string, latitude: number|null, longitude: number|null }} input - Entered values; NaN marks text that was not a number.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message per invalid field.
 */
export function validatePoi(input) {
  const errors = {};
  if (typeof input.title !== 'string' || input.title.trim() === '') errors.title = 'Enter a title.';
  for (const name of ['latitude', 'longitude']) {
    const value = input[name];
    // Coordinates follow the same rules as a house's.
    if (value === null || value === undefined) errors[name] = 'Enter a value.';
    else if (fieldError(value, HOUSE_FIELDS[name]) !== null) errors[name] = fieldError(value, HOUSE_FIELDS[name]);
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Builds a stored place from valid entered values, keeping its id when it already has one.
 * @param {{ id?: string, title: string, latitude: number, longitude: number }} input - Values that passed validatePoi.
 * @param {function(): string} [makeId] - Id generator for a new place.
 * @returns {{ id: string, title: string, latitude: number, longitude: number }} The place.
 */
export function createPoi(input, makeId = createId) {
  return { id: input.id || makeId(), title: input.title.trim(), latitude: input.latitude, longitude: input.longitude };
}

/**
 * Cleans stored places, quietly dropping any that cannot be used rather than rejecting the data.
 * @param {*} raw - Places as stored or imported; absent in data saved before places existed.
 * @returns {Array<{ id: string, title: string, latitude: number, longitude: number }>} Valid places with unique ids.
 */
export function normalizePois(raw) {
  if (!Array.isArray(raw)) return [];
  const pois = [];
  const ids = new Set();
  for (const entry of raw) {
    if (!isObject(entry) || typeof entry.id !== 'string' || entry.id === '' || ids.has(entry.id)) continue;
    if (!validatePoi(entry).ok) continue;
    ids.add(entry.id);
    pois.push(createPoi(entry));
  }
  return pois;
}

/* --------------------------------------------------------------------------
   Listing price history, Listing Date, and status
   -------------------------------------------------------------------------- */

/**
 * Checks a price-history entry before it is added or changed.
 * @param {object} house - House the entry belongs to.
 * @param {{ price: number|null, date: string }} input - Entry values; NaN price means unreadable text.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message per invalid field.
 */
export function validatePriceEntry(house, input) {
  const errors = {};
  if (input.price === null) errors.price = 'Enter the listing price.';
  else if (numberError(input.price) !== null) errors.price = numberError(input.price);
  if (!isDateString(input.date)) errors.date = 'Enter the date the price took effect.';
  else if (input.date < house.listingDate) errors.date = 'Must be on or after the listing date.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Adds a listing-price change; the current price follows if it is the latest by date.
 * @param {object} house - House to change; not modified.
 * @param {{ price: number, date: string }} input - New price and the date it took effect.
 * @param {function(): string} [makeId] - Id generator; defaults to createId.
 * @returns {object} A copy of the house with the entry added.
 */
export function addPriceEntry(house, input, makeId = createId) {
  const entry = { id: makeId(), price: input.price, date: input.date };
  return { ...house, priceHistory: normalizePriceHistory([...house.priceHistory, entry]) };
}

/**
 * Corrects one listing-price entry.
 * @param {object} house - House to change; not modified.
 * @param {string} id - Id of the entry to correct.
 * @param {{ price: number, date: string }} input - Corrected price and date.
 * @returns {object} A copy of the house with the entry replaced.
 */
export function updatePriceEntry(house, id, input) {
  const entries = [];
  for (const entry of house.priceHistory) {
    entries.push(entry.id === id ? { id, price: input.price, date: input.date } : entry);
  }
  return { ...house, priceHistory: normalizePriceHistory(entries) };
}

/**
 * Checks whether a price entry may be deleted: one entry must always remain.
 * @param {object} house - House the entry belongs to.
 * @returns {boolean} True when the house has more than one entry.
 */
export function canDeletePriceEntry(house) {
  return house.priceHistory.length > 1;
}

/**
 * Deletes one listing-price entry, unless it is the only one left.
 * @param {object} house - House to change; not modified.
 * @param {string} id - Id of the entry to delete.
 * @returns {object} A copy of the house without the entry, or the house unchanged when it is the last.
 */
export function deletePriceEntry(house, id) {
  if (!canDeletePriceEntry(house)) return house;
  const entries = [];
  for (const entry of house.priceHistory) {
    if (entry.id !== id) entries.push(entry);
  }
  return { ...house, priceHistory: entries };
}

/**
 * Finds the entry that records the initial listing price: the earliest, if dated on the Listing Date.
 * @param {object} house - House to look in.
 * @returns {object|null} The initial entry, or null when no entry sits on the Listing Date.
 */
function initialPriceEntry(house) {
  const earliest = house.priceHistory[0];
  return earliest !== undefined && earliest.date === house.listingDate ? earliest : null;
}

/**
 * Checks a new Listing Date against the status date and the later price changes.
 * @param {object} house - House whose Listing Date is changing.
 * @param {string} date - Proposed Listing Date as YYYY-MM-DD.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message for "listingDate".
 */
export function validateListingDate(house, date) {
  const errors = {};
  const initial = initialPriceEntry(house);
  let firstChange = null;
  for (const entry of house.priceHistory) {
    if (entry !== initial && (firstChange === null || entry.date < firstChange)) firstChange = entry.date;
  }
  if (!isDateString(date)) errors.listingDate = 'Enter the listing date.';
  else if (house.statusDate !== null && date > house.statusDate) errors.listingDate = 'Must be on or before the status date.';
  else if (firstChange !== null && date > firstChange) errors.listingDate = 'Must be on or before the first price change.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Changes the Listing Date, moving the initial price entry with it.
 * @param {object} house - House to change; not modified.
 * @param {string} date - New Listing Date as YYYY-MM-DD.
 * @returns {object} A copy of the house with the new Listing Date.
 */
export function setListingDate(house, date) {
  const initial = initialPriceEntry(house);
  const entries = [];
  for (const entry of house.priceHistory) {
    entries.push(entry === initial ? { ...entry, date } : entry);
  }
  return { ...house, listingDate: date, priceHistory: normalizePriceHistory(entries) };
}

/**
 * Suggests the Status Date for a status: today on a change, the saved date when unchanged.
 * @param {object} house - House whose status is being set.
 * @param {string} status - Status being chosen.
 * @param {string} today - Today's date as YYYY-MM-DD.
 * @returns {string|null} Suggested date, or null for Available, which has none.
 */
export function defaultStatusDate(house, status, today) {
  if (status === STATUS_AVAILABLE) return null;
  if (status === house.status && house.statusDate !== null) return house.statusDate;
  return today;
}

/**
 * Checks a status change and its Status Date.
 * @param {object} house - House whose status is changing.
 * @param {string} status - New status.
 * @param {string|null} statusDate - Date it left Available; ignored for Available.
 * @returns {{ ok: boolean, errors: Object<string, string> }} Whether to save, and a message for "statusDate".
 */
export function validateStatus(house, status, statusDate) {
  const errors = {};
  if (!STATUSES.includes(status)) errors.status = 'Choose a status.';
  else if (status !== STATUS_AVAILABLE) {
    if (!isDateString(statusDate)) errors.statusDate = 'Enter the status date.';
    else if (statusDate < house.listingDate) errors.statusDate = 'Must be on or after the listing date.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Sets a house's status; Available clears the Status Date.
 * @param {object} house - House to change; not modified.
 * @param {string} status - New status.
 * @param {string|null} statusDate - Date it left Available; ignored for Available.
 * @returns {object} A copy of the house with the new status.
 */
export function setStatus(house, status, statusDate) {
  return { ...house, status, statusDate: status === STATUS_AVAILABLE ? null : statusDate };
}

/* --------------------------------------------------------------------------
   Stored document
   -------------------------------------------------------------------------- */

/**
 * Builds the document stored for a fresh install.
 * @returns {{ settings: object, houses: object[], pois: object[] }} Default settings, no houses, and no places.
 */
export function createEmptyData() {
  return { settings: defaultSettings(), houses: [], pois: [] };
}

/**
 * Upgrades a stored document one version at a time.
 * @param {object} envelope - Stored document with a schemaVersion.
 * @param {Object<number, function(object): object>} [migrations] - Upgrade steps keyed by source version.
 * @param {number} [targetVersion] - Version to upgrade to.
 * @returns {object|null} The upgraded document, or null when a needed step is missing.
 */
export function migrate(envelope, migrations = MIGRATIONS, targetVersion = SCHEMA_VERSION) {
  let current = envelope;
  while (current.schemaVersion < targetVersion) {
    const step = migrations[current.schemaVersion];
    if (typeof step !== 'function') return null;
    const next = step(current);
    current = { ...next, schemaVersion: current.schemaVersion + 1 };
  }
  return current;
}

/**
 * Turns app data into the text that is stored and exported.
 * @param {{ settings: object, houses: object[], pois: object[] }} data - Current app data.
 * @returns {string} JSON text including the app marker and schema version.
 */
export function serializeData(data) {
  const envelope = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    settings: data.settings,
    houses: data.houses,
    pois: data.pois,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Reads stored or imported text into valid app data.
 * @param {string} text - JSON text from storage or a backup file.
 * @returns {{ ok: boolean, data?: object, error?: string, message?: string }} Data, or an error code and message.
 */
export function parseData(text) {
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson', message: 'This is not a readable backup file.' };
  }
  if (!isObject(envelope) || envelope.app !== APP_ID || !Number.isInteger(envelope.schemaVersion)) {
    return { ok: false, error: 'notHouz', message: 'This file is not a Houz backup.' };
  }
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'newer', message: 'This backup was made by a newer version of Houz.' };
  }
  const upgraded = migrate(envelope);
  if (upgraded === null || !Array.isArray(upgraded.houses)) {
    return { ok: false, error: 'invalid', message: 'This backup is damaged and cannot be read.' };
  }
  const settings = normalizeSettings(upgraded.settings);
  const houses = [];
  for (const raw of upgraded.houses) {
    if (!isUsableHouse(raw)) {
      return {
        ok: false,
        error: 'invalid',
        message: 'This backup contains a house without an address or listing price.',
      };
    }
    // The id is how every view finds a house, so two houses can never share one.
    if (findHouse({ houses }, raw.id) !== null) {
      return { ok: false, error: 'invalid', message: 'This backup contains two houses with the same MLS number.' };
    }
    houses.push(normalizeHouse(raw));
  }
  return { ok: true, data: { settings, houses, pois: normalizePois(upgraded.pois) } };
}

/**
 * Names a backup file for a given day.
 * @param {string} today - Today's date as YYYY-MM-DD.
 * @returns {string} File name such as "houz-backup-2026-10-13.json".
 */
export function backupFileName(today) {
  return `houz-backup-${today}.json`;
}

/* --------------------------------------------------------------------------
   Storage
   -------------------------------------------------------------------------- */

/**
 * Loads app data, never throwing and never discarding text it could not read.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @returns {{ data: object, problem: string|null }} Data plus "unavailable", "unreadable", or null.
 */
export function loadData(storage) {
  let text;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: createEmptyData(), problem: 'unavailable' };
  }
  if (text === null) return { data: createEmptyData(), problem: null };

  const result = parseData(text);
  if (result.ok) return { data: result.data, problem: null };

  // Keep the original text aside so the next save cannot destroy it.
  try {
    storage.setItem(UNREADABLE_KEY, text);
  } catch {
    // Nothing more can be done; the caller is told the data was unreadable.
  }
  return { data: createEmptyData(), problem: 'unreadable' };
}

/**
 * Saves app data, reporting failure instead of throwing.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @param {{ settings: object, houses: object[], pois: object[] }} data - Current app data.
 * @returns {boolean} True when the data was written.
 */
export function saveData(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, serializeData(data));
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
   Collection view preferences
   -------------------------------------------------------------------------- */

/**
 * Builds the collection view the app starts with: every status shown, grouped by status, best fit first.
 * @returns {{ sort: string, grouped: boolean, hidden: string[] }} Sort option, whether it groups by status, and the hidden statuses.
 */
export function defaultViewPrefs() {
  return { sort: SORT_FIT_HIGH, grouped: true, hidden: [] };
}

/**
 * Cleans stored collection view preferences, falling back to the defaults for anything invalid.
 * @param {*} raw - Preferences as stored.
 * @returns {{ sort: string, grouped: boolean, hidden: string[] }} Valid preferences.
 */
export function normalizeViewPrefs(raw) {
  const prefs = defaultViewPrefs();
  if (!isObject(raw)) return prefs;
  if (SORT_OPTIONS.includes(raw.sort)) prefs.sort = raw.sort;
  // Only an explicit false turns grouping off, so preferences saved before the option keep their grouped order.
  if (raw.grouped === false) prefs.grouped = false;
  if (Array.isArray(raw.hidden)) {
    for (const status of STATUSES) {
      if (raw.hidden.includes(status)) prefs.hidden.push(status);
    }
  }
  return prefs;
}

/**
 * Loads this device's collection view preferences, never throwing.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @returns {{ sort: string, grouped: boolean, hidden: string[] }} Saved preferences, or the defaults.
 */
export function loadViewPrefs(storage) {
  try {
    const text = storage.getItem(VIEW_KEY);
    return text === null ? defaultViewPrefs() : normalizeViewPrefs(JSON.parse(text));
  } catch {
    return defaultViewPrefs();
  }
}

/**
 * Saves this device's collection view preferences, reporting failure instead of throwing.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @param {{ sort: string, grouped: boolean, hidden: string[] }} prefs - Preferences to save.
 * @returns {boolean} True when the preferences were written.
 */
export function saveViewPrefs(storage, prefs) {
  try {
    storage.setItem(VIEW_KEY, JSON.stringify(normalizeViewPrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
   Price Ladder view preferences
   -------------------------------------------------------------------------- */

/**
 * Builds the Price Ladder view the app starts with: no house hidden.
 * @returns {{ hidden: string[] }} Ids of the houses hidden from the ladder.
 */
export function defaultLadderPrefs() {
  return { hidden: [] };
}

/**
 * Cleans stored Price Ladder preferences, keeping each hidden house id once.
 * @param {*} raw - Preferences as stored.
 * @returns {{ hidden: string[] }} Valid preferences.
 */
export function normalizeLadderPrefs(raw) {
  const prefs = defaultLadderPrefs();
  if (!isObject(raw) || !Array.isArray(raw.hidden)) return prefs;
  for (const id of raw.hidden) {
    if (typeof id === 'string' && id !== '' && !prefs.hidden.includes(id)) prefs.hidden.push(id);
  }
  return prefs;
}

/**
 * Keeps a hidden house hidden when its id changes because its MLS number was entered or corrected.
 * @param {{ hidden: string[] }} prefs - Current Price Ladder preferences.
 * @param {string} previousId - Id the house had.
 * @param {string} id - Id it has now.
 * @returns {{ hidden: string[] }} Preferences with the id replaced.
 */
export function renameLadderHidden(prefs, previousId, id) {
  const hidden = [];
  for (const existing of prefs.hidden) hidden.push(existing === previousId ? id : existing);
  return normalizeLadderPrefs({ hidden });
}

/**
 * Loads this device's Price Ladder preferences, never throwing.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @returns {{ hidden: string[] }} Saved preferences, or the defaults.
 */
export function loadLadderPrefs(storage) {
  try {
    const text = storage.getItem(LADDER_KEY);
    return text === null ? defaultLadderPrefs() : normalizeLadderPrefs(JSON.parse(text));
  } catch {
    return defaultLadderPrefs();
  }
}

/**
 * Saves this device's Price Ladder preferences, reporting failure instead of throwing.
 * @param {Storage|null} storage - localStorage-like object, or null when storage is unavailable.
 * @param {{ hidden: string[] }} prefs - Preferences to save.
 * @returns {boolean} True when the preferences were written.
 */
export function saveLadderPrefs(storage, prefs) {
  try {
    storage.setItem(LADDER_KEY, JSON.stringify(normalizeLadderPrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}
