// Deterministic derived facts. No DOM, no storage, no scoring judgments.
//
// A value of null always means "not available". Unknown is never treated as zero.

import { NO, YES, PROJECT_AREAS, PROJECT_NEED, STATUS_AVAILABLE, projectsAnswered } from './data.js';

export const ENTERED = 'entered';
export const DEFAULT_ESTIMATE = 'default';

// Reasons a figure cannot be completed.
export const MISSING_INTEREST_RATE = 'interestRate';
export const MISSING_POINTS = 'pointsPercent';
export const MISSING_HOA = 'hoa';
export const MISSING_SOLAR = 'solar';
export const MISSING_PROJECT_ANSWERS = 'projectsUnanswered';
export const MISSING_PROJECT_COST = 'projectCost';
export const MISSING_WANT_COST = 'wantCost';
export const MISSING_MAXIMUM_PRICE = 'maximumPurchasePrice';

const SOLAR_FINANCED = 'financed';
const SQUARE_FEET_PER_ACRE = 43560;

/**
 * Picks a property value over the inherited Settings value and records where it came from.
 * @param {number|null} propertyValue - Value entered on the property, or null to inherit.
 * @param {number|null} settingsValue - Current Settings value, or null when not configured.
 * @returns {{ value: number|null, provenance: string|null }} Effective value and its provenance.
 */
export function resolveValue(propertyValue, settingsValue) {
  if (propertyValue !== null) return { value: propertyValue, provenance: ENTERED };
  if (settingsValue !== null) return { value: settingsValue, provenance: DEFAULT_ESTIMATE };
  return { value: null, provenance: null };
}

/**
 * Calculates the monthly payment for a fixed-rate amortizing loan.
 * @param {number} principal - Loan principal in dollars.
 * @param {number} annualRatePercent - Annual interest rate as a percent, such as 6.5.
 * @param {number} termYears - Loan term in years.
 * @returns {number} Monthly principal and interest payment in dollars.
 */
export function mortgagePayment(principal, annualRatePercent, termYears) {
  const payments = termYears * 12;
  if (annualRatePercent === 0) return principal / payments;
  const monthlyRate = annualRatePercent / 100 / 12;
  const growth = (1 + monthlyRate) ** payments;
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * Adds numbers, giving null when any of them is unavailable.
 * @param {Array<number|null>} values - Amounts to add.
 * @returns {number|null} The total, or null when any amount is null.
 */
function sumAll(values) {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

/**
 * Adds only the numbers that are available.
 * @param {Array<number|null>} values - Amounts to add.
 * @returns {number} The total of the non-null amounts.
 */
function sumKnown(values) {
  let total = 0;
  for (const value of values) {
    if (value !== null) total += value;
  }
  return total;
}

/**
 * Multiplies two numbers, giving null when either is unavailable.
 * @param {number|null} a - First factor.
 * @param {number|null} b - Second factor.
 * @returns {number|null} The product, or null when either factor is null.
 */
function multiply(a, b) {
  return a === null || b === null ? null : a * b;
}

/**
 * Calculates required-work cost from the project records.
 * @param {object} house - House with projects.
 * @returns {{ knownCost: number, total: number|null, hasUncosted: boolean, answered: boolean, missing: string[] }} Required-work facts.
 */
export function calculateRequiredWork(house) {
  return calculateProjectWork(house, PROJECT_NEED);
}

/**
 * Totals the cost of every project in one state, such as all Need to fix or all Want to fix projects.
 * @param {object} house - House with projects.
 * @param {string} state - PROJECT_NEED or PROJECT_WANT.
 * @returns {{ knownCost: number, total: number|null, hasUncosted: boolean, answered: boolean, missing: string[] }} Cost facts and why the total is unknown.
 */
export function calculateProjectWork(house, state) {
  let knownCost = 0;
  let hasUncosted = false;
  for (const area of PROJECT_AREAS) {
    const project = house.projects[area];
    if (project.state !== state) continue;
    if (project.cost === null) hasUncosted = true;
    else knownCost += project.cost;
  }
  const answered = projectsAnswered(house);
  // An untouched area earns no credit: the total is unknown until every area has been answered.
  const total = answered && !hasUncosted ? knownCost : null;
  const missing = [];
  if (!answered) missing.push(MISSING_PROJECT_ANSWERS);
  if (hasUncosted) missing.push(state === PROJECT_NEED ? MISSING_PROJECT_COST : MISSING_WANT_COST);
  return { knownCost, total, hasUncosted, answered, missing };
}

/**
 * Resolves annual property tax from the property value or the fallback rate.
 * @param {object} house - House with annualPropertyTax and its listing-price history.
 * @param {object} settings - Settings with fallbackPropertyTaxRate as a percent.
 * @returns {{ value: number|null, provenance: string|null }} Annual tax and its provenance.
 */
function resolvePropertyTax(house, settings) {
  if (house.annualPropertyTax !== null) return { value: house.annualPropertyTax, provenance: ENTERED };
  const estimate = (currentListingPrice(house) * settings.fallbackPropertyTaxRate) / 100;
  return { value: estimate, provenance: DEFAULT_ESTIMATE };
}

/**
 * Resolves the monthly HOA amount.
 * @param {object} house - House with hoa and hoaDues.
 * @returns {number|null} Monthly dues, 0 for a confirmed no-HOA property, or null when unknown.
 */
function resolveMonthlyHoa(house) {
  if (house.hoa === NO) return 0;
  if (house.hoa === YES) return house.hoaDues;
  return null;
}

/**
 * Resolves the monthly solar obligation.
 * @param {object} house - House with solarStatus and solarPayment.
 * @returns {number|null} Monthly payment, 0 for owned or no solar, or null when unknown.
 */
function resolveMonthlySolar(house) {
  if (house.solarStatus === null) return null;
  if (house.solarStatus === SOLAR_FINANCED) return house.solarPayment;
  return 0;
}

/**
 * Calculates every financing figure for a house under the current settings.
 * @param {object} house - Normalized house.
 * @param {object} settings - Normalized app settings.
 * @returns {object} Inputs with provenance, monthly costs, Cash to Close parts, required work and its cushion, and Cash to Acquire.
 */
export function calculateFinancing(house, settings) {
  // The current listing price is the one price used for every financial figure.
  const price = currentListingPrice(house);
  const rate = settings.interestRate;
  const term = settings.loanTermYears;

  const downPaymentPercent = resolveValue(house.downPaymentPercent, settings.downPaymentPercent);
  const pointsPercent = resolveValue(house.pointsPercent, settings.pointsPercent);
  const fixedLenderFee = resolveValue(house.fixedLenderFee, settings.fixedLenderFee);
  const titleInsurance = resolveValue(house.titleInsurance, settings.titleInsurance);
  const prepaidInterestDays = resolveValue(house.prepaidInterestDays, settings.prepaidInterestDays);
  const annualPropertyTax = resolvePropertyTax(house, settings);
  const annualInsurance = resolveValue(house.annualInsurance, settings.fallbackAnnualInsurance);

  // Down payment and loan
  const downPaymentAmount = (price * downPaymentPercent.value) / 100;
  const loanAmount = price - downPaymentAmount;

  // Monthly costs
  const hasRate = rate !== null;
  const monthlyPI = hasRate ? mortgagePayment(loanAmount, rate, term) : null;
  const monthlyPropertyTax = annualPropertyTax.value / 12;
  const monthlyInsurance = annualInsurance.value / 12;
  const monthlyHoa = resolveMonthlyHoa(house);
  const monthlySolar = resolveMonthlySolar(house);
  const recurring = [monthlyPropertyTax, monthlyInsurance, monthlyHoa, monthlySolar];

  const monthlyMissing = [];
  if (rate === null) monthlyMissing.push(MISSING_INTEREST_RATE);
  if (monthlyHoa === null) monthlyMissing.push(MISSING_HOA);
  if (monthlySolar === null) monthlyMissing.push(MISSING_SOLAR);

  const initialMonthlyCost = sumAll([monthlyPI, ...recurring]);
  // A subtotal is only meaningful once the mortgage payment itself is known.
  const initialMonthlyKnownSubtotal = monthlyPI === null ? null : sumKnown([monthlyPI, ...recurring]);

  // Recast, modeled against the original term
  const recastPrincipal = Math.max(loanAmount - settings.plannedRecastPrincipal, 0);
  const postRecastPI = hasRate ? mortgagePayment(recastPrincipal, rate, term) : null;
  const postRecastMonthlyCost = sumAll([postRecastPI, ...recurring]);
  const postRecastKnownSubtotal = postRecastPI === null ? null : sumKnown([postRecastPI, ...recurring]);

  // Cash to Close components
  const pointsCost = pointsPercent.value === null ? null : (loanAmount * pointsPercent.value) / 100;
  const lenderFees = sumAll([pointsCost, fixedLenderFee.value]);
  const thirdPartyFees =
    settings.appraisalFee +
    settings.creditReportFee +
    settings.floodCertificateFee +
    settings.mersFee +
    settings.processingFee +
    settings.taxMonitoringFee +
    settings.escrowClosingFee;
  const governmentFees = settings.recordingFee + settings.otherGovernmentFees;
  const closingCosts = sumAll([lenderFees, thirdPartyFees, titleInsurance.value, governmentFees]);

  const prepaidInsurancePremium = monthlyInsurance * settings.prepaidInsuranceMonths;
  // Lenders quote prepaid interest on a 360-day year.
  const dailyInterest = hasRate ? (loanAmount * rate) / 100 / 360 : null;
  const prepaidInterest = multiply(dailyInterest, prepaidInterestDays.value);
  const initialInsuranceReserve = monthlyInsurance * settings.insuranceReserveMonths;
  const initialTaxReserve = monthlyPropertyTax * settings.propertyTaxReserveMonths;
  const prepaidsAndInitialEscrow = sumAll([
    prepaidInsurancePremium,
    prepaidInterest,
    initialInsuranceReserve,
    initialTaxReserve,
  ]);

  const fundsDueFromBorrower = sumAll([downPaymentAmount, closingCosts, prepaidsAndInitialEscrow]);
  const credits = house.sellerCredits + house.lenderCredits;
  const cashToClose = fundsDueFromBorrower === null ? null : Math.max(fundsDueFromBorrower - credits, 0);

  const cashToCloseMissing = [];
  if (rate === null) cashToCloseMissing.push(MISSING_INTEREST_RATE);
  if (pointsPercent.value === null) cashToCloseMissing.push(MISSING_POINTS);

  // Required work, the room below the maximum purchase price for it, and the informational Cash to Acquire
  const requiredWork = calculateRequiredWork(house);
  const requiredWorkCushion = settings.maximumPurchasePrice === null ? null : Math.max(0, settings.maximumPurchasePrice - price);
  const cashToAcquire = sumAll([cashToClose, requiredWork.total]);
  // A minimum only; never a substitute for the complete figure.
  const knownCashToAcquire = cashToClose === null ? null : cashToClose + requiredWork.knownCost;

  const cashToAcquireMissing = [...cashToCloseMissing, ...requiredWork.missing];

  return {
    inputs: {
      downPaymentPercent,
      pointsPercent,
      fixedLenderFee,
      titleInsurance,
      prepaidInterestDays,
      annualPropertyTax,
      annualInsurance,
    },
    downPaymentAmount,
    loanAmount,
    monthlyPI,
    monthlyPropertyTax,
    monthlyInsurance,
    monthlyHoa,
    monthlySolar,
    initialMonthlyCost,
    initialMonthlyKnownSubtotal,
    recastPrincipal,
    postRecastPI,
    postRecastMonthlyCost,
    postRecastKnownSubtotal,
    monthlyMissing,
    pointsCost,
    lenderFees,
    thirdPartyFees,
    governmentFees,
    closingCosts,
    prepaidInsurancePremium,
    prepaidInterest,
    initialInsuranceReserve,
    initialTaxReserve,
    prepaidsAndInitialEscrow,
    fundsDueFromBorrower,
    sellerCredits: house.sellerCredits,
    lenderCredits: house.lenderCredits,
    cashToClose,
    cashToCloseMissing,
    requiredWork,
    requiredWorkCushion,
    cashToAcquire,
    knownCashToAcquire,
    cashToAcquireMissing,
  };
}

/**
 * Calculates price per square foot from the current listing price.
 * @param {object} house - House with its listing-price history and squareFeet.
 * @returns {number|null} Dollars per square foot, or null when square feet is unknown or zero.
 */
export function pricePerSquareFoot(house) {
  if (house.squareFeet === null || house.squareFeet === 0) return null;
  return currentListingPrice(house) / house.squareFeet;
}

/**
 * Reads one option of a multi-select as a yes/no/unknown fact.
 * @param {string[]|null} selection - Stored multi-select value; null when untouched.
 * @param {string} option - Option to look for.
 * @returns {string|null} YES when selected, NO when the field is completed without it, null when untouched.
 */
export function optionState(selection, option) {
  if (selection === null) return null;
  return selection.includes(option) ? YES : NO;
}

/**
 * Counts how many of shoes, coat, and purse the entry supports.
 * @param {object} house - House with entryShoes, entryCoat, and entryPurse.
 * @returns {number|null} Count from 0 to 3, or null when any of the three is unknown.
 */
export function entrySupportCount(house) {
  let count = 0;
  for (const answer of [house.entryShoes, house.entryCoat, house.entryPurse]) {
    if (answer === null) return null;
    if (answer === YES) count += 1;
  }
  return count;
}

/**
 * Finds the current listing price: the most recent entry in the listing-price history.
 * @param {{ priceHistory: Array<{ price: number, date: string }> }} house - House with at least one history entry.
 * @returns {number} The current listing price in dollars.
 */
export function currentListingPrice(house) {
  let latest = house.priceHistory[0];
  for (const entry of house.priceHistory) {
    // On or after, so the later-entered of two same-day entries wins.
    if (entry.date >= latest.date) latest = entry;
  }
  return latest.price;
}

/**
 * Counts whole calendar days from one date to another, with no time-zone drift.
 * @param {string} from - Start date as YYYY-MM-DD.
 * @param {string} to - End date as YYYY-MM-DD.
 * @returns {number} Days from start to end; negative when the end is earlier.
 */
export function daysBetween(from, to) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const ms = Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay);
  return Math.round(ms / 86400000);
}

/**
 * Calculates Days on Market, which stops counting at the Status Date once a house leaves Available.
 * @param {object} house - House with listingDate, status, and statusDate.
 * @param {string} today - Today's date as YYYY-MM-DD.
 * @returns {number|null} Days on market, or null when a house off the market has no Status Date.
 */
export function daysOnMarket(house, today) {
  const end = house.status === STATUS_AVAILABLE ? today : house.statusDate;
  if (end === null) return null;
  // A listing date still in the future has not started counting.
  return Math.max(0, daysBetween(house.listingDate, end));
}

/**
 * Lists the listing-price history newest first, with each entry's change from the one before it.
 * @param {object} house - House with its listing-price history.
 * @returns {Array<{ id: string, price: number, date: string, change: number|null }>} Entries; change is null for the first.
 */
export function priceHistoryChanges(house) {
  const entries = [];
  let previous = null;
  for (const entry of house.priceHistory) {
    entries.push({ ...entry, change: previous === null ? null : entry.price - previous.price });
    previous = entry;
  }
  return entries.reverse();
}

/**
 * Calculates price per square foot of lot, converting the lot size from acres.
 * @param {object} house - House with its listing-price history and lotAcres.
 * @returns {number|null} Dollars per lot square foot, or null when the lot size is unknown or zero.
 */
export function pricePerLotSquareFoot(house) {
  if (house.lotAcres === null || house.lotAcres === 0) return null;
  return currentListingPrice(house) / (house.lotAcres * SQUARE_FEET_PER_ACRE);
}

/* --------------------------------------------------------------------------
   Map position
   -------------------------------------------------------------------------- */

const RADIANS_PER_DEGREE = Math.PI / 180;
// The smallest stretch of ground the Houses map shows, so one house or a tight cluster still has streets around it.
const MAP_MIN_SPAN_METERS = 3000;
// Room left around the outermost houses, as a share of their spread on each side.
const MAP_PADDING = 0.15;

/**
 * Places a latitude and longitude on the map, using the projection map.json describes.
 * @param {number|null} latitude - Latitude in decimal degrees, or null when unknown.
 * @param {number|null} longitude - Longitude in decimal degrees, or null when unknown.
 * @param {{ bounds: object, earthRadius: number, scale: number, offsetX: number, offsetY: number }} map - Map metadata from map.json.
 * @returns {{ x: number, y: number }|null} SVG coordinates, or null when either value is unknown or the point is off the map.
 */
export function mapPoint(latitude, longitude, map) {
  if (latitude === null || longitude === null) return null;
  const { north, south, west, east } = map.bounds;
  if (latitude > north || latitude < south || longitude < west || longitude > east) return null;
  const lat = latitude * RADIANS_PER_DEGREE;
  const lon = longitude * RADIANS_PER_DEGREE;
  return {
    x: map.scale * map.earthRadius * lon + map.offsetX,
    y: map.offsetY - map.scale * map.earthRadius * Math.log(Math.tan(Math.PI / 4 + lat / 2)),
  };
}

/**
 * Chooses the part of the map to show: the houses with room around them, at the frame's shape.
 * @param {Array<{ x: number, y: number }>} points - Houses' map positions.
 * @param {number} aspect - Frame width divided by height.
 * @param {{ viewBox: number[], bounds: object, scale: number }} map - Map metadata from map.json.
 * @returns {number[]} SVG viewBox as [x, y, width, height]; with no points, as much of the map as fills the frame.
 */
export function fitMapView(points, aspect, map) {
  const [mapX, mapY, mapWidth, mapHeight] = map.viewBox;
  let left = mapX;
  let right = mapX + mapWidth;
  let top = mapY;
  let bottom = mapY + mapHeight;
  let width = mapWidth;
  let height = mapHeight;
  if (points.length > 0) {
    left = Math.min(...points.map((point) => point.x));
    right = Math.max(...points.map((point) => point.x));
    top = Math.min(...points.map((point) => point.y));
    bottom = Math.max(...points.map((point) => point.y));
    // Web Mercator stretches ground distance by 1 / cos(latitude); the map's middle latitude is close enough across it.
    const middle = ((map.bounds.north + map.bounds.south) / 2) * RADIANS_PER_DEGREE;
    const minSpan = (MAP_MIN_SPAN_METERS * map.scale) / Math.cos(middle);
    width = Math.max((right - left) * (1 + 2 * MAP_PADDING), minSpan);
    height = Math.max((bottom - top) * (1 + 2 * MAP_PADDING), minSpan);
  }
  // Houses are given more room to reach the frame's shape; the whole map is cropped to it instead, so no part of the frame is left blank.
  const narrower = width / height < aspect;
  if (points.length === 0) {
    if (narrower) height = width / aspect;
    else width = height * aspect;
  } else if (narrower) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }
  // Centered on the houses, then slid back onto the map when it would run off an edge it is small enough to stay within.
  let x = (left + right - width) / 2;
  let y = (top + bottom - height) / 2;
  if (width <= mapWidth) x = Math.min(Math.max(x, mapX), mapX + mapWidth - width);
  if (height <= mapHeight) y = Math.min(Math.max(y, mapY), mapY + mapHeight - height);
  return [x, y, width, height];
}

// The closest the Houses map zooms in: a view this many times narrower than the whole map, about 470 m across.
export const MAP_MAX_ZOOM = 80;

/**
 * Gives the narrowest and widest views a frame of this shape may show of the map.
 * @param {number} aspect - Frame width divided by height.
 * @param {{ viewBox: number[] }} map - Map metadata from map.json.
 * @returns {{ min: number, max: number }} Smallest and largest view widths in map units; the widest still lies wholly on the map.
 */
export function mapZoomLimits(aspect, map) {
  const [, , mapWidth, mapHeight] = map.viewBox;
  const max = Math.min(mapWidth, mapHeight * aspect);
  return { min: Math.min(mapWidth / MAP_MAX_ZOOM, max), max };
}

/**
 * Keeps a view on the map: sized within the zoom limits about its center, then slid back inside the map's edges.
 * @param {number[]} view - View as [x, y, width, height] in map units.
 * @param {{ viewBox: number[] }} map - Map metadata from map.json.
 * @returns {number[]} The view as [x, y, width, height], wholly on the map.
 */
export function clampMapView(view, map) {
  const [mapX, mapY, mapWidth, mapHeight] = map.viewBox;
  let [x, y, width, height] = view;
  const aspect = width / height;
  const { min, max } = mapZoomLimits(aspect, map);
  const limited = Math.min(Math.max(width, min), max);
  if (limited !== width) {
    x += (width - limited) / 2;
    y += (height - limited / aspect) / 2;
    width = limited;
    height = limited / aspect;
  }
  x = Math.min(Math.max(x, mapX), mapX + mapWidth - width);
  y = Math.min(Math.max(y, mapY), mapY + mapHeight - height);
  return [x, y, width, height];
}

/**
 * Finds the map position under a point in the frame.
 * @param {number[]} view - View as [x, y, width, height] in map units.
 * @param {{ x: number, y: number }} point - Point in CSS pixels from the frame's top-left corner.
 * @param {{ width: number, height: number }} frame - Frame size in CSS pixels.
 * @returns {{ x: number, y: number }} The map position under the point.
 */
export function mapPointAt(view, point, frame) {
  return { x: view[0] + (point.x * view[2]) / frame.width, y: view[1] + (point.y * view[3]) / frame.height };
}

/**
 * Moves and zooms the view so a map position sits under a point: for drag, pinch, wheel, and double-tap.
 * @param {number[]} start - View as [x, y, width, height] when the gesture began.
 * @param {{ x: number, y: number }} anchor - Map position that stays under the point.
 * @param {{ x: number, y: number }} point - Where the anchor is now, in CSS pixels from the frame's top-left corner.
 * @param {number} scale - Zoom since the gesture began: 2 is twice as close, 1 is only a move.
 * @param {{ width: number, height: number }} frame - Frame size in CSS pixels.
 * @param {{ viewBox: number[] }} map - Map metadata from map.json.
 * @returns {number[]} The new view as [x, y, width, height], within the zoom limits and on the map.
 */
export function gestureMapView(start, anchor, point, scale, frame, map) {
  const aspect = frame.width / frame.height;
  const { min, max } = mapZoomLimits(aspect, map);
  // The zoom is limited first, so the anchor stays under the point right up to the limit.
  const width = Math.min(Math.max(start[2] / scale, min), max);
  const height = width / aspect;
  return clampMapView([anchor.x - (point.x * width) / frame.width, anchor.y - (point.y * height) / frame.height, width, height], map);
}
