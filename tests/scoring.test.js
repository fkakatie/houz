import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NA,
  NO,
  YES,
  HOUSE_FIELDS,
  PROJECT_AREAS,
  PROJECT_NEED,
  PROJECT_NO_CHANGE,
  PROJECT_WANT,
  createHouse,
  defaultSettings,
} from '../scripts/data.js';
import {
  BIGGEST_DIFFERENCES,
  CATEGORIES,
  CURVES,
  DIFFERS,
  FINANCIAL_CRITERIA,
  GAIN,
  GIVE_UP,
  INCOMPLETE,
  KNOWN,
  LADDER_FACTS,
  NOT_APPLICABLE,
  STABILITY_NO_FINANCIAL_SCORE,
  STABILITY_UNCOSTED_WORK,
  SAME,
  UNKNOWN,
  compareEvaluations,
  evaluate,
  interpolate,
  ladderStep,
  scoreCost,
  sortForCollection,
  sortForLadder,
  weightedMean,
} from '../scripts/scoring.js';

/**
 * Asserts that two numbers are within a tolerance of each other.
 * @param {number} actual - Calculated value.
 * @param {number} expected - Value it should be near.
 * @param {string} [label] - Name of the value, shown on failure.
 * @param {number} [tolerance] - Largest acceptable difference.
 */
function assertClose(actual, expected, label = 'value', tolerance = 1e-6) {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

/**
 * Builds settings with financing terms and generous scoring targets configured.
 * @param {object} [overrides] - Settings values to change.
 * @returns {object} Settings under which a $400,000 house scores 100 on every cost criterion, with a $100,000 cushion.
 */
function configuredSettings(overrides = {}) {
  return {
    ...defaultSettings(),
    interestRate: 6,
    pointsPercent: 1,
    comfortableMonthlyCost: 10000,
    maximumMonthlyCost: 20000,
    comfortableCashToClose: 1000000,
    maximumCashToClose: 2000000,
    maximumPurchasePrice: 500000,
    ...overrides,
  };
}

/**
 * Builds a new house with nothing known beyond its creation values.
 * @param {object} [overrides] - House fields to change.
 * @returns {object} A $400,000 house with every observation unknown.
 */
function bareHouse(overrides = {}) {
  const house = createHouse({ mlsNumber: '2100001', address: '300 N Example St', listingPrice: 400000, listingDate: '2026-10-01' });
  return { ...house, ...overrides };
}

/**
 * Builds a copy of a house with every untouched project area answered No change.
 * @param {object} house - House to copy.
 * @returns {object} A house whose projects are fully answered.
 */
function answered(house) {
  const projects = {};
  for (const area of PROJECT_AREAS) {
    const project = house.projects[area];
    projects[area] = project.state === null ? { ...project, state: PROJECT_NO_CHANGE } : project;
  }
  return { ...house, projects };
}

/**
 * Builds a copy of a house with one project area replaced.
 * @param {object} house - House to copy.
 * @param {string} area - Project area key such as "roof".
 * @param {{ state: string, cost?: number|null, excited?: string|null }} project - Values for that project.
 * @returns {object} A new house with the project set.
 */
function withProject(house, area, project) {
  const full = { note: '', cost: null, excited: null, ...project };
  return { ...house, projects: { ...house.projects, [area]: full } };
}

/**
 * Builds a house with every criterion known and at its best possible answer.
 * @param {object} [overrides] - House fields to change.
 * @returns {object} A fully evaluated house.
 */
function bestHouse(overrides = {}) {
  let house = bareHouse({
    hoa: NO,
    solarStatus: 'none',
    foundation: 'clear',
    electrical: 'modern',
    sewer: 'clear',
    roofStatus: 'good',
    plumbing: 'modern',
    waterHeaterStatus: 'good',
    waterIntrusion: 'none',
    furnaceStatus: 'good',
    trainMinutes: 5,
    groceryMinutes: 5,
    freewayMinutes: 5,
    skincareOnCounter: YES,
    privatePrimaryBath: YES,
    tubAvailability: 'primary',
    outletAtVanity: YES,
    bathroomStorage: ['vanity', 'medicineCabinet', 'linen'],
    bedroomFloor: 'upper',
    bedroomWindowExposure: ['privateOutdoor'],
    closetType: 'walkIn',
    storageVacuum: YES,
    storageCleaning: YES,
    storageTools: YES,
    storageSeasonal: YES,
    storageBulk: YES,
    litterBoxSpot: YES,
    catTreeSpot: YES,
    safeOutdoor: ['yard'],
    fullyFenced: YES,
    matureTrees: YES,
    parkStrip: NO,
    irrigation: YES,
    sidewalkToShovel: NO,
    parking: ['attachedGarage', 'carport', 'driveway', 'dedicatedUncovered', 'street'],
    garagePower: YES,
    garageWorkspace: YES,
    entryShoes: YES,
    entryCoat: YES,
    entryPurse: YES,
    exteriorSteps: 1,
    coveredRoute: YES,
    megacouchFits: YES,
    tvAreaIsThoroughfare: NO,
    tvBackToFrontDoor: NO,
    tvBackToWindows: NO,
    christmasTreeSpot: YES,
    sinkStoveWorks: YES,
    foodStorage: ['pantry', 'cabinetry'],
    dishwasherBesideSink: YES,
    counterBesideStove: YES,
    counterBesideSink: YES,
    propertyType: 'detached',
    cornerLot: YES,
    laundrySupplyStorage: YES,
    laundrySameFloor: YES,
    laundryUsableSpace: YES,
    counterSeating: YES,
    diningTableSpace: YES,
    likeBeingHere: YES,
    liveAsIsThreeYears: YES,
    sadIfSold: YES,
    wantToGoBack: YES,
    parentsMinutes: 10,
    airportMinutes: 15,
    guestFullBath: YES,
    ...overrides,
  });
  house = answered(house);
  for (const area of ['kitchen', 'yard', 'office', 'livingRoom']) {
    house = withProject(house, area, { state: PROJECT_WANT, excited: YES });
  }
  return house;
}

/**
 * Finds a category in an evaluation.
 * @param {object} evaluation - Result of evaluate.
 * @param {string} id - Category id.
 * @returns {object} The scored category.
 */
function category(evaluation, id) {
  for (const item of evaluation.categories) {
    if (item.id === id) return item;
  }
  throw new Error(`No category ${id}`);
}

/**
 * Finds a subcategory in an evaluation.
 * @param {object} evaluation - Result of evaluate.
 * @param {string} categoryId - Category id.
 * @param {string} id - Subcategory id.
 * @returns {object} The scored subcategory.
 */
function subcategory(evaluation, categoryId, id) {
  for (const item of category(evaluation, categoryId).subcategories) {
    if (item.id === id) return item;
  }
  throw new Error(`No subcategory ${id}`);
}

/**
 * Evaluates a house and returns one criterion's result.
 * @param {object} house - House to evaluate.
 * @param {string} id - Criterion id.
 * @param {object} [settings] - Settings to evaluate under.
 * @returns {{ state: string, score: number|null, value: * }} The criterion result.
 */
function criterion(house, id, settings = configuredSettings()) {
  const result = evaluate(house, settings).criteria[id];
  assert.ok(result, `criterion ${id} exists`);
  return result;
}

/**
 * Asserts that a criterion scored a specific value.
 * @param {object} house - House to evaluate.
 * @param {string} id - Criterion id.
 * @param {number} expected - Expected score.
 */
function assertScore(house, id, expected) {
  const result = criterion(house, id);
  assert.equal(result.state, KNOWN, `${id} is known`);
  assertClose(result.score, expected, id);
}

/**
 * Asserts that a criterion is unknown and unscored.
 * @param {object} house - House to evaluate.
 * @param {string} id - Criterion id.
 */
function assertUnknown(house, id) {
  const result = criterion(house, id);
  assert.equal(result.state, UNKNOWN, `${id} is unknown`);
  assert.equal(result.score, null, `${id} has no score`);
}

/* --------------------------------------------------------------------------
   Hierarchy
   -------------------------------------------------------------------------- */

test('every weight table sums to 100', () => {
  let categoryTotal = 0;
  for (const categoryDef of CATEGORIES) {
    categoryTotal += categoryDef.weight;
    let subcategoryTotal = 0;
    for (const subcategoryDef of categoryDef.subcategories) {
      subcategoryTotal += subcategoryDef.weight;
      let criterionTotal = 0;
      for (const criterionDef of subcategoryDef.criteria) criterionTotal += criterionDef.weight;
      assert.equal(criterionTotal, 100, `${subcategoryDef.id} criteria`);
    }
    assert.equal(subcategoryTotal, 100, `${categoryDef.id} subcategories`);
  }
  assert.equal(categoryTotal, 100, 'categories');
});

test('the hierarchy holds 72 uniquely named criteria', () => {
  const ids = new Set();
  let count = 0;
  for (const categoryDef of CATEGORIES) {
    for (const subcategoryDef of categoryDef.subcategories) {
      for (const criterionDef of subcategoryDef.criteria) {
        ids.add(criterionDef.id);
        count += 1;
      }
    }
  }
  assert.equal(count, 72);
  assert.equal(ids.size, 72);
});

test('every criterion reads a field that exists', () => {
  for (const categoryDef of CATEGORIES) {
    for (const subcategoryDef of categoryDef.subcategories) {
      for (const criterionDef of subcategoryDef.criteria) {
        if (criterionDef.field === undefined) continue;
        assert.ok(criterionDef.field in HOUSE_FIELDS, `${criterionDef.id} reads ${criterionDef.field}`);
      }
    }
  }
});

test('mapped criteria score every option their field allows', () => {
  for (const categoryDef of CATEGORIES) {
    for (const subcategoryDef of categoryDef.subcategories) {
      for (const criterionDef of subcategoryDef.criteria) {
        if (criterionDef.type !== 'map') continue;
        const options = HOUSE_FIELDS[criterionDef.field].options;
        assert.deepEqual(Object.keys(criterionDef.scores).sort(), [...options].sort(), criterionDef.id);
      }
    }
  }
});

/* --------------------------------------------------------------------------
   Curves
   -------------------------------------------------------------------------- */

test('interpolate hits breakpoints, interpolates between them, and clamps outside', () => {
  const points = [[10, 100], [20, 50], [30, 0]];
  assert.equal(interpolate(points, 10), 100);
  assert.equal(interpolate(points, 20), 50);
  assert.equal(interpolate(points, 15), 75);
  assert.equal(interpolate(points, 27.5), 12.5);
  assert.equal(interpolate(points, 0), 100);
  assert.equal(interpolate(points, 99), 0);
});

test('travel curves match their breakpoint tables', () => {
  assert.equal(interpolate(CURVES.train, 5), 100);
  assert.equal(interpolate(CURVES.train, 8), 94);
  assert.equal(interpolate(CURVES.train, 12.5), 80);
  assert.equal(interpolate(CURVES.train, 30), 0);
  assert.equal(interpolate(CURVES.train, 45), 0);
  assert.equal(interpolate(CURVES.grocery, 10), 95);
  assert.equal(interpolate(CURVES.grocery, 35), 10);
  assert.equal(interpolate(CURVES.freeway, 25), 40);
  assert.equal(interpolate(CURVES.parents, 15), 100);
  assert.equal(interpolate(CURVES.parents, 25), 80);
  assert.equal(interpolate(CURVES.parents, 60), 0);
  assert.equal(interpolate(CURVES.airport, 15), 100);
  assert.equal(interpolate(CURVES.airport, 45), 52.5);
  assert.equal(interpolate(CURVES.airport, 67.5), 7.5);
});

test('the exterior-steps curve forgives a step or two', () => {
  assert.equal(interpolate(CURVES.exteriorSteps, 0), 100);
  assert.equal(interpolate(CURVES.exteriorSteps, 1), 100);
  assert.equal(interpolate(CURVES.exteriorSteps, 2), 97.5);
  assert.equal(interpolate(CURVES.exteriorSteps, 3), 95);
  assert.equal(interpolate(CURVES.exteriorSteps, 10), 37.5);
  assert.equal(interpolate(CURVES.exteriorSteps, 20), 0);
});

test('the cost curve is anchored on the comfortable and maximum targets', () => {
  assert.equal(scoreCost(1000, 2000, 3000), 100);
  assert.equal(scoreCost(1500, 2000, 3000), 100);
  assert.equal(scoreCost(1750, 2000, 3000), 92.5);
  assert.equal(scoreCost(2000, 2000, 3000), 85);
  assert.equal(scoreCost(2250, 2000, 3000), 67.5);
  assert.equal(scoreCost(2500, 2000, 3000), 50);
  assert.equal(scoreCost(2750, 2000, 3000), 25);
  assert.equal(scoreCost(3000, 2000, 3000), 0);
  assert.equal(scoreCost(4000, 2000, 3000), 0);
});

test('weightedMean renormalizes around unscored items', () => {
  assert.equal(weightedMean([{ weight: 60, score: 100 }, { weight: 40, score: 0 }]), 60);
  assert.equal(weightedMean([{ weight: 60, score: null }, { weight: 40, score: 80 }]), 80);
  assert.equal(weightedMean([{ weight: 60, score: null }, { weight: 40, score: null }]), null);
  assert.equal(weightedMean([]), null);
});

/* --------------------------------------------------------------------------
   Simple criteria
   -------------------------------------------------------------------------- */

test('positive yes/no criteria score 100, 0, or stay unknown', () => {
  assertScore(bareHouse({ megacouchFits: YES }), 'megacouchFits', 100);
  assertScore(bareHouse({ megacouchFits: NO }), 'megacouchFits', 0);
  assertUnknown(bareHouse(), 'megacouchFits');
});

test('criteria phrased as undesirable conditions score in reverse', () => {
  assertScore(bareHouse({ parkStrip: NO }), 'noParkStrip', 100);
  assertScore(bareHouse({ parkStrip: YES }), 'noParkStrip', 0);
  assertScore(bareHouse({ sidewalkToShovel: NO }), 'noSidewalkToShovel', 100);
  assertScore(bareHouse({ tvAreaIsThoroughfare: YES }), 'tvAreaNotThoroughfare', 0);
  assertScore(bareHouse({ tvBackToFrontDoor: NO }), 'tvNotBackToDoor', 100);
  assertScore(bareHouse({ tvBackToWindows: YES }), 'tvNotBackToWindows', 0);
  assertUnknown(bareHouse(), 'noParkStrip');
});

test('travel criteria use their own curves and keep the raw minutes', () => {
  const house = bareHouse({ trainMinutes: 8, parentsMinutes: 25, airportMinutes: 40 });
  assertScore(house, 'train', 94);
  assertScore(house, 'parents', 80);
  assertScore(house, 'airport', 65);
  assert.equal(criterion(house, 'train').value, 8);
  assertUnknown(house, 'grocery');
});

test('a zero-minute trip is a known best score, not unknown', () => {
  assertScore(bareHouse({ trainMinutes: 0 }), 'train', 100);
});

test('categorical mappings follow the spec tables', () => {
  assertScore(bareHouse({ bedroomFloor: 'upper' }), 'bedroomFloor', 100);
  assertScore(bareHouse({ bedroomFloor: 'lower' }), 'bedroomFloor', 100);
  assertScore(bareHouse({ bedroomFloor: 'main' }), 'bedroomFloor', 50);
  assertScore(bareHouse({ closetType: 'reachIn' }), 'closetType', 70);
  assertScore(bareHouse({ tubAvailability: 'elsewhere' }), 'tub', 85);
  assertScore(bareHouse({ tubAvailability: 'none' }), 'tub', 0);
  assertScore(bareHouse({ propertyType: 'townhouse' }), 'detached', 50);
  assertScore(bareHouse({ propertyType: 'condo' }), 'detached', 35);
  assertUnknown(bareHouse(), 'bedroomFloor');
});

test('major-system statuses map to scores and unknown stays unscored', () => {
  assertScore(bareHouse({ foundation: 'minorIssue' }), 'foundation', 60);
  assertScore(bareHouse({ electrical: 'older' }), 'electrical', 70);
  assertScore(bareHouse({ sewer: 'significantIssue' }), 'sewer', 0);
  assertScore(bareHouse({ roofStatus: 'mediumTerm' }), 'roof', 65);
  assertScore(bareHouse({ roofStatus: 'failed' }), 'roof', 0);
  assertScore(bareHouse({ plumbing: 'materialConcern' }), 'plumbing', 30);
  assertScore(bareHouse({ waterHeaterStatus: 'soon' }), 'waterHeater', 30);
  assertScore(bareHouse({ waterIntrusion: 'remediated' }), 'waterIntrusion', 70);
  assertScore(bareHouse({ furnaceStatus: 'older' }), 'furnace', 65);
  assertUnknown(bareHouse({ roofYear: 1998 }), 'roof');
});

/* --------------------------------------------------------------------------
   Multi-select criteria
   -------------------------------------------------------------------------- */

test('criteria read from an untouched multi-select are unknown', () => {
  const house = bareHouse();
  for (const id of ['driveway', 'carport', 'dedicatedUncovered', 'streetParking', 'vanityStorage', 'linenStorage']) {
    assertUnknown(house, id);
  }
});

test('a completed multi-select scores selected options yes and the rest no', () => {
  const house = bareHouse({ parking: ['driveway'], bathroomStorage: ['vanity', 'linen'] });
  assertScore(house, 'driveway', 100);
  assertScore(house, 'dedicatedUncovered', 0);
  assertScore(house, 'streetParking', 0);
  assertScore(house, 'vanityStorage', 100);
  assertScore(house, 'linenStorage', 100);
  assertScore(house, 'medicineCabinet', 0);
});

test('a multi-select answered None scores every option as a known no', () => {
  const house = bareHouse({ parking: [], bathroomStorage: [] });
  for (const id of ['garage', 'carport', 'driveway', 'dedicatedUncovered', 'streetParking', 'garageWorkspace']) {
    assertScore(house, id, 0);
  }
  assertScore(house, 'vanityStorage', 0);
  assertScore(house, 'parkingCombination', 0);
});

test('a carport scores 65, below a garage', () => {
  assertScore(bareHouse({ parking: ['carport'] }), 'carport', 65);
  assertScore(bareHouse({ parking: ['detachedGarage'] }), 'carport', 0);
});

/* --------------------------------------------------------------------------
   Derived criteria
   -------------------------------------------------------------------------- */

test('garage scores by type, with power as a modifier', () => {
  assertScore(bareHouse({ parking: ['attachedGarage'], garagePower: YES }), 'garage', 100);
  assertScore(bareHouse({ parking: ['attachedGarage'], garagePower: NO }), 'garage', 85);
  assertScore(bareHouse({ parking: ['detachedGarage'], garagePower: YES }), 'garage', 85);
  assertScore(bareHouse({ parking: ['detachedGarage'], garagePower: NO }), 'garage', 70);
  assertScore(bareHouse({ parking: ['driveway'] }), 'garage', 0);
  assertUnknown(bareHouse(), 'garage');
});

test('unknown garage power keeps the known garage type scored, between power and no power', () => {
  const attached = bareHouse({ parking: ['attachedGarage'] });
  assertScore(attached, 'garage', 90);
  assert.deepEqual(criterion(attached, 'garage').value, { garage: 'attachedGarage', power: null });
  assertScore(bareHouse({ parking: ['detachedGarage'] }), 'garage', 75);
  // The garage type is enough to know the criterion, so it counts as known for completeness.
  const evaluation = evaluate(attached, configuredSettings());
  assert.equal(evaluation.criteria.garage.state, KNOWN);
});

test('Parking & Arrival gives Garage 40%, with every other criterion kept', () => {
  const livability = CATEGORIES.find((item) => item.id === 'livability');
  const parking = livability.subcategories.find((item) => item.id === 'parking');
  assert.equal(parking.weight, 8);
  assert.deepEqual(idWeights(parking.criteria), [
    ['garage', 40], ['functionalEntry', 13], ['carport', 11], ['driveway', 10], ['exteriorSteps', 8],
    ['dedicatedUncovered', 5], ['coveredRoute', 5], ['streetParking', 3], ['garageWorkspace', 2], ['parkingCombination', 3],
  ]);
});

test('two garages score as the best one, with nothing extra for the second', () => {
  const both = bareHouse({ parking: ['attachedGarage', 'detachedGarage'], garagePower: NO });
  assertScore(both, 'garage', 85);
  assert.deepEqual(criterion(both, 'garage').value, { garage: 'attachedGarage', power: NO });
  assertScore(bareHouse({ parking: ['attachedGarage', 'detachedGarage'] }), 'parkingCombination', 0);
});

test('every garage scores above a carport', () => {
  assert.ok(criterion(bareHouse({ parking: ['detachedGarage'], garagePower: NO }), 'garage').score > 65);
});

test('covered route is not applicable with an attached garage and scored otherwise', () => {
  const attached = evaluate(bareHouse({ parking: ['attachedGarage', 'driveway'], coveredRoute: NO }), configuredSettings());
  assert.equal(attached.criteria.coveredRoute.state, NOT_APPLICABLE);
  assert.equal(attached.completeness.applicable, 71);
  assertScore(bareHouse({ parking: ['detachedGarage'], coveredRoute: YES }), 'coveredRoute', 100);
  assertScore(bareHouse({ parking: ['driveway'], coveredRoute: NO }), 'coveredRoute', 0);
  assertUnknown(bareHouse({ parking: ['detachedGarage'] }), 'coveredRoute');
});

test('garage workspace is a known 0 without a garage and unknown until answered with one', () => {
  assertScore(bareHouse({ parking: ['driveway'] }), 'garageWorkspace', 0);
  assertUnknown(bareHouse({ parking: ['attachedGarage'] }), 'garageWorkspace');
  assertScore(bareHouse({ parking: ['detachedGarage'], garageWorkspace: YES }), 'garageWorkspace', 100);
  assertScore(bareHouse({ parking: ['attachedGarage'], garageWorkspace: NO }), 'garageWorkspace', 0);
  assert.equal(criterion(bareHouse({ parking: ['driveway'] }), 'garageWorkspace').state, KNOWN);
});

test('functional entry needs all three answers, then scores by count', () => {
  assertUnknown(bareHouse({ entryShoes: YES, entryCoat: YES }), 'functionalEntry');
  assertScore(bareHouse({ entryShoes: NO, entryCoat: NO, entryPurse: NO }), 'functionalEntry', 0);
  assertScore(bareHouse({ entryShoes: YES, entryCoat: NO, entryPurse: NO }), 'functionalEntry', 40);
  assertScore(bareHouse({ entryShoes: YES, entryCoat: NO, entryPurse: YES }), 'functionalEntry', 75);
  assertScore(bareHouse({ entryShoes: YES, entryCoat: YES, entryPurse: YES }), 'functionalEntry', 100);
});

test('parking combination uses the highest-value pairing', () => {
  assertScore(bareHouse({ parking: ['attachedGarage', 'driveway'] }), 'parkingCombination', 100);
  assertScore(bareHouse({ parking: ['detachedGarage', 'driveway'] }), 'parkingCombination', 100);
  assertScore(bareHouse({ parking: ['attachedGarage', 'driveway', 'dedicatedUncovered'] }), 'parkingCombination', 100);
  assertScore(bareHouse({ parking: ['detachedGarage', 'dedicatedUncovered'] }), 'parkingCombination', 80);
  assertScore(bareHouse({ parking: ['driveway', 'dedicatedUncovered'] }), 'parkingCombination', 60);
  assertScore(bareHouse({ parking: ['attachedGarage'] }), 'parkingCombination', 0);
  assertScore(bareHouse({ parking: ['street', 'driveway'] }), 'parkingCombination', 0);
  assertUnknown(bareHouse(), 'parkingCombination');
});

test('a carport counts as a dedicated space in combinations and earns nothing extra', () => {
  assertScore(bareHouse({ parking: ['attachedGarage', 'carport'] }), 'parkingCombination', 80);
  assertScore(bareHouse({ parking: ['driveway', 'carport'] }), 'parkingCombination', 60);
  assertScore(bareHouse({ parking: ['carport', 'dedicatedUncovered'] }), 'parkingCombination', 0);
  assertScore(bareHouse({ parking: ['carport'] }), 'parkingCombination', 0);
});

test('food storage scores by number of workable types', () => {
  assertUnknown(bareHouse(), 'foodStorage');
  assertScore(bareHouse({ foodStorage: [] }), 'foodStorage', 0);
  assertScore(bareHouse({ foodStorage: ['cabinetry'] }), 'foodStorage', 70);
  assertScore(bareHouse({ foodStorage: ['pantry', 'cabinetry'] }), 'foodStorage', 100);
  assertScore(bareHouse({ foodStorage: ['pantry', 'cabinetry', 'other'] }), 'foodStorage', 100);
});

test('bedroom window privacy uses the most limiting exposure', () => {
  assertScore(bareHouse({ bedroomWindowExposure: ['privateOutdoor'] }), 'windowPrivacy', 100);
  assertScore(bareHouse({ bedroomWindowExposure: ['neighborProperty'] }), 'windowPrivacy', 80);
  assertScore(bareHouse({ bedroomWindowExposure: ['privateOutdoor', 'street'] }), 'windowPrivacy', 70);
  assertScore(bareHouse({ bedroomWindowExposure: ['street', 'publicSidewalk'] }), 'windowPrivacy', 50);
  assertScore(bareHouse({ bedroomWindowExposure: ['privateOutdoor', 'directNeighborWindow'] }), 'windowPrivacy', 25);
  assertUnknown(bareHouse(), 'windowPrivacy');
  assertUnknown(bareHouse({ bedroomWindowExposure: [] }), 'windowPrivacy');
});

test('one safe outdoor option is enough and more earn nothing extra', () => {
  assertUnknown(bareHouse(), 'safeOutdoor');
  assertScore(bareHouse({ safeOutdoor: [] }), 'safeOutdoor', 0);
  assertScore(bareHouse({ safeOutdoor: ['catio'] }), 'safeOutdoor', 100);
  assertScore(bareHouse({ safeOutdoor: ['yard', 'balconyPatio', 'catio'] }), 'safeOutdoor', 100);
});

test('irrigation can be not applicable, which removes it from scoring and completeness', () => {
  assertScore(bareHouse({ irrigation: YES }), 'irrigation', 100);
  assertScore(bareHouse({ irrigation: NO }), 'irrigation', 0);
  assertUnknown(bareHouse(), 'irrigation');

  const evaluation = evaluate(bareHouse({ irrigation: NA }), configuredSettings());
  assert.equal(evaluation.criteria.irrigation.state, NOT_APPLICABLE);
  assert.equal(evaluation.criteria.irrigation.score, null);
  assert.equal(evaluation.completeness.applicable, 71);
  assert.equal(evaluate(bareHouse(), configuredSettings()).completeness.applicable, 72);
});

test('a not-applicable criterion does not drag its subcategory down', () => {
  const house = bareHouse({ irrigation: NA, matureTrees: YES, parkStrip: NO, sidewalkToShovel: NO });
  assertClose(subcategory(evaluate(house, configuredSettings()), 'livability', 'exterior').score, 100, 'exterior');
});

/* --------------------------------------------------------------------------
   Creative Authorship
   -------------------------------------------------------------------------- */

test('Creative Authorship is unscored until every project area is answered', () => {
  assertUnknown(bareHouse(), 'creativeAuthorship');
  const touched = withProject(bareHouse(), 'kitchen', { state: PROJECT_WANT, excited: YES });
  assertUnknown(touched, 'creativeAuthorship');
  // One area left untouched is still unknown, not No change.
  const almost = withProject(answered(bareHouse()), 'garage', { state: null });
  assertUnknown(almost, 'creativeAuthorship');
  assertUnknown(almost, 'requiredWorkCushion');
});

test('every area answered with no optional projects is a neutral 50', () => {
  assertScore(answered(bareHouse()), 'creativeAuthorship', 50);
  const noChange = withProject(answered(bareHouse()), 'kitchen', { state: PROJECT_NO_CHANGE });
  assertScore(noChange, 'creativeAuthorship', 50);
});

/**
 * Builds a fully answered house with a number of excited and unwanted optional projects.
 * @param {number} excited - Count of Want to fix projects the user is excited about.
 * @param {number} unwanted - Count of Want to fix projects the user is not excited about.
 * @returns {object} House with those projects set.
 */
function houseWithOptionalProjects(excited, unwanted) {
  const areas = ['livingRoom', 'kitchen', 'primaryBedroom', 'primaryBathroom', 'office', 'guestBedroom', 'yard', 'garage'];
  let house = answered(bareHouse());
  for (let index = 0; index < excited + unwanted; index += 1) {
    house = withProject(house, areas[index], { state: PROJECT_WANT, excited: index < excited ? YES : NO });
  }
  return house;
}

test('Creative Authorship rewards a few exciting projects with diminishing returns', () => {
  assertScore(houseWithOptionalProjects(1, 0), 'creativeAuthorship', 70);
  assertScore(houseWithOptionalProjects(2, 0), 'creativeAuthorship', 85);
  assertScore(houseWithOptionalProjects(3, 0), 'creativeAuthorship', 95);
  assertScore(houseWithOptionalProjects(4, 0), 'creativeAuthorship', 100);
  assertScore(houseWithOptionalProjects(6, 0), 'creativeAuthorship', 100);
});

test('Creative Authorship subtracts 10 per unwanted optional project and clamps at 0', () => {
  assertScore(houseWithOptionalProjects(3, 1), 'creativeAuthorship', 85);
  assertScore(houseWithOptionalProjects(4, 2), 'creativeAuthorship', 80);
  assertScore(houseWithOptionalProjects(0, 2), 'creativeAuthorship', 30);
  assertScore(houseWithOptionalProjects(0, 7), 'creativeAuthorship', 0);
});

test('an unanswered "excited" leaves Creative Authorship unscored', () => {
  const house = withProject(houseWithOptionalProjects(2, 0), 'roof', { state: PROJECT_WANT, excited: null });
  assertUnknown(house, 'creativeAuthorship');
});

test('required repairs earn no Creative Authorship credit', () => {
  const house = withProject(answered(bareHouse()), 'roof', { state: PROJECT_NEED, cost: 18000 });
  assertScore(house, 'creativeAuthorship', 50);
});

/* --------------------------------------------------------------------------
   Financial criteria
   -------------------------------------------------------------------------- */

test('Ongoing Cost blends initial and post-recast scores 60/40', () => {
  const house = bareHouse({ hoa: NO, solarStatus: 'none' });
  const settings = configuredSettings({
    plannedRecastPrincipal: 100000,
    comfortableMonthlyCost: 2000,
    maximumMonthlyCost: 3000,
  });
  const evaluation = evaluate(house, settings);
  const { initialMonthlyCost, postRecastMonthlyCost } = evaluation.financing;
  const expected = scoreCost(initialMonthlyCost, 2000, 3000) * 0.6 + scoreCost(postRecastMonthlyCost, 2000, 3000) * 0.4;
  assertClose(evaluation.criteria.ongoingCost.score, expected, 'ongoing cost');
  assert.ok(postRecastMonthlyCost < initialMonthlyCost);
  assert.ok(evaluation.criteria.ongoingCost.score > scoreCost(initialMonthlyCost, 2000, 3000));
});

test('Ongoing Cost is unscored when the estimate is incomplete or targets are missing', () => {
  assertUnknown(bareHouse({ solarStatus: 'none' }), 'ongoingCost');
  const complete = bareHouse({ hoa: NO, solarStatus: 'none' });
  assert.equal(criterion(complete, 'ongoingCost', configuredSettings({ interestRate: null })).state, UNKNOWN);
  assert.equal(criterion(complete, 'ongoingCost', configuredSettings({ maximumMonthlyCost: null })).state, UNKNOWN);
  assert.equal(criterion(complete, 'ongoingCost', configuredSettings({ comfortableMonthlyCost: null })).state, UNKNOWN);
  assert.equal(criterion(complete, 'ongoingCost').state, KNOWN);
});

test('Cash to Close is scored against the cash-to-close targets, without required work', () => {
  const settings = configuredSettings({ comfortableCashToClose: 80000, maximumCashToClose: 120000 });
  const house = withProject(answered(bareHouse()), 'roof', { state: PROJECT_NEED, cost: 30000 });
  const evaluation = evaluate(house, settings);
  const expected = scoreCost(evaluation.financing.cashToClose, 80000, 120000);
  assertClose(evaluation.criteria.cashToClose.score, expected, 'cash to close');
  assert.equal(evaluation.criteria.cashToClose.value, evaluation.financing.cashToClose);

  assert.equal(criterion(bareHouse(), 'cashToClose', settings).state, KNOWN, 'scored before every project area is answered');
  assert.equal(criterion(bareHouse(), 'cashToClose', configuredSettings({ pointsPercent: null })).state, UNKNOWN);
  assert.equal(criterion(bareHouse(), 'cashToClose', configuredSettings({ maximumCashToClose: null })).state, UNKNOWN);
});

test('the required-work cushion curve passes through its breakpoints', () => {
  const points = [[0, 100], [0.25, 100], [0.5, 85], [0.75, 60], [1, 30], [1.5, 0], [2, 0]];
  for (const [share, score] of points) assertClose(interpolate(CURVES.cushionShare, share), score, `share ${share}`);
  assertClose(interpolate(CURVES.cushionShare, 0.32), 95.8, 'midpoint');
});

test('Required Work Cushion scores required work against the room below the maximum price', () => {
  // A $400,000 house under a $500,000 maximum has a $100,000 cushion.
  const noWork = answered(bareHouse());
  /**
   * Scores the cushion with one Need to fix roof project at a given cost.
   * @param {number} cost - Roof project cost in dollars.
   * @returns {{ state: string, score: number|null, value: * }} The cushion criterion.
   */
  function cushion(cost) {
    return criterion(withProject(noWork, 'roof', { state: PROJECT_NEED, cost }), 'requiredWorkCushion');
  }
  assertClose(criterion(noWork, 'requiredWorkCushion').score, 100, 'no required work');
  assertClose(cushion(8000).score, 100, '8% of the cushion');
  assertClose(cushion(50000).score, 85, 'half the cushion');
  assertClose(cushion(100000).score, 30, 'the whole cushion');
  assertClose(cushion(150000).score, 0, 'half again over');
  assert.deepEqual(cushion(50000).value, { work: 50000, cushion: 100000 });
});

test('the cushion is clamped at $0: no work still scores 100, any work scores 0', () => {
  const settings = configuredSettings({ maximumPurchasePrice: 380000 });
  const noWork = answered(bareHouse());
  assert.equal(evaluate(noWork, settings).financing.requiredWorkCushion, 0);
  assertClose(criterion(noWork, 'requiredWorkCushion', settings).score, 100, 'no required work');
  const repair = withProject(noWork, 'roof', { state: PROJECT_NEED, cost: 1000 });
  assertClose(criterion(repair, 'requiredWorkCushion', settings).score, 0, 'work with no cushion');
});

test('Required Work Cushion waits for every project area, Need to fix costs, and the maximum price', () => {
  assert.equal(criterion(bareHouse(), 'requiredWorkCushion').state, UNKNOWN, 'project areas not answered');
  const uncosted = withProject(answered(bareHouse()), 'roof', { state: PROJECT_NEED, cost: null });
  assert.equal(criterion(uncosted, 'requiredWorkCushion').state, UNKNOWN, 'uncosted Need to fix');
  assert.equal(criterion(uncosted, 'cashToClose').state, KNOWN, 'cash to close is not held up');
  const noMaximum = configuredSettings({ maximumPurchasePrice: null });
  assert.equal(criterion(answered(bareHouse()), 'requiredWorkCushion', noMaximum).state, UNKNOWN);
});

test('Cash to Acquire is informational and no criterion scores it', () => {
  const types = [];
  let acquisition = null;
  for (const item of CATEGORIES) {
    for (const sub of item.subcategories) {
      if (sub.id === 'acquisitionCost') acquisition = sub;
      for (const entry of sub.criteria) types.push(entry.type);
    }
  }
  assert.equal(types.includes('acquisitionCost'), false);
  const weights = [];
  for (const entry of acquisition.criteria) weights.push([entry.id, entry.weight]);
  assert.deepEqual(weights, [['cashToClose', 60], ['requiredWorkCushion', 40]]);
  assert.equal(acquisition.weight, 35);
});

/* --------------------------------------------------------------------------
   Rollup and renormalization
   -------------------------------------------------------------------------- */

test('a subcategory is the weighted mean of its known criteria only', () => {
  const house = bareHouse({ trainMinutes: 10, groceryMinutes: 20 });
  const location = subcategory(evaluate(house, configuredSettings()), 'livability', 'location');
  assertClose(location.score, (45 * 90 + 35 * 60) / 80, 'location');
});

test('one known criterion is not diluted by unknown neighbors', () => {
  const evaluation = evaluate(bareHouse({ megacouchFits: YES }), configuredSettings());
  assertClose(subcategory(evaluation, 'livability', 'livingRoom').score, 100, 'living room');
  assertClose(category(evaluation, 'livability').score, 100, 'livability');
});

test('a category renormalizes around subcategories with nothing known', () => {
  const house = bareHouse({ megacouchFits: NO, counterSeating: YES, diningTableSpace: YES });
  const evaluation = evaluate(house, configuredSettings());
  assertClose(category(evaluation, 'livability').score, (8 * 0 + 4 * 100) / 12, 'livability');
  assert.equal(subcategory(evaluation, 'livability', 'kitchen').score, null);
});

test('Contentment is the weighted mean of the answered reactions', () => {
  const house = bareHouse({ likeBeingHere: YES, liveAsIsThreeYears: NO, wantToGoBack: YES });
  const evaluation = evaluate(house, configuredSettings());
  assertClose(category(evaluation, 'contentment').score, (35 * 100 + 30 * 0 + 15 * 100) / 80, 'contentment');
  assert.equal(category(evaluate(bareHouse(), configuredSettings()), 'contentment').score, null);
});

test('Deep Connection combines proximity, guest usability, and Salem', () => {
  const house = bareHouse({ parentsMinutes: 20, airportMinutes: 30, guestFullBath: NO, litterBoxSpot: YES });
  const evaluation = evaluate(house, configuredSettings());
  const proximity = (69 * 90 + 31 * 85) / 100;
  assertClose(subcategory(evaluation, 'deepConnection', 'proximity').score, proximity, 'proximity');
  assertClose(subcategory(evaluation, 'deepConnection', 'salem').score, 100, 'salem');
  assertClose(category(evaluation, 'deepConnection').score, 0.45 * 100 + 0.4 * proximity + 0.15 * 0, 'deep connection');
});

/**
 * Lists the id and weight of each item, in order.
 * @param {Array<{ id: string, weight: number }>} items - Subcategories or criteria.
 * @returns {Array<Array<string|number>>} Pairs of id and weight.
 */
function idWeights(items) {
  const pairs = [];
  for (const item of items) pairs.push([item.id, item.weight]);
  return pairs;
}

test('Overall Fit weighs the five categories 34, 34, 12, 10, and 10, highest first, totalling 100', () => {
  assert.deepEqual(idWeights(CATEGORIES), [
    ['stability', 34], ['livability', 34], ['deepConnection', 12], ['creativeAuthorship', 10], ['contentment', 10],
  ]);
  // Every view lists categories as an evaluation does, so this is the order everywhere.
  const order = [];
  for (const item of evaluate(bareHouse(), configuredSettings()).categories) order.push(item.id);
  assert.deepEqual(order, ['stability', 'livability', 'deepConnection', 'creativeAuthorship', 'contentment']);
});

test('Salem is part of Deep Connection, not Livability, with its criteria unchanged', () => {
  let livability = null;
  let deep = null;
  for (const item of CATEGORIES) {
    if (item.id === 'livability') livability = item;
    if (item.id === 'deepConnection') deep = item;
  }
  assert.deepEqual(idWeights(deep.subcategories), [['salem', 45], ['proximity', 40], ['guestUsability', 15]]);
  assert.deepEqual(idWeights(deep.subcategories[0].criteria), [
    ['litterBoxSpot', 35],
    ['catTreeSpot', 28],
    ['safeOutdoor', 22],
    ['fullyFenced', 15],
  ]);
  assert.deepEqual(idWeights(livability.subcategories), [
    ['location', 15], ['bathroom', 13], ['primaryBedroom', 10], ['householdStorage', 10], ['exterior', 10],
    ['parking', 8], ['livingRoom', 8], ['kitchen', 8], ['propertyForm', 8], ['laundry', 6], ['eating', 4],
  ]);
  const eating = livability.subcategories[livability.subcategories.length - 1];
  assert.deepEqual(idWeights(eating.criteria), [['counterSeating', 70], ['diningTableSpace', 30]]);
});

/* --------------------------------------------------------------------------
   Stability availability
   -------------------------------------------------------------------------- */

test('Major Systems alone cannot produce a Stability score', () => {
  const house = bareHouse({ foundation: 'clear', roofStatus: 'good', electrical: 'modern' });
  const evaluation = evaluate(house, defaultSettings());
  const stability = category(evaluation, 'stability');
  assert.equal(stability.score, null);
  assert.equal(stability.unavailableReason, STABILITY_NO_FINANCIAL_SCORE);
  assertClose(subcategory(evaluation, 'stability', 'majorSystems').score, 100, 'major systems still shown');
});

test('Stability scores with Cash to Close while project areas are unanswered; only the cushion waits', () => {
  const house = bareHouse({ hoa: NO, solarStatus: 'none', foundation: 'minorIssue', roofStatus: 'good' });
  const evaluation = evaluate(house, configuredSettings());
  const stability = category(evaluation, 'stability');
  assert.equal(stability.unavailableReason, null);
  assert.equal(evaluation.criteria.cashToClose.state, KNOWN);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, UNKNOWN);
  assertClose(subcategory(evaluation, 'stability', 'acquisitionCost').score, 100, 'acquisition from cash to close alone');
  const systems = (20 * 60 + 12 * 100) / 32;
  assertClose(subcategory(evaluation, 'stability', 'majorSystems').score, systems, 'major systems');
  assertClose(stability.score, (45 * 100 + 35 * 100 + 20 * systems) / 100, 'stability');
});

test('the cushion and Major Systems alone cannot establish Stability', () => {
  // No interest rate: Ongoing Cost and Cash to Close are unscored, but the cushion is known.
  const house = answered(bareHouse({ hoa: NO, solarStatus: 'none', roofStatus: 'good' }));
  const evaluation = evaluate(house, configuredSettings({ interestRate: null }));
  assert.equal(evaluation.criteria.ongoingCost.state, UNKNOWN);
  assert.equal(evaluation.criteria.cashToClose.state, UNKNOWN);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, KNOWN);
  const stability = category(evaluation, 'stability');
  assert.equal(stability.score, null);
  assert.equal(stability.unavailableReason, STABILITY_NO_FINANCIAL_SCORE);
});

test('Cash to Close alone is enough for Stability, renormalized with the other known criteria', () => {
  const house = answered(bareHouse({ roofStatus: 'good' }));
  const evaluation = evaluate(house, configuredSettings());
  assert.equal(evaluation.criteria.ongoingCost.state, UNKNOWN, 'HOA and solar unknown');
  assert.equal(evaluation.criteria.cashToClose.state, KNOWN);
  assert.equal(category(evaluation, 'stability').unavailableReason, null);
  assertClose(category(evaluation, 'stability').score, 100, 'stability');
});

test('one scoreable financial subcategory is enough for Stability', () => {
  const house = answered(bareHouse());
  const evaluation = evaluate(house, configuredSettings());
  assert.equal(evaluation.criteria.ongoingCost.state, UNKNOWN, 'HOA and solar unknown');
  assert.equal(evaluation.criteria.cashToClose.state, KNOWN);
  assertClose(category(evaluation, 'stability').score, 100, 'stability');
});

test('uncosted required work makes Stability unavailable even when Ongoing Cost is scoreable', () => {
  const base = answered(bareHouse({ hoa: NO, solarStatus: 'none', foundation: 'clear' }));
  const house = withProject(base, 'roof', { state: PROJECT_NEED, cost: null });
  const evaluation = evaluate(house, configuredSettings());
  const stability = category(evaluation, 'stability');
  assert.equal(evaluation.criteria.ongoingCost.state, KNOWN);
  assert.equal(stability.score, null);
  assert.equal(stability.unavailableReason, STABILITY_UNCOSTED_WORK);

  const costed = withProject(base, 'roof', { state: PROJECT_NEED, cost: 18000 });
  assert.notEqual(category(evaluate(costed, configuredSettings()), 'stability').score, null);
});

test('uncosted required work blocks Stability before every area is answered too', () => {
  const base = bareHouse({ hoa: NO, solarStatus: 'none' });
  const house = withProject(base, 'sewer', { state: PROJECT_NEED, cost: null });
  assert.equal(category(evaluate(house, configuredSettings()), 'stability').unavailableReason, STABILITY_UNCOSTED_WORK);
});

test('Want to fix costs never move Acquisition Cost or Stability, only Creative Authorship', () => {
  const settings = configuredSettings({ comfortableCashToClose: 80000, maximumCashToClose: 150000 });
  const plain = bestHouse();
  const optional = withProject(withProject(plain, 'kitchen', { state: PROJECT_WANT, cost: 60000, excited: YES }), 'yard', {
    state: PROJECT_WANT,
    cost: null,
    excited: NO,
  });
  const before = evaluate(plain, settings);
  const after = evaluate(optional, settings);
  assert.equal(after.financing.cashToAcquire, before.financing.cashToAcquire);
  assert.equal(after.criteria.cashToClose.score, before.criteria.cashToClose.score);
  assert.equal(after.criteria.requiredWorkCushion.score, before.criteria.requiredWorkCushion.score);
  assert.equal(category(after, 'stability').score, category(before, 'stability').score);
  assert.notEqual(category(after, 'stability').score, null, 'an uncosted Want to fix does not block Stability');
  assert.notEqual(category(after, 'creativeAuthorship').score, category(before, 'creativeAuthorship').score);
});

test('the same cost marked Need to fix lowers the cushion score but not Cash to Close', () => {
  const settings = configuredSettings({ comfortableCashToClose: 80000, maximumCashToClose: 150000 });
  const wanted = withProject(bestHouse(), 'kitchen', { state: PROJECT_WANT, cost: 60000, excited: YES });
  const needed = withProject(bestHouse(), 'kitchen', { state: PROJECT_NEED, cost: 60000 });
  assert.ok(evaluate(needed, settings).criteria.requiredWorkCushion.score < evaluate(wanted, settings).criteria.requiredWorkCushion.score);
  assert.equal(evaluate(needed, settings).criteria.cashToClose.score, evaluate(wanted, settings).criteria.cashToClose.score);
});

test('uncosted required work leaves Acquisition Cost unscored under tight targets', () => {
  const settings = configuredSettings({ comfortableCashToClose: 80000, maximumCashToClose: 120000 });
  const uncosted = withProject(bestHouse(), 'roof', { state: PROJECT_NEED, cost: null });
  const evaluation = evaluate(uncosted, settings);
  assert.equal(category(evaluation, 'stability').score, null);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, UNKNOWN);
});

test('an unavailable Stability drops out of Overall Fit like any unknown category', () => {
  const house = withProject(bestHouse(), 'roof', { state: PROJECT_NEED, cost: null });
  const evaluation = evaluate(house, configuredSettings());
  const livability = category(evaluation, 'livability').score;
  const expected = (34 * livability + 12 * 100 + 10 * 100 + 10 * 100) / 66;
  assertClose(evaluation.weightedFit, expected, 'weighted fit');
  assertClose(evaluation.overallFit, Math.min(100, expected + 2), 'overall fit with delights');
});

/* --------------------------------------------------------------------------
   Information Completeness and the Overall Fit gate
   -------------------------------------------------------------------------- */

test('a house with nothing known scores nothing and has 0% completeness', () => {
  const evaluation = evaluate(bareHouse(), defaultSettings());
  for (const [id, result] of Object.entries(evaluation.criteria)) {
    assert.equal(result.state, UNKNOWN, id);
    assert.equal(result.score, null, id);
  }
  for (const item of evaluation.categories) assert.equal(item.score, null, item.id);
  assert.deepEqual(evaluation.completeness, { known: 0, applicable: 72, percent: 0 });
  assert.equal(evaluation.overallFit, null);
});

test('a fully known house is 100% complete', () => {
  const evaluation = evaluate(bestHouse(), configuredSettings());
  // Covered Route does not apply alongside the attached garage, so 71 of the 72 criteria apply.
  assert.deepEqual(evaluation.completeness, { known: 71, applicable: 71, percent: 100 });
});

test('criteria scored from fallback tax and insurance count as known', () => {
  const house = answered(bareHouse({ hoa: NO, solarStatus: 'none' }));
  const evaluation = evaluate(house, configuredSettings());
  assert.equal(evaluation.financing.inputs.annualPropertyTax.provenance, 'default');
  assert.equal(evaluation.criteria.ongoingCost.state, KNOWN);
  assert.equal(evaluation.criteria.cashToClose.state, KNOWN);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, KNOWN);
  assert.equal(evaluation.completeness.known, 4, 'ongoing cost, cash to close, cushion, creative authorship');
});

test('unconfigured Settings leave financial criteria unknown and lower completeness', () => {
  const evaluation = evaluate(bestHouse(), defaultSettings());
  assert.equal(evaluation.criteria.ongoingCost.state, UNKNOWN);
  assert.equal(evaluation.criteria.cashToClose.state, UNKNOWN);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, UNKNOWN);
  assert.equal(evaluation.completeness.known, 68);
});

test('unanswered tour reactions count against completeness before a tour', () => {
  const house = bestHouse({ likeBeingHere: null, liveAsIsThreeYears: null, sadIfSold: null, wantToGoBack: null });
  const evaluation = evaluate(house, configuredSettings());
  assert.equal(evaluation.completeness.known, 67);
  assert.equal(evaluation.completeness.applicable, 71);
  assert.equal(category(evaluation, 'contentment').score, null);
});

/**
 * Builds a house with exactly a chosen number of known criteria out of its 70 applicable ones.
 * @param {number} knownCount - Number of criteria to leave known, from 33 to 70.
 * @returns {object} The best house with yes/no answers cleared until that many remain known.
 */
function houseWithKnownCount(knownCount) {
  const clearable = [
    'skincareOnCounter', 'privatePrimaryBath', 'outletAtVanity', 'storageVacuum', 'storageCleaning',
    'storageTools', 'storageSeasonal', 'storageBulk', 'litterBoxSpot', 'catTreeSpot', 'fullyFenced',
    'matureTrees', 'parkStrip', 'sidewalkToShovel', 'freewayMinutes', 'megacouchFits', 'tvAreaIsThoroughfare',
    'tvBackToFrontDoor', 'tvBackToWindows', 'christmasTreeSpot', 'sinkStoveWorks', 'dishwasherBesideSink',
    'counterBesideStove', 'counterBesideSink', 'cornerLot', 'laundrySupplyStorage', 'laundrySameFloor',
    'laundryUsableSpace', 'counterSeating', 'diningTableSpace', 'likeBeingHere', 'liveAsIsThreeYears',
    'sadIfSold', 'wantToGoBack', 'guestFullBath', 'trainMinutes', 'groceryMinutes',
  ];
  // No irrigation to run leaves an even 70 applicable, so exactly half can be known.
  const cleared = { irrigation: NA };
  for (let index = 0; index < 70 - knownCount; index += 1) cleared[clearable[index]] = null;
  return bestHouse(cleared);
}

test('Overall Fit appears at exactly 50% completeness and not below', () => {
  const atHalf = evaluate(houseWithKnownCount(35), configuredSettings());
  assert.deepEqual(atHalf.completeness, { known: 35, applicable: 70, percent: 50 });
  assert.notEqual(atHalf.overallFit, null);

  const belowHalf = evaluate(houseWithKnownCount(34), configuredSettings());
  assert.equal(belowHalf.completeness.known, 34);
  assert.equal(belowHalf.overallFit, null);
});

test('category scores still show when Overall Fit is gated', () => {
  const evaluation = evaluate(houseWithKnownCount(34), configuredSettings());
  assert.equal(evaluation.overallFit, null);
  assert.notEqual(category(evaluation, 'stability').score, null);
  assert.notEqual(category(evaluation, 'livability').score, null);
});

/* --------------------------------------------------------------------------
   Delight bonus
   -------------------------------------------------------------------------- */

test('each delight feature answered Yes adds 1 point to Overall Fit, up to 4', () => {
  const base = houseWithKnownCount(50);
  const plain = { ...base, parking: ['detachedGarage', 'carport', 'driveway', 'dedicatedUncovered', 'street'], privatePrimaryBath: NO };
  const without = evaluate(plain, configuredSettings());
  assert.deepEqual(without.delights, []);
  assert.equal(without.overallFit, without.weightedFit);

  const all = { ...base, privatePrimaryBath: YES, fireplace: YES, bayWindow: YES };
  const withAll = evaluate(all, configuredSettings());
  assert.deepEqual(withAll.delights, ['attachedGarage', 'privatePrimaryBath', 'fireplace', 'bayWindow']);
  assert.equal(withAll.delightBonus, 4);
  assertClose(withAll.overallFit, Math.min(100, withAll.weightedFit + 4), 'overall fit');
});

test('No and Unknown delight answers add nothing and cost nothing', () => {
  const house = houseWithKnownCount(50);
  const unknown = evaluate({ ...house, fireplace: null, bayWindow: null }, configuredSettings());
  const no = evaluate({ ...house, fireplace: NO, bayWindow: NO }, configuredSettings());
  assert.equal(no.overallFit, unknown.overallFit);
  assert.equal(no.weightedFit, unknown.weightedFit);
});

test('delight features change no category score and no completeness', () => {
  const house = bestHouse({ privatePrimaryBath: NO });
  const before = evaluate(house, configuredSettings());
  const after = evaluate({ ...house, fireplace: YES, bayWindow: YES }, configuredSettings());
  assert.deepEqual(after.completeness, before.completeness);
  for (let index = 0; index < before.categories.length; index += 1) {
    assert.equal(after.categories[index].score, before.categories[index].score, before.categories[index].id);
  }
  assert.equal(after.weightedFit, before.weightedFit);
});

test('the delight bonus never makes Overall Fit appear below the completeness gate', () => {
  // Trading exterior steps for the private bathroom answer keeps 34 of 70 known, just under half.
  const house = houseWithKnownCount(34);
  const delightful = { ...house, privatePrimaryBath: YES, exteriorSteps: null, fireplace: YES, bayWindow: YES };
  const evaluation = evaluate(delightful, configuredSettings());
  assert.equal(evaluation.completeness.known, 34);
  assert.equal(evaluation.weightedFit, null);
  assert.equal(evaluation.overallFit, null);
  assert.equal(evaluation.delights.length, 4);
});

test('the private primary bathroom carries 45% of Bathroom & Getting Ready', () => {
  let bathroom = null;
  for (const item of CATEGORIES) {
    for (const sub of item.subcategories) {
      if (sub.id === 'bathroom') bathroom = sub;
    }
  }
  assert.deepEqual(idWeights(bathroom.criteria), [
    ['privatePrimaryBath', 45],
    ['skincareOnCounter', 17],
    ['tub', 12],
    ['outletAtVanity', 10],
    ['vanityStorage', 7],
    ['linenStorage', 6],
    ['medicineCabinet', 3],
  ]);
});

/* --------------------------------------------------------------------------
   Whole-house fixtures
   -------------------------------------------------------------------------- */

test('fixture: the best possible house', () => {
  const evaluation = evaluate(bestHouse(), configuredSettings());
  // Only the carport criterion falls short: its best score is 65. Covered Route (5) does not apply.
  const parking = 100 - (11 * 35) / 95;
  const livability = 100 - 0.08 * (100 - parking);
  assertClose(subcategory(evaluation, 'livability', 'parking').score, parking, 'parking');
  assertClose(category(evaluation, 'livability').score, livability, 'livability');
  assertClose(category(evaluation, 'stability').score, 100, 'stability');
  assertClose(category(evaluation, 'contentment').score, 100, 'contentment');
  assertClose(category(evaluation, 'creativeAuthorship').score, 100, 'creative authorship');
  assertClose(category(evaluation, 'deepConnection').score, 100, 'deep connection');
  const weighted = 100 - 0.34 * (100 - livability);
  assertClose(evaluation.weightedFit, weighted, 'weighted fit');
  assert.deepEqual(evaluation.delights, ['attachedGarage', 'privatePrimaryBath']);
  assertClose(evaluation.overallFit, 100, 'the +2 delight bonus is capped at 100');
});

test('fixture: a toured house with specific weaknesses', () => {
  let house = bestHouse({
    trainMinutes: 10,
    roofStatus: 'mediumTerm',
    wantToGoBack: NO,
    airportMinutes: 30,
    guestFullBath: NO,
  });
  house = withProject(house, 'office', { state: PROJECT_WANT, excited: NO });
  const evaluation = evaluate(house, configuredSettings());

  const location = 0.45 * 90 + 0.35 * 100 + 0.2 * 100;
  const parking = 100 - (11 * 35) / 95;
  const livability = 100 - 0.15 * (100 - location) - 0.08 * (100 - parking);
  const majorSystems = 100 - 0.12 * 35;
  const stability = 0.45 * 100 + 0.35 * 100 + 0.2 * majorSystems;
  const contentment = 85;
  const creativeAuthorship = 95 - 10;
  const proximity = 0.69 * 100 + 0.31 * 85;
  const deepConnection = 0.45 * 100 + 0.4 * proximity + 0.15 * 0;

  assertClose(category(evaluation, 'livability').score, livability, 'livability');
  assertClose(category(evaluation, 'stability').score, stability, 'stability');
  assertClose(category(evaluation, 'contentment').score, contentment, 'contentment');
  assertClose(category(evaluation, 'creativeAuthorship').score, creativeAuthorship, 'creative authorship');
  assertClose(category(evaluation, 'deepConnection').score, deepConnection, 'deep connection');

  const overall =
    0.34 * stability + 0.34 * livability + 0.12 * deepConnection + 0.1 * creativeAuthorship + 0.1 * contentment;
  assertClose(evaluation.weightedFit, overall, 'weighted fit');
  assertClose(evaluation.overallFit, Math.min(100, overall + 2), 'overall fit with the attached garage and private bath delights');
  assert.equal(evaluation.completeness.percent, 100);
});

test('fixture: an untoured house with finances and travel times only', () => {
  const house = bareHouse({
    hoa: NO,
    solarStatus: 'none',
    propertyType: 'detached',
    trainMinutes: 15,
    groceryMinutes: 10,
    freewayMinutes: 5,
    parentsMinutes: 20,
    airportMinutes: 20,
  });
  const evaluation = evaluate(house, configuredSettings());

  assertClose(category(evaluation, 'stability').score, 100, 'stability from ongoing cost alone');
  const location = 0.45 * 70 + 0.35 * 95 + 0.2 * 100;
  assertClose(category(evaluation, 'livability').score, (15 * location + 8 * 100) / 23, 'livability');
  assertClose(category(evaluation, 'deepConnection').score, 0.69 * 90 + 0.31 * 95, 'deep connection');
  assert.equal(category(evaluation, 'contentment').score, null);
  assert.equal(category(evaluation, 'creativeAuthorship').score, null);

  assert.equal(evaluation.completeness.known, 8, 'cash to close is known before every project area is answered');
  assert.equal(evaluation.overallFit, null, 'gated below 50% completeness');
});

test('fixture: a house with an uncosted repair', () => {
  let house = bestHouse({ roofStatus: 'failed' });
  house = withProject(house, 'roof', { state: PROJECT_NEED, cost: null });
  const evaluation = evaluate(house, configuredSettings());

  assert.equal(category(evaluation, 'stability').score, null);
  assert.equal(category(evaluation, 'stability').unavailableReason, STABILITY_UNCOSTED_WORK);
  assert.equal(evaluation.criteria.requiredWorkCushion.state, UNKNOWN);
  assert.equal(evaluation.criteria.cashToClose.state, KNOWN);
  assert.equal(evaluation.completeness.known, 70);
  assertClose(subcategory(evaluation, 'stability', 'majorSystems').score, 88, 'major systems');

  const costed = evaluate(withProject(house, 'roof', { state: PROJECT_NEED, cost: 18000 }), configuredSettings());
  assertClose(category(costed, 'stability').score, 0.8 * 100 + 0.2 * 88, 'stability once costed');
  assert.equal(costed.completeness.known, 71);
});

test('status has no effect on any score', () => {
  const available = evaluate(bestHouse(), configuredSettings());
  const sold = evaluate(bestHouse({ status: 'sold', statusDate: '2026-10-20' }), configuredSettings());
  assert.equal(sold.overallFit, available.overallFit);
});

/* --------------------------------------------------------------------------
   Collection order
   -------------------------------------------------------------------------- */

/**
 * Builds a collection entry for sorting tests.
 * @param {string} address - House address, used to identify the entry.
 * @param {string} status - House status.
 * @param {number|null} overallFit - Overall Fit, or null when unavailable.
 * @param {number} [price] - Current listing price.
 * @returns {{ house: object, overallFit: number|null }} The entry.
 */
function entry(address, status, overallFit, price = 400000) {
  return { house: { address, status, priceHistory: [{ id: 'p', price, date: '2026-10-01' }] }, overallFit };
}

/**
 * Lists the addresses of sorted entries.
 * @param {Array<{ house: { address: string } }>} items - Sorted entries.
 * @returns {string[]} Addresses in order.
 */
function addresses(items) {
  const result = [];
  for (const item of items) result.push(item.house.address);
  return result;
}

test('the collection sorts by status, then Overall Fit highest first, unscored last', () => {
  const items = [
    entry('Sold high', 'sold', 95),
    entry('Available unscored', 'available', null),
    entry('Under contract', 'underContract', 70),
    entry('Available low', 'available', 61),
    entry('Available high', 'available', 88),
    entry('Sold unscored', 'sold', null),
    entry('Available middle', 'available', 74.5),
  ];
  assert.deepEqual(addresses(sortForCollection(items)), [
    'Available high',
    'Available middle',
    'Available low',
    'Available unscored',
    'Under contract',
    'Sold high',
    'Sold unscored',
  ]);
});

test('price plays no part in the default fit order', () => {
  const items = [entry('Cheap', 'available', 80, 300000), entry('Dear', 'available', 81, 600000)];
  assert.deepEqual(addresses(sortForCollection(items)), ['Dear', 'Cheap']);
});

/**
 * Builds a mixed set of entries for the sort-option tests.
 * @returns {Array<{ house: object, overallFit: number|null }>} Entries across statuses, fits, and prices.
 */
function mixedEntries() {
  return [
    entry('Sold cheap', 'sold', 90, 350000),
    entry('Avail unscored', 'available', null, 410000),
    entry('Avail 60 dear', 'available', 60, 520000),
    entry('Contract 70', 'underContract', 70, 450000),
    entry('Avail 88 mid', 'available', 88, 430000),
    entry('Avail 74 cheap', 'available', 74, 380000),
  ];
}

test('Overall Fit low to high keeps status order and unscored houses last', () => {
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'fitLow')), [
    'Avail 60 dear',
    'Avail 74 cheap',
    'Avail 88 mid',
    'Avail unscored',
    'Contract 70',
    'Sold cheap',
  ]);
});

test('listing price low to high and high to low sort within each status', () => {
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'priceLow')), [
    'Avail 74 cheap',
    'Avail unscored',
    'Avail 88 mid',
    'Avail 60 dear',
    'Contract 70',
    'Sold cheap',
  ]);
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'priceHigh')), [
    'Avail 60 dear',
    'Avail 88 mid',
    'Avail unscored',
    'Avail 74 cheap',
    'Contract 70',
    'Sold cheap',
  ]);
});

test('price sorting uses the current listing price, not the first one', () => {
  const dropped = entry('Dropped', 'available', 80, 500000);
  dropped.house.priceHistory.push({ id: 'q', price: 350000, date: '2026-10-09' });
  const steady = entry('Steady', 'available', 80, 400000);
  assert.deepEqual(addresses(sortForCollection([steady, dropped], 'priceLow')), ['Dropped', 'Steady']);
});

test('ties in status and fit fall back to address', () => {
  const items = [entry('B Street', 'available', 80), entry('A Street', 'available', 80), entry('C Street', 'available', null), entry('A Lane', 'available', null)];
  assert.deepEqual(addresses(sortForCollection(items)), ['A Street', 'B Street', 'A Lane', 'C Street']);
});

test('without grouping, status plays no part and the sort runs across every house', () => {
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'fitHigh', false)), [
    'Sold cheap',
    'Avail 88 mid',
    'Avail 74 cheap',
    'Contract 70',
    'Avail 60 dear',
    'Avail unscored',
  ]);
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'priceLow', false)), [
    'Sold cheap',
    'Avail 74 cheap',
    'Avail unscored',
    'Avail 88 mid',
    'Contract 70',
    'Avail 60 dear',
  ]);
});

test('without grouping, houses missing the sorted value still go last, ties by address', () => {
  const items = [entry('B unscored', 'available', null), entry('Sold 80', 'sold', 80), entry('A unscored', 'sold', null), entry('Avail 80', 'available', 80)];
  assert.deepEqual(addresses(sortForCollection(items, 'fitLow', false)), ['Avail 80', 'Sold 80', 'A unscored', 'B unscored']);
});

test('grouping by status is the default', () => {
  assert.deepEqual(addresses(sortForCollection(mixedEntries(), 'fitHigh', true)), addresses(sortForCollection(mixedEntries())));
});

test('sortForCollection does not reorder the array it is given', () => {
  const items = [entry('B', 'sold', 1), entry('A', 'available', 2)];
  sortForCollection(items);
  assert.deepEqual(addresses(items), ['B', 'A']);
});

test('each scored criterion carries what a view needs to describe its observation', () => {
  const evaluation = evaluate(bareHouse({ trainMinutes: 8, exteriorSteps: 3, megacouchFits: YES }), configuredSettings());
  const train = evaluation.criteria.train;
  assert.deepEqual([train.type, train.field, train.unit, train.value], ['curve', 'trainMinutes', 'min', 8]);
  assert.equal(evaluation.criteria.exteriorSteps.unit, 'steps');
  assert.deepEqual([evaluation.criteria.megacouchFits.type, evaluation.criteria.megacouchFits.field], ['yes', 'megacouchFits']);
  assert.equal(evaluation.criteria.garage.field, null);
});

/**
 * Builds a collection entry with size facts for the extra sort tests.
 * @param {string} address - House address, used to identify the entry.
 * @param {string} status - House status.
 * @param {{ price?: number, squareFeet?: number|null, lotAcres?: number|null, yearBuilt?: number|null }} facts - Size facts.
 * @returns {{ house: object, overallFit: number|null }} The entry.
 */
function sized(address, status, facts) {
  const item = entry(address, status, 80, facts.price === undefined ? 400000 : facts.price);
  item.house.squareFeet = facts.squareFeet === undefined ? null : facts.squareFeet;
  item.house.lotAcres = facts.lotAcres === undefined ? null : facts.lotAcres;
  item.house.yearBuilt = facts.yearBuilt === undefined ? null : facts.yearBuilt;
  return item;
}

/**
 * Builds a mixed set of entries with size facts.
 * @returns {Array<{ house: object, overallFit: number|null }>} Entries across statuses and sizes.
 */
function sizedEntries() {
  return [
    sized('Sold big', 'sold', { squareFeet: 3000, lotAcres: 1, yearBuilt: 2020, price: 600000 }),
    sized('Avail unknown', 'available', {}),
    sized('Avail small', 'available', { squareFeet: 1200, lotAcres: 0.1, yearBuilt: 1950, price: 360000 }),
    sized('Avail large', 'available', { squareFeet: 2400, lotAcres: 0.25, yearBuilt: 2005, price: 480000 }),
    sized('Avail mid', 'available', { squareFeet: 1600, lotAcres: 0.18, yearBuilt: 1978, price: 400000 }),
  ];
}

test('square feet, lot size, and year built sort within status, unknowns last', () => {
  const avail = ['Avail large', 'Avail mid', 'Avail small'];
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'sqftHigh')), [...avail, 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'sqftLow')), [...[...avail].reverse(), 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'lotHigh')), [...avail, 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'lotLow')), [...[...avail].reverse(), 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'yearNewest')), [...avail, 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'yearOldest')), [...[...avail].reverse(), 'Avail unknown', 'Sold big']);
});

test('price per square foot sorts within status, unknowns last', () => {
  // Per square foot: small 300, large 200, mid 250.
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'perSqftLow')), ['Avail large', 'Avail mid', 'Avail small', 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'perSqftHigh')), ['Avail small', 'Avail mid', 'Avail large', 'Avail unknown', 'Sold big']);
});

test('price per lot square foot sorts within status, unknowns last', () => {
  // Per lot acre: small 3,600,000, large 1,920,000, mid about 2,222,222.
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'perLotSqftLow')), ['Avail large', 'Avail mid', 'Avail small', 'Avail unknown', 'Sold big']);
  assert.deepEqual(addresses(sortForCollection(sizedEntries(), 'perLotSqftHigh')), ['Avail small', 'Avail mid', 'Avail large', 'Avail unknown', 'Sold big']);
});

test('days on market sorts within status, unknowns last', () => {
  const items = [
    { ...entry('Sold long', 'sold', null), daysOnMarket: 90 },
    { ...entry('Avail unknown', 'available', null), daysOnMarket: null },
    { ...entry('Avail fresh', 'available', null), daysOnMarket: 3 },
    { ...entry('Avail stale', 'available', null), daysOnMarket: 61 },
    { ...entry('Avail mid', 'available', null), daysOnMarket: 20 },
  ];
  assert.deepEqual(addresses(sortForCollection(items, 'daysLow')), ['Avail fresh', 'Avail mid', 'Avail stale', 'Avail unknown', 'Sold long']);
  assert.deepEqual(addresses(sortForCollection(items, 'daysHigh')), ['Avail stale', 'Avail mid', 'Avail fresh', 'Avail unknown', 'Sold long']);
});

/* --------------------------------------------------------------------------
   Comparing two houses
   -------------------------------------------------------------------------- */

/**
 * Compares two houses under the same settings.
 * @param {object} houseA - First house.
 * @param {object} houseB - Second house.
 * @param {object} [settings] - Settings to evaluate under.
 * @returns {{ categories: object[], differences: object[] }} Result of compareEvaluations.
 */
function compareHouses(houseA, houseB, settings = configuredSettings()) {
  return compareEvaluations(evaluate(houseA, settings), evaluate(houseB, settings));
}

/**
 * Finds one criterion's compared row.
 * @param {{ categories: object[] }} comparison - Result of compareEvaluations.
 * @param {string} id - Criterion id.
 * @returns {object} The row.
 */
function comparedRow(comparison, id) {
  for (const categoryRow of comparison.categories) {
    for (const subcategoryRow of categoryRow.subcategories) {
      for (const row of subcategoryRow.rows) {
        if (row.id === id) return row;
      }
    }
  }
  throw new Error(`No row ${id}`);
}

/**
 * Builds a copy of a house at a different listing price.
 * @param {object} house - House to copy.
 * @param {number} price - New listing price.
 * @returns {object} The house with one price entry at that price.
 */
function atPrice(house, price) {
  return { ...house, priceHistory: [{ ...house.priceHistory[0], price }] };
}

test('two identical, fully known houses are the same everywhere and have no differences', () => {
  const comparison = compareHouses(bestHouse(), bestHouse());
  assert.equal(comparison.differences.length, 0);
  for (const categoryRow of comparison.categories) {
    for (const subcategoryRow of categoryRow.subcategories) {
      for (const row of subcategoryRow.rows) assert.equal(row.kind, SAME, `${row.id} is the same`);
    }
  }
});

test('the comparison pairs every criterion, in rubric order', () => {
  const comparison = compareHouses(bestHouse(), bareHouse());
  const ids = [];
  for (const categoryRow of comparison.categories) {
    for (const subcategoryRow of categoryRow.subcategories) {
      for (const row of subcategoryRow.rows) ids.push(row.id);
    }
  }
  const expected = [];
  for (const categoryDef of CATEGORIES) {
    for (const subcategoryDef of categoryDef.subcategories) {
      for (const criterionDef of subcategoryDef.criteria) expected.push(criterionDef.id);
    }
  }
  assert.deepEqual(ids, expected);
});

test('a known difference is weighted by its share of Overall Fit', () => {
  const comparison = compareHouses(bestHouse(), bestHouse({ likeBeingHere: NO }));
  const row = comparedRow(comparison, 'likeBeingHere');
  assert.equal(row.kind, DIFFERS);
  // 100 points × Contentment 10% × 35%.
  assertClose(row.impact, 3.5, 'impact');
  assert.deepEqual(comparison.differences.map((item) => item.id), ['likeBeingHere']);
});

test('an unknown on either side cannot be compared yet and is never a difference', () => {
  const comparison = compareHouses(bestHouse(), bestHouse({ megacouchFits: null }));
  const row = comparedRow(comparison, 'megacouchFits');
  assert.equal(row.kind, INCOMPLETE);
  assert.equal(row.impact, 0);
  assert.equal(comparison.differences.length, 0);
  assert.equal(comparedRow(compareHouses(bareHouse(), bareHouse()), 'megacouchFits').kind, INCOMPLETE);
});

test('a criterion that applies to only one house differs without a score gap', () => {
  // An attached garage makes Covered Route not applicable.
  const withoutAttached = bestHouse({ parking: ['detachedGarage', 'carport', 'driveway', 'dedicatedUncovered', 'street'] });
  const comparison = compareHouses(bestHouse(), withoutAttached);
  const row = comparedRow(comparison, 'coveredRoute');
  assert.equal(row.a.state, NOT_APPLICABLE);
  assert.equal(row.kind, DIFFERS);
  assert.equal(row.impact, 0);
  assert.ok(!comparison.differences.some((item) => item.id === 'coveredRoute'));
  assert.equal(comparedRow(compareHouses(bestHouse(), bestHouse()), 'coveredRoute').kind, SAME);
});

test('different facts with the same score still differ, but are not ranked', () => {
  // Pantry and cabinetry, or pantry and other storage: two workable types either way.
  const comparison = compareHouses(bestHouse(), bestHouse({ foodStorage: ['pantry', 'other'] }));
  const row = comparedRow(comparison, 'foodStorage');
  assert.equal(row.kind, DIFFERS);
  assert.equal(row.impact, 0);
  assert.equal(comparison.differences.length, 0);
});

test('the biggest differences are ordered by their weight in Overall Fit', () => {
  const comparison = compareHouses(bestHouse(), bestHouse({ megacouchFits: NO, likeBeingHere: NO, guestFullBath: NO }));
  // Like being here 3.5, guest bathroom 12% × 15% × 100 = 1.8, megacouch 34% × 8% × 30% × 100 = 0.816.
  assert.deepEqual(comparison.differences.map((item) => item.id), ['likeBeingHere', 'guestFullBath', 'megacouchFits']);
  assert.equal(comparison.differences[0].category, 'Contentment');
});

test('cost criteria are compared but left out of the biggest differences', () => {
  const settings = configuredSettings({ comfortableMonthlyCost: 2000, maximumMonthlyCost: 4000, comfortableCashToClose: 80000, maximumCashToClose: 120000 });
  const comparison = compareHouses(bestHouse(), atPrice(bestHouse(), 480000), settings);
  for (const id of FINANCIAL_CRITERIA) assert.equal(comparedRow(comparison, id).kind, DIFFERS, `${id} differs`);
  assert.ok(!comparison.differences.some((item) => FINANCIAL_CRITERIA.includes(item.id)));
});

test('an attached garage difference includes its delight point in Biggest differences', () => {
  const noGarage = bestHouse({ parking: ['carport', 'driveway', 'dedicatedUncovered', 'street'] });
  const comparison = compareHouses(bestHouse(), noGarage);
  const garage = comparedRow(comparison, 'garage');
  // 34% × Parking 8% × Garage 40% × 100, plus the one-point delight.
  assertClose(garage.impact, 0.34 * 0.08 * 0.4 * 100 + 1, 'garage impact');
  assert.equal(garage.delight, 'attachedGarage');
  assert.ok(comparison.differences.includes(garage));
  assert.deepEqual(comparison.delights, []);
});

test('a private primary bathroom difference includes its delight point', () => {
  const row = comparedRow(compareHouses(bestHouse(), bestHouse({ privatePrimaryBath: NO })), 'privatePrimaryBath');
  assertClose(row.impact, 0.34 * 0.13 * 0.45 * 100 + 1, 'impact');
});

test('a delight with no criterion to carry it gets a row of its own, worth one point', () => {
  const comparison = compareHouses(bestHouse({ fireplace: YES }), bestHouse({ fireplace: NO }));
  assert.equal(comparison.delights.length, 1);
  const [row] = comparison.delights;
  assert.deepEqual([row.id, row.label, row.category, row.impact, row.a.score, row.b.score], ['fireplace', 'Fireplace', 'Delight bonus', 1, 100, 0]);
  assert.deepEqual(comparison.differences.map((item) => item.id), ['fireplace']);
});

test('an attached garage that ties a detached one on Garage still shows its delight point', () => {
  // Attached without power and detached with power both score 85 on Garage.
  const attached = bestHouse({ garagePower: NO });
  const detached = bestHouse({ parking: ['detachedGarage', 'carport', 'driveway', 'dedicatedUncovered', 'street'], garagePower: YES });
  const comparison = compareHouses(attached, detached);
  assert.equal(comparedRow(comparison, 'garage').delight, null);
  assert.deepEqual(comparison.delights.map((row) => [row.id, row.impact, row.a.score]), [['attachedGarage', 1, 100]]);
});

test('a delight unknown for either house is never a difference', () => {
  assert.deepEqual(compareHouses(bestHouse({ fireplace: YES }), bestHouse()).delights, []);
});

test('Compare and the Price Ladder give the same Fit effect for the same feature', () => {
  const noGarage = bestHouse({ parking: ['carport', 'driveway', 'dedicatedUncovered', 'street'] });
  const settings = configuredSettings();
  const comparison = compareHouses(noGarage, bestHouse(), settings);
  const step = ladderStep({ house: noGarage, evaluation: evaluate(noGarage, settings) }, { house: bestHouse(), evaluation: evaluate(bestHouse(), settings) });
  // The other parking differences (workspace, combination) fall under the ladder's floor, so the line is the garage alone.
  const ladderGarage = step.facts.find((fact) => fact.items.some((item) => item.id === 'garage'));
  assert.deepEqual(ladderGarage.items.map((item) => item.id), ['garage']);
  assertClose(ladderGarage.impact, comparedRow(comparison, 'garage').impact, 'same points');
});

test('at most the top ten differences are listed', () => {
  const answers = {};
  for (const field of ['megacouchFits', 'christmasTreeSpot', 'sinkStoveWorks', 'dishwasherBesideSink', 'counterBesideStove', 'counterBesideSink',
    'storageVacuum', 'storageCleaning', 'storageTools', 'storageSeasonal', 'storageBulk', 'litterBoxSpot']) {
    answers[field] = NO;
  }
  const comparison = compareHouses(bestHouse(), bestHouse(answers));
  assert.equal(comparison.differences.length, BIGGEST_DIFFERENCES);
  for (let index = 1; index < comparison.differences.length; index += 1) {
    assert.ok(comparison.differences[index - 1].impact >= comparison.differences[index].impact, 'largest first');
  }
});

/* --------------------------------------------------------------------------
   Price Ladder
   -------------------------------------------------------------------------- */

/**
 * Explains the step from a cheaper house up to a pricier one, both evaluated under the same settings.
 * @param {object} lower - The cheaper house.
 * @param {object} higher - The pricier house.
 * @param {object} [settings] - Settings to evaluate under.
 * @returns {{ facts: object[], unknown: number }} Result of ladderStep.
 */
function climb(lower, higher, settings = configuredSettings()) {
  return ladderStep({ house: lower, evaluation: evaluate(lower, settings) }, { house: higher, evaluation: evaluate(higher, settings) });
}

/**
 * Lists the criterion or delight ids of each fact, one array per fact.
 * @param {{ facts: object[] }} step - Result of ladderStep.
 * @returns {string[][]} Ids per fact, in order.
 */
function factIds(step) {
  const ids = [];
  for (const fact of step.facts) {
    const itemIds = [];
    for (const item of fact.items) itemIds.push(item.id);
    ids.push(itemIds);
  }
  return ids;
}

test('the ladder leaves out Sold houses and orders the rest by listing price, ties by address', () => {
  const items = [
    { house: { ...atPrice(bareHouse(), 450000), address: 'B Street', status: 'available' } },
    { house: { ...atPrice(bareHouse(), 300000), address: 'Sold Street', status: 'sold' } },
    { house: { ...atPrice(bareHouse(), 400000), address: 'C Street', status: 'underContract' } },
    { house: { ...atPrice(bareHouse(), 400000), address: 'A Street', status: 'available' } },
  ];
  const addresses = [];
  for (const item of sortForLadder(items)) addresses.push(item.house.address);
  assert.deepEqual(addresses, ['A Street', 'C Street', 'B Street']);
});

test('a step names what the pricier house gains and what it gives up', () => {
  const step = climb(bestHouse({ guestFullBath: NO }), bestHouse({ litterBoxSpot: NO }));
  assert.deepEqual(factIds(step), [['litterBoxSpot'], ['guestFullBath']]);
  assert.equal(step.facts[0].direction, GIVE_UP);
  assert.equal(step.facts[1].direction, GAIN);
  // Salem 45% × litter box 35% × Deep Connection 12% × 100.
  assertClose(step.facts[0].impact, 1.89, 'impact');
});

test('reactions and price-derived costs are never ladder facts', () => {
  assert.deepEqual(climb(bestHouse({ likeBeingHere: NO, sadIfSold: NO }), bestHouse()).facts, []);
  const settings = configuredSettings({ comfortableMonthlyCost: 2000, maximumMonthlyCost: 4000, comfortableCashToClose: 80000, maximumCashToClose: 120000 });
  assert.deepEqual(climb(bestHouse(), atPrice(bestHouse(), 480000), settings).facts, []);
});

test('differences worth less than the floor are left out', () => {
  // Medicine cabinet: Livability 34% × Bathroom 13% × 3% × 100 ≈ 0.13 points.
  assert.deepEqual(climb(bestHouse({ bathroomStorage: ['vanity', 'linen'] }), bestHouse()).facts, []);
  // Outlet at vanity: 34% × 13% × 10% × 100 ≈ 0.44 points, over the floor.
  assert.deepEqual(factIds(climb(bestHouse({ outletAtVanity: NO }), bestHouse())), [['outletAtVanity']]);
});

test('facts in one subcategory moving the same way share a line', () => {
  const together = climb(bestHouse({ sinkStoveWorks: NO, dishwasherBesideSink: NO }), bestHouse());
  assert.deepEqual(factIds(together), [['sinkStoveWorks', 'dishwasherBesideSink']]);
  assert.equal(together.facts[0].grouped, true);
  assert.equal(together.facts[0].subcategory, 'Kitchen');
  // 34% × Kitchen 8% × (30% + 20%) × 100.
  assertClose(together.facts[0].impact, 1.36, 'impact');

  const apart = climb(bestHouse({ sinkStoveWorks: NO }), bestHouse({ dishwasherBesideSink: NO }));
  assert.deepEqual(factIds(apart), [['sinkStoveWorks'], ['dishwasherBesideSink']]);
  assert.equal(apart.facts[0].grouped, false);
});

test('a delight that is also a criterion joins its line and adds one point', () => {
  const bath = climb(bestHouse({ privatePrimaryBath: NO }), bestHouse());
  assert.deepEqual(factIds(bath), [['privatePrimaryBath']]);
  // 34% × 13% × 45% × 100, plus the one-point delight.
  assertClose(bath.facts[0].impact, 0.34 * 0.13 * 0.45 * 100 + 1, 'impact');

  // Detached to attached garage is a small Garage gain that the delight lifts over the floor.
  const garage = climb(bestHouse({ parking: ['detachedGarage', 'carport', 'driveway', 'dedicatedUncovered', 'street'] }), bestHouse());
  assert.deepEqual(factIds(garage), [['garage']]);
  assertClose(garage.facts[0].impact, 15 * 0.34 * 0.08 * 0.4 + 1, 'impact');
});

test('a delight with no criterion is its own fact, and only between known answers', () => {
  const fireplace = climb(bestHouse({ fireplace: YES }), bestHouse({ fireplace: NO }));
  assert.deepEqual(factIds(fireplace), [['fireplace']]);
  assert.equal(fireplace.facts[0].direction, GIVE_UP);
  assert.equal(fireplace.facts[0].items[0].isDelight, true);
  assert.equal(fireplace.facts[0].impact, 1);
  assert.deepEqual(climb(bestHouse({ fireplace: YES }), bestHouse()).facts, []);
});

test('at most three facts, keeping room for a give-up when gains would fill every slot', () => {
  const lower = bestHouse({ litterBoxSpot: NO, guestFullBath: NO, sinkStoveWorks: NO, megacouchFits: NO });
  const step = climb(lower, bestHouse({ outletAtVanity: NO }));
  assert.equal(step.facts.length, LADDER_FACTS);
  assert.deepEqual(factIds(step), [['litterBoxSpot'], ['guestFullBath'], ['outletAtVanity']]);
  assert.equal(step.facts[2].direction, GIVE_UP);
});

test('a step counts the criteria still unknown for either house, outside reactions and costs', () => {
  assert.equal(climb(bestHouse(), bestHouse()).unknown, 0);
  assert.equal(climb(bestHouse(), bestHouse({ megacouchFits: null })).unknown, 1);
  assert.equal(climb(bestHouse({ likeBeingHere: null }), bestHouse()).unknown, 0);
});
