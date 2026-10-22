// Read-only views and the DOM helpers they are built from.

import {
  HOUSE_FIELDS,
  MIN_DOWN_PAYMENT_PERCENT,
  MULTI,
  NO,
  NUMBER,
  PROJECT_AREAS,
  PROJECT_NEED,
  PROJECT_NO_CHANGE,
  PROJECT_WANT,
  SELECT,
  SORT_OPTIONS,
  SORT_DAYS_HIGH,
  SORT_DAYS_LOW,
  SORT_FIT_HIGH,
  SORT_FIT_LOW,
  SORT_LOT_HIGH,
  SORT_LOT_LOW,
  SORT_PER_LOT_SQFT_HIGH,
  SORT_PER_LOT_SQFT_LOW,
  SORT_PER_SQFT_HIGH,
  SORT_PER_SQFT_LOW,
  SORT_PRICE_HIGH,
  SORT_PRICE_LOW,
  SORT_SQFT_HIGH,
  SORT_SQFT_LOW,
  SORT_YEAR_NEWEST,
  SORT_YEAR_OLDEST,
  STATUSES,
  STATUS_AVAILABLE,
  STATUS_SOLD,
  STATUS_UNDER_CONTRACT,
  TEXT,
  TRI,
  YES,
  isFieldApplicable,
  isFieldKnown,
  isMlsNumber,
  listingUrl,
  projectsProgress,
  sectionProgress,
} from './data.js';
import {
  DEFAULT_ESTIMATE,
  ENTERED,
  MISSING_HOA,
  MISSING_INTEREST_RATE,
  MISSING_MAXIMUM_PRICE,
  MISSING_POINTS,
  MISSING_PROJECT_COST,
  MISSING_PROJECT_ANSWERS,
  MISSING_SOLAR,
  MISSING_WANT_COST,
  calculateProjectWork,
  currentListingPrice,
  clampMapView,
  daysOnMarket,
  fitMapView,
  gestureMapView,
  mapPoint,
  mapPointAt,
  priceHistoryChanges,
  pricePerLotSquareFoot,
  pricePerSquareFoot,
} from './calculations.js';
import {
  DELIGHTS,
  DELIGHT_POINTS,
  DIFFERS,
  INCOMPLETE,
  KNOWN,
  NOT_APPLICABLE,
  SAME,
  STABILITY_NO_FINANCIAL_SCORE,
  STABILITY_UNCOSTED_WORK,
  UNKNOWN,
  GAIN,
  GIVE_UP,
  LADDER_FACTS,
  compareEvaluations,
  evaluate,
  ladderStep,
  sortForCollection,
  sortForLadder,
} from './scoring.js';
// The Houses map's extent, projection, and attribution; map.svg shares its coordinates.
import MAP from '../map/map.json' with { type: 'json' };

export const STATUS_LABELS = {
  [STATUS_AVAILABLE]: 'Available',
  [STATUS_UNDER_CONTRACT]: 'Under Contract',
  [STATUS_SOLD]: 'Sold',
};

// What the Status Date means for each status that has one.
export const STATUS_DATE_LABELS = {
  [STATUS_UNDER_CONTRACT]: 'Under contract on',
  [STATUS_SOLD]: 'Sold on',
};

const SORT_LABELS = {
  [SORT_FIT_HIGH]: 'Overall Fit, high to low',
  [SORT_FIT_LOW]: 'Overall Fit, low to high',
  [SORT_PRICE_LOW]: 'Listing price, low to high',
  [SORT_PRICE_HIGH]: 'Listing price, high to low',
  [SORT_PER_SQFT_LOW]: 'Price per sqft, low to high',
  [SORT_PER_SQFT_HIGH]: 'Price per sqft, high to low',
  [SORT_PER_LOT_SQFT_LOW]: 'Price per lot sqft, low to high',
  [SORT_PER_LOT_SQFT_HIGH]: 'Price per lot sqft, high to low',
  [SORT_SQFT_HIGH]: 'Square feet, largest first',
  [SORT_SQFT_LOW]: 'Square feet, smallest first',
  [SORT_LOT_HIGH]: 'Lot size, largest first',
  [SORT_LOT_LOW]: 'Lot size, smallest first',
  [SORT_YEAR_NEWEST]: 'Year built, newest first',
  [SORT_YEAR_OLDEST]: 'Year built, oldest first',
  [SORT_DAYS_LOW]: 'Days on market, fewest first',
  [SORT_DAYS_HIGH]: 'Days on market, most first',
};

// Short enough for the Sort button on a phone. The arrow points down for high to low, largest, newest, or most first.
const SORT_SHORT_LABELS = {
  [SORT_FIT_HIGH]: 'Fit ↓',
  [SORT_FIT_LOW]: 'Fit ↑',
  [SORT_PRICE_LOW]: 'Price ↑',
  [SORT_PRICE_HIGH]: 'Price ↓',
  [SORT_PER_SQFT_LOW]: '$/sqft ↑',
  [SORT_PER_SQFT_HIGH]: '$/sqft ↓',
  [SORT_PER_LOT_SQFT_LOW]: '$/lot ↑',
  [SORT_PER_LOT_SQFT_HIGH]: '$/lot ↓',
  [SORT_SQFT_HIGH]: 'Sqft ↓',
  [SORT_SQFT_LOW]: 'Sqft ↑',
  [SORT_LOT_HIGH]: 'Lot ↓',
  [SORT_LOT_LOW]: 'Lot ↑',
  [SORT_YEAR_NEWEST]: 'Year ↓',
  [SORT_YEAR_OLDEST]: 'Year ↑',
  [SORT_DAYS_LOW]: 'Days ↑',
  [SORT_DAYS_HIGH]: 'Days ↓',
};

/* --------------------------------------------------------------------------
   Property sections and labels, shared by the property form and House Detail
   -------------------------------------------------------------------------- */

const EQUIPMENT_STATUS_LABELS = { good: 'Good', older: 'Functional but older', soon: 'Replacement expected soon', failed: 'Failed / immediate replacement' };

// Display text for every select and multi-select option.
export const OPTION_LABELS = {
  propertyType: { detached: 'Detached', townhouse: 'Townhouse / rowhouse', condo: 'Condo / other attached' },
  parking: {
    attachedGarage: 'Attached garage',
    detachedGarage: 'Detached garage',
    carport: 'Carport',
    driveway: 'Driveway',
    dedicatedUncovered: 'Dedicated uncovered',
    street: 'Street',
  },
  foodStorage: { pantry: 'Pantry', cabinetry: 'Cabinetry', other: 'Other dedicated storage' },
  bedroomFloor: { upper: 'Upper', main: 'Main / ground', lower: 'Lower / basement' },
  bedroomWindowExposure: {
    privateOutdoor: 'Private outdoor space',
    street: 'Street',
    neighborProperty: 'Neighbor property',
    directNeighborWindow: 'Direct neighbor window',
    publicSidewalk: 'Public sidewalk',
  },
  closetType: { reachIn: 'Reach-in', walkIn: 'Walk-in' },
  tubAvailability: { primary: 'Primary bathroom', elsewhere: 'Elsewhere in house', none: 'None' },
  bathroomStorage: { vanity: 'Vanity storage', medicineCabinet: 'Medicine cabinet', linen: 'Linen storage' },
  safeOutdoor: { yard: 'Yard', balconyPatio: 'Balcony / patio', catio: 'Catio feasible' },
  irrigation: { yes: 'Yes', no: 'No', na: 'Not applicable' },
  coolingType: {
    centralAc: 'Central A/C',
    miniSplit: 'Mini-split',
    evaporative: 'Evaporative',
    windowUnits: 'Window units',
    none: 'None',
  },
  roofStatus: {
    good: 'Good / substantial remaining life',
    mediumTerm: 'Functional, medium-term replacement',
    soon: 'Replacement expected soon',
    failed: 'Failed / immediate replacement',
  },
  furnaceStatus: EQUIPMENT_STATUS_LABELS,
  waterHeaterStatus: EQUIPMENT_STATUS_LABELS,
  electrical: {
    modern: 'Modern / updated',
    older: 'Older, no known issue',
    significantIssue: 'Knob-and-tube or significant issue',
  },
  plumbing: {
    modern: 'Modern / updated',
    older: 'Older, no known issue',
    materialConcern: 'Galvanized / material concern',
    failure: 'Known significant failure',
  },
  sewer: { clear: 'Scoped and clear', minorIssue: 'Scoped, minor issue', significantIssue: 'Scoped, significant issue' },
  foundation: { clear: 'No known issue', minorIssue: 'Minor issue, understood remedy', significantIssue: 'Significant known issue' },
  waterIntrusion: { none: 'No known history', remediated: 'Prior issue, remediated', unresolved: 'Unresolved / recurrent' },
  solarStatus: { owned: 'Owned', financed: 'Financed / leased', none: 'None' },
};

// Every form section, once. The order shown to the user comes from SECTION_ORDERS.
// Each field is { name, label } plus optional layout hints:
//   counts: false    - left out of the section's "n of m known" count
//   prefix, suffix   - unit shown before or after a number, such as "$" or "per year"
//   hint             - help text under the field
//   inherits         - Settings value shown as the placeholder while the field is blank
//   estimate         - "tax" or "insurance": the Settings estimate shown as the placeholder while blank
//   type, multiline  - input type of a text field, such as "url", or a multi-line text box
//   noneLabel        - wording of a multi-select's None option
//   unknownOption    - multi-select offers Unknown in place of None
//   plain            - number shown without thousands separators
//   coordinate       - number shown exactly as stored, typed on a full keyboard so it can be negative
//   wide: false      - text field takes half a row instead of the full row
export const HOUSE_SECTIONS = [
  {
    id: 'basics',
    title: 'Property Basics',
    fields: [
      // Address shares its row with the MLS number, which the forms add beside it.
      { name: 'address', label: 'Address', wide: false },
      { name: 'imageUrl', label: 'Primary image URL', type: 'url', counts: false },
      { name: 'yearBuilt', label: 'Year built', plain: true },
      { name: 'bedrooms', label: 'Bedrooms' },
      { name: 'bathrooms', label: 'Bathrooms' },
      { name: 'squareFeet', label: 'Square feet', suffix: 'sqft' },
      { name: 'lotAcres', label: 'Lot size', suffix: 'acres' },
      { name: 'propertyType', label: 'Property type' },
      { name: 'cornerLot', label: 'Corner lot' },
      // Delight features anywhere in the house; they add a bonus and are not counted as scored information.
      { name: 'fireplace', label: 'Fireplace', counts: false },
      { name: 'bayWindow', label: 'Bay window', counts: false },
    ],
  },
  {
    id: 'location',
    title: 'Location & Travel',
    fields: [
      // Only used to place the house on the Houses map, so not counted as information about the house.
      { name: 'latitude', label: 'Latitude', coordinate: true, counts: false, hint: 'Decimal degrees, such as 40.7518' },
      { name: 'longitude', label: 'Longitude', coordinate: true, counts: false, hint: 'Decimal degrees, such as -111.8160' },
      { name: 'trainMinutes', label: 'Scooter time to train', suffix: 'min' },
      { name: 'groceryMinutes', label: 'Scooter time to grocery', suffix: 'min' },
      { name: 'freewayMinutes', label: 'Drive time to freeway', suffix: 'min' },
      { name: 'parentsMinutes', label: 'Drive time to parents', suffix: 'min' },
      { name: 'airportMinutes', label: 'Drive time to airport', suffix: 'min' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Inputs',
    fields: [
      { name: 'annualPropertyTax', label: 'Annual property tax', prefix: '$', suffix: 'per year', estimate: 'tax' },
      { name: 'annualInsurance', label: 'Annual homeowners insurance', prefix: '$', suffix: 'per year', estimate: 'insurance' },
      { name: 'hoa', label: 'HOA' },
      { name: 'hoaDues', label: 'Monthly HOA dues', prefix: '$', suffix: 'per month' },
      { name: 'hoaNotes', label: 'HOA notes', multiline: true, counts: false },
      { name: 'sellerCredits', label: 'Seller credits', prefix: '$', counts: false },
      { name: 'lenderCredits', label: 'Lender credits', prefix: '$', counts: false },
      { name: 'downPaymentPercent', label: 'Down payment', suffix: '%', inherits: 'downPaymentPercent', counts: false, hint: `${MIN_DOWN_PAYMENT_PERCENT}% minimum.` },
      { name: 'pointsPercent', label: 'Points', suffix: '%', inherits: 'pointsPercent', counts: false },
      { name: 'fixedLenderFee', label: 'Fixed lender fee', prefix: '$', inherits: 'fixedLenderFee', counts: false },
      { name: 'titleInsurance', label: `Lender's title insurance`, prefix: '$', inherits: 'titleInsurance', counts: false },
      { name: 'prepaidInterestDays', label: 'Prepaid-interest days', suffix: 'days', inherits: 'prepaidInterestDays', counts: false },
    ],
  },
  {
    id: 'parking',
    title: 'Parking & Arrival',
    fields: [
      { name: 'parking', label: 'Available parking', noneLabel: 'None' },
      { name: 'garageStalls', label: 'Garage stalls' },
      { name: 'garagePower', label: 'Power available in garage' },
      { name: 'garageWorkspace', label: 'Garage workspace' },
      { name: 'coveredRoute', label: 'Covered route from parking to house' },
      { name: 'exteriorSteps', label: 'Exterior steps from parking to house', suffix: 'steps' },
      { name: 'entryShoes', label: 'Entry has a place for shoes' },
      { name: 'entryCoat', label: 'Entry has a place for a coat' },
      { name: 'entryPurse', label: 'Entry has a place for a purse' },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior & Upkeep',
    fields: [
      { name: 'parkStrip', label: 'Park strip to maintain' },
      { name: 'irrigation', label: 'Automatic irrigation', hint: 'Not applicable when nothing needs watering.' },
      { name: 'sidewalkToShovel', label: 'Sidewalk to shovel' },
      { name: 'matureTrees', label: 'Mature trees' },
    ],
  },
  {
    id: 'livingRoom',
    title: 'Living Room',
    fields: [
      { name: 'megacouchFits', label: 'Megacouch fits' },
      { name: 'tvAreaIsThoroughfare', label: 'Couch-to-TV area is a main walkway', hint: 'Yes means people cross the sightline to get through the room.' },
      { name: 'tvBackToFrontDoor', label: 'TV seating puts back to front door' },
      { name: 'tvBackToWindows', label: 'TV seating puts back to windows' },
      { name: 'christmasTreeSpot', label: 'Good Christmas tree location' },
    ],
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    fields: [
      { name: 'sinkStoveWorks', label: 'Sink / stove relationship works' },
      { name: 'counterBesideSink', label: 'Counter beside sink' },
      { name: 'counterBesideStove', label: 'Counter beside stove' },
      { name: 'dishwasherBesideSink', label: 'Dishwasher beside sink' },
      { name: 'foodStorage', label: 'Food storage', noneLabel: 'No workable food storage' },
    ],
  },
  {
    id: 'eating',
    title: 'Eating',
    fields: [
      { name: 'diningTableSpace', label: 'Dining table space' },
      { name: 'counterSeating', label: 'Counter / bar seating' },
    ],
  },
  {
    id: 'primaryBedroom',
    title: 'Primary Bedroom',
    fields: [
      { name: 'bedroomFloor', label: 'Primary bedroom floor' },
      { name: 'bedroomWindowExposure', label: 'Bedroom windows face', unknownOption: true },
      { name: 'closetType', label: 'Closet type' },
    ],
  },
  {
    id: 'primaryBathroom',
    title: 'Primary Bathroom & Getting Ready',
    fields: [
      { name: 'privatePrimaryBath', label: 'Private primary bathroom' },
      { name: 'tubAvailability', label: 'Tub' },
      { name: 'skincareOnCounter', label: 'Skincare can permanently live on counter' },
      { name: 'outletAtVanity', label: 'Outlet at vanity' },
      { name: 'bathroomStorage', label: 'Bathroom storage', noneLabel: 'None' },
    ],
  },
  {
    id: 'guestBathroom',
    title: 'Guest Bathroom Usability',
    fields: [
      { name: 'guestFullBath', label: 'Full bathroom available to guests', hint: 'Usable without passing through the primary bedroom.' },
    ],
  },
  {
    id: 'laundry',
    title: 'Laundry',
    fields: [
      { name: 'laundrySameFloor', label: 'Laundry on same floor as primary' },
      { name: 'laundrySupplyStorage', label: 'Laundry supply storage' },
      { name: 'laundryUsableSpace', label: 'Usable space for handling laundry', hint: 'Room to load, unload, and handle a basket without it being awkward.' },
    ],
  },
  {
    id: 'salem',
    title: 'Salem',
    fields: [
      { name: 'litterBoxSpot', label: 'Obvious litter-box location' },
      { name: 'catTreeSpot', label: 'Obvious cat-tree location' },
      { name: 'safeOutdoor', label: 'Safe outdoor options', noneLabel: 'None' },
      { name: 'fullyFenced', label: 'Fully fenced outdoor space' },
    ],
  },
  {
    id: 'storage',
    title: 'Household Storage',
    fields: [
      { name: 'storageVacuum', label: 'Vacuum / broom storage' },
      { name: 'storageCleaning', label: 'Cleaning supply storage' },
      { name: 'storageTools', label: 'Tools / home maintenance storage' },
      { name: 'storageSeasonal', label: 'Seasonal / holiday storage' },
      { name: 'storageBulk', label: 'Bulk household goods storage' },
    ],
  },
  {
    id: 'systems',
    title: 'Major Systems',
    fields: [
      { name: 'coolingType', label: 'Cooling type' },
      { name: 'coolingYear', label: 'Cooling system year', plain: true },
      { name: 'roofYear', label: 'Roof year', plain: true },
      { name: 'roofStatus', label: 'Roof status' },
      { name: 'furnaceYear', label: 'Furnace year', plain: true },
      { name: 'furnaceStatus', label: 'Furnace status' },
      { name: 'waterHeaterYear', label: 'Water heater year', plain: true },
      { name: 'waterHeaterStatus', label: 'Water heater status' },
      { name: 'electrical', label: 'Electrical' },
      { name: 'plumbing', label: 'Plumbing' },
      { name: 'sewer', label: 'Sewer' },
      { name: 'foundation', label: 'Foundation' },
      { name: 'waterIntrusion', label: 'Water intrusion' },
      { name: 'solarStatus', label: 'Solar' },
      { name: 'solarPayment', label: 'Monthly solar payment', prefix: '$', suffix: 'per month' },
    ],
  },
  {
    // Built by projectsSection rather than from fields.
    id: 'projects',
    title: 'Projects',
    fields: [],
  },
  {
    id: 'tourReaction',
    title: 'Tour Reaction',
    fields: [
      { name: 'likeBeingHere', label: 'I actually like being here' },
      { name: 'liveAsIsThreeYears', label: 'I could happily live here as-is for three years' },
      { name: 'sadIfSold', label: 'I would be sad if someone bought it tonight' },
      { name: 'wantToGoBack', label: 'I want to go back inside' },
    ],
  },
];

// Presentation order of the form sections (FORM_SCHEMA.md §26). Order never affects data or scoring.
// Research order suits a computer with the listing open; tour order suits walking through on a phone.
export const SECTION_ORDERS = {
  research: [
    'basics', 'location', 'financial', 'parking', 'exterior', 'livingRoom', 'kitchen', 'eating', 'primaryBedroom',
    'primaryBathroom', 'guestBathroom', 'salem', 'laundry', 'storage', 'systems', 'projects', 'tourReaction',
  ],
  tour: [
    'basics', 'parking', 'exterior', 'livingRoom', 'kitchen', 'eating', 'primaryBedroom', 'primaryBathroom',
    'guestBathroom', 'salem', 'laundry', 'storage', 'systems', 'projects', 'tourReaction', 'location', 'financial',
  ],
};

export const PROJECT_LABELS = {
  livingRoom: 'Living room',
  kitchen: 'Kitchen',
  primaryBedroom: 'Primary bedroom',
  primaryBathroom: 'Primary bathroom',
  office: 'Office',
  guestBedroom: 'Guest bedroom',
  otherBathrooms: 'Other bathrooms',
  yard: 'Yard',
  garage: 'Garage',
  roof: 'Roof',
  hvac: 'HVAC',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  sewer: 'Sewer',
  foundation: 'Foundation',
  other: 'Other',
};

export const PROJECT_STATE_LABELS = {
  [PROJECT_NO_CHANGE]: 'No change',
  [PROJECT_WANT]: 'Want to fix',
  [PROJECT_NEED]: 'Need to fix',
};

/**
 * Finds a form section's layout by id.
 * @param {string} id - Section id such as "basics".
 * @returns {object|undefined} The section layout, or undefined when there is none with that id.
 */
export function findSection(id) {
  for (const section of HOUSE_SECTIONS) {
    if (section.id === id) return section;
  }
  return undefined;
}

/* --------------------------------------------------------------------------
   DOM helpers
   -------------------------------------------------------------------------- */

/**
 * Builds an element, adding string children as text nodes so they are never parsed as HTML.
 * @param {string} tag - Element tag name.
 * @param {Object<string, string>} [attrs] - Attributes to set; null and undefined values are skipped.
 * @param {Array<Node|string|null|undefined>} [children] - Child nodes or text; null and undefined are skipped.
 * @returns {HTMLElement} The new element.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

// Stylesheets requested this session, by address: the pending load, or true once loaded.
const stylesheets = new Map();

/**
 * Adds stylesheets not yet loaded this session and leaves them in place for later views.
 * @param {string[]} hrefs - Stylesheet addresses, such as "styles/settings.css".
 * @returns {Promise<void[]>|null} Settles once all have loaded or failed; null when all were already loaded.
 */
export function loadStylesheets(hrefs) {
  const pending = [];
  for (const href of hrefs) {
    const state = stylesheets.get(href);
    if (state === true) continue;
    if (state !== undefined) {
      pending.push(state);
      continue;
    }
    const link = el('link', { rel: 'stylesheet', href });
    const loading = new Promise(function waitForStylesheet(resolve) {
      link.addEventListener('load', function handleLoad() {
        stylesheets.set(href, true);
        resolve();
      });
      link.addEventListener('error', function handleError() {
        // A view without its styles beats one that never appears; forgetting the link lets the next visit retry.
        link.remove();
        stylesheets.delete(href);
        resolve();
      });
    });
    stylesheets.set(href, loading);
    document.head.append(link);
    pending.push(loading);
  }
  return pending.length === 0 ? null : Promise.all(pending);
}

/**
 * Formats a number with thousands separators for display and form fields.
 * @param {number} value - Number to format.
 * @returns {string} Text such as "400,000" or "6.875".
 */
export function formatNumber(value) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const SCROLL_HOLD_MS = 1000;
const CURRENT_LINE_OFFSET = 24;

/**
 * Checks whether the user has asked the system to minimize motion.
 * @returns {boolean} True when animated scrolling should be skipped.
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Builds a sticky list of section links that scroll to each section and mark the one in view.
 * @param {string} label - Accessible name for the navigation, such as "Settings sections".
 * @param {HTMLElement[]} sections - Section elements, each containing an h2 used as its link text.
 * @returns {HTMLElement} The navigation element.
 */
export function sectionNav(label, sections) {
  const nav = el('nav', { class: 'sections', 'aria-label': label });
  const buttons = [];
  const listeners = new AbortController();
  let current = -1;
  // The section the user last asked for; it wins ties and stays current until they scroll themselves.
  let preferred = -1;
  let pinned = false;
  let holding = false;
  let scheduled = false;
  let wasConnected = false;

  /**
   * Marks one section's link as current.
   * @param {number} index - Position of the section in the list.
   */
  function setCurrent(index) {
    if (index === current) return;
    current = index;
    for (let position = 0; position < buttons.length; position += 1) {
      if (position === index) buttons[position].setAttribute('aria-current', 'true');
      else buttons[position].removeAttribute('aria-current');
    }
    // Slide the list sideways to center the current link. Scrolling the list itself, not the
    // link, leaves any page scroll already under way undisturbed.
    if (nav.isConnected) {
      const button = buttons[index];
      const left = button.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2;
      nav.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function update() {
    scheduled = false;
    if (!nav.isConnected) {
      // The view has been replaced; stop listening.
      if (wasConnected) listeners.abort();
      return;
    }
    wasConnected = true;
    // Nothing to track while a pinned section holds, or while the bar is hidden on wide screens.
    if (pinned || nav.offsetParent === null) return;

    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom && window.scrollY > 0) {
      setCurrent(sections.length - 1);
      return;
    }
    // The current section is the one whose top most recently passed under the sticky bar.
    const line = nav.getBoundingClientRect().bottom + CURRENT_LINE_OFFSET;
    let best = 0;
    let bestTop = -Infinity;
    for (let index = 0; index < sections.length; index += 1) {
      const top = sections[index].getBoundingClientRect().top;
      if (top > line) continue;
      const tied = Math.abs(top - bestTop) <= 2;
      if (top > bestTop + 2 || (tied && index === preferred)) {
        best = index;
        bestTop = top;
      }
    }
    setCurrent(best);
  }

  function requestUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }

  function handleScroll() {
    // Scrolling started by a link click does not count as the user moving on.
    if (holding) return;
    pinned = false;
    requestUpdate();
  }

  function releaseHold() {
    holding = false;
  }

  /**
   * Scrolls to a section, marks it current, and moves focus to its heading.
   * @param {number} index - Position of the section in the list.
   */
  function goTo(index) {
    preferred = index;
    pinned = true;
    holding = true;
    window.setTimeout(releaseHold, SCROLL_HOLD_MS);
    setCurrent(index);
    // A collapsed section is opened so the user lands on its fields, not just its heading.
    if (sections[index] instanceof HTMLDetailsElement) sections[index].open = true;
    sections[index].scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    sections[index].querySelector('h2').focus({ preventScroll: true });
  }

  for (let index = 0; index < sections.length; index += 1) {
    const heading = sections[index].querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    const button = el('button', { type: 'button' }, [heading.textContent]);
    button.addEventListener('click', function handleClick() {
      goTo(index);
    });
    buttons.push(button);
    nav.append(button);
  }

  setCurrent(0);
  window.addEventListener('scroll', handleScroll, { passive: true, signal: listeners.signal });
  window.addEventListener('resize', requestUpdate, { signal: listeners.signal });
  // Runs once the view is on the page, so a re-render keeps the right link current.
  requestUpdate();
  return nav;
}

/**
 * Builds a focusable page heading.
 * @param {string} text - Heading text.
 * @returns {HTMLElement} The h1 element.
 */
export function pageTitle(text) {
  return el('h1', { tabindex: '-1' }, [text]);
}

/**
 * Formats a dollar amount rounded to the nearest dollar.
 * @param {number} amount - Amount in dollars.
 * @returns {string} Text such as "$475,000".
 */
export function formatMoney(amount) {
  return `$${formatNumber(Math.round(amount))}`;
}

/**
 * Formats a calendar date for reading, without shifting it across time zones.
 * @param {string} date - Date as YYYY-MM-DD.
 * @returns {string} Text such as "Oct 12, 2026".
 */
export function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  const options = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', options);
}

/**
 * Words a count with its unit, singular for exactly one.
 * @param {number} count - The count, such as 2.5 bathrooms.
 * @param {string} singular - Unit for exactly one, such as "bd" or "day".
 * @param {string} plural - Unit otherwise, such as "bds" or "days".
 * @returns {string} Text such as "4 bds" or "1 day".
 */
export function countText(count, singular, plural) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Words a score as the whole number every view shows and compares.
 * @param {number} score - Score from 0 to 100.
 * @returns {string} Text such as "87".
 */
function scoreText(score) {
  return String(Math.round(score));
}

/**
 * Words how much of a house's scored information is known.
 * @param {{ percent: number }} completeness - Completeness from an evaluation.
 * @returns {string} Text such as "62% known".
 */
function percentKnownText(completeness) {
  return `${Math.round(completeness.percent)}% known`;
}

/**
 * Words how many of a section's applicable answers are known.
 * @param {number} known - Known answers.
 * @param {number} total - Applicable answers.
 * @returns {string} Text such as "18 of 22 known".
 */
export function knownCountText(known, total) {
  return `${known} of ${total} known`;
}

/**
 * Builds a house's photo, falling back to a placeholder when there is no image or it fails to load.
 * @param {string} imageUrl - Image address; may be blank.
 * @param {Array<HTMLElement|null>} [overlays] - Elements pinned over the photo, such as the status pill.
 * @returns {HTMLElement} The photo frame.
 */
function housePhoto(imageUrl, overlays = []) {
  const frame = el('div', { class: 'photo' }, overlays);
  if (imageUrl === '') {
    frame.classList.add('missing');
    return frame;
  }
  // Listing sites often refuse images requested with a referrer from another site.
  const image = el('img', { src: imageUrl, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  image.addEventListener('error', function handleImageError() {
    image.remove();
    frame.classList.add('missing');
  });
  frame.prepend(image);
  return frame;
}

// On the Houses cards, an Overall Fit at or below this, as shown, is set in amber.
const LOW_FIT_MAX = 70;

/**
 * Builds the Overall Fit shown on a house card.
 * @param {number|null} overallFit - Overall Fit, or null when not enough is known.
 * @returns {HTMLElement} The fit element.
 */
function cardFit(overallFit) {
  if (overallFit === null) {
    return el('p', { class: 'fit unavailable' }, [el('span', { class: 'label' }, ['Overall Fit not available yet'])]);
  }
  // Judged on the whole number shown, so a card reading 70 is always amber.
  const shown = Math.round(overallFit);
  return el('p', { class: shown <= LOW_FIT_MAX ? 'fit low' : 'fit' }, [
    el('span', { class: 'score' }, [scoreText(overallFit)]),
    el('span', { class: 'label' }, ['Overall Fit']),
  ]);
}

/**
 * Builds a card's facts line: the listing price.
 * @param {object} house - House to describe.
 * @returns {Array<Node>} The price element.
 */
function cardFacts(house) {
  return [el('span', { class: 'amount' }, [formatMoney(currentListingPrice(house))])];
}

/**
 * Formats a dollars-per-unit rate, keeping cents when the rate is small.
 * @param {number} rate - Dollars per unit.
 * @returns {string} Text such as "$301" or "$0.27".
 */
function formatRate(rate) {
  return rate < 10 ? `$${rate.toFixed(2)}` : formatMoney(rate);
}

// Stands in for an unknown value in the spec grid, so every fact keeps its place.
const UNKNOWN_SPEC = '—';

/**
 * Builds the spec grid shared by the Houses cards and House Detail: basics, size and lot, and market.
 * @param {object} house - House to describe.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @returns {HTMLElement} The grid, with unknown values shown as a dash and no link while the house has no MLS number.
 */
function specGrid(house, today) {
  // Each fact reads as a phrase, value first, so it makes sense read aloud or copied.
  function fact(value, rest) {
    return el('p', {}, [el('span', { class: 'value' }, [value]), ' ', ...rest]);
  }
  function shown(number) {
    return number === null ? UNKNOWN_SPEC : formatNumber(number);
  }
  // A unit is part of its measurement; a rate is only shown when both of its inputs are known.
  function measure(number, singular, plural, rate, per) {
    const unit = el('span', { class: 'unit' }, [number === 1 ? singular : plural]);
    const rateLine = rate === null ? null : el('span', { class: 'rate' }, [`${formatRate(rate)}/${per}`]);
    return fact(shown(number), [unit, rateLine === null ? null : ' ', rateLine]);
  }

  const days = daysOnMarket(house, today);
  const url = listingUrl(house);
  // A house without an MLS number names no listing, so it gets no link rather than a broken one.
  const link = url === null
    ? null
    : el('p', {}, [el('a', { href: url, target: '_blank', rel: 'noreferrer' }, ['View on URE', el('span', { 'aria-hidden': 'true' }, [' →'])])]);
  return el('div', { class: 'specs' }, [
    el('div', { class: 'basics' }, [
      fact(shown(house.bedrooms), [house.bedrooms === 1 ? 'bed' : 'beds']),
      fact(shown(house.bathrooms), [house.bathrooms === 1 ? 'bath' : 'baths']),
      fact(house.yearBuilt === null ? UNKNOWN_SPEC : String(house.yearBuilt), ['built']),
    ]),
    el('div', { class: 'size' }, [
      measure(house.squareFeet, 'sqft', 'sqft', pricePerSquareFoot(house), 'sqft'),
      measure(house.lotAcres, 'acre', 'acres', pricePerLotSquareFoot(house), 'lot sqft'),
    ]),
    // Days on Market is plain listing context, so no part of it is emphasized.
    el('div', { class: 'market' }, [
      el('p', {}, [`${days === null ? `${UNKNOWN_SPEC} days` : countText(days, 'day', 'days')} on market`]),
      link,
    ]),
  ]);
}

/**
 * Builds a house's status pill, colored by status.
 * @param {object} house - House to describe.
 * @returns {HTMLElement} The pill.
 */
function statusPill(house) {
  return el('p', { class: 'status', 'data-status': house.status }, [STATUS_LABELS[house.status]]);
}

/**
 * Passes a click anywhere on a card to the card's own link or checkbox, unless the click selected text.
 * @param {MouseEvent} event - Click from within a list of cards.
 */
function clickCard(event) {
  const card = event.target.closest('.card');
  // Links, labels, buttons, and checkboxes already act for themselves.
  if (card === null || event.target.closest('a, button, input, label') !== null) return;
  // Dragging across the card to highlight its text is not a click on it.
  if (window.getSelection().toString() !== '') return;
  card.querySelector('a, input').click();
}

/**
 * Builds one house's card for Houses and the map's preview, linked by its address or picked by a checkbox.
 * @param {object} house - House to show.
 * @param {number|null} overallFit - The house's Overall Fit, or null when unavailable.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @param {{ checked: boolean }|null} [pick] - Checkbox state while comparing; null for a link.
 * @returns {HTMLElement} The card.
 */
function houseCard(house, overallFit, today, pick = null) {
  // Only the status is pinned over the photo; Days on Market is in the spec grid.
  const overlays = [statusPill(house)];
  let address;
  if (pick === null) {
    address = el('a', { href: `#/house/${house.id}` }, [house.address]);
  } else {
    const id = `pick-${house.id}`;
    overlays.push(el('input', { class: 'pick', type: 'checkbox', id, value: house.id, checked: pick.checked ? '' : null }));
    address = el('label', { for: id }, [house.address]);
  }
  const body = el('div', { class: 'body' }, [
    el('p', { class: 'address' }, [address]),
    el('p', { class: 'facts' }, cardFacts(house)),
    cardFit(overallFit),
    specGrid(house, today),
  ]);
  return el('div', { class: 'card linked' }, [housePhoto(house.imageUrl, overlays), body]);
}

/**
 * Builds the button that closes one of the Houses dialogs, shown on a phone.
 * @param {string} id - Id of the popover it closes.
 * @returns {HTMLElement} The close button.
 */
function closeButton(id) {
  return el('button', { class: 'close', type: 'button', popovertarget: id, popovertargetaction: 'hide', 'aria-label': 'Close' }, [
    el('img', { src: 'icons/close.svg', alt: '' }),
  ]);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// The map's own styles, loaded the first time Houses shows the map.
export const MAP_STYLESHEET = 'styles/map.css';

// On-screen sizes of a map marker in CSS pixels: a finger-sized target, the focus ring, and the dot.
const MARKER_TARGET_RADIUS = 22;
const MARKER_RING_RADIUS = 12;
const MARKER_DOT_RADIUS = 7;
// A place is a smaller, neutral dot than a house, with the same finger-sized target; its title sits beside it.
const PLACE_DOT_RADIUS = 6;
const PLACE_LABEL_OFFSET = 12;
// The map frame's shape on a phone, used until the frame has been measured.
const MAP_INITIAL_ASPECT = 4 / 5;
// A pointer that moves farther than this, in CSS pixels, is dragging the map rather than tapping it.
const TAP_SLOP = 8;
// Two taps on the map this close in time and place zoom in, by this much, around the tap.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24;
const DOUBLE_TAP_ZOOM = 2;
// A click this soon after a drag ends belongs to the drag, so it does not choose the marker it started on.
const DRAG_CLICK_MS = 100;
// Wheel zoom per pixel scrolled: gentle for a mouse wheel, quicker for a trackpad pinch, which reports small steps.
// One event counts for at most WHEEL_MAX_DELTA pixels, so a single notch never jumps several zoom levels.
const WHEEL_ZOOM_RATE = 0.002;
const PINCH_ZOOM_RATE = 0.01;
const WHEEL_MAX_DELTA = 100;
const WHEEL_LINE_HEIGHT = 16;
// Once the wheel has rested this long, the wheel zoom is over and the map is redrawn sharp.
const WHEEL_SETTLE_MS = 150;

/**
 * Builds an SVG element with its attributes.
 * @param {string} tag - SVG tag name.
 * @param {Object<string, string|number>} [attrs] - Attributes to set.
 * @param {Array<Node>} [children] - Child nodes.
 * @returns {SVGElement} The new element.
 */
function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/**
 * Builds a house's marker on the map: a dot inside a finger-sized target, named by its address and status.
 * @param {object} house - House to mark.
 * @param {{ x: number, y: number }} point - The house's position in map coordinates.
 * @returns {SVGGElement} The marker, which acts as a toggle button.
 */
function mapMarker(house, point) {
  // The inner group is scaled to keep the marker one size on screen however large the map is drawn.
  const pin = svgEl('g', { class: 'pin' }, [
    svgEl('circle', { class: 'target', r: MARKER_TARGET_RADIUS }),
    svgEl('circle', { class: 'ring', r: MARKER_RING_RADIUS }),
    svgEl('circle', { class: 'dot', r: MARKER_DOT_RADIUS }),
  ]);
  return svgEl('g', {
    class: 'marker',
    role: 'button',
    tabindex: '0',
    'aria-pressed': 'false',
    'aria-label': `${house.address}, ${STATUS_LABELS[house.status]}`,
    'data-house': house.id,
    'data-status': house.status,
    transform: `translate(${point.x} ${point.y})`,
  }, [pin]);
}

/**
 * Checks whether a latitude and longitude fall inside the map, so a marker can be placed there.
 * @param {number|null} latitude - Latitude in degrees.
 * @param {number|null} longitude - Longitude in degrees.
 * @returns {boolean} True when the position is on the map.
 */
export function isOnMap(latitude, longitude) {
  return mapPoint(latitude, longitude, MAP) !== null;
}

/**
 * Builds a place's marker on the map: a small dot in a finger-sized target, its title shown once chosen.
 * @param {{ id: string, title: string }} poi - Place to mark.
 * @param {{ x: number, y: number }} point - The place's position in map coordinates.
 * @returns {SVGGElement} The marker, which acts as a toggle button.
 */
function placeMarker(poi, point) {
  const pin = svgEl('g', { class: 'pin' }, [
    svgEl('circle', { class: 'target', r: MARKER_TARGET_RADIUS }),
    svgEl('circle', { class: 'ring', r: MARKER_RING_RADIUS }),
    svgEl('circle', { class: 'dot', r: PLACE_DOT_RADIUS }),
    svgEl('text', { class: 'label', x: PLACE_LABEL_OFFSET, 'aria-hidden': 'true' }, [poi.title]),
  ]);
  return svgEl('g', {
    class: 'place',
    role: 'button',
    tabindex: '0',
    'aria-pressed': 'false',
    'aria-label': poi.title,
    'data-place': poi.id,
    transform: `translate(${point.x} ${point.y})`,
  }, [pin]);
}

/**
 * Words why some shown houses have no marker: no coordinates, or coordinates off the map.
 * @param {number} missing - Shown houses without both coordinates.
 * @param {number} outside - Shown houses whose coordinates fall outside the map.
 * @returns {string} Text such as "2 houses don't have map coordinates.", or an empty string when every house is marked.
 */
function unmappedText(missing, outside) {
  const parts = [];
  if (missing > 0) parts.push(`${countText(missing, 'house', 'houses')} ${missing === 1 ? 'doesn’t' : 'don’t'} have map coordinates.`);
  if (outside > 0) parts.push(`${countText(outside, 'house is', 'houses are')} outside the map area.`);
  return parts.join(' ');
}

/**
 * Builds the Houses map: the shown houses as markers, and a preview of the selected one.
 * @param {Array<{ house: object, overallFit: number|null }>} items - Every house, for fitting the map to them.
 * @param {string|null} selected - Id of the house selected when the view opens, or null.
 * @param {function(string|null): void} onSelect - Called with the newly selected house's id, or null when none.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market on the preview.
 * @param {Array<{ id: string, title: string, latitude: number, longitude: number }>} pois - Saved places, marked whatever the filters.
 * @returns {{ node: HTMLElement, show: function(Array<object>): void }} The map's element, and the function that marks the shown houses.
 */
function houseMap(items, selected, onSelect, today, pois) {
  const points = new Map();
  for (const item of items) {
    const point = mapPoint(item.house.latitude, item.house.longitude, MAP);
    if (point !== null) points.set(item.house.id, point);
  }
  // Framed on every placeable house, whatever is shown, so filtering never moves the map.
  const allPoints = [...points.values()];
  const [mapX, mapY, mapWidth, mapHeight] = MAP.viewBox;
  const markers = svgEl('g', { class: 'markers' });
  // Places are context, not houses: never filtered, never framed on, and drawn beneath the houses so a house wins a shared tap.
  const places = svgEl('g', { class: 'places' });
  const placePoints = new Map();
  for (const poi of pois) {
    const point = mapPoint(poi.latitude, poi.longitude, MAP);
    if (point === null) continue;
    placePoints.set(poi.id, point);
    places.append(placeMarker(poi, point));
  }
  // The camera: the part of the map in view, as [x, y, width, height] in map units.
  // The base map is redrawn only when a gesture ends (committed); while one is under way it is moved as a picture
  // to show live, since redrawing every path of map.svg each frame cannot keep up with a finger.
  let live = clampMapView(fitMapView(allPoints, MAP_INITIAL_ASPECT, MAP), MAP);
  let committed = live;
  // The image's address is set once the map is first measured, so Cards never downloads it.
  const image = svgEl('image', { x: mapX, y: mapY, width: mapWidth, height: mapHeight });
  // Both maps fill the frame, cropping rather than leaving blank bands while the view and the frame differ in shape.
  const base = svgEl('svg', { class: 'base', viewBox: live.join(' '), preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, [image]);
  // The markers lie over the map in the same coordinates and follow every movement, so they stay exact and one size.
  const marks = svgEl('svg', {
    class: 'marks',
    viewBox: live.join(' '),
    preserveAspectRatio: 'xMidYMid slice',
    role: 'group',
    'aria-label': 'Map of shown houses',
  }, [places, markers]);
  const viewport = el('div', { class: 'viewport' }, [base, marks]);
  const reset = el('button', { class: 'reset', type: 'button', 'aria-label': 'Reset map view' }, ['Reset']);
  const preview = el('div', { class: 'preview', 'aria-live': 'polite' });
  // The note and the attribution are laid over the map's lower edge, above the preview when one is open.
  const note = el('p', { class: 'note', hidden: '' });
  const node = el('div', { class: 'map' }, [
    viewport,
    reset,
    note,
    el('p', { class: 'attribution' }, [
      el('small', {}, [
        el('a', { href: MAP.attributionUrl, target: '_blank', rel: 'noreferrer' }, [
          MAP.attribution,
          el('span', { 'aria-hidden': 'true' }),
        ]),
      ]),
    ]),
    preview,
  ]);
  let shownItems = [];

  function showSelected() {
    const item = shownItems.find((shown) => shown.house.id === selected);
    for (const marker of markers.children) marker.setAttribute('aria-pressed', String(marker.dataset.house === selected));
    // The selected house's preview is its Houses card.
    if (item !== undefined) preview.replaceChildren(houseCard(item.house, item.overallFit, today));
    else preview.replaceChildren();
  }

  /**
   * Marks the shown houses that can be placed, and notes how many cannot.
   * @param {Array<{ house: object, overallFit: number|null }>} shown - Houses passing the Show and search filters, in sort order.
   */
  function show(shown) {
    shownItems = shown.filter((item) => points.has(item.house.id));
    markers.replaceChildren();
    let missing = 0;
    let outside = 0;
    for (const { house } of shown) {
      if (points.has(house.id)) markers.append(mapMarker(house, points.get(house.id)));
      else if (house.latitude === null || house.longitude === null) missing += 1;
      else outside += 1;
    }
    // A house filtered out of view can no longer be the selected one.
    if (selected !== null && !shownItems.some((item) => item.house.id === selected)) {
      selected = null;
      onSelect(null);
    }
    // With no marker at all, the note says why in the middle of the map instead of counting in a corner.
    const empty = markers.children.length === 0;
    note.classList.toggle('empty', empty);
    if (shown.length === 0) note.textContent = 'No houses are shown. Change the search or Show to see them here.';
    else if (empty && missing === 0) note.textContent = 'None of the shown houses is inside the map area.';
    else if (empty) note.textContent = 'None of the shown houses has map coordinates yet. Add latitude and longitude in Location & Travel.';
    else note.textContent = unmappedText(missing, outside);
    note.hidden = note.textContent === '';
    showSelected();
  }

  /**
   * Selects a house from its marker, showing its preview.
   * @param {Element} marker - The chosen marker.
   */
  function choose(marker) {
    selected = marker.dataset.house;
    onSelect(selected);
    showSelected();
  }

  // When the last drag or pinch ended: the click that closes it must not choose the marker it began on.
  let dragEnded = -Infinity;

  markers.addEventListener('click', function handleMarkerClick(event) {
    const marker = event.target.closest('.marker');
    if (marker !== null && event.timeStamp - dragEnded > DRAG_CLICK_MS) choose(marker);
  });
  markers.addEventListener('keydown', function handleMarkerKey(event) {
    const marker = event.target.closest('.marker');
    if (marker === null || (event.key !== 'Enter' && event.key !== ' ')) return;
    // Space would otherwise scroll the page.
    event.preventDefault();
    choose(marker);
  });
  preview.addEventListener('click', clickCard);

  /**
   * Shows a place's title, or hides it when it is already showing; only one title shows at a time.
   * @param {Element} place - The chosen place marker.
   */
  function togglePlace(place) {
    const open = place.getAttribute('aria-pressed') !== 'true';
    for (const other of places.children) other.setAttribute('aria-pressed', String(open && other === place));
  }

  places.addEventListener('click', function handlePlaceClick(event) {
    const place = event.target.closest('.place');
    if (place !== null && event.timeStamp - dragEnded > DRAG_CLICK_MS) togglePlace(place);
  });
  places.addEventListener('keydown', function handlePlaceKey(event) {
    const place = event.target.closest('.place');
    if (place === null || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    togglePlace(place);
  });

  // The frame's size in CSS pixels, once measured; the frame's shape is set in CSS.
  let frame = null;
  let frameRequest = 0;
  let settle = false;

  /**
   * Draws the camera: the markers at the live view, and the base map moved from where it was last drawn to match.
   */
  function paint() {
    frameRequest = 0;
    if (frame === null) return;
    if (settle) {
      settle = false;
      committed = live;
      base.setAttribute('viewBox', committed.join(' '));
    }
    marks.setAttribute('viewBox', live.join(' '));
    marks.style.setProperty('--unit', String(live[2] / frame.width));
    if (committed === live) {
      base.style.transform = '';
      return;
    }
    const scale = committed[2] / live[2];
    const x = ((committed[0] - live[0]) * frame.width) / live[2];
    const y = ((committed[1] - live[1]) * frame.height) / live[3];
    base.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  /**
   * Shows a new view on the next frame.
   * @param {number[]} view - View as [x, y, width, height].
   */
  function moveTo(view) {
    live = view;
    if (frameRequest === 0) frameRequest = requestAnimationFrame(paint);
  }

  /**
   * Shows a view and redraws the base map sharp at it, as when a gesture ends.
   * @param {number[]} view - View as [x, y, width, height].
   */
  function commit(view) {
    settle = true;
    moveTo(view);
  }

  /**
   * Slides a view just enough to keep a marker inside it.
   * @param {number[]} view - View as [x, y, width, height].
   * @param {number} unit - Map units per CSS pixel.
   * @param {{ x: number, y: number }|undefined} point - The marker's map position; undefined leaves the view as it is.
   * @returns {number[]} The view, moved if the marker would be outside it.
   */
  function keepInView(view, unit, point) {
    if (point === undefined) return view;
    const margin = MARKER_TARGET_RADIUS * unit;
    let [x, y] = view;
    x = Math.min(Math.max(x, point.x + margin - view[2]), point.x - margin);
    y = Math.min(Math.max(y, point.y + margin - view[3]), point.y - margin);
    return clampMapView([x, y, view[2], view[3]], MAP);
  }

  // Fitted to the houses when first measured. After that a new size keeps the scale and the top-left corner,
  // so the map stays put when the preview opens beneath it. While Cards are shown the map measures zero, so it waits.
  const observer = new ResizeObserver(function measure(entries) {
    const { width, height } = entries[0].contentRect;
    if (width === 0 || height === 0) return;
    let view;
    if (frame === null) {
      image.setAttribute('href', 'map/map.svg');
      view = clampMapView(fitMapView(allPoints, width / height, MAP), MAP);
    } else {
      const unit = live[2] / frame.width;
      view = keepInView(clampMapView([live[0], live[1], width * unit, height * unit], MAP), unit, points.get(selected));
    }
    frame = { width, height };
    commit(view);
  });
  observer.observe(viewport);

  // A marker reached with Tab may lie outside the view, so the map slides to show it. A tap never moves the map.
  marks.addEventListener('focusin', function revealFocused(event) {
    const marker = event.target.closest('.marker, .place');
    if (frame === null || marker === null || !marker.matches(':focus-visible')) return;
    const point = marker.dataset.house === undefined ? placePoints.get(marker.dataset.place) : points.get(marker.dataset.house);
    const view = keepInView(live, live[2] / frame.width, point);
    if (view.some((value, index) => value !== live[index])) commit(view);
  });

  reset.addEventListener('click', function resetView() {
    if (frame !== null) commit(clampMapView(fitMapView(allPoints, frame.width / frame.height, MAP), MAP));
  });

  // Pointers on the map, by id, at their latest position in CSS pixels from the frame's top-left corner.
  const pointers = new Map();
  // Where the frame's corner is on screen, read when a gesture starts; the frame does not move during one.
  let origin = null;
  // The view, map position, and finger spread the gesture is measured from, retaken whenever a finger is added or lifted.
  let gesture = null;
  let downPoint = null;
  let moved = false;
  let lastTap = null;

  /**
   * Finds a pointer event's position in the frame.
   * @param {PointerEvent|WheelEvent} event - Event over the map.
   * @returns {{ x: number, y: number }} Position in CSS pixels from the frame's top-left corner.
   */
  function framePoint(event) {
    return { x: event.clientX - origin.x, y: event.clientY - origin.y };
  }

  function readOrigin() {
    const rect = viewport.getBoundingClientRect();
    origin = { x: rect.left + viewport.clientLeft, y: rect.top + viewport.clientTop };
  }

  /**
   * Measures the pointers: the point a gesture follows, and for two, how far apart they are.
   * @returns {{ point: { x: number, y: number }, spread: number|null }} One pointer's position or two pointers' midpoint, and their spread.
   */
  function pointerSpan() {
    const [a, b] = pointers.values();
    if (b === undefined) return { point: a, spread: null };
    return { point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, spread: Math.hypot(b.x - a.x, b.y - a.y) };
  }

  // Measuring from the view as it is now, rather than from the gesture's start, keeps the map from jumping.
  function rebase() {
    const { point, spread } = pointerSpan();
    gesture = { start: live, anchor: mapPointAt(live, point, frame), spread };
  }

  /**
   * Keeps a pointer's events coming to the map even off the frame. A pointer the browser has already let go cannot be
   * captured; its pointerup or pointercancel is on its way, so that is not an error.
   * @param {number} id - Pointer id.
   */
  function capture(id) {
    try {
      viewport.setPointerCapture(id);
    } catch {
      // Already released.
    }
  }

  // From here the map follows the pointers wherever they go.
  function startMoving() {
    moved = true;
    viewport.classList.add('dragging');
    for (const id of pointers.keys()) capture(id);
  }

  /**
   * Zooms in around a second tap close after the first; otherwise remembers the tap.
   * @param {{ x: number, y: number }} point - Where the tap was, in the frame.
   * @param {number} time - When the tap ended.
   */
  function tapMap(point, time) {
    if (lastTap !== null && time - lastTap.time < DOUBLE_TAP_MS && Math.hypot(point.x - lastTap.point.x, point.y - lastTap.point.y) < DOUBLE_TAP_SLOP) {
      lastTap = null;
      commit(gestureMapView(live, mapPointAt(live, point, frame), point, DOUBLE_TAP_ZOOM, frame, MAP));
      return;
    }
    lastTap = { point, time };
  }

  viewport.addEventListener('pointerdown', function startGesture(event) {
    if (frame === null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (pointers.size === 0) {
      readOrigin();
      moved = false;
      downPoint = framePoint(event);
    }
    pointers.set(event.pointerId, framePoint(event));
    // A second finger makes it a pinch, which is never a tap.
    if (pointers.size > 1 && !moved) startMoving();
    else if (moved) capture(event.pointerId);
    rebase();
  });

  viewport.addEventListener('pointermove', function followPointers(event) {
    if (!pointers.has(event.pointerId)) return;
    const point = framePoint(event);
    pointers.set(event.pointerId, point);
    if (!moved) {
      // Small movements are still a tap; once past them, the map follows from here, so it does not jump.
      if (Math.hypot(point.x - downPoint.x, point.y - downPoint.y) <= TAP_SLOP) return;
      startMoving();
      rebase();
    }
    const span = pointerSpan();
    const scale = gesture.spread === null || span.spread === null ? 1 : span.spread / gesture.spread;
    moveTo(gestureMapView(gesture.start, gesture.anchor, span.point, scale, frame, MAP));
  });

  /**
   * Lets go of a pointer: the gesture carries on with the rest, or ends, redrawing the map sharp or taking a tap.
   * @param {PointerEvent} event - The pointerup or pointercancel.
   */
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size > 0) {
      rebase();
      return;
    }
    gesture = null;
    if (moved) {
      viewport.classList.remove('dragging');
      dragEnded = event.timeStamp;
      commit(live);
    } else if (event.type === 'pointerup' && event.target.closest('.marker, .place') === null) {
      tapMap(downPoint, event.timeStamp);
    }
  }

  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  let wheelTimer = null;
  viewport.addEventListener('wheel', function zoomWithWheel(event) {
    if (frame === null) return;
    if (wheelTimer === null) readOrigin();
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= WHEEL_LINE_HEIGHT;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= frame.height;
    delta = Math.min(Math.max(delta, -WHEEL_MAX_DELTA), WHEEL_MAX_DELTA);
    // Browsers report a trackpad pinch as a wheel event with Control held.
    const rate = event.ctrlKey ? PINCH_ZOOM_RATE : WHEEL_ZOOM_RATE;
    const point = framePoint(event);
    const view = gestureMapView(live, mapPointAt(live, point, frame), point, Math.exp(-delta * rate), frame, MAP);
    // At a zoom limit the wheel is left to the page; a pinch never is, or it would zoom the whole page instead.
    const changed = view.some((value, index) => value !== live[index]);
    if (!changed && !event.ctrlKey) return;
    event.preventDefault();
    if (!changed) return;
    moveTo(view);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function settleWheel() {
      wheelTimer = null;
      commit(live);
    }, WHEEL_SETTLE_MS);
  }, { passive: false });

  return { node, show };
}

/**
 * Builds the Houses collection view, ordered by the chosen sort, grouped by status unless turned off.
 * @param {{ settings: object, houses: Array<object>, pois: Array<object> }} data - Current app data.
 * @param {{ sort: string, grouped: boolean, hidden: string[] }} prefs - This device's sort choice, status grouping, and hidden statuses.
 * @param {function({ sort: string, grouped: boolean, hidden: string[] }): void} onPrefsChange - Called with new preferences to remember.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @param {{ selection: string[]|null, onSelectionChange: Function, onCompare: Function }} compare - Ticked ids, or null when not comparing, and handlers.
 * @param {{ mode: string, selected: string|null, onChange: Function }} layout - Cards or Map, the house selected on the map, and the handler that remembers them.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderHouses(data, prefs, onPrefsChange, today, compare, layout) {
  if (data.houses.length === 0) {
    return el('section', { class: 'collection' }, [
      pageTitle('Houses'),
      el('div', { class: 'card empty' }, [
        el('p', { class: 'title' }, ['No houses yet.']),
        el('p', { class: 'text' }, ['Add the first one when something looks worth considering.']),
        el('a', { class: 'button primary', href: '#/add' }, ['Add House']),
      ]),
    ]);
  }

  const items = [];
  const counts = {};
  for (const house of data.houses) {
    items.push({ house, overallFit: evaluate(house, data.settings).overallFit, daysOnMarket: daysOnMarket(house, today) });
    counts[house.status] = (counts[house.status] || 0) + 1;
  }
  let current = prefs;

  // One show/hide checkbox per status that has houses, always in status order.
  const statusToggles = [];
  for (const status of STATUSES) {
    if (counts[status] === undefined) continue;
    const input = el('input', { type: 'checkbox', name: 'show', value: status, checked: current.hidden.includes(status) ? null : '' });
    statusToggles.push(el('label', {}, [input, el('span', {}, [`${STATUS_LABELS[status]} (${counts[status]})`])]));
  }
  const sortSelect = el('select', { name: 'sort' });
  for (const value of SORT_OPTIONS) {
    sortSelect.append(el('option', { value, selected: value === current.sort ? '' : null }, [SORT_LABELS[value]]));
  }
  // Searching narrows the cards by address for now; unlike the sort and Show choices, it is not remembered.
  const search = el('input', { type: 'search', name: 'search', placeholder: 'Search by address', autocomplete: 'off', spellcheck: 'false' });
  // An option on the sort itself, so it sits with the menu rather than with the Show filters.
  const groupInput = el('input', { type: 'checkbox', name: 'grouped', checked: current.grouped ? '' : null });
  // One Compare control: it starts choosing, counts the ticked houses, and opens the comparison at two.
  // The hidden sizer holds the widest label, so the control keeps one width as its count changes.
  const compareLabel = el('span', { class: 'label' }, ['Compare']);
  const compareButton = el('button', { class: 'button compare', type: 'button' }, [
    compareLabel,
    el('span', { class: 'sizer', 'aria-hidden': 'true' }, ['Compare · 0/2']),
  ]);
  const cancel = el('button', { class: 'button cancel dismiss', type: 'button', hidden: '' }, ['Cancel']);
  const tools = el('div', { class: 'tools' }, [cancel, compareButton]);
  // On a phone, Show and Sort open as dialogs from these buttons; wider screens show both in full.
  // Both name the current choice, and Show also switches on while a status is hidden.
  const showLabel = el('span');
  const showButton = el('button', { class: 'button trigger', type: 'button', popovertarget: 'show-options' }, [showLabel]);
  const sortLabel = el('span');
  const sortButton = el('button', { class: 'button trigger', type: 'button', popovertarget: 'sort-options' }, [sortLabel]);
  const controls = el('div', { class: 'controls' }, [
    el('label', { class: 'search' }, [el('span', { class: 'visually-hidden' }, ['Search by address']), search]),
    showButton,
    el('fieldset', { class: 'show', id: 'show-options', popover: '' }, [
      el('legend', {}, ['Show']),
      el('div', { class: 'statuses' }, statusToggles),
      closeButton('show-options'),
    ]),
    sortButton,
    el('div', { class: 'sort', id: 'sort-options', popover: '' }, [
      el('label', { class: 'menu' }, [el('span', {}, ['Sort']), sortSelect]),
      el('label', { class: 'grouping' }, [groupInput, el('span', {}, ['Group by status'])]),
      closeButton('sort-options'),
    ]),
    tools,
  ]);
  const list = el('ul', { class: 'houses' });
  const note = el('p', { class: 'muted note', hidden: '' });

  // Cards and Map are two views of the same shown houses; the choice lasts while the app is open.
  let mode = layout.mode;
  let mapSelected = layout.selected;
  const viewOptions = [];
  for (const [value, text] of [['cards', 'Cards'], ['map', 'Map']]) {
    const input = el('input', { type: 'radio', name: 'view', value, checked: value === mode ? '' : null });
    viewOptions.push(el('label', {}, [input, el('span', {}, [text])]));
  }
  // The two choices name themselves; the caption stays for screen readers.
  const viewSwitch = el('fieldset', { class: 'view' }, [el('legend', { class: 'visually-hidden' }, ['View']), ...viewOptions]);
  const map = houseMap(items, mapSelected, function rememberSelected(id) {
    mapSelected = id;
    layout.onChange({ mode, selected: mapSelected });
  }, today, data.pois);
  const view = el('section', { class: 'collection', 'data-view': mode }, [el('header', {}, [pageTitle('Houses'), viewSwitch])]);

  // Choosing two houses to compare: ids in the order they were ticked, or null when not choosing.
  let selection = compare.selection;

  function showSelection() {
    const choosing = selection !== null;
    const full = choosing && selection.length === 2;
    cancel.hidden = !choosing;
    // Comparing needs two houses, so the control only appears once there are two to choose from.
    tools.hidden = !choosing && data.houses.length < 2;
    compareLabel.textContent = choosing ? `Compare · ${selection.length}/2` : 'Compare';
    compareButton.classList.toggle('primary', full);
    // Until two are ticked the control shows progress but cannot open anything; it stays focusable and readable.
    if (choosing && !full) compareButton.setAttribute('aria-disabled', 'true');
    else compareButton.removeAttribute('aria-disabled');
    // Two is the limit: once two are ticked, the rest cannot be.
    for (const input of list.querySelectorAll('.pick')) input.disabled = full && !input.checked;
  }

  // Every word typed must appear somewhere in the address, in any order and any case.
  function matchesSearch(house) {
    const address = house.address.toLowerCase();
    return search.value.toLowerCase().split(/\s+/).every((term) => address.includes(term));
  }

  function showChoices() {
    const present = Object.keys(counts);
    const shown = present.filter((status) => !current.hidden.includes(status)).length;
    const filtered = shown < present.length;
    showButton.classList.toggle('filtered', filtered);
    showLabel.textContent = filtered ? `Show: ${shown}/${present.length}` : 'Show: All';
    if (filtered) showButton.setAttribute('aria-label', `Show: ${shown} of ${present.length} statuses`);
    else showButton.removeAttribute('aria-label');
    sortLabel.textContent = `Sort: ${SORT_SHORT_LABELS[current.sort]}`;
    // The arrow reads poorly aloud, so the button is named with the menu's full wording.
    sortButton.setAttribute('aria-label', `Sort: ${SORT_LABELS[current.sort]}`);
  }

  function draw() {
    const shown = [];
    for (const item of sortForCollection(items, current.sort, current.grouped)) {
      if (!current.hidden.includes(item.house.status) && matchesSearch(item.house)) shown.push(item);
    }
    list.replaceChildren();
    for (const item of shown) {
      const pick = selection === null ? null : { checked: selection.includes(item.house.id) };
      list.append(el('li', {}, [houseCard(item.house, item.overallFit, today, pick)]));
    }
    map.show(shown);
    showChoices();
    note.hidden = shown.length > 0;
    const allHidden = Object.keys(counts).every((status) => current.hidden.includes(status));
    note.textContent = allHidden
      ? 'Every status is turned off. Turn one back on to see its houses.'
      : `No shown house has an address matching “${search.value.trim()}”.`;
    showSelection();
  }

  /**
   * Starts or stops choosing houses to compare, redrawing the cards as checkboxes or links.
   * @param {string[]|null} next - Ticked ids to start with, or null to stop choosing.
   */
  function setSelection(next) {
    selection = next;
    compare.onSelectionChange(selection);
    draw();
  }

  /**
   * Adds or removes a ticked house, keeping the order the houses were ticked in.
   * @param {Event} event - Change event from a card's checkbox.
   */
  function handlePick(event) {
    const input = event.target;
    const next = [];
    for (const id of selection) {
      if (id !== input.value) next.push(id);
    }
    if (input.checked) next.push(input.value);
    selection = next;
    compare.onSelectionChange(selection);
    showSelection();
  }

  compareButton.addEventListener('click', function handleCompare() {
    if (selection === null) setSelection([]);
    else if (selection.length === 2) compare.onCompare(selection[0], selection[1]);
  });
  cancel.addEventListener('click', function stopComparing() {
    setSelection(null);
    if (!tools.hidden) compareButton.focus();
  });
  list.addEventListener('change', handlePick);
  list.addEventListener('click', clickCard);

  function handleChange(event) {
    // The search redraws as it is typed and is not a preference.
    if (event.target === search) return;
    const hidden = [];
    for (const input of controls.querySelectorAll('input[name="show"]')) {
      if (!input.checked) hidden.push(input.value);
    }
    // Keep hidden statuses that currently have no houses, so the choice survives their return.
    for (const status of current.hidden) {
      if (counts[status] === undefined) hidden.push(status);
    }
    current = { sort: sortSelect.value, grouped: groupInput.checked, hidden };
    onPrefsChange(current);
    draw();
  }

  function showMode() {
    view.dataset.view = mode;
  }

  viewSwitch.addEventListener('change', function switchView(event) {
    mode = event.target.value;
    layout.onChange({ mode, selected: mapSelected });
    // Choosing houses to compare happens on the cards, so leaving them ends it.
    if (mode === 'map' && selection !== null) setSelection(null);
    // The map is fitted when first measured, so it waits for its styles; showMode applies the latest choice.
    const loading = mode === 'map' ? loadStylesheets([MAP_STYLESHEET]) : null;
    if (loading === null) showMode();
    else loading.then(showMode);
  });
  controls.addEventListener('change', handleChange);
  search.addEventListener('input', draw);
  draw();
  view.append(controls, list, map.node, note);
  return view;
}

/* --------------------------------------------------------------------------
   House Detail
   -------------------------------------------------------------------------- */

const MISSING_TEXT = {
  [MISSING_INTEREST_RATE]: 'needs an interest rate in Settings',
  [MISSING_POINTS]: 'needs points in Settings or on this house',
  [MISSING_HOA]: 'HOA not known yet',
  [MISSING_SOLAR]: 'solar not known yet',
  [MISSING_PROJECT_ANSWERS]: 'some project areas not answered yet',
  [MISSING_PROJECT_COST]: 'a Need to fix project has no cost',
  [MISSING_WANT_COST]: 'a Want to fix project has no cost',
  [MISSING_MAXIMUM_PRICE]: 'needs a maximum purchase price in Settings',
};

const UNAVAILABLE_TEXT = {
  [STABILITY_NO_FINANCIAL_SCORE]: 'Needs a monthly cost or cash-to-close score. Check Settings and the financial inputs.',
  [STABILITY_UNCOSTED_WORK]: 'A Need to fix project has no cost yet.',
};

/**
 * Words a yes/no answer.
 * @param {string|null} answer - YES, NO, or null.
 * @returns {string} "Yes", "No", or "Unknown".
 */
function answerText(answer) {
  if (answer === YES) return 'Yes';
  if (answer === NO) return 'No';
  return 'Unknown';
}

/**
 * Words a multi-select selection with its option labels.
 * @param {string} name - Field name, for its option labels.
 * @param {string[]} selection - Selected options; empty means None.
 * @returns {string} Labels joined with commas, or "None".
 */
function selectionText(name, selection) {
  if (selection.length === 0) return 'None';
  const labels = [];
  for (const option of selection) labels.push(OPTION_LABELS[name][option]);
  return labels.join(', ');
}

/**
 * Words a stored property value using its field's layout, for read-only display.
 * @param {{ name: string, prefix?: string, suffix?: string, plain?: boolean }} field - Field layout from HOUSE_SECTIONS.
 * @param {*} value - Stored value; assumed known.
 * @returns {string} Display text such as "$475,000", "8 min", "Detached", or "Pantry, Cabinetry".
 */
function fieldText(field, value) {
  const kind = HOUSE_FIELDS[field.name].kind;
  if (kind === TEXT) return value;
  if (kind === TRI) return answerText(value);
  if (kind === SELECT) return OPTION_LABELS[field.name][value];
  if (kind === MULTI) return selectionText(field.name, value);
  if (field.plain || field.coordinate) return String(value);
  const number = field.prefix === '$' ? formatMoney(value) : formatNumber(value);
  return field.suffix ? `${number} ${field.suffix}` : number;
}

/**
 * Describes the observation behind one scored criterion, raw fact first.
 * @param {{ type: string, field: string|null, unit: string|null, value: * }} criterion - Criterion from an evaluation.
 * @returns {string} Display text such as "8 min", "Upper", or "Garage, no power".
 */
function observationText(criterion) {
  const { type, field, unit, value } = criterion;
  switch (type) {
    case 'yes':
    case 'no':
    case 'option':
    case 'irrigation':
    case 'garageWorkspace':
    case 'coveredRoute':
      return answerText(value);
    case 'curve':
      return `${formatNumber(value)} ${unit}`;
    case 'map':
      return OPTION_LABELS[field][value];
    case 'ongoingCost':
      return `${formatMoney(value.initialMonthlyCost)}/mo, ${formatMoney(value.postRecastMonthlyCost)}/mo after recast`;
    case 'cashToClose':
      return `${formatMoney(value)} cash to close`;
    case 'requiredWorkCushion':
      if (value.work === 0) return 'No required work';
      return `${formatMoney(value.work)} of ${formatMoney(value.cushion)} cushion`;
    case 'garage': {
      if (value.garage === null) return 'No garage';
      const kind = OPTION_LABELS.parking[value.garage];
      if (value.power === null) return `${kind}, power unknown`;
      return value.power === YES ? `${kind} with power` : `${kind}, no power`;
    }
    case 'functionalEntry':
      return `${value} of 3: shoes, coat, purse`;
    case 'parkingCombination':
      return selectionText('parking', value);
    case 'foodStorage':
      return selectionText('foodStorage', value);
    case 'windowPrivacy':
      return selectionText('bedroomWindowExposure', value);
    case 'safeOutdoor':
      return selectionText('safeOutdoor', value);
    case 'creativeAuthorship':
      return `${value.excited} exciting, ${value.unwanted} not exciting`;
    default:
      return '';
  }
}

/**
 * Builds a thin bar showing a 0–100 score.
 * @param {number} score - Score from 0 to 100.
 * @returns {HTMLElement} The bar.
 */
function scoreBar(score) {
  return el('span', { class: 'bar', style: `--score: ${score.toFixed(1)}`, 'aria-hidden': 'true' }, [el('span')]);
}

/**
 * Draws one arc of a ring as an SVG path.
 * @param {number} start - Start angle in degrees, clockwise from the top.
 * @param {number} end - End angle in degrees.
 * @param {string} className - Class for the path, which sets its color.
 * @returns {SVGPathElement} The arc.
 */
function ringArc(start, end, className) {
  const radius = 50;
  /**
   * Converts an angle to a point on the ring.
   * @param {number} degrees - Angle clockwise from the top.
   * @returns {string} "x y" coordinates in the 120 by 120 view box.
   */
  function point(degrees) {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return `${(60 + radius * Math.cos(radians)).toFixed(3)} ${(60 + radius * Math.sin(radians)).toFixed(3)}`;
  }
  const large = end - start > 180 ? 1 : 0;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', `M ${point(start)} A ${radius} ${radius} 0 ${large} 1 ${point(end)}`);
  path.setAttribute('class', className);
  return path;
}

/**
 * Draws the Overall Fit ring: one segment per category, sized by its weight and filled by its score.
 * @param {Array<{ weight: number, score: number|null }>} categories - Scored categories from an evaluation.
 * @returns {SVGSVGElement} The ring, hidden from screen readers because the scores are also given as text.
 */
function fitRing(categories) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const gap = 3;
  let angle = 0;
  for (const category of categories) {
    // Each segment's share of the circle is its share of Overall Fit.
    const span = (category.weight / 100) * 360;
    const start = angle + gap / 2;
    const end = angle + span - gap / 2;
    // An unscored category is left out of Overall Fit, so its arc is hatched rather than an empty zero.
    svg.append(ringArc(start, end, category.score === null ? 'track unscored' : 'track'));
    if (category.score !== null && category.score > 0) {
      svg.append(ringArc(start, start + ((end - start) * category.score) / 100, 'fill'));
    }
    angle += span;
  }
  return svg;
}

/**
 * Builds the rows for a list of criteria: the observation first, the score after it.
 * @param {object[]} criteria - Criteria from an evaluation.
 * @returns {HTMLElement} A list of criteria.
 */
function criteriaList(criteria) {
  const list = el('ul', { class: 'criteria' });
  for (const criterion of criteria) {
    let fact;
    let score = null;
    if (criterion.state === KNOWN) {
      fact = el('span', { class: 'fact' }, [observationText(criterion)]);
      score = el('span', { class: 'score' }, [scoreText(criterion.score)]);
    } else if (criterion.state === NOT_APPLICABLE) {
      fact = el('span', { class: 'fact muted' }, ['Not applicable']);
    } else {
      fact = el('span', { class: 'fact muted' }, ['Unknown']);
    }
    list.append(el('li', {}, [el('span', { class: 'name' }, [criterion.label]), fact, score]));
  }
  return list;
}

/**
 * Builds a summary row: name, then a score with its bar, or an unavailable note.
 * @param {string} name - Category or subcategory name.
 * @param {number|null} score - Score, or null when it cannot be scored.
 * @param {string} [unavailable] - Note shown in place of a missing score.
 * @param {number|null} [weight] - A category's share of Overall Fit, shown under its name; null for subcategories.
 * @returns {HTMLElement} The summary element.
 */
function scoreSummary(name, score, unavailable = 'Nothing known yet', weight = null) {
  let share = null;
  if (weight !== null) {
    share = el('span', { class: 'weight' }, [score === null ? `${weight}% of Overall Fit · not counted` : `${weight}% of Overall Fit`]);
  }
  if (score === null) {
    return el('summary', { class: 'disclosure' }, [el('span', { class: 'name' }, [name]), share, el('span', { class: 'value muted' }, [unavailable])]);
  }
  return el('summary', { class: 'disclosure' }, [
    el('span', { class: 'name' }, [name]),
    share,
    el('span', { class: 'value' }, [scoreText(score)]),
    scoreBar(score),
  ]);
}

/**
 * Explains the delight bonus: which features earned it and how much it added to Overall Fit.
 * @param {{ delights: string[], delightBonus: number, weightedFit: number|null, overallFit: number|null }} evaluation - Result of evaluate.
 * @returns {HTMLElement|null} The note, or null when the house has no delight features.
 */
function delightNote(evaluation) {
  const { delights, delightBonus, weightedFit, overallFit } = evaluation;
  if (delights.length === 0) return null;
  const names = [];
  for (const { id, label } of DELIGHTS) {
    if (delights.includes(id)) names.push(label.toLowerCase());
  }
  if (weightedFit === null) return el('p', { class: 'delights' }, [`Delights: ${names.join(', ')} · added once Overall Fit appears`]);
  // Overall Fit is capped at 100, so it says how much of the bonus was actually added; judged as shown, to a tenth.
  const added = Math.round((overallFit - weightedFit) * 10) / 10;
  const capped = added < Math.round(delightBonus * 10) / 10 ? ' (capped at 100)' : '';
  return el('p', { class: 'delights' }, [`Includes +${formatNumber(added)}${capped}: ${names.join(', ')}`]);
}

/**
 * Builds the Overall Fit card: the number, the ring, completeness, and the category drill-down.
 * @param {object} evaluation - Result of evaluate for the house.
 * @returns {HTMLElement} The card.
 */
function fitCard(evaluation) {
  const { overallFit, completeness, categories } = evaluation;
  const number =
    overallFit === null
      ? el('p', { class: 'overall unavailable' }, [el('span', { class: 'label' }, ['Overall Fit not available yet'])])
      : el('p', { class: 'overall' }, [
        el('span', { class: 'number' }, [scoreText(overallFit)]),
        el('span', { class: 'label' }, ['Overall Fit']),
      ]);

  const list = el('div', { class: 'categories' });
  for (const category of categories) {
    const reason = category.unavailableReason ? UNAVAILABLE_TEXT[category.unavailableReason] : undefined;
    const details = el('details', { class: 'category' }, [scoreSummary(category.label, category.score, reason, category.weight)]);
    if (category.score !== null) {
      // Points earned toward Overall Fit, out of the most this category can give.
      const points = formatNumber(Math.round(category.weight * category.score / 10) / 10);
      details.append(el('p', { class: 'contribution' }, [`Contribution to Overall Fit: ${points} / ${category.weight}`]));
    }
    for (const subcategory of category.subcategories) {
      // Contentment and Creative Authorship have no subcategory level of their own.
      if (subcategory.implicit) {
        details.append(criteriaList(subcategory.criteria));
        continue;
      }
      details.append(
        el('details', { class: 'subcategory' }, [scoreSummary(subcategory.label, subcategory.score), criteriaList(subcategory.criteria)]),
      );
    }
    list.append(details);
  }

  return el('section', { class: 'card fit' }, [
    el('h2', {}, ['Fit']),
    el('div', { class: 'headline' }, [
      el('div', { class: 'dial' }, [fitRing(categories), number]),
      el('p', { class: 'completeness' }, [`Information · ${percentKnownText(completeness)}`]),
      delightNote(evaluation),
    ]),
    list,
  ]);
}

/**
 * Words a provenance for a breakdown input.
 * @param {string|null} provenance - ENTERED, DEFAULT_ESTIMATE, or null.
 * @returns {string|null} "entered", "estimated", or null when there is nothing to say.
 */
function provenanceText(provenance) {
  if (provenance === ENTERED) return 'entered';
  if (provenance === DEFAULT_ESTIMATE) return 'estimated';
  return null;
}

/**
 * Words a total that may be incomplete: the amount, a known minimum, or Not available.
 * @param {number|null} value - The complete figure, or null when it cannot be calculated.
 * @param {number|null} minimum - A known minimum to show when incomplete, or null.
 * @param {string} [suffix] - Text after the amount, such as "/mo".
 * @returns {string} Text such as "$2,283/mo", "≥$2,113/mo", or "Not available".
 */
function totalText(value, minimum, suffix = '') {
  if (value !== null) return `${formatMoney(value)}${suffix}`;
  if (minimum !== null) return `≥${formatMoney(minimum)}${suffix}`;
  return 'Not available';
}

/**
 * Builds one headline figure of the Costs card, with a known minimum or a reason when incomplete.
 * @param {string} label - What the figure is.
 * @param {number|null} value - The complete figure, or null when it cannot be calculated.
 * @param {number|null} minimum - A known minimum to show when incomplete, or null.
 * @param {string[]} missing - Reason codes for why the figure is incomplete.
 * @param {string} [suffix] - Text after the amount, such as "/mo".
 * @returns {HTMLElement} The figure: its name, then the amount and any reason as the value.
 */
function costFigure(label, value, minimum, missing, suffix = '') {
  return el('div', { class: 'figure' }, [el('dt', { class: 'label' }, [label]), el('dd', {}, costAmount(value, minimum, missing, suffix))]);
}

/**
 * Builds a cost amount, with a known minimum or a reason when it is incomplete.
 * @param {number|null} value - The complete figure, or null when it cannot be calculated.
 * @param {number|null} minimum - A known minimum to show when incomplete, or null.
 * @param {string[]} missing - Reason codes for why the figure is incomplete.
 * @param {string} [suffix] - Text after the amount, such as "/mo".
 * @returns {Array<HTMLElement|null>} The amount, then the reason or null when complete.
 */
function costAmount(value, minimum, missing, suffix = '') {
  let state = null;
  if (value === null) state = minimum === null ? 'muted' : 'partial';
  const amount = el('p', { class: state === null ? 'amount' : `amount ${state}` }, [totalText(value, minimum, suffix)]);
  return [amount, value === null ? reasonNote(missing, 'why') : null];
}

/**
 * Gives the costed part of a project total as the minimum to show while the total is unknown.
 * @param {{ knownCost: number }} work - Result of calculateProjectWork.
 * @returns {number|null} The known cost, or null when nothing is costed yet.
 */
function knownWorkMinimum(work) {
  return work.knownCost > 0 ? work.knownCost : null;
}

/**
 * Lists the five decision figures shown for a house's costs.
 * @param {object} f - Result of calculateFinancing for the house.
 * @returns {Array<{ label: string, value: number|null, minimum: number|null, missing: string[], suffix: string, lowerIsBetter: boolean }>} The figures.
 */
function costFigures(f) {
  const work = f.requiredWork;
  return [
    { label: 'Estimated monthly', value: f.initialMonthlyCost, minimum: f.initialMonthlyKnownSubtotal, missing: f.monthlyMissing, suffix: '/mo', lowerIsBetter: true },
    { label: 'After planned recast', value: f.postRecastMonthlyCost, minimum: f.postRecastKnownSubtotal, missing: f.monthlyMissing, suffix: '/mo', lowerIsBetter: true },
    { label: 'Cash to close', value: f.cashToClose, minimum: null, missing: f.cashToCloseMissing, suffix: '', lowerIsBetter: true },
    { label: 'Immediate required work', value: work.total, minimum: knownWorkMinimum(work), missing: work.missing, suffix: '', lowerIsBetter: true },
    // More room below the maximum purchase price is better, unlike the costs above.
    { label: 'Required work cushion', value: f.requiredWorkCushion, minimum: null, missing: [MISSING_MAXIMUM_PRICE], suffix: '', lowerIsBetter: false },
  ];
}

/**
 * Builds a short note saying why a figure is incomplete.
 * @param {string[]} missing - Reason codes.
 * @param {string} className - Class for the note element.
 * @returns {HTMLElement|null} The note, or null when there is no reason to give.
 */
function reasonNote(missing, className) {
  const reasons = [];
  for (const code of missing) reasons.push(MISSING_TEXT[code]);
  return reasons.length === 0 ? null : el('p', { class: className }, [reasons.join('; ')]);
}

/**
 * Words a breakdown amount, showing credits as subtractions.
 * @param {number|null} amount - Dollars; negative for a credit; null when unknown.
 * @param {string} [suffix] - Text after the amount, such as "/mo".
 * @returns {string} Text such as "$1,300", "−$14,000", or "Unknown".
 */
function amountText(amount, suffix = '') {
  if (amount === null) return 'Unknown';
  return amount < 0 ? `−${formatMoney(-amount)}${suffix}` : `${formatMoney(amount)}${suffix}`;
}

/**
 * Builds one line of the breakdown: a label with any assumption and provenance, then its value.
 * @param {string} label - What the value is.
 * @param {string} value - Formatted value, such as "$1,300" or "7.125%".
 * @param {{ level?: string, detail?: string|null, provenance?: string|null }} [options] - "total" or "subtotal" level, context such as "20%", and provenance.
 * @returns {HTMLElement} The row.
 */
function line(label, value, options = {}) {
  const tag = provenanceText(options.provenance || null);
  return el('div', { class: options.level || null }, [
    el('dt', {}, [
      label,
      options.detail ? el('span', { class: 'detail' }, [options.detail]) : null,
      tag === null ? null : el('span', { class: 'tag' }, [tag]),
    ]),
    el('dd', {}, [value]),
  ]);
}

/**
 * Words which monthly payments are confirmed as zero, so they need no row of their own.
 * @param {object} f - Result of calculateFinancing.
 * @returns {string|null} Text such as "No HOA or solar payment.", or null when neither is zero.
 */
function zeroMonthlyText(f) {
  if (f.monthlyHoa === 0 && f.monthlySolar === 0) return 'No HOA or solar payment.';
  if (f.monthlyHoa === 0) return 'No HOA.';
  if (f.monthlySolar === 0) return 'No solar payment.';
  return null;
}

/**
 * Builds the monthly components shared by the initial and post-recast totals.
 * @param {object} f - Result of calculateFinancing.
 * @param {number|null} principalAndInterest - The principal and interest for this total.
 * @param {boolean} withProvenance - Whether to tag estimated tax and insurance.
 * @returns {HTMLElement[]} Rows; HOA and solar appear only when not zero.
 */
function monthlyParts(f, principalAndInterest, withProvenance) {
  const { inputs } = f;
  const rows = [
    line('Principal & interest', amountText(principalAndInterest)),
    line('Property tax', amountText(f.monthlyPropertyTax), { provenance: withProvenance ? inputs.annualPropertyTax.provenance : null }),
    line('Homeowners insurance', amountText(f.monthlyInsurance), { provenance: withProvenance ? inputs.annualInsurance.provenance : null }),
  ];
  // Zero is said once in a note; unknown keeps its row so it is never mistaken for none.
  if (f.monthlyHoa !== 0) rows.push(line('HOA', amountText(f.monthlyHoa)));
  if (f.monthlySolar !== 0) rows.push(line('Solar', amountText(f.monthlySolar)));
  return rows;
}

/**
 * Words a rate or percentage setting that may not be set.
 * @param {number|null} value - Percentage, or null when not set.
 * @returns {string} Text such as "7.125%" or "Not set".
 */
function percent(value) {
  return value === null ? 'Not set' : `${formatNumber(value)}%`;
}

/**
 * Builds the expanded breakdown: monthly cost, financing terms, cash to close, and cash to acquire.
 * @param {object} f - Result of calculateFinancing for the house.
 * @param {object} settings - Current app settings.
 * @param {number} price - The current listing price the financing uses.
 * @returns {HTMLElement} The disclosure element.
 */
function breakdownDetails(f, settings, price) {
  const { inputs } = f;
  const work = f.requiredWork;
  const zeroMonthly = zeroMonthlyText(f);

  const monthly = el('section', {}, [
    el('h3', {}, ['Monthly housing cost']),
    el('dl', {}, [line('Initial monthly housing cost', totalText(f.initialMonthlyCost, f.initialMonthlyKnownSubtotal, '/mo'), { level: 'total' }), ...monthlyParts(f, f.monthlyPI, true)]),
    el('dl', {}, [line('After planned recast', totalText(f.postRecastMonthlyCost, f.postRecastKnownSubtotal, '/mo'), { level: 'total' }), ...monthlyParts(f, f.postRecastPI, false)]),
    zeroMonthly === null ? null : el('p', { class: 'note' }, [zeroMonthly]),
    f.initialMonthlyCost === null ? reasonNote(f.monthlyMissing, 'note') : null,
  ]);

  const financing = el('section', {}, [
    el('h3', {}, ['Financing']),
    el('dl', {}, [
      line('Purchase price', formatMoney(price), { detail: 'listing price' }),
      line('Down payment', formatMoney(f.downPaymentAmount), { detail: percent(inputs.downPaymentPercent.value), provenance: inputs.downPaymentPercent.provenance }),
      line('Loan amount', formatMoney(f.loanAmount)),
      line('Interest rate', percent(settings.interestRate)),
      line('Loan term', `${formatNumber(settings.loanTermYears)} years`),
      line('Points', percent(inputs.pointsPercent.value), { provenance: inputs.pointsPercent.provenance }),
      line('Planned recast principal', formatMoney(settings.plannedRecastPrincipal)),
      line('Loan balance after recast', amountText(f.recastPrincipal)),
    ]),
  ]);

  const credits = [];
  if (f.sellerCredits !== 0) credits.push(line('Seller credits', amountText(-f.sellerCredits)));
  if (f.lenderCredits !== 0) credits.push(line('Lender credits', amountText(-f.lenderCredits)));
  // Credits larger than the amount due leave nothing to bring, and the total stops at zero.
  const clamped = f.fundsDueFromBorrower !== null && f.fundsDueFromBorrower - f.sellerCredits - f.lenderCredits < 0;
  const cashToClose = totalText(f.cashToClose, null);

  const closing = el('section', {}, [
    el('h3', {}, ['Cash to close']),
    el('dl', {}, [line('Estimated cash to close', cashToClose, { level: 'total' })]),
    f.cashToClose === null ? reasonNote(f.cashToCloseMissing, 'note') : null,
    el('dl', {}, [line('Down payment', formatMoney(f.downPaymentAmount))]),
    el('h4', {}, ['Loan & closing costs']),
    el('dl', {}, [
      line('Points', amountText(f.pointsCost)),
      line('Fixed lender fee', amountText(inputs.fixedLenderFee.value), { provenance: inputs.fixedLenderFee.provenance }),
      line('Third-party fees', amountText(f.thirdPartyFees)),
      line(`Lender's title insurance`, amountText(inputs.titleInsurance.value), { provenance: inputs.titleInsurance.provenance }),
      line('Government fees', amountText(f.governmentFees)),
      line('Subtotal', amountText(f.closingCosts), { level: 'subtotal' }),
    ]),
    el('h4', {}, ['Prepaids & escrow']),
    el('dl', {}, [
      line('Prepaid homeowners insurance', amountText(f.prepaidInsurancePremium), { detail: `${formatNumber(settings.prepaidInsuranceMonths)} mo` }),
      line('Prepaid interest', amountText(f.prepaidInterest), {
        detail: `${formatNumber(inputs.prepaidInterestDays.value)} days`,
        provenance: inputs.prepaidInterestDays.provenance,
      }),
      line('Insurance reserve', amountText(f.initialInsuranceReserve), { detail: `${formatNumber(settings.insuranceReserveMonths)} mo` }),
      line('Property tax reserve', amountText(f.initialTaxReserve), { detail: `${formatNumber(settings.propertyTaxReserveMonths)} mo` }),
      line('Subtotal', amountText(f.prepaidsAndInitialEscrow), { level: 'subtotal' }),
    ]),
    el('h4', {}, ['Credits']),
    credits.length > 0 ? el('dl', {}, credits) : el('p', { class: 'note' }, ['No seller or lender credits.']),
    clamped ? el('p', { class: 'note' }, ['Credits are more than the amount due, so nothing is brought to closing.']) : null,
    el('dl', {}, [line('Estimated cash to close', cashToClose, { level: 'subtotal' })]),
  ]);

  const workText = totalText(work.total, knownWorkMinimum(work));
  const cushion = f.requiredWorkCushion;
  const share = work.total !== null && cushion !== null && cushion > 0 ? `${formatNumber(Math.round((work.total / cushion) * 100))}%` : null;
  const required = el('section', {}, [
    el('h3', {}, ['Required work']),
    el('dl', {}, [
      line('Required work cushion', cushion === null ? 'Not set' : formatMoney(cushion), { level: 'total' }),
      line('Maximum purchase price', settings.maximumPurchasePrice === null ? 'Not set' : formatMoney(settings.maximumPurchasePrice)),
      line('Current listing price', formatMoney(price)),
    ]),
    cushion === null ? el('p', { class: 'note' }, ['Set a maximum purchase price in Settings to see the cushion.']) : null,
    el('dl', {}, [
      line('Immediate required work', workText, { detail: 'Need to fix only' }),
      share === null ? null : line('Share of cushion used', share),
    ]),
    work.total === null ? reasonNote(work.missing, 'note') : null,
  ]);

  // Cash to Acquire adds two separate budgets together, so it is shown for reference and not scored.
  const acquire = el('section', {}, [
    el('h3', {}, ['Cash to acquire']),
    el('p', { class: 'note' }, ['For reference. Cash to close and required work are scored against separate budgets.']),
    el('dl', {}, [
      line('Estimated cash to close', cashToClose),
      line('Immediate required work', workText),
      line('Estimated cash to acquire', totalText(f.cashToAcquire, f.knownCashToAcquire), { level: 'subtotal' }),
    ]),
    f.cashToAcquire === null ? reasonNote(f.cashToAcquireMissing, 'note') : null,
  ]);

  return el('details', { class: 'breakdown' }, [el('summary', { class: 'disclosure' }, ['View breakdown']), monthly, financing, closing, required, acquire]);
}

/**
 * Builds the Costs card: the five decision figures, with the full breakdown on request.
 * @param {object} financing - Result of calculateFinancing for the house.
 * @param {object} settings - Current app settings.
 * @param {number} price - The current listing price the financing uses.
 * @returns {HTMLElement} The card.
 */
function costsCard(financing, settings, price) {
  const f = financing;
  const figures = el('dl', { class: 'figures' });
  for (const figure of costFigures(f)) {
    figures.append(costFigure(figure.label, figure.value, figure.minimum, figure.missing, figure.suffix));
  }

  return el('section', { class: 'card costs' }, [
    el('h2', {}, ['Costs']),
    el('p', { class: 'muted' }, ['Planning estimates, not a lender quote.']),
    figures,
    breakdownDetails(f, settings, price),
  ]);
}

/**
 * Words a project with work marked: its state, cost when known, and excitement for optional work.
 * @param {{ state: string, cost: number|null, excited: string|null }} project - A Want to fix or Need to fix project.
 * @returns {Array<Node|string>} Text and nodes such as "Need to fix · " then the cost in a money span.
 */
function projectText(project) {
  const parts = [PROJECT_STATE_LABELS[project.state]];
  if (project.cost !== null) parts.push(el('span', { class: 'money' }, [formatMoney(project.cost)]));
  if (project.state === PROJECT_WANT && project.excited !== null) parts.push(project.excited === YES ? 'excited' : 'not excited');
  const nodes = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (index > 0) nodes.push(' · ');
    nodes.push(parts[index]);
  }
  return nodes;
}

/**
 * Builds one cost cell of the Projects table: the cost and, for optional work, whether it is exciting.
 * @param {{ state: string, cost: number|null, excited: string|null }} project - A project.
 * @param {string} state - The column's state, PROJECT_WANT or PROJECT_NEED.
 * @returns {HTMLElement} The cell; empty when the project is not in this column.
 */
function projectCostCell(project, state) {
  const cell = el('td', { class: 'cost' });
  if (project.state !== state) return cell;
  cell.append(project.cost === null ? el('p', { class: 'amount muted' }, ['No cost yet']) : el('p', { class: 'amount' }, [formatMoney(project.cost)]));
  if (state === PROJECT_WANT && project.excited !== null) cell.append(el('p', { class: 'note' }, [project.excited === YES ? 'excited' : 'not excited']));
  return cell;
}

/**
 * Words how much of a house's Projects section is known, as the form counts it.
 * @param {object} house - House whose projects to count.
 * @returns {string} Text such as "18 of 22 known".
 */
function projectsProgressText(house) {
  const { known, total } = projectsProgress(house);
  return knownCountText(known, total);
}

/**
 * Builds the Projects card: how much is known, then each area with work, its cost under Want or Need.
 * @param {object} house - House whose projects to show.
 * @returns {HTMLElement} The card.
 */
function projectsCard(house) {
  const rows = [];
  for (const area of PROJECT_AREAS) {
    const project = house.projects[area];
    if (project.state !== PROJECT_WANT && project.state !== PROJECT_NEED) continue;
    rows.push(
      el('tr', {}, [
        el('th', { scope: 'row' }, [el('p', {}, [PROJECT_LABELS[area]]), project.note === '' ? null : el('p', { class: 'note' }, [project.note])]),
        projectCostCell(project, PROJECT_WANT),
        projectCostCell(project, PROJECT_NEED),
      ]),
    );
  }
  // The totals close the table whether or not any work is marked, so a house with unanswered areas still says why.
  const totals = [el('th', { scope: 'row' }, ['Total'])];
  for (const state of [PROJECT_WANT, PROJECT_NEED]) {
    const figure = projectTotalFigure(house, state);
    totals.push(el('td', { class: 'cost' }, costAmount(figure.value, figure.minimum, figure.missing)));
  }
  const none = rows.length === 0 ? el('p', { class: 'muted' }, ['No projects marked.']) : null;
  const table = el('table', {}, [
    el('thead', {}, [
      el('tr', {}, [
        // The area is named by its row, so the column heading would only repeat that; it stays for screen readers.
        el('th', { scope: 'col' }, [el('span', { class: 'visually-hidden' }, ['Area'])]),
        el('th', { scope: 'col', class: 'cost' }, [PROJECT_STATE_LABELS[PROJECT_WANT]]),
        el('th', { scope: 'col', class: 'cost' }, [PROJECT_STATE_LABELS[PROJECT_NEED]]),
      ]),
    ]),
    rows.length > 0 ? el('tbody', {}, rows) : null,
    el('tfoot', {}, [el('tr', {}, totals)]),
  ]);
  return el('section', { class: 'card projects' }, [
    el('h2', {}, ['Projects']),
    el('p', { class: 'muted' }, [projectsProgressText(house)]),
    none,
    table,
  ]);
}

/**
 * Rates how complete a section is, for coloring its progress pill.
 * @param {number} known - Known applicable fields.
 * @param {number} total - Applicable fields.
 * @returns {string} "complete" when all are known, "low" when half or more are missing, otherwise "partial".
 */
export function progressLevel(known, total) {
  if (known === total) return 'complete';
  if (total - known >= total / 2) return 'low';
  return 'partial';
}

/**
 * Builds one read-only property section listing every applicable field, with a dash for unknowns.
 * @param {object} section - Section layout from HOUSE_SECTIONS.
 * @param {object} house - House to describe.
 * @returns {HTMLElement} A collapsible section.
 */
function propertySection(section, house) {
  const counted = [];
  const rows = [];
  for (const field of section.fields) {
    if (field.counts !== false) counted.push(field.name);
    // The photo itself is shown at the top, so its address adds nothing here.
    if (field.name === 'imageUrl') continue;
    if (!isFieldApplicable(house, field.name)) continue;
    const fact = isFieldKnown(house, field.name)
      ? el('dd', {}, [fieldText(field, house[field.name])])
      : el('dd', { class: 'muted' }, ['—']);
    rows.push(el('div', {}, [el('dt', {}, [field.label]), fact]));
    // The MLS number is the house's id, so it is not a counted field, but it reads as one beside the address.
    if (field.name === 'address') {
      const number = isMlsNumber(house.id) ? el('dd', {}, [house.id]) : el('dd', { class: 'muted' }, ['—']);
      rows.push(el('div', {}, [el('dt', {}, ['MLS number']), number]));
    }
  }
  const { known, total } = sectionProgress(house, counted);
  return el('details', { class: 'section' }, [
    el('summary', { class: 'disclosure' }, [
      el('h3', {}, [section.title]),
      el('span', { class: 'progress', 'data-level': progressLevel(known, total) }, [knownCountText(known, total)]),
    ]),
    rows.length > 0 ? el('dl', { class: 'facts' }, rows) : null,
  ]);
}

/**
 * Words a change from the previous listing price, with a true minus sign for drops.
 * @param {number|null} change - Dollars up or down, or null for the first entry.
 * @returns {string} Text such as "−$6,000", "+$5,000", "No change", or "First listed".
 */
function changeText(change) {
  if (change === null) return 'First listed';
  if (change === 0) return 'No change';
  return signedMoney(change);
}

/**
 * Builds the Listing card: status, Listing Date, Days on Market, and the listing-price history.
 * @param {object} house - House to describe.
 * @param {string} today - Today's date as YYYY-MM-DD.
 * @returns {HTMLElement} The card.
 */
function listingCard(house, today) {
  const days = daysOnMarket(house, today);
  /**
   * Builds one row of the listing facts.
   * @param {string} term - What the row describes.
   * @param {Array<Node|string|null>} value - Contents of the value.
   * @returns {HTMLElement} The row.
   */
  function row(term, value) {
    return el('div', {}, [el('dt', {}, [term]), el('dd', {}, value)]);
  }
  const facts = [row('Status', [STATUS_LABELS[house.status]])];
  if (house.status !== STATUS_AVAILABLE && house.statusDate !== null) {
    facts.push(row(STATUS_DATE_LABELS[house.status], [formatDate(house.statusDate)]));
  }
  facts.push(row('Listed', [formatDate(house.listingDate)]));
  facts.push(row('Days on market', [days === null ? '—' : countText(days, 'day', 'days')]));

  const rows = [];
  for (const entry of priceHistoryChanges(house)) {
    rows.push(
      el('tr', {}, [
        el('td', {}, [formatDate(entry.date)]),
        el('td', { class: 'amount' }, [formatMoney(entry.price)]),
        el('td', { class: 'change' }, [changeText(entry.change)]),
      ]),
    );
  }
  const history = el('table', { class: 'history' }, [
    el('caption', {}, ['Listing price history']),
    el('thead', {}, [
      el('tr', {}, [
        el('th', { scope: 'col' }, ['Date']),
        el('th', { scope: 'col' }, ['Price']),
        el('th', { scope: 'col' }, ['Change']),
      ]),
    ]),
    el('tbody', {}, rows),
  ]);
  return el('section', { class: 'card listing' }, [el('h2', {}, ['Listing']), el('dl', { class: 'facts' }, facts), history]);
}

/**
 * Builds the House Detail view: the house, how it fits, what it costs, and everything known about it.
 * @param {object} house - The house to show.
 * @param {object} settings - Current app settings.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @param {{ updatePrice: Function, changeStatus: Function, deleteHouse: Function }} actions - Handlers for the view's buttons.
 * @param {string} housesMode - How Houses was last shown, "cards" or "map", which the link back to it is named for.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderHouseDetail(house, settings, today, actions, housesMode) {
  const evaluation = evaluate(house, settings);
  const listing = currentListingPrice(house);

  const price = el('p', { class: 'price' }, [el('span', { class: 'amount' }, [formatMoney(listing)]), ' listing price']);
  const updatePrice = el('button', { class: 'button', type: 'button' }, ['Update price']);
  updatePrice.addEventListener('click', actions.updatePrice);
  const changeStatus = el('button', { class: 'button', type: 'button' }, ['Change status']);
  changeStatus.addEventListener('click', actions.changeStatus);
  const remove = el('button', { class: 'button danger', type: 'button' }, ['Delete house']);
  remove.addEventListener('click', actions.deleteHouse);

  const hero = el('div', { class: 'card hero' }, [
    housePhoto(house.imageUrl, [statusPill(house)]),
    el('div', { class: 'summary' }, [
      price,
      // The same spec grid as the Houses card, given more room.
      specGrid(house, today),
      // Property-level actions: correct the house's data, or record a listing event.
      el('div', { class: 'actions' }, [el('a', { class: 'button primary', href: `#/house/${house.id}/edit` }, ['Edit house']), updatePrice, changeStatus]),
    ]),
  ]);

  const sections = [];
  for (const id of SECTION_ORDERS.research) {
    // Projects has a card of its own, with its totals.
    if (id === 'projects') continue;
    sections.push(propertySection(findSection(id), house));
  }

  // Houses reopens as it was left, so the link is named for what it returns to.
  const backText = housesMode === 'map' ? 'Map' : 'Houses';
  const back = el('a', { class: 'button back', href: '#/', 'aria-label': `Back to ${backText}` }, [
    el('span', { 'aria-hidden': 'true' }, ['←']),
    backText,
  ]);

  return el('section', { class: 'detail' }, [
    el('header', {}, [pageTitle(house.address), back]),
    hero,
    el('div', { class: 'panels' }, [fitCard(evaluation), costsCard(evaluation.financing, settings, listing)]),
    listingCard(house, today),
    projectsCard(house),
    el('section', { class: 'card property' }, [el('h2', {}, ['Property']), ...sections]),
    // Deleting is kept out of the way at the very end, and always asks first.
    el('div', { class: 'actions' }, [remove]),
  ]);
}

/* --------------------------------------------------------------------------
   Compare
   -------------------------------------------------------------------------- */

/**
 * Builds one comparison row: what is compared, then one cell for each house.
 * @param {Array<Node|string|null>} label - Contents of the label.
 * @param {Array<Node|string|null>} cellA - Contents for the first house.
 * @param {Array<Node|string|null>} cellB - Contents for the second house.
 * @param {string|null} [kind] - Extra class for a row styled apart, such as "known".
 * @returns {HTMLElement} The row.
 */
function compareRow(label, cellA, cellB, kind = null) {
  return el('div', { class: kind === null ? 'row' : `row ${kind}` }, compareCells(label, cellA, cellB));
}

/**
 * Builds the parts of a comparison row: the label, then one cell for each house.
 * @param {Array<Node|string|null>} label - Contents of the label.
 * @param {Array<Node|string|null>} cellA - Contents for the first house.
 * @param {Array<Node|string|null>} cellB - Contents for the second house.
 * @returns {HTMLElement[]} The label and the two cells.
 */
function compareCells(label, cellA, cellB) {
  return [el('div', { class: 'label' }, label), el('div', { class: 'cell' }, cellA), el('div', { class: 'cell' }, cellB)];
}

/**
 * Builds one house's column heading: its photo, kept clear; status is compared in Property Basics.
 * @param {object} house - House to show.
 * @returns {HTMLElement} The heading card.
 */
function compareHeading(house) {
  return el('div', { class: 'card house' }, [housePhoto(house.imageUrl)]);
}

/**
 * Builds one house's name in the column key, linked to its House Detail.
 * @param {object} house - House to name.
 * @returns {HTMLElement} The name.
 */
function compareName(house) {
  return el('p', {}, [el('a', { href: `#/house/${house.id}` }, [house.address])]);
}

/**
 * Describes a house's current listing price as a cost figure, so it lines up with the others.
 * @param {object} house - House whose price to give.
 * @returns {{ label: string, value: number, minimum: null, missing: string[], suffix: string, lowerIsBetter: boolean }} The figure.
 */
function listingFigure(house) {
  return { label: 'Listing price', value: currentListingPrice(house), minimum: null, missing: [], suffix: '', lowerIsBetter: true };
}

/**
 * Names the categories this house's Overall Fit leaves out but the other house's includes.
 * @param {object} evaluation - Evaluation of this house.
 * @param {object} other - Evaluation of the other house.
 * @returns {HTMLElement|null} The note, or null when both count the same categories or Fit is unavailable.
 */
function leftOutNote(evaluation, other) {
  if (evaluation.overallFit === null) return null;
  const names = [];
  for (let index = 0; index < evaluation.categories.length; index += 1) {
    if (evaluation.categories[index].score === null && other.categories[index].score !== null) {
      names.push(evaluation.categories[index].label);
    }
  }
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return el('p', { class: 'note' }, [`Leaves out ${list} — not scored yet`]);
}

/**
 * Builds one house's Overall Fit cell: the number, its delights, and what it leaves out.
 * @param {object} evaluation - Evaluation of this house.
 * @param {object} other - Evaluation of the other house.
 * @returns {Array<HTMLElement|null>} The cell's contents.
 */
function overallCell(evaluation, other) {
  const { overallFit } = evaluation;
  const number =
    overallFit === null
      ? el('p', { class: 'value muted' }, ['Not available yet'])
      : el('p', { class: 'value score' }, [scoreText(overallFit)]);
  return [
    number,
    scoreDifference(overallFit, other.overallFit),
    delightNote(evaluation),
    leftOutNote(evaluation, other),
  ];
}

/**
 * Builds one house's category cell: its score, bar, and lead over the other house, or why it is unscored.
 * @param {{ score: number|null, unavailableReason: string|null }} category - Category from this house's evaluation.
 * @param {{ score: number|null }} other - The same category for the other house.
 * @returns {Array<HTMLElement|null>} The cell's contents.
 */
function categoryCell(category, other) {
  if (category.score === null) {
    const reason = category.unavailableReason ? UNAVAILABLE_TEXT[category.unavailableReason] : 'Nothing known yet';
    return [el('p', { class: 'value muted' }, [reason])];
  }
  return [el('p', { class: 'value' }, [scoreText(category.score)]), scoreDifference(category.score, other.score), scoreBar(category.score)];
}

/**
 * Says how many points higher this score is than the other house's, using the whole numbers shown.
 * @param {number|null} score - This house's score, or null when not scored.
 * @param {number|null} other - The other house's same score, or null when not scored.
 * @returns {HTMLElement|null} The difference, or null unless both are scored and this one is higher.
 */
function scoreDifference(score, other) {
  if (score === null || other === null) return null;
  const points = Math.round(score) - Math.round(other);
  return points >= 1 ? el('span', { class: 'difference' }, [`+${points}`]) : null;
}

/**
 * Builds one house's Property Basics cell: the fact, tagged when it is the larger or newer number.
 * @param {object} house - House to describe.
 * @param {object} other - The other house.
 * @param {object} field - Field layout from HOUSE_SECTIONS.
 * @returns {Array<HTMLElement|null>} The cell's contents.
 */
function basicsCell(house, other, field) {
  if (!isFieldKnown(house, field.name)) return [el('p', { class: 'value muted' }, ['Unknown'])];
  return [el('p', { class: 'fact' }, [fieldText(field, house[field.name])]), basicsDifference(house, other, field)];
}

/**
 * Says how much larger, or for Year built how much newer, this house's number is than the other's.
 * @param {object} house - House the cell belongs to.
 * @param {object} other - The other house.
 * @param {object} field - Field layout from HOUSE_SECTIONS.
 * @returns {HTMLElement|null} The tag, or null unless both are known numbers and this one is larger.
 */
function basicsDifference(house, other, field) {
  if (HOUSE_FIELDS[field.name].kind !== NUMBER || !isFieldKnown(other, field.name)) return null;
  // Rounded as the facts are shown, so the tag never states a gap the numbers do not.
  const gap = Math.round((house[field.name] - other[field.name]) * 100) / 100;
  if (gap <= 0) return null;
  if (field.name === 'yearBuilt') return el('span', { class: 'difference' }, [`${countText(gap, 'yr', 'yrs')} newer`]);
  return el('span', { class: 'difference' }, [`+${formatNumber(gap)}${field.suffix ? ` ${field.suffix}` : ''}`]);
}

/**
 * Builds one house's Days on Market cell, tagged with how many more days it has when it has more.
 * @param {number|null} days - This house's Days on Market, or null when unknown.
 * @param {number|null} other - The other house's Days on Market, or null when unknown.
 * @returns {Array<HTMLElement|null>} The cell's contents.
 */
function daysCell(days, other) {
  if (days === null) return [el('p', { class: 'value muted' }, ['Unknown'])];
  const more = other !== null && days > other ? el('span', { class: 'difference' }, [`+${countText(days - other, 'day', 'days')}`]) : null;
  return [el('p', { class: 'fact' }, [countText(days, 'day', 'days')]), more];
}

/**
 * Builds the Property Basics card: status, Days on Market, then the form's Property Basics fields.
 * @param {object} houseA - The first house.
 * @param {object} houseB - The second house.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @returns {HTMLElement} The card.
 */
function compareBasics(houseA, houseB, today) {
  const daysA = daysOnMarket(houseA, today);
  const daysB = daysOnMarket(houseB, today);
  const rows = [
    compareRow(['Status'], [statusPill(houseA)], [statusPill(houseB)]),
    compareRow(['Days on market'], daysCell(daysA, daysB), daysCell(daysB, daysA)),
  ];
  for (const field of findSection('basics').fields) {
    // The column headings already show each house's address and photo.
    if (field.name === 'address' || field.name === 'imageUrl') continue;
    rows.push(compareRow([field.label], basicsCell(houseA, houseB, field), basicsCell(houseB, houseA, field)));
  }
  return el('section', { class: 'card basics' }, [el('h2', {}, ['Property Basics']), ...rows]);
}

/**
 * Builds the Fit card: Overall Fit, then each category, which opens to its subcategories and criteria.
 * @param {object} evaluationA - Evaluation of the first house.
 * @param {object} evaluationB - Evaluation of the second house.
 * @param {{ categories: object[] }} comparison - Result of compareEvaluations for the two.
 * @returns {HTMLElement} The card.
 */
function compareFit(evaluationA, evaluationB, comparison) {
  const parts = [
    compareRow(['Overall Fit'], overallCell(evaluationA, evaluationB), overallCell(evaluationB, evaluationA)),
    // How much is known is its own quiet line, so it is never read as part of the score.
    compareRow(
      ['Information'],
      [percentKnownText(evaluationA.completeness)],
      [percentKnownText(evaluationB.completeness)],
      'known',
    ),
  ];
  for (const category of comparison.categories) parts.push(compareCategory(category));
  return el('section', { class: 'card scores' }, [el('h2', {}, ['Fit']), ...parts]);
}

/**
 * Builds one category of the Fit card: scores in its summary, subcategories and differing criteria inside.
 * @param {object} category - One category from compareEvaluations, with both houses' scores and compared rows.
 * @returns {HTMLElement} A disclosure for the category.
 */
function compareCategory(category) {
  const details = el('details', { class: 'category' });
  let differ = 0;
  let unknown = 0;
  for (const subcategory of category.subcategories) {
    // Contentment and Creative Authorship have no subcategory level of their own.
    if (!subcategory.implicit) {
      details.append(compareRow([subcategory.label], categoryCell(subcategory.a, subcategory.b), categoryCell(subcategory.b, subcategory.a), 'subcategory'));
    }
    const same = [];
    const neither = [];
    for (const row of subcategory.rows) {
      if (row.kind === SAME) {
        same.push(row.label);
        continue;
      }
      if (row.kind === DIFFERS) differ += 1;
      else unknown += 1;
      // Unknown for both has nothing to compare, but is never folded in with Same for both.
      if (row.a.state === UNKNOWN && row.b.state === UNKNOWN) {
        neither.push(row.label);
        continue;
      }
      details.append(compareRow([row.label], criterionCell(row.a, row.b), criterionCell(row.b, row.a), row.kind === INCOMPLETE ? 'criterion incomplete' : 'criterion'));
    }
    if (same.length > 0) details.append(el('p', { class: 'same' }, [`Same for both: ${same.join(', ')}`]));
    if (neither.length > 0) details.append(el('p', { class: 'same' }, [`Unknown for both: ${neither.join(', ')}`]));
  }

  const counts = [];
  if (differ > 0) counts.push(countText(differ, 'difference', 'differences'));
  if (unknown > 0) counts.push(`${unknown} not known yet`);
  const label = [
    category.label,
    el('span', { class: 'weight' }, [`${category.a.weight}% of Overall Fit`]),
    el('span', { class: 'context' }, [counts.length > 0 ? counts.join(' · ') : 'Same for both']),
  ];
  details.prepend(el('summary', { class: 'row disclosure' }, compareCells(label, categoryCell(category.a, category.b), categoryCell(category.b, category.a))));
  return details;
}

/**
 * Builds one house's cost cell: the amount, how much better it is than the other's, or why it is incomplete.
 * @param {{ value: number|null, minimum: number|null, missing: string[], suffix: string, lowerIsBetter: boolean }} figure - This house's figure.
 * @param {{ value: number|null }} other - The other house's same figure.
 * @returns {Array<HTMLElement|null>} The cell's contents.
 */
function costCell(figure, other) {
  const [amount, why] = costAmount(figure.value, figure.minimum, figure.missing, figure.suffix);
  let difference = null;
  // A difference is only stated between two complete figures, and only on the house where it is better:
  // less to pay, or more cushion.
  if (figure.value !== null && other.value !== null) {
    const gain = figure.lowerIsBetter ? other.value - figure.value : figure.value - other.value;
    if (Math.round(gain) >= 1) {
      const sign = figure.lowerIsBetter ? '−' : '+';
      difference = el('span', { class: 'difference' }, [`${sign}${formatMoney(gain)}${figure.suffix}`]);
    }
  }
  return [amount, difference, why];
}

/**
 * Builds the Costs card: listing price and the five decision figures side by side.
 * @param {object} houseA - The first house.
 * @param {object} houseB - The second house.
 * @param {object} evaluationA - Evaluation of the first house.
 * @param {object} evaluationB - Evaluation of the second house.
 * @returns {HTMLElement} The card.
 */
function compareCosts(houseA, houseB, evaluationA, evaluationB) {
  // Listing price leads, since every other figure follows from it.
  const figuresA = [listingFigure(houseA), ...costFigures(evaluationA.financing)];
  const figuresB = [listingFigure(houseB), ...costFigures(evaluationB.financing)];
  const rows = [];
  for (let index = 0; index < figuresA.length; index += 1) {
    rows.push(compareRow([figuresA[index].label], costCell(figuresA[index], figuresB[index]), costCell(figuresB[index], figuresA[index])));
  }
  return el('section', { class: 'card costs' }, [
    el('h2', {}, ['Costs']),
    el('p', { class: 'muted' }, ['Planning estimates, not a lender quote.']),
    ...rows,
  ]);
}

/**
 * Builds one house's criterion cell: the observation, then its score, muted when it scores lower.
 * @param {{ state: string, score: number|null }} criterion - Criterion from this house's evaluation.
 * @param {{ state: string, score: number|null }} other - The same criterion for the other house.
 * @returns {HTMLElement[]} The cell's contents.
 */
function criterionCell(criterion, other) {
  if (criterion.state === NOT_APPLICABLE) return [el('p', { class: 'value muted' }, ['Not applicable'])];
  if (criterion.state !== KNOWN) return [el('p', { class: 'value muted' }, ['Unknown'])];
  // Only a gap between two known scores puts one house behind.
  const behind = other.state === KNOWN && criterion.score < other.score;
  return [el('p', { class: behind ? 'fact behind' : 'fact' }, [observationText(criterion)]), el('span', { class: 'points' }, [scoreText(criterion.score)])];
}

/**
 * Builds the Biggest differences card: where the two houses differ most, weighted as Overall Fit weighs them.
 * @param {{ differences: object[], delights: object[] }} comparison - Result of compareEvaluations.
 * @returns {HTMLElement} The card.
 */
function compareDifferences(comparison) {
  const rows = [];
  for (const row of comparison.differences) {
    // Contentment and Creative Authorship have no subcategory of their own to name.
    let context = row.category === row.subcategory ? row.category : `${row.category} · ${row.subcategory}`;
    // A criterion that also carries a delight says so, since its points include the bonus.
    const carriesDelight = row.delight !== null && !comparison.delights.includes(row);
    if (carriesDelight) context = `${context} · includes +${formatNumber(DELIGHT_POINTS)} delight`;
    // Every ranked difference is between two known scores, so one house is always ahead.
    const aheadA = row.a.score > row.b.score;
    rows.push(compareRow([row.label, el('span', { class: 'context' }, [context])], differenceCell(row.a, aheadA, row.impact), differenceCell(row.b, !aheadA, row.impact)));
  }
  return el('section', { class: 'card differences' }, [
    el('h2', {}, ['Biggest differences']),
    el('p', { class: 'muted' }, ['Where these two differ most. The tag marks the house that comes out ahead, and how many Overall Fit points the gap is worth.']),
    ...(rows.length > 0 ? rows : [el('p', { class: 'muted' }, ['No scored differences between these two yet.'])]),
  ]);
}

/**
 * Builds one house's Biggest differences cell: its fact, tagged with the gap's Fit points when it is ahead.
 * @param {object} criterion - Criterion from this house's evaluation; known.
 * @param {boolean} ahead - Whether this house scores higher on the criterion.
 * @param {number} impact - Overall Fit points the gap is worth.
 * @returns {HTMLElement[]} The cell's contents.
 */
function differenceCell(criterion, ahead, impact) {
  const fact = el('p', { class: ahead ? 'fact' : 'fact behind' }, [observationText(criterion)]);
  if (!ahead) return [fact];
  const points = impact < 0.05 ? '<0.1' : (Math.round(impact * 10) / 10).toFixed(1);
  return [fact, el('span', { class: 'difference' }, [`+${points} Fit`])];
}

/**
 * Builds one house's cell for a project area.
 * @param {object} house - House the project belongs to.
 * @param {string} area - Project area key such as "kitchen".
 * @returns {HTMLElement[]} The cell's contents.
 */
function projectCell(house, area) {
  const project = house.projects[area];
  if (project.state === PROJECT_WANT || project.state === PROJECT_NEED) {
    return [el('p', { class: 'fact' }, projectText(project)), project.note === '' ? null : el('p', { class: 'note' }, [project.note])];
  }
  // An untouched area is unknown, never No change.
  return [el('p', { class: 'value muted' }, [project.state === null ? 'Unknown' : 'No change'])];
}

/**
 * Builds the Projects card: how much of each house's projects is known, then every area with work in either.
 * @param {object} houseA - The first house.
 * @param {object} houseB - The second house.
 * @returns {HTMLElement} The card.
 */
function compareProjects(houseA, houseB) {
  // How much is known: a quiet line of its own, as under Overall Fit.
  const rows = [compareRow(['Information'], [projectsProgressText(houseA)], [projectsProgressText(houseB)], 'known')];
  for (const area of PROJECT_AREAS) {
    const states = [houseA.projects[area].state, houseB.projects[area].state];
    if (!states.includes(PROJECT_WANT) && !states.includes(PROJECT_NEED)) continue;
    rows.push(compareRow([PROJECT_LABELS[area]], projectCell(houseA, area), projectCell(houseB, area)));
  }
  const none = rows.length === 1 ? el('p', { class: 'muted' }, ['Neither house has projects marked.']) : null;
  const totals = [];
  for (const state of [PROJECT_WANT, PROJECT_NEED]) {
    const figureA = projectTotalFigure(houseA, state);
    const figureB = projectTotalFigure(houseB, state);
    totals.push(compareRow([figureA.label], costCell(figureA, figureB), costCell(figureB, figureA), 'total'));
  }
  return el('section', { class: 'card projects' }, [el('h2', {}, ['Projects']), ...rows, none, ...totals]);
}

/**
 * Describes one house's total for Want to fix or Need to fix projects as a cost figure, lower being better.
 * @param {object} house - House whose projects to total.
 * @param {string} state - PROJECT_WANT or PROJECT_NEED.
 * @returns {{ label: string, value: number|null, minimum: number|null, missing: string[], suffix: string, lowerIsBetter: boolean }} The figure.
 */
function projectTotalFigure(house, state) {
  const work = calculateProjectWork(house, state);
  const minimum = knownWorkMinimum(work);
  return { label: `${PROJECT_STATE_LABELS[state]} total`, value: work.total, minimum, missing: work.missing, suffix: '', lowerIsBetter: true };
}

/**
 * Builds the comparison of two houses: their basics, how they fit, what they cost, and where they differ.
 * @param {object} houseA - House shown in the first column.
 * @param {object} houseB - House shown in the second column.
 * @param {object} settings - Current app settings.
 * @param {string} today - Today's date as YYYY-MM-DD, for Days on Market.
 * @param {function(): void} onChangeHouses - Called to go back to Houses with these two ticked.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderCompare(houseA, houseB, settings, today, onChangeHouses) {
  const evaluationA = evaluate(houseA, settings);
  const evaluationB = evaluate(houseB, settings);
  const comparison = compareEvaluations(evaluationA, evaluationB);
  const change = el('button', { class: 'button', type: 'button' }, ['Change houses']);
  change.addEventListener('click', onChangeHouses);

  return el('section', { class: 'compare' }, [
    el('header', {}, [pageTitle('Compare'), change]),
    el('div', { class: 'headings' }, [compareHeading(houseA), compareHeading(houseB)]),
    // The addresses name the columns and stay in view while scrolling, so it is always clear which house is which.
    el('div', { class: 'names' }, [compareName(houseA), compareName(houseB)]),
    compareBasics(houseA, houseB, today),
    compareFit(evaluationA, evaluationB, comparison),
    compareCosts(houseA, houseB, evaluationA, evaluationB),
    compareProjects(houseA, houseB),
    compareDifferences(comparison),
  ]);
}

/* --------------------------------------------------------------------------
   Price Ladder
   -------------------------------------------------------------------------- */

// Criteria phrased as a drawback, named by their absence so a gain never reads as gaining the drawback.
export const LADDER_POSITIVE_LABELS = {
  noParkStrip: 'No park strip',
  noSidewalkToShovel: 'No sidewalk to shovel',
  tvAreaNotThoroughfare: 'Couch-to-TV area is not a thoroughfare',
  tvNotBackToDoor: 'TV seating does not put back to front door',
  tvNotBackToWindows: 'TV seating does not put back to windows',
};

// Answer-like criteria are named alone on the ladder; their group says which way they moved.
const LADDER_NAMED_ALONE = ['yes', 'option', 'irrigation', 'garageWorkspace', 'coveredRoute'];

/**
 * Words one item of a ladder fact: its name, and for anything beyond a yes or no, how it changed.
 * @param {{ id: string, label: string|null, isDelight: boolean, lower: object|null, higher: object|null }} item - Item from ladderStep.
 * @returns {string} Text such as "Fireplace", "No park strip", or "Train · 8 min → 15 min".
 */
function ladderItemText(item) {
  if (item.isDelight) return item.label;
  if (item.higher.type === 'no') return LADDER_POSITIVE_LABELS[item.id];
  if (LADDER_NAMED_ALONE.includes(item.higher.type)) return item.label;
  return `${item.label} · ${observationText(item.lower)} → ${observationText(item.higher)}`;
}

/**
 * Words one ladder fact; facts sharing a subcategory are introduced by its name.
 * @param {{ grouped: boolean, subcategory: string|null, items: object[] }} fact - Fact from ladderStep.
 * @returns {Array<Node|string>} The contents of the fact's line.
 */
function ladderFactText(fact) {
  const texts = [];
  for (const item of fact.items) texts.push(ladderItemText(item));
  if (!fact.grouped) return [texts[0]];
  return [el('span', { class: 'name' }, [fact.subcategory]), ` — ${texts.join(', ')}`];
}

/**
 * Words the change between two amounts, such as "+$25,000" or "−$32".
 * @param {number} change - Difference in dollars; negative when the second amount is lower.
 * @returns {string} The signed amount.
 */
function signedMoney(change) {
  return `${change < 0 ? '−' : '+'}${formatMoney(Math.abs(change))}`;
}

/**
 * Words how the pricier house's Overall Fit, age, size, and lot differ from the cheaper one's, by direction.
 * @param {{ house: object, evaluation: object }} lower - The cheaper house and its evaluation.
 * @param {{ house: object, evaluation: object }} higher - The pricier house and its evaluation.
 * @returns {{ gain: string[], giveUp: string[] }} Texts such as "6 Fit points" or "195 sqft", by direction; equal or unknown are left out.
 */
function ladderMeasures(lower, higher) {
  const measures = { [GAIN]: [], [GIVE_UP]: [] };
  const before = lower.evaluation.overallFit;
  const after = higher.evaluation.overallFit;
  // From the whole numbers on the rungs, so the points always match what is shown.
  if (before !== null && after !== null) {
    const points = Math.round(after) - Math.round(before);
    if (points !== 0) measures[points > 0 ? GAIN : GIVE_UP].push(countText(Math.abs(points), 'Fit point', 'Fit points'));
  }
  // Newer, larger, and more lot sit with the gains; the group's own + or − marks the direction.
  for (const name of ['yearBuilt', 'squareFeet', 'lotAcres']) {
    if (lower.house[name] === null || higher.house[name] === null) continue;
    // Rounded as the facts are shown, so a difference too small to show is no difference.
    const gap = Math.round((higher.house[name] - lower.house[name]) * 100) / 100;
    if (gap === 0) continue;
    const size = Math.abs(gap);
    let text;
    if (name === 'yearBuilt') text = `${countText(size, 'yr', 'yrs')} ${gap > 0 ? 'newer' : 'older'}`;
    else if (name === 'squareFeet') text = `${formatNumber(size)} sqft`;
    else text = countText(size, 'acre', 'acres');
    measures[gap > 0 ? GAIN : GIVE_UP].push(text);
  }
  return measures;
}

/**
 * Builds the step between two neighbouring houses: the price increase, the monthly change, and what changes.
 * @param {{ house: object, evaluation: object }} lower - The cheaper house.
 * @param {{ house: object, evaluation: object }} higher - The pricier house.
 * @param {number} largest - The largest price increase on the ladder, which sizes the bar.
 * @returns {HTMLElement} The step.
 */
function ladderStepView(lower, higher, largest) {
  const increase = currentListingPrice(higher.house) - currentListingPrice(lower.house);
  const price = el('p', { class: 'increase' }, [
    increase === 0 ? 'Same price' : el('span', { class: 'money' }, [signedMoney(increase)]),
  ]);
  // The bar shows this step against the largest one, so the big jumps stand out before the numbers are read.
  const share = largest === 0 ? 0 : increase / largest;
  const bar = el('span', { class: 'bar', style: `--share: ${share.toFixed(3)}`, 'aria-hidden': 'true' }, [el('span')]);

  let monthly = null;
  const before = lower.evaluation.financing.initialMonthlyCost;
  const after = higher.evaluation.financing.initialMonthlyCost;
  // Only two complete estimates can be compared; a partial one would understate the change.
  if (before !== null && after !== null) {
    const change = Math.round(after) - Math.round(before);
    monthly = el('p', { class: 'monthly' }, [change === 0 ? 'Same monthly cost' : el('span', { class: 'money' }, [`${signedMoney(change)}/mo`])]);
  }

  const { facts, unknown } = ladderStep(lower, higher);
  // Fit points, age, size, and lot follow the scored facts in each group, and never take one of their three places.
  const measures = ladderMeasures(lower, higher);
  const groups = [];
  for (const [direction, title] of [[GAIN, 'Gains'], [GIVE_UP, 'Gives up']]) {
    const lines = [];
    for (const fact of facts) {
      if (fact.direction === direction) lines.push(el('dd', {}, ladderFactText(fact)));
    }
    for (const text of measures[direction]) lines.push(el('dd', {}, [text]));
    if (lines.length > 0) groups.push(el('div', { class: direction === GAIN ? 'gains' : 'losses' }, [el('dt', {}, [title]), ...lines]));
  }
  const changes = groups.length > 0 ? el('dl', { class: 'changes' }, groups) : el('p', { class: 'none' }, [`No meaningful differences in what's known for both.`]);
  // Fewer facts can mean little changes or little is known; the count keeps the two apart.
  let note = null;
  if (facts.length < LADDER_FACTS && unknown > 0) {
    note = el('p', { class: 'unknown' }, [`${countText(unknown, 'fact', 'facts')} not known yet for one or both`]);
  }

  return el('div', { class: 'step', role: 'group', 'aria-label': `From ${lower.house.address} to ${higher.house.address}` }, [
    el('div', { class: 'spine' }, [price, monthly, bar]),
    el('div', { class: 'body' }, [changes, note]),
  ]);
}

/**
 * Builds one rung: the house's photo, price, Fit, and address linked to House Detail, with its Hide button.
 * @param {{ house: object, evaluation: object }} item - The house and its evaluation.
 * @returns {HTMLElement} The rung.
 */
function ladderRung(item) {
  const { house, evaluation } = item;
  // Available is the ladder's usual case, so only Under Contract is marked.
  const status = house.status === STATUS_UNDER_CONTRACT ? statusPill(house) : null;
  const fit =
    evaluation.overallFit === null
      ? el('p', { class: 'fit unavailable' }, [`Fit not available yet · ${percentKnownText(evaluation.completeness)}`])
      : el('p', { class: 'fit' }, [el('span', { class: 'score' }, [scoreText(evaluation.overallFit)]), ' Overall Fit']);
  const card = el('div', { class: 'card linked' }, [
    el('p', { class: 'price money' }, [formatMoney(currentListingPrice(house))]),
    housePhoto(house.imageUrl),
    el('p', { class: 'address' }, [el('a', { href: `#/house/${house.id}` }, [house.address])]),
    status,
    fit,
  ]);
  const hide = el('button', { class: 'button hide dismiss', type: 'button', value: house.id, 'aria-label': `Hide ${house.address} from the ladder` }, ['Hide']);
  return el('div', { class: 'rung' }, [card, hide]);
}

/**
 * Builds the Price Ladder: every house except Sold, cheapest first, with what each step up in price changes.
 * @param {{ settings: object, houses: Array<object> }} data - Current app data.
 * @param {{ hidden: string[] }} prefs - Houses this device hides from the ladder.
 * @param {function({ hidden: string[] }): void} onPrefsChange - Called with new preferences to remember.
 * @param {function(string): void} announce - Shows a short status message.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderLadder(data, prefs, onPrefsChange, announce) {
  const view = el('section', { class: 'ladder' }, [pageTitle('Price Ladder')]);
  if (data.houses.length === 0) {
    view.append(
      el('div', { class: 'card empty' }, [
        el('p', { class: 'title' }, ['No houses yet.']),
        el('p', { class: 'text' }, ['Add a few houses to see what more money buys.']),
        el('a', { class: 'button primary', href: '#/add' }, ['Add House']),
      ]),
    );
    return view;
  }

  const items = [];
  for (const house of data.houses) items.push({ house, evaluation: evaluate(house, data.settings) });
  const listed = sortForLadder(items);
  if (listed.length === 0) {
    view.append(
      el('div', { class: 'card empty' }, [
        el('p', { class: 'title' }, ['No houses on the ladder.']),
        el('p', { class: 'text' }, ['Sold houses stay off the ladder.']),
        el('a', { class: 'button', href: '#/' }, ['Back to Houses']),
      ]),
    );
    return view;
  }

  // A deleted house is forgotten; a Sold one stays hidden in case it returns to the market.
  const known = [];
  for (const house of data.houses) known.push(house.id);
  let hidden = [];
  for (const id of prefs.hidden) {
    if (known.includes(id)) hidden.push(id);
  }

  const intro = el('p', { class: 'intro muted' }, ['Every house except Sold, lowest listing price first.']);
  const shelf = el('details');
  const shelfSummary = el('summary', { class: 'disclosure' });
  const shelfList = el('ul');
  const showAll = el('button', { class: 'button', type: 'button' }, ['Show all']);
  shelf.append(shelfSummary, shelfList, showAll);
  const ladder = el('ol', { class: 'rungs' });
  const note = el('p', { class: 'note muted' });

  function draw() {
    const visible = [];
    const shelved = [];
    for (const item of listed) {
      if (hidden.includes(item.house.id)) shelved.push(item);
      else visible.push(item);
    }

    shelf.hidden = shelved.length === 0;
    shelfSummary.textContent = `${shelved.length} hidden`;
    shelfList.replaceChildren();
    for (const item of shelved) {
      shelfList.append(
        el('li', {}, [
          el('span', { class: 'address' }, [item.house.address]),
          el('span', { class: 'money' }, [formatMoney(currentListingPrice(item.house))]),
          el('button', { class: 'button show', type: 'button', value: item.house.id, 'aria-label': `Show ${item.house.address} on the ladder` }, ['Show']),
        ]),
      );
    }
    showAll.hidden = shelved.length < 2;

    let largest = 0;
    for (let index = 1; index < visible.length; index += 1) {
      largest = Math.max(largest, currentListingPrice(visible[index].house) - currentListingPrice(visible[index - 1].house));
    }
    ladder.replaceChildren();
    for (let index = 0; index < visible.length; index += 1) {
      const step = index === 0 ? null : ladderStepView(visible[index - 1], visible[index], largest);
      ladder.append(el('li', {}, [step, ladderRung(visible[index])]));
    }

    note.hidden = visible.length > 1;
    if (visible.length === 0) {
      note.textContent = 'Every house on the ladder is hidden.';
      shelf.open = true;
    } else {
      note.textContent = 'Add or show another house to see what more money buys.';
    }
  }

  /**
   * Remembers a new set of hidden houses and redraws the ladder around them.
   * @param {string[]} next - Ids of the houses to hide.
   */
  function setHidden(next) {
    hidden = next;
    onPrefsChange({ hidden });
    draw();
  }

  /**
   * Finds a listed house by id.
   * @param {string} id - House id.
   * @returns {object|null} The house, or null when it is not on the ladder.
   */
  function listedHouse(id) {
    for (const item of listed) {
      if (item.house.id === id) return item.house;
    }
    return null;
  }

  /**
   * Hides a house from the ladder and keeps focus near where it was.
   * @param {Event} event - Click from within the ladder.
   */
  function handleHide(event) {
    const button = event.target.closest('.hide');
    if (button === null) return;
    const buttons = [...ladder.querySelectorAll('.hide')];
    const position = buttons.indexOf(button);
    setHidden([...hidden, button.value]);
    announce(`${listedHouse(button.value).address} hidden from the ladder.`);
    // Focus moves to the rung that took its place, or the one before it, or the hidden list.
    const remaining = ladder.querySelectorAll('.hide');
    if (remaining.length > 0) remaining[Math.min(position, remaining.length - 1)].focus();
    else shelfSummary.focus();
  }

  /**
   * Puts a hidden house back on the ladder.
   * @param {Event} event - Click from within the hidden list.
   */
  function handleShow(event) {
    const button = event.target.closest('.show');
    if (button === null) return;
    const next = [];
    for (const id of hidden) {
      if (id !== button.value) next.push(id);
    }
    setHidden(next);
    announce(`${listedHouse(button.value).address} is back on the ladder.`);
    const restored = ladder.querySelector(`.hide[value="${CSS.escape(button.value)}"]`);
    if (restored !== null) restored.focus();
  }

  ladder.addEventListener('click', handleHide);
  ladder.addEventListener('click', clickCard);
  shelfList.addEventListener('click', handleShow);
  showAll.addEventListener('click', function handleShowAll() {
    setHidden([]);
    announce('Every house is back on the ladder.');
    const first = ladder.querySelector('.hide');
    if (first !== null) first.focus();
  });

  draw();
  view.append(intro, shelf, ladder, note);
  return view;
}

/**
 * Builds the view shown for an unknown address.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderNotFound() {
  return el('section', {}, [
    pageTitle('Page not found'),
    el('div', { class: 'card empty' }, [
      el('p', { class: 'text' }, ['That address does not match anything in the app.']),
      el('a', { class: 'button', href: '#/' }, ['Back to Houses']),
    ]),
  ]);
}
