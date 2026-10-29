// Normalized scores, rollups, availability, and Information Completeness.
//
// Scoring reads facts and never writes them. Unknown criteria are left out of every
// weighted mean and the remaining weights renormalize; unknown is never scored as zero.

import {
  NA,
  NO,
  YES,
  PROJECT_AREAS,
  PROJECT_WANT,
  GARAGE_OPTIONS,
  PARKING_ATTACHED_GARAGE,
  DESCENDING_SORTS,
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
  STATUS_SOLD,
  projectsAnswered,
} from './data.js';
import { calculateFinancing, currentListingPrice, entrySupportCount, optionState, pricePerLotSquareFoot, pricePerSquareFoot } from './calculations.js';

export const KNOWN = 'known';
export const UNKNOWN = 'unknown';
export const NOT_APPLICABLE = 'notApplicable';

export const OVERALL_FIT_MIN_COMPLETENESS = 50;

// Reasons Stability & Security is unavailable.
export const STABILITY_NO_FINANCIAL_SCORE = 'noFinancialScore';
export const STABILITY_UNCOSTED_WORK = 'uncostedRequiredWork';

/* --------------------------------------------------------------------------
   Curves and mappings (SCORING_CURVES.md)
   -------------------------------------------------------------------------- */

// Each curve is a list of [value, score] breakpoints, lowest value first.
export const CURVES = {
  train: [[0, 100], [5, 100], [10, 80], [15, 50], [20, 25], [30, 0]],
  grocery: [[0, 100], [5, 100], [10, 90], [15, 75], [20, 50], [25, 30], [30, 15], [40, 0]],
  lightRail: [[0, 100], [5, 100], [10, 80], [15, 50], [20, 25], [30, 0]],
  freeway: [[0, 100], [5, 100], [10, 80], [15, 50], [20, 30], [30, 0]],
  parents: [[0, 100], [15, 100], [20, 85], [30, 50], [40, 25], [50, 10], [60, 0]],
  airport: [[0, 100], [15, 100], [20, 85], [30, 50], [40, 25], [50, 10], [60, 0]],
  // Fewer than two bathrooms scores nothing, and nothing is added past two and a half.
  bathrooms: [[1.5, 0], [2, 75], [2.5, 100]],
  exteriorSteps: [[0, 100], [1, 100], [3, 95], [5, 80], [8, 55], [12, 20], [15, 0]],
  // Required work as a share of the required-work cushion.
  cushionShare: [[0, 100], [0.25, 100], [0.5, 85], [0.75, 60], [1, 30], [1.5, 0]],
};

const ENTRY_SCORES = [0, 40, 75, 100];
const EXCITED_PROJECT_SCORES = [50, 70, 85, 95, 100];
const UNWANTED_PROJECT_PENALTY = 10;
// Garage scores by the best garage present; power modifies it, and unknown power sits between yes and no.
const GARAGE_SCORES = {
  attachedGarage: { power: 100, unknownPower: 90, noPower: 85 },
  detachedGarage: { power: 85, unknownPower: 75, noPower: 70 },
};

// Delight features add to Overall Fit after weighting; absence costs nothing and they are not criteria.
export const DELIGHT_POINTS = 1;
const CARPORT_SCORE = 65;
const INITIAL_MONTHLY_SHARE = 0.6;
const POST_RECAST_SHARE = 0.4;

const WINDOW_EXPOSURE_SCORES = {
  privateOutdoor: 100,
  neighborProperty: 80,
  street: 70,
  publicSidewalk: 50,
  directNeighborWindow: 25,
};

const EQUIPMENT_STATUS_SCORES = { good: 100, older: 65, soon: 30, failed: 0 };

/* --------------------------------------------------------------------------
   Hierarchy and weights (SCORING_MODEL.md)
   -------------------------------------------------------------------------- */

// Criterion types:
//   yes      - yes/no field; yes scores 100
//   no       - yes/no field phrased as an undesirable condition; no scores 100
//   curve    - numeric field scored on a breakpoint curve; `unit` names its unit for display
//   map      - single-select field scored by option
//   option   - one option of a multi-select; selected scores `score` (default 100)
//   anything else names a purpose-built scorer in scoreCriterion
export const CATEGORIES = [
  {
    id: 'stability',
    label: 'Stability & Security',
    weight: 34,
    subcategories: [
      {
        id: 'ongoingCost',
        label: 'Ongoing Cost',
        weight: 45,
        criteria: [{ id: 'ongoingCost', label: 'Monthly housing cost', weight: 100, type: 'ongoingCost' }],
      },
      {
        id: 'acquisitionCost',
        label: 'Acquisition Cost',
        weight: 35,
        criteria: [
          { id: 'cashToClose', label: 'Cash to close', weight: 60, type: 'cashToClose' },
          { id: 'requiredWorkCushion', label: 'Required work cushion', weight: 40, type: 'requiredWorkCushion' },
        ],
      },
      {
        id: 'majorSystems',
        label: 'Major Systems',
        weight: 20,
        criteria: [
          {
            id: 'foundation',
            label: 'Foundation',
            weight: 20,
            type: 'map',
            field: 'foundation',
            scores: { clear: 100, minorIssue: 60, significantIssue: 0 },
          },
          {
            id: 'electrical',
            label: 'Electrical',
            weight: 16,
            type: 'map',
            field: 'electrical',
            scores: { modern: 100, older: 70, significantIssue: 0 },
          },
          {
            id: 'sewer',
            label: 'Sewer',
            weight: 16,
            type: 'map',
            field: 'sewer',
            scores: { clear: 100, minorIssue: 60, significantIssue: 0 },
          },
          {
            id: 'roof',
            label: 'Roof',
            weight: 12,
            type: 'map',
            field: 'roofStatus',
            scores: { good: 100, mediumTerm: 65, soon: 30, failed: 0 },
          },
          {
            id: 'plumbing',
            label: 'Plumbing',
            weight: 12,
            type: 'map',
            field: 'plumbing',
            scores: { modern: 100, older: 70, materialConcern: 30, failure: 0 },
          },
          {
            id: 'waterHeater',
            label: 'Water heater',
            weight: 8,
            type: 'map',
            field: 'waterHeaterStatus',
            scores: EQUIPMENT_STATUS_SCORES,
          },
          {
            id: 'waterIntrusion',
            label: 'Water intrusion',
            weight: 8,
            type: 'map',
            field: 'waterIntrusion',
            scores: { none: 100, remediated: 70, unresolved: 0 },
          },
          {
            id: 'furnace',
            label: 'Furnace',
            weight: 8,
            type: 'map',
            field: 'furnaceStatus',
            scores: EQUIPMENT_STATUS_SCORES,
          },
        ],
      },
    ],
  },
  {
    id: 'livability',
    label: 'Livability',
    weight: 34,
    subcategories: [
      {
        id: 'location',
        label: 'Location',
        weight: 16,
        criteria: [
          { id: 'train', label: 'Train', weight: 40, type: 'curve', field: 'trainMinutes', curve: CURVES.train, unit: 'min' },
          { id: 'grocery', label: 'Grocery', weight: 30, type: 'curve', field: 'groceryMinutes', curve: CURVES.grocery, unit: 'min' },
          { id: 'freeway', label: 'Freeway', weight: 18, type: 'curve', field: 'freewayMinutes', curve: CURVES.freeway, unit: 'min' },
          {
            id: 'lightRail',
            label: 'Light rail',
            weight: 12,
            type: 'curve',
            field: 'lightRailMinutes',
            curve: CURVES.lightRail,
            unit: 'min',
          },
        ],
      },
      {
        id: 'bathroom',
        label: 'Bathroom & Getting Ready',
        weight: 17,
        criteria: [
          { id: 'privatePrimaryBath', label: 'Private primary bathroom', weight: 55, type: 'yes', field: 'privatePrimaryBath' },
          {
            id: 'bathroomCount',
            label: 'Bathrooms',
            weight: 15,
            type: 'curve',
            field: 'bathrooms',
            curve: CURVES.bathrooms,
            unit: 'baths',
          },
          { id: 'skincareOnCounter', label: 'Skincare can live on counter', weight: 9, type: 'yes', field: 'skincareOnCounter' },
          {
            id: 'tub',
            label: 'Tub',
            weight: 7,
            type: 'map',
            field: 'tubAvailability',
            scores: { primary: 100, elsewhere: 50, none: 0 },
          },
          { id: 'outletAtVanity', label: 'Outlet at vanity', weight: 6, type: 'yes', field: 'outletAtVanity' },
          { id: 'vanityStorage', label: 'Vanity storage', weight: 4, type: 'option', field: 'bathroomStorage', option: 'vanity' },
          { id: 'linenStorage', label: 'Linen storage', weight: 3, type: 'option', field: 'bathroomStorage', option: 'linen' },
          {
            id: 'medicineCabinet',
            label: 'Medicine cabinet',
            weight: 1,
            type: 'option',
            field: 'bathroomStorage',
            option: 'medicineCabinet',
          },
        ],
      },
      {
        id: 'primaryBedroom',
        label: 'Primary Bedroom',
        weight: 9,
        criteria: [
          {
            id: 'bedroomFloor',
            label: 'Primary bedroom floor',
            weight: 45,
            type: 'map',
            field: 'bedroomFloor',
            scores: { upper: 100, lower: 100, main: 50 },
          },
          { id: 'windowPrivacy', label: 'Bedroom window privacy', weight: 35, type: 'windowPrivacy' },
          {
            id: 'closetType',
            label: 'Closet',
            weight: 20,
            type: 'map',
            field: 'closetType',
            scores: { walkIn: 100, reachIn: 50 },
          },
        ],
      },
      {
        id: 'householdStorage',
        label: 'Household Storage',
        weight: 8,
        criteria: [
          { id: 'storageVacuum', label: 'Vacuum / broom storage', weight: 30, type: 'yes', field: 'storageVacuum' },
          { id: 'storageCleaning', label: 'Cleaning supply storage', weight: 25, type: 'yes', field: 'storageCleaning' },
          { id: 'storageTools', label: 'Tools / maintenance storage', weight: 20, type: 'yes', field: 'storageTools' },
          { id: 'storageSeasonal', label: 'Seasonal / holiday storage', weight: 15, type: 'yes', field: 'storageSeasonal' },
          { id: 'storageBulk', label: 'Bulk goods storage', weight: 10, type: 'yes', field: 'storageBulk' },
        ],
      },
      {
        id: 'exterior',
        label: 'Exterior & Upkeep',
        weight: 6,
        criteria: [
          { id: 'noParkStrip', label: 'Park strip', weight: 32, type: 'no', field: 'parkStrip' },
          { id: 'irrigation', label: 'Automatic irrigation', weight: 28, type: 'irrigation' },
          { id: 'matureTrees', label: 'Mature trees', weight: 20, type: 'yes', field: 'matureTrees' },
          { id: 'noSidewalkToShovel', label: 'Sidewalk to shovel', weight: 20, type: 'no', field: 'sidewalkToShovel' },
        ],
      },
      {
        id: 'parking',
        label: 'Parking & Arrival',
        weight: 14,
        criteria: [
          { id: 'garage', label: 'Garage', weight: 45, type: 'garage' },
          { id: 'driveway', label: 'Driveway', weight: 20, type: 'option', field: 'parking', option: 'driveway' },
          { id: 'functionalEntry', label: 'Entry / drop zone', weight: 10, type: 'functionalEntry' },
          {
            id: 'carport',
            label: 'Carport',
            weight: 6,
            type: 'option',
            field: 'parking',
            option: 'carport',
            score: CARPORT_SCORE,
          },
          {
            id: 'exteriorSteps',
            label: 'Exterior steps',
            weight: 6,
            type: 'curve',
            field: 'exteriorSteps',
            curve: CURVES.exteriorSteps,
            unit: 'steps',
          },
          {
            id: 'dedicatedUncovered',
            label: 'Dedicated uncovered parking',
            weight: 3,
            type: 'option',
            field: 'parking',
            option: 'dedicatedUncovered',
          },
          { id: 'coveredRoute', label: 'Covered route to house', weight: 3, type: 'coveredRoute' },
          { id: 'streetParking', label: 'Street parking', weight: 2, type: 'option', field: 'parking', option: 'street' },
          { id: 'garageWorkspace', label: 'Garage workspace', weight: 2, type: 'garageWorkspace' },
          { id: 'parkingCombination', label: 'Parking combination', weight: 3, type: 'parkingCombination' },
        ],
      },
      {
        id: 'livingRoom',
        label: 'Living Room',
        weight: 8,
        criteria: [
          { id: 'megacouchFits', label: 'Megacouch fits', weight: 30, type: 'yes', field: 'megacouchFits' },
          { id: 'tvAreaNotThoroughfare', label: 'Couch-to-TV area is a thoroughfare', weight: 25, type: 'no', field: 'tvAreaIsThoroughfare' },
          { id: 'tvNotBackToDoor', label: 'TV seating puts back to front door', weight: 20, type: 'no', field: 'tvBackToFrontDoor' },
          { id: 'christmasTreeSpot', label: 'Christmas tree location', weight: 15, type: 'yes', field: 'christmasTreeSpot' },
          { id: 'tvNotBackToWindows', label: 'TV seating puts back to windows', weight: 10, type: 'no', field: 'tvBackToWindows' },
        ],
      },
      {
        id: 'kitchen',
        label: 'Kitchen',
        weight: 8,
        criteria: [
          { id: 'sinkStoveWorks', label: 'Sink / stove relationship works', weight: 30, type: 'yes', field: 'sinkStoveWorks' },
          { id: 'foodStorage', label: 'Food storage', weight: 25, type: 'foodStorage' },
          { id: 'dishwasherBesideSink', label: 'Dishwasher beside sink', weight: 20, type: 'yes', field: 'dishwasherBesideSink' },
          { id: 'counterBesideStove', label: 'Counter beside stove', weight: 15, type: 'yes', field: 'counterBesideStove' },
          { id: 'counterBesideSink', label: 'Counter beside sink', weight: 10, type: 'yes', field: 'counterBesideSink' },
        ],
      },
      {
        id: 'propertyForm',
        label: 'Property Form',
        weight: 7,
        criteria: [
          {
            id: 'detached',
            label: 'Property type',
            weight: 50,
            type: 'map',
            field: 'propertyType',
            scores: { detached: 100, townhouse: 50, condo: 35 },
          },
          { id: 'cornerLot', label: 'Corner lot', weight: 50, type: 'yes', field: 'cornerLot' },
        ],
      },
      {
        id: 'laundry',
        label: 'Laundry',
        weight: 4,
        criteria: [
          { id: 'laundrySupplyStorage', label: 'Laundry supply storage', weight: 45, type: 'yes', field: 'laundrySupplyStorage' },
          { id: 'laundrySameFloor', label: 'Laundry on same floor as primary', weight: 30, type: 'yes', field: 'laundrySameFloor' },
          { id: 'laundryUsableSpace', label: 'Usable space for handling laundry', weight: 25, type: 'yes', field: 'laundryUsableSpace' },
        ],
      },
      {
        id: 'eating',
        label: 'Eating',
        weight: 3,
        criteria: [
          { id: 'counterSeating', label: 'Counter / bar seating', weight: 70, type: 'yes', field: 'counterSeating' },
          { id: 'diningTableSpace', label: 'Dining table space', weight: 30, type: 'yes', field: 'diningTableSpace' },
        ],
      },
    ],
  },
  {
    id: 'deepConnection',
    label: 'Deep Connection',
    weight: 12,
    subcategories: [
      {
        id: 'salem',
        label: 'Salem',
        weight: 45,
        criteria: [
          { id: 'litterBoxSpot', label: 'Litter-box location', weight: 35, type: 'yes', field: 'litterBoxSpot' },
          { id: 'catTreeSpot', label: 'Cat-tree location', weight: 28, type: 'yes', field: 'catTreeSpot' },
          { id: 'safeOutdoor', label: 'Safe outdoor option', weight: 22, type: 'safeOutdoor' },
          { id: 'fullyFenced', label: 'Fully fenced outdoor space', weight: 15, type: 'yes', field: 'fullyFenced' },
        ],
      },
      {
        id: 'proximity',
        label: 'Proximity',
        weight: 40,
        criteria: [
          { id: 'parents', label: 'Parents', weight: 69, type: 'curve', field: 'parentsMinutes', curve: CURVES.parents, unit: 'min' },
          { id: 'airport', label: 'Airport', weight: 31, type: 'curve', field: 'airportMinutes', curve: CURVES.airport, unit: 'min' },
        ],
      },
      {
        id: 'guestUsability',
        label: 'Guest Usability',
        weight: 15,
        criteria: [{ id: 'guestFullBath', label: 'Full bathroom available to guests', weight: 100, type: 'yes', field: 'guestFullBath' }],
      },
    ],
  },
  {
    id: 'creativeAuthorship',
    label: 'Creative Authorship',
    weight: 10,
    subcategories: [
      {
        id: 'creativeAuthorship',
        label: 'Creative Authorship',
        weight: 100,
        implicit: true,
        criteria: [{ id: 'creativeAuthorship', label: 'Optional projects', weight: 100, type: 'creativeAuthorship' }],
      },
    ],
  },
  {
    id: 'contentment',
    label: 'Contentment',
    weight: 10,
    subcategories: [
      {
        id: 'contentment',
        label: 'Contentment',
        weight: 100,
        implicit: true,
        criteria: [
          { id: 'likeBeingHere', label: 'I actually like being here', weight: 35, type: 'yes', field: 'likeBeingHere' },
          { id: 'liveAsIsThreeYears', label: 'I could happily live here as-is for three years', weight: 30, type: 'yes', field: 'liveAsIsThreeYears' },
          { id: 'sadIfSold', label: 'I would be sad if someone bought it tonight', weight: 20, type: 'yes', field: 'sadIfSold' },
          { id: 'wantToGoBack', label: 'I want to go back inside', weight: 15, type: 'yes', field: 'wantToGoBack' },
        ],
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   Result helpers
   -------------------------------------------------------------------------- */

/**
 * Builds the result for a criterion that could be scored.
 * @param {number} score - Normalized score from 0 to 100.
 * @param {*} value - The observation the score came from.
 * @returns {{ state: string, score: number, value: * }} A known result.
 */
function known(score, value) {
  return { state: KNOWN, score, value };
}

/**
 * Builds the result for a criterion whose inputs are not all known.
 * @returns {{ state: string, score: null, value: null }} An unknown, unscored result.
 */
function unknown() {
  return { state: UNKNOWN, score: null, value: null };
}

/**
 * Builds the result for a criterion that does not apply to the property.
 * @returns {{ state: string, score: null, value: null }} A not-applicable, unscored result.
 */
function notApplicable() {
  return { state: NOT_APPLICABLE, score: null, value: null };
}

/* --------------------------------------------------------------------------
   Scoring functions
   -------------------------------------------------------------------------- */

/**
 * Scores a value on a piecewise-linear curve, clamping outside the breakpoints.
 * @param {Array<[number, number]>} points - Breakpoints as [value, score], lowest value first.
 * @param {number} value - Value to score.
 * @returns {number} Interpolated score.
 */
export function interpolate(points, value) {
  if (value <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [x2, y2] = points[index];
    if (value <= x2) {
      const [x1, y1] = points[index - 1];
      return y1 + ((value - x1) / (x2 - x1)) * (y2 - y1);
    }
  }
  return points[points.length - 1][1];
}

/**
 * Scores a cost against the user's comfortable and maximum anchors.
 * @param {number} cost - Monthly housing cost or Cash to Close in dollars.
 * @param {number} comfortable - Comfortable target in dollars.
 * @param {number} maximum - Maximum target in dollars; must exceed comfortable.
 * @returns {number} Score from 0 to 100.
 */
export function scoreCost(cost, comfortable, maximum) {
  const points = [
    [comfortable * 0.75, 100],
    [comfortable, 85],
    [(comfortable + maximum) / 2, 50],
    [maximum, 0],
  ];
  return interpolate(points, cost);
}

/**
 * Checks that a comfortable/maximum pair is configured and usable.
 * @param {number|null} comfortable - Comfortable target, or null when not configured.
 * @param {number|null} maximum - Maximum target, or null when not configured.
 * @returns {boolean} True when both are set and maximum exceeds comfortable.
 */
function hasTargets(comfortable, maximum) {
  return comfortable !== null && maximum !== null && maximum > comfortable;
}

/**
 * Scores Ongoing Cost from the initial and post-recast monthly housing costs.
 * @param {object} financing - Result of calculateFinancing.
 * @param {object} settings - Settings with the monthly cost targets.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreOngoingCost(financing, settings) {
  const { initialMonthlyCost, postRecastMonthlyCost } = financing;
  const { comfortableMonthlyCost, maximumMonthlyCost } = settings;
  if (initialMonthlyCost === null || postRecastMonthlyCost === null) return unknown();
  if (!hasTargets(comfortableMonthlyCost, maximumMonthlyCost)) return unknown();
  const initialScore = scoreCost(initialMonthlyCost, comfortableMonthlyCost, maximumMonthlyCost);
  const postRecastScore = scoreCost(postRecastMonthlyCost, comfortableMonthlyCost, maximumMonthlyCost);
  const score = initialScore * INITIAL_MONTHLY_SHARE + postRecastScore * POST_RECAST_SHARE;
  return known(score, { initialMonthlyCost, postRecastMonthlyCost, initialScore, postRecastScore });
}

/**
 * Scores Cash to Close against the cash-to-close targets; required work is not part of it.
 * @param {object} financing - Result of calculateFinancing.
 * @param {object} settings - Settings with the cash-to-close targets.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreCashToClose(financing, settings) {
  const { cashToClose } = financing;
  const { comfortableCashToClose, maximumCashToClose } = settings;
  if (cashToClose === null) return unknown();
  if (!hasTargets(comfortableCashToClose, maximumCashToClose)) return unknown();
  return known(scoreCost(cashToClose, comfortableCashToClose, maximumCashToClose), cashToClose);
}

/**
 * Scores Immediate Required Work by how much of the room below the maximum purchase price it uses.
 * @param {object} financing - Result of calculateFinancing.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreRequiredWorkCushion(financing) {
  const work = financing.requiredWork.total;
  const cushion = financing.requiredWorkCushion;
  if (work === null || cushion === null) return unknown();
  const value = { work, cushion };
  // No required work scores fully, even with no cushion; work with no cushion at all scores nothing.
  if (work === 0) return known(100, value);
  if (cushion === 0) return known(0, value);
  return known(interpolate(CURVES.cushionShare, work / cushion), value);
}

/**
 * Scores a yes/no answer.
 * @param {string|null} answer - YES, NO, or null when unknown.
 * @param {number} yesScore - Score for YES.
 * @param {number} noScore - Score for NO.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreAnswer(answer, yesScore, noScore) {
  if (answer === YES) return known(yesScore, answer);
  if (answer === NO) return known(noScore, answer);
  return unknown();
}

/**
 * Finds the most valuable garage type selected; a second garage adds nothing here.
 * @param {string[]} parking - Answered Available Parking selections.
 * @returns {string|null} The attached or detached garage option, or null when there is no garage.
 */
function bestGarage(parking) {
  for (const option of GARAGE_OPTIONS) {
    if (parking.includes(option)) return option;
  }
  return null;
}

/**
 * Scores Garage from the best garage type present, where power modifies the score.
 * @param {object} house - House with parking and garagePower.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreGarage(house) {
  if (house.parking === null) return unknown();
  const garage = bestGarage(house.parking);
  if (garage === null) return known(0, { garage: null, power: null });
  // Power only modifies a garage already known to exist, so unknown power scores between yes and no
  // rather than leaving the whole criterion unknown.
  const scores = GARAGE_SCORES[garage];
  let score = scores.unknownPower;
  if (house.garagePower === YES) score = scores.power;
  if (house.garagePower === NO) score = scores.noPower;
  return known(score, { garage, power: house.garagePower });
}

/**
 * Scores Covered Route, which does not apply when an attached garage already gives one.
 * @param {object} house - House with parking and coveredRoute.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreCoveredRoute(house) {
  if (optionState(house.parking, PARKING_ATTACHED_GARAGE) === YES) return notApplicable();
  return scoreAnswer(house.coveredRoute, 100, 0);
}

/**
 * Scores Garage Workspace, where having no garage is a known negative.
 * @param {object} house - House with parking and garageWorkspace.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreGarageWorkspace(house) {
  if (house.parking === null) return unknown();
  if (bestGarage(house.parking) === null) return known(0, NO);
  return scoreAnswer(house.garageWorkspace, 100, 0);
}

/**
 * Scores Functional Entry / Drop Zone from support for shoes, coat, and purse.
 * @param {object} house - House with the three entry-support answers.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreFunctionalEntry(house) {
  const count = entrySupportCount(house);
  if (count === null) return unknown();
  return known(ENTRY_SCORES[count], count);
}

/**
 * Scores the highest-value parking combination; a carport counts as a dedicated space.
 * @param {object} house - House with the parking multi-select.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreParkingCombination(house) {
  const parking = house.parking;
  if (parking === null) return unknown();
  // Either garage type counts as the garage; attached plus detached is not a combination.
  const garage = bestGarage(parking) !== null;
  const driveway = parking.includes('driveway');
  const dedicated = parking.includes('dedicatedUncovered') || parking.includes('carport');
  if (garage && driveway) return known(100, parking);
  if (garage && dedicated) return known(80, parking);
  if (driveway && dedicated) return known(60, parking);
  return known(0, parking);
}

/**
 * Scores Adequate Food Storage from the number of workable storage types.
 * @param {object} house - House with the foodStorage multi-select.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreFoodStorage(house) {
  const storage = house.foodStorage;
  if (storage === null) return unknown();
  if (storage.length === 0) return known(0, storage);
  return known(storage.length === 1 ? 70 : 100, storage);
}

/**
 * Scores Bedroom Window Privacy using the most privacy-limiting exposure.
 * @param {object} house - House with the bedroomWindowExposure multi-select.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreWindowPrivacy(house) {
  const exposures = house.bedroomWindowExposure;
  // This field has no None option, so an empty selection is unknown.
  if (exposures === null || exposures.length === 0) return unknown();
  let lowest = 100;
  for (const exposure of exposures) {
    lowest = Math.min(lowest, WINDOW_EXPOSURE_SCORES[exposure]);
  }
  return known(lowest, exposures);
}

/**
 * Scores Safe Outdoor Option for Salem; more options earn nothing extra.
 * @param {object} house - House with the safeOutdoor multi-select.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreSafeOutdoor(house) {
  const options = house.safeOutdoor;
  if (options === null) return unknown();
  return known(options.length > 0 ? 100 : 0, options);
}

/**
 * Scores Automatic Irrigation, which can be not applicable.
 * @param {object} house - House with the irrigation answer.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreIrrigation(house) {
  if (house.irrigation === NA) return notApplicable();
  return scoreAnswer(house.irrigation, 100, 0);
}

/**
 * Scores Creative Authorship from the optional projects, once every project area has been answered.
 * @param {object} house - House with projects.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
function scoreCreativeAuthorship(house) {
  // An untouched area is unknown, not No change, so the score waits for every area.
  if (!projectsAnswered(house)) return unknown();
  let excited = 0;
  let unwanted = 0;
  for (const area of PROJECT_AREAS) {
    const project = house.projects[area];
    if (project.state !== PROJECT_WANT) continue;
    if (project.excited === null) return unknown();
    if (project.excited === YES) excited += 1;
    else unwanted += 1;
  }
  const base = EXCITED_PROJECT_SCORES[Math.min(excited, EXCITED_PROJECT_SCORES.length - 1)];
  const score = Math.min(100, Math.max(0, base - unwanted * UNWANTED_PROJECT_PENALTY));
  return known(score, { excited, unwanted });
}

// Delight features, in a fixed order, with the names comparisons give them.
export const DELIGHTS = [
  { id: 'attachedGarage', label: 'Attached garage' },
  { id: 'privatePrimaryBath', label: 'Private primary bathroom' },
  { id: 'fireplace', label: 'Fireplace' },
  { id: 'bayWindow', label: 'Bay window' },
];

// Delights that are also scored criteria: a comparison adds the bonus to that criterion's difference.
const DELIGHT_CRITERIA = { attachedGarage: 'garage', privatePrimaryBath: 'privatePrimaryBath' };

/**
 * Reads each delight feature as a yes/no/unknown answer.
 * @param {object} house - House with parking, privatePrimaryBath, fireplace, and bayWindow.
 * @returns {Object<string, string|null>} YES, NO, or null for each delight id.
 */
export function delightAnswers(house) {
  const answers = {};
  for (const { id } of DELIGHTS) {
    answers[id] = id === 'attachedGarage' ? optionState(house.parking, PARKING_ATTACHED_GARAGE) : house[id];
  }
  return answers;
}

/**
 * Lists the delight features a house has: each answered Yes earns a small Overall Fit bonus.
 * @param {Object<string, string|null>} answers - Each delight's answer, from delightAnswers.
 * @returns {string[]} Ids of the features present, in a fixed order; unknown and No are left out.
 */
export function delightFeatures(answers) {
  const present = [];
  for (const { id } of DELIGHTS) {
    if (answers[id] === YES) present.push(id);
  }
  return present;
}

/**
 * Scores one criterion from the registry.
 * @param {object} criterion - Criterion definition from CATEGORIES.
 * @param {{ house: object, settings: object, financing: object }} context - Facts to score from.
 * @returns {{ state: string, score: number|null, value: * }} Criterion result.
 */
export function scoreCriterion(criterion, context) {
  const { house, settings, financing } = context;
  switch (criterion.type) {
    case 'yes':
      return scoreAnswer(house[criterion.field], 100, 0);
    case 'no':
      return scoreAnswer(house[criterion.field], 0, 100);
    case 'curve': {
      const value = house[criterion.field];
      return value === null ? unknown() : known(interpolate(criterion.curve, value), value);
    }
    case 'map': {
      const value = house[criterion.field];
      return value === null ? unknown() : known(criterion.scores[value], value);
    }
    case 'option': {
      const yesScore = criterion.score === undefined ? 100 : criterion.score;
      return scoreAnswer(optionState(house[criterion.field], criterion.option), yesScore, 0);
    }
    case 'ongoingCost':
      return scoreOngoingCost(financing, settings);
    case 'cashToClose':
      return scoreCashToClose(financing, settings);
    case 'requiredWorkCushion':
      return scoreRequiredWorkCushion(financing);
    case 'garage':
      return scoreGarage(house);
    case 'coveredRoute':
      return scoreCoveredRoute(house);
    case 'garageWorkspace':
      return scoreGarageWorkspace(house);
    case 'functionalEntry':
      return scoreFunctionalEntry(house);
    case 'parkingCombination':
      return scoreParkingCombination(house);
    case 'foodStorage':
      return scoreFoodStorage(house);
    case 'windowPrivacy':
      return scoreWindowPrivacy(house);
    case 'safeOutdoor':
      return scoreSafeOutdoor(house);
    case 'irrigation':
      return scoreIrrigation(house);
    case 'creativeAuthorship':
      return scoreCreativeAuthorship(house);
    default:
      throw new Error(`Unknown criterion type: ${criterion.type}`);
  }
}

/* --------------------------------------------------------------------------
   Rollup
   -------------------------------------------------------------------------- */

/**
 * Averages scored items by weight, leaving out unscored ones and renormalizing.
 * @param {Array<{ weight: number, score: number|null }>} items - Weighted items; null scores are skipped.
 * @returns {number|null} Weighted mean of the scored items, or null when none are scored.
 */
export function weightedMean(items) {
  let weightTotal = 0;
  let scoreTotal = 0;
  for (const item of items) {
    if (item.score === null) continue;
    weightTotal += item.weight;
    scoreTotal += item.weight * item.score;
  }
  return weightTotal === 0 ? null : scoreTotal / weightTotal;
}

// Only these say whether the purchase can be carried or closed on, so Stability needs at least one.
const AFFORDABILITY_CRITERIA = ['ongoingCost', 'cashToClose'];

/**
 * Decides whether Stability & Security can be scored.
 * @param {Object<string, { state: string }>} criteriaById - Scored criteria so far, by id.
 * @param {object} financing - Result of calculateFinancing.
 * @returns {string|null} A reason code when unavailable, otherwise null.
 */
function stabilityUnavailableReason(criteriaById, financing) {
  if (financing.requiredWork.hasUncosted) return STABILITY_UNCOSTED_WORK;
  // The required-work cushion and Major Systems alone cannot establish Stability.
  for (const id of AFFORDABILITY_CRITERIA) {
    if (criteriaById[id].state === KNOWN) return null;
  }
  return STABILITY_NO_FINANCIAL_SCORE;
}

/**
 * Evaluates a house: financing, every criterion, rollups, completeness, and Overall Fit.
 * @param {object} house - Normalized house.
 * @param {object} settings - Normalized app settings.
 * @returns {object} Financing facts, scored hierarchy, criteria by id, completeness, and gated Overall Fit.
 */
export function evaluate(house, settings) {
  const financing = calculateFinancing(house, settings);
  const context = { house, settings, financing };
  const criteriaById = {};
  const categories = [];
  let knownCount = 0;
  let applicableCount = 0;

  for (const categoryDef of CATEGORIES) {
    const subcategories = [];
    for (const subcategoryDef of categoryDef.subcategories) {
      const criteria = [];
      for (const criterionDef of subcategoryDef.criteria) {
        const result = scoreCriterion(criterionDef, context);
        const criterion = {
          id: criterionDef.id,
          label: criterionDef.label,
          weight: criterionDef.weight,
          // Kept so a view can describe the observation behind the score.
          type: criterionDef.type,
          field: criterionDef.field === undefined ? null : criterionDef.field,
          unit: criterionDef.unit === undefined ? null : criterionDef.unit,
          state: result.state,
          score: result.score,
          value: result.value,
        };
        criteria.push(criterion);
        criteriaById[criterion.id] = criterion;
        if (result.state !== NOT_APPLICABLE) applicableCount += 1;
        if (result.state === KNOWN) knownCount += 1;
      }
      subcategories.push({
        id: subcategoryDef.id,
        label: subcategoryDef.label,
        weight: subcategoryDef.weight,
        implicit: subcategoryDef.implicit === true,
        score: weightedMean(criteria),
        criteria,
      });
    }

    let unavailableReason = null;
    if (categoryDef.id === 'stability') unavailableReason = stabilityUnavailableReason(criteriaById, financing);
    categories.push({
      id: categoryDef.id,
      label: categoryDef.label,
      weight: categoryDef.weight,
      score: unavailableReason === null ? weightedMean(subcategories) : null,
      unavailableReason,
      subcategories,
    });
  }

  const completenessPercent = (knownCount / applicableCount) * 100;
  const ungatedFit = weightedMean(categories);
  const weightedFit = completenessPercent >= OVERALL_FIT_MIN_COMPLETENESS ? ungatedFit : null;
  const answers = delightAnswers(house);
  const delights = delightFeatures(answers);
  // The bonus only lifts an Overall Fit that already exists, and never past 100.
  const delightBonus = delights.length * DELIGHT_POINTS;
  const overallFit = weightedFit === null ? null : Math.min(100, weightedFit + delightBonus);

  return {
    financing,
    categories,
    criteria: criteriaById,
    completeness: { known: knownCount, applicable: applicableCount, percent: completenessPercent },
    weightedFit,
    delights,
    delightAnswers: answers,
    delightBonus,
    overallFit,
  };
}

/* --------------------------------------------------------------------------
   Comparing two houses
   -------------------------------------------------------------------------- */

// How one criterion compares between two houses.
export const DIFFERS = 'differs';
export const SAME = 'same';
export const INCOMPLETE = 'incomplete';

// Compare shows these in its Costs card, so they are left out of the biggest differences.
export const FINANCIAL_CRITERIA = ['ongoingCost', 'cashToClose', 'requiredWorkCushion'];
export const BIGGEST_DIFFERENCES = 10;

/**
 * Decides how one criterion compares between two houses; a difference is only claimed between known facts.
 * @param {{ state: string, score: number|null, value: * }} a - The criterion for the first house.
 * @param {{ state: string, score: number|null, value: * }} b - The same criterion for the second house.
 * @returns {string} DIFFERS, SAME, or INCOMPLETE when either is unknown.
 */
function compareCriterion(a, b) {
  if (a.state === UNKNOWN || b.state === UNKNOWN) return INCOMPLETE;
  // Applying to one house and not the other is a real difference, though it has no score gap.
  if (a.state !== b.state) return DIFFERS;
  if (a.state === NOT_APPLICABLE) return SAME;
  return a.score === b.score && JSON.stringify(a.value) === JSON.stringify(b.value) ? SAME : DIFFERS;
}

/**
 * Describes one house's answer to a delight feature as a known yes/no criterion, so it compares like one.
 * @param {string} answer - YES or NO.
 * @returns {{ state: string, score: number, value: string, type: string, field: null, unit: null }} The answer as a criterion.
 */
function delightCriterion(answer) {
  return { state: KNOWN, score: answer === YES ? 100 : 0, value: answer, type: 'yes', field: null, unit: null };
}

/**
 * Orders differences or ladder lines largest first; the sort is stable, so ties keep the rubric's order.
 * @param {{ impact: number }} first - One difference or line.
 * @param {{ impact: number }} second - Another.
 * @returns {number} Negative when first comes first.
 */
function byImpact(first, second) {
  return second.impact - first.impact;
}

/**
 * Lines up two evaluations criterion by criterion and ranks where they differ most, by the user's own weights.
 * @param {object} evaluationA - Evaluation of the first house.
 * @param {object} evaluationB - Evaluation of the second house.
 * @returns {{ categories: object[], differences: object[], delights: object[] }} Paired rows, biggest differences, lone delights.
 */
export function compareEvaluations(evaluationA, evaluationB) {
  const categories = [];
  const differences = [];
  const rowsById = {};
  // Both evaluations follow CATEGORIES, so every level lines up by position.
  for (let c = 0; c < evaluationA.categories.length; c += 1) {
    const categoryA = evaluationA.categories[c];
    const categoryB = evaluationB.categories[c];
    const subcategories = [];
    for (let s = 0; s < categoryA.subcategories.length; s += 1) {
      const subcategoryA = categoryA.subcategories[s];
      const subcategoryB = categoryB.subcategories[s];
      const rows = [];
      for (let k = 0; k < subcategoryA.criteria.length; k += 1) {
        const a = subcategoryA.criteria[k];
        const b = subcategoryB.criteria[k];
        const kind = compareCriterion(a, b);
        // The gap in Overall Fit points at full weight: score gap times the criterion's share of Overall Fit.
        const share = (categoryA.weight / 100) * (subcategoryA.weight / 100) * (a.weight / 100);
        const impact = kind === DIFFERS && a.state === KNOWN && b.state === KNOWN ? Math.abs(a.score - b.score) * share : 0;
        const row = { id: a.id, label: a.label, category: categoryA.label, subcategory: subcategoryA.label, kind, a, b, impact, delight: null };
        rows.push(row);
        rowsById[row.id] = row;
        if (impact > 0 && !FINANCIAL_CRITERIA.includes(a.id)) differences.push(row);
      }
      subcategories.push({ id: subcategoryA.id, label: subcategoryA.label, implicit: subcategoryA.implicit, a: subcategoryA, b: subcategoryB, rows });
    }
    categories.push({ id: categoryA.id, label: categoryA.label, a: categoryA, b: categoryB, subcategories });
  }

  // A delight's bonus is part of the Fit effect of the difference that carries it, so it is counted there.
  const delights = [];
  for (const { id, label } of DELIGHTS) {
    const answerA = evaluationA.delightAnswers[id];
    const answerB = evaluationB.delightAnswers[id];
    if (answerA === null || answerB === null || answerA === answerB) continue;
    const host = rowsById[DELIGHT_CRITERIA[id]];
    // It joins its criterion's row when that row already puts the same house ahead; otherwise it stands alone.
    if (host !== undefined && host.impact > 0 && host.a.score > host.b.score === (answerA === YES)) {
      host.impact += DELIGHT_POINTS;
      host.delight = id;
      continue;
    }
    const row = {
      id,
      label,
      category: 'Delight bonus',
      subcategory: 'Delight bonus',
      kind: DIFFERS,
      a: delightCriterion(answerA),
      b: delightCriterion(answerB),
      impact: DELIGHT_POINTS,
      delight: id,
    };
    delights.push(row);
    differences.push(row);
  }

  differences.sort(byImpact);
  return { categories, differences: differences.slice(0, BIGGEST_DIFFERENCES), delights };
}

/**
 * Reads the value a collection sort orders by.
 * @param {{ house: object, overallFit: number|null, daysOnMarket?: number|null }} item - Collection entry.
 * @param {string} sortBy - One of the SORT_ options.
 * @returns {number|null} The value, or null when it is unknown for this house.
 */
function sortValue(item, sortBy) {
  const { house } = item;
  switch (sortBy) {
    case SORT_FIT_HIGH:
    case SORT_FIT_LOW:
      return item.overallFit;
    case SORT_PRICE_LOW:
    case SORT_PRICE_HIGH:
      return currentListingPrice(house);
    case SORT_PER_SQFT_LOW:
    case SORT_PER_SQFT_HIGH:
      return pricePerSquareFoot(house);
    case SORT_PER_LOT_SQFT_LOW:
    case SORT_PER_LOT_SQFT_HIGH:
      return pricePerLotSquareFoot(house);
    case SORT_SQFT_HIGH:
    case SORT_SQFT_LOW:
      return house.squareFeet;
    case SORT_LOT_HIGH:
    case SORT_LOT_LOW:
      return house.lotAcres;
    case SORT_YEAR_NEWEST:
    case SORT_YEAR_OLDEST:
      return house.yearBuilt;
    case SORT_DAYS_LOW:
    case SORT_DAYS_HIGH:
      return item.daysOnMarket;
    default:
      return item.overallFit;
  }
}

/**
 * Orders houses for the collection by the chosen sort, grouped by status first unless grouping is turned off.
 * @param {Array<{ house: object, overallFit: number|null, daysOnMarket?: number|null }>} items - Houses with their Overall Fit and Days on Market.
 * @param {string} [sortBy] - One of the SORT_ options; Overall Fit high to low by default.
 * @param {boolean} [grouped] - True to keep Available, Under Contract, and Sold together, in that order; true by default.
 * @returns {Array<{ house: object, overallFit: number|null, daysOnMarket?: number|null }>} A new, sorted array.
 */
export function sortForCollection(items, sortBy = SORT_FIT_HIGH, grouped = true) {
  const descending = DESCENDING_SORTS.includes(sortBy);

  /**
   * Compares two collection entries.
   * @param {{ house: object, overallFit: number|null }} a - First entry.
   * @param {{ house: object, overallFit: number|null }} b - Second entry.
   * @returns {number} Negative when a comes first, positive when b comes first, zero when equal.
   */
  function compare(a, b) {
    // Grouped: Available, then Under Contract, then Sold, whatever the sort.
    if (grouped) {
      const statusOrder = STATUSES.indexOf(a.house.status) - STATUSES.indexOf(b.house.status);
      if (statusOrder !== 0) return statusOrder;
    }

    const valueA = sortValue(a, sortBy);
    const valueB = sortValue(b, sortBy);
    // Houses missing the sorted value stay at the end, of their status when grouped, in both directions.
    if (valueA === null && valueB !== null) return 1;
    if (valueA !== null && valueB === null) return -1;
    if (valueA !== null && valueA !== valueB) return descending ? valueB - valueA : valueA - valueB;
    // Ties fall back to address, so the order never shuffles between visits.
    return a.house.address.localeCompare(b.house.address);
  }

  return [...items].sort(compare);
}

/* --------------------------------------------------------------------------
   Price Ladder
   -------------------------------------------------------------------------- */

// Which way a step up in price moves a fact: the pricier house gains it or gives it up.
export const GAIN = 'gain';
export const GIVE_UP = 'giveUp';

// At most this many facts explain each step, and none worth less than this many Overall Fit points.
export const LADDER_FACTS = 3;
export const LADDER_MIN_IMPACT = 0.3;

// Contentment records reactions rather than facts the money buys, so the ladder leaves it out.
const LADDER_LEFT_OUT_CATEGORIES = ['contentment'];

/**
 * Orders the houses on the Price Ladder: every house except Sold, by current listing price, lowest first.
 * @param {Array<{ house: object }>} items - Houses with anything the ladder shows alongside them.
 * @returns {Array<{ house: object }>} A new array without Sold houses, cheapest first, ties by address.
 */
export function sortForLadder(items) {
  /**
   * Compares two ladder entries by price, then address.
   * @param {{ house: object }} a - First entry.
   * @param {{ house: object }} b - Second entry.
   * @returns {number} Negative when a comes first.
   */
  function compare(a, b) {
    const gap = currentListingPrice(a.house) - currentListingPrice(b.house);
    return gap !== 0 ? gap : a.house.address.localeCompare(b.house.address);
  }
  const listed = [];
  for (const item of items) {
    if (item.house.status !== STATUS_SOLD) listed.push(item);
  }
  return listed.sort(compare);
}

/**
 * Picks the few facts that best explain one step up the Price Ladder, gains and give-ups alike.
 * @param {{ house: object, evaluation: object }} lower - The cheaper house and its evaluation.
 * @param {{ house: object, evaluation: object }} higher - The pricier house and its evaluation.
 * @returns {{ facts: object[], unknown: number }} Up to three facts, largest first, and how many criteria are unknown for either house.
 */
export function ladderStep(lower, higher) {
  const comparison = compareEvaluations(lower.evaluation, higher.evaluation);
  const candidates = [];
  let unknown = 0;
  for (const category of comparison.categories) {
    if (LADDER_LEFT_OUT_CATEGORIES.includes(category.id)) continue;
    for (const subcategory of category.subcategories) {
      for (const row of subcategory.rows) {
        // Price is the ladder's own axis, so costs that follow from it are not facts the money buys.
        if (FINANCIAL_CRITERIA.includes(row.id)) continue;
        if (row.kind === INCOMPLETE) unknown += 1;
        if (row.impact === 0) continue;
        candidates.push({
          group: subcategory.id,
          subcategory: subcategory.label,
          direction: row.b.score > row.a.score ? GAIN : GIVE_UP,
          impact: row.impact,
          items: [{ id: row.id, label: row.label, isDelight: false, lower: row.a, higher: row.b }],
        });
      }
    }
  }

  // The comparison has already added each delight's bonus to its criterion's row, or given it a row of its own.
  for (const row of comparison.delights) {
    candidates.push({
      group: row.id,
      subcategory: null,
      direction: row.b.score > row.a.score ? GAIN : GIVE_UP,
      impact: row.impact,
      items: [{ id: row.id, label: row.label, isDelight: true, lower: row.a, higher: row.b }],
    });
  }

  // Facts in one subcategory that move the same way share a line, named by the subcategory.
  const lines = [];
  const byGroup = {};
  for (const candidate of candidates) {
    if (candidate.impact < LADDER_MIN_IMPACT) continue;
    const key = `${candidate.group} ${candidate.direction}`;
    const line = byGroup[key];
    if (line === undefined) {
      byGroup[key] = { ...candidate, items: [...candidate.items] };
      lines.push(byGroup[key]);
      continue;
    }
    line.impact += candidate.impact;
    line.items.push(...candidate.items);
  }
  for (const line of lines) {
    // A subcategory names a line only when it gathers more than one fact.
    line.grouped = line.items.length > 1;
    delete line.group;
  }

  lines.sort(byImpact);
  const facts = lines.slice(0, LADDER_FACTS);
  // A real loss, or a real gain, is never crowded out by a smaller third fact going the other way.
  for (const direction of [GIVE_UP, GAIN]) {
    if (facts.length < LADDER_FACTS || firstGoing(facts, direction) !== null) continue;
    const best = firstGoing(lines, direction);
    if (best !== null) facts[LADDER_FACTS - 1] = best;
  }
  return { facts, unknown };
}

/**
 * Finds the first ladder line that moves in one direction.
 * @param {Array<{ direction: string }>} lines - Ladder lines, largest first.
 * @param {string} direction - GAIN or GIVE_UP.
 * @returns {object|null} The first matching line, or null when none moves that way.
 */
function firstGoing(lines, direction) {
  for (const line of lines) {
    if (line.direction === direction) return line;
  }
  return null;
}
