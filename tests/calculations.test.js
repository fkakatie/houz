import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NO,
  YES,
  PROJECT_AREAS,
  PROJECT_NEED,
  PROJECT_NO_CHANGE,
  PROJECT_WANT,
  STATUS_AVAILABLE,
  STATUS_SOLD,
  STATUS_UNDER_CONTRACT,
  addPriceEntry,
  createHouse,
  defaultSettings,
} from '../scripts/data.js';
import {
  DEFAULT_ESTIMATE,
  ENTERED,
  MISSING_HOA,
  MISSING_INTEREST_RATE,
  MISSING_POINTS,
  MISSING_PROJECT_COST,
  MISSING_PROJECT_ANSWERS,
  MISSING_SOLAR,
  MISSING_WANT_COST,
  calculateFinancing,
  calculateProjectWork,
  calculateRequiredWork,
  currentListingPrice,
  daysBetween,
  daysOnMarket,
  entrySupportCount,
  MAP_MAX_ZOOM,
  clampMapView,
  fitMapView,
  gestureMapView,
  mapPoint,
  mapPointAt,
  mapZoomLimits,
  mortgagePayment,
  optionState,
  priceHistoryChanges,
  pricePerLotSquareFoot,
  pricePerSquareFoot,
  resolveValue,
} from '../scripts/calculations.js';
import MAP from '../map/map.json' with { type: 'json' };

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
 * Asserts that two numbers are within a tolerance of each other.
 * @param {number} actual - Calculated value.
 * @param {number} expected - Value it should be near.
 * @param {number} tolerance - Largest acceptable difference.
 * @param {string} [label] - Name of the value, shown on failure.
 */
function assertClose(actual, expected, tolerance, label = 'value') {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ±${tolerance}, got ${actual}`,
  );
}

/**
 * Builds settings with the financing terms configured.
 * @param {object} [overrides] - Settings values to change from the configured defaults.
 * @returns {object} Settings with a 7.125% rate and 1.832 points unless overridden.
 */
function configuredSettings(overrides = {}) {
  return { ...defaultSettings(), interestRate: 7.125, pointsPercent: 1.832, ...overrides };
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
 * Builds a copy of a house with one project area left untouched.
 * @param {object} house - House to copy.
 * @returns {object} A house whose projects are not all answered.
 */
function unanswered(house) {
  return { ...house, projects: { ...house.projects, kitchen: { ...house.projects.kitchen, state: null } } };
}

/**
 * Builds a $400,000 house with HOA and solar confirmed absent and every project area answered No change.
 * @param {object} [overrides] - House fields to change.
 * @returns {object} A house whose financing can be fully calculated.
 */
function knownHouse(overrides = {}) {
  const house = createHouse({ mlsNumber: '2100001', address: '300 N Example St', listingPrice: 400000, listingDate: '2026-10-01' });
  return answered({ ...house, hoa: NO, solarStatus: 'none', ...overrides });
}

/**
 * Builds a copy of a house with one project area replaced.
 * @param {object} house - House to copy.
 * @param {string} area - Project area key such as "roof".
 * @param {{ state: string, cost: number|null }} project - Project state and cost for that area.
 * @returns {object} A new house with the project set.
 */
function withProject(house, area, project) {
  const full = { note: '', excited: null, ...project };
  return { ...house, projects: { ...house.projects, [area]: full } };
}

/* --------------------------------------------------------------------------
   Building blocks
   -------------------------------------------------------------------------- */

test('resolveValue prefers the property value, then Settings, then unknown', () => {
  assert.deepEqual(resolveValue(25, 20), { value: 25, provenance: ENTERED });
  assert.deepEqual(resolveValue(null, 20), { value: 20, provenance: DEFAULT_ESTIMATE });
  assert.deepEqual(resolveValue(null, null), { value: null, provenance: null });
});

test('resolveValue treats an entered zero as a real value', () => {
  assert.deepEqual(resolveValue(0, 1.5), { value: 0, provenance: ENTERED });
});

test('mortgagePayment matches the lender worksheet payment', () => {
  // $320,000 at 7.125% for 30 years: worksheet total $2,429.11 less $90 insurance and $183.21 tax.
  assertClose(mortgagePayment(320000, 7.125, 30), 2155.9, 0.01, 'monthly P&I');
});

test('mortgagePayment handles a zero interest rate without dividing by zero', () => {
  assert.equal(mortgagePayment(360000, 0, 30), 1000);
});

/* --------------------------------------------------------------------------
   Lender worksheet
   -------------------------------------------------------------------------- */

test('the $400,000 standard worksheet is reproduced from its components', () => {
  const house = knownHouse({ sellerCredits: 14000 });
  const result = calculateFinancing(house, configuredSettings());

  assert.equal(result.downPaymentAmount, 80000);
  assert.equal(result.loanAmount, 320000);
  assertClose(result.pointsCost, 5862.4, 0.005, 'points cost');
  assertClose(result.lenderFees, 6937.4, 0.005, 'lender fees');
  assert.equal(result.thirdPartyFees, 2702);
  assert.equal(result.governmentFees, 90);
  assert.equal(result.prepaidInsurancePremium, 1080);
  assertClose(result.prepaidInterest, 760, 0.005, 'prepaid interest');
  assert.equal(result.initialInsuranceReserve, 270);
  assertClose(result.initialTaxReserve, 550, 0.005, 'tax reserve');

  const expectedFunds = 80000 + 6937.4 + 2702 + 1300 + 90 + 1080 + 760 + 270 + 550;
  assertClose(result.fundsDueFromBorrower, expectedFunds, 0.005, 'funds due');
  assertClose(result.cashToClose, expectedFunds - 14000, 0.005, 'cash to close');

  // Worksheet: funds due $93,688.84, cash from borrower $79,688.84, monthly payment $2,429.11.
  assertClose(result.fundsDueFromBorrower, 93688.84, 1, 'funds due vs worksheet');
  assertClose(result.cashToClose, 79688.84, 1, 'cash to close vs worksheet');
  assertClose(result.initialMonthlyCost, 2429.11, 0.25, 'monthly cost vs worksheet');
});

/* --------------------------------------------------------------------------
   Availability
   -------------------------------------------------------------------------- */

test('a blank interest rate makes mortgage-dependent figures unavailable', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings({ interestRate: null }));
  assert.equal(result.downPaymentAmount, 80000, 'down payment needs no rate');
  assert.equal(result.loanAmount, 320000);
  assert.equal(result.monthlyPI, null);
  assert.equal(result.initialMonthlyCost, null);
  assert.equal(result.initialMonthlyKnownSubtotal, null);
  assert.equal(result.postRecastMonthlyCost, null);
  assert.equal(result.prepaidInterest, null);
  assert.equal(result.cashToClose, null);
  assert.equal(result.cashToAcquire, null);
  assert.equal(result.knownCashToAcquire, null);
  assert.ok(result.monthlyMissing.includes(MISSING_INTEREST_RATE));
  assert.ok(result.cashToCloseMissing.includes(MISSING_INTEREST_RATE));
});

test('a zero interest rate is a known rate', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings({ interestRate: 0 }));
  assertClose(result.monthlyPI, 320000 / 360, 0.005, 'monthly P&I');
  assert.equal(result.prepaidInterest, 0);
  assert.notEqual(result.cashToClose, null);
});

test('blank points make Cash to Close unavailable but not monthly cost', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings({ pointsPercent: null }));
  assert.notEqual(result.initialMonthlyCost, null);
  assert.equal(result.pointsCost, null);
  assert.equal(result.cashToClose, null);
  assert.equal(result.cashToAcquire, null);
  assert.deepEqual(result.cashToCloseMissing, [MISSING_POINTS]);
  assert.deepEqual(result.monthlyMissing, []);
});

test('points entered on the property make Cash to Close available', () => {
  const result = calculateFinancing(knownHouse({ pointsPercent: 0 }), configuredSettings({ pointsPercent: null }));
  assert.equal(result.pointsCost, 0);
  assert.notEqual(result.cashToClose, null);
  assert.equal(result.inputs.pointsPercent.provenance, ENTERED);
});

/* --------------------------------------------------------------------------
   Tax and insurance fallbacks
   -------------------------------------------------------------------------- */

test('blank tax and insurance use the fallback estimates and are labeled as such', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings());
  assertClose(result.inputs.annualPropertyTax.value, 2200, 0.005, 'annual tax');
  assert.equal(result.inputs.annualPropertyTax.provenance, DEFAULT_ESTIMATE);
  assert.equal(result.inputs.annualInsurance.value, 1080);
  assert.equal(result.inputs.annualInsurance.provenance, DEFAULT_ESTIMATE);
  assert.notEqual(result.initialMonthlyCost, null, 'fallbacks keep the estimate complete');
});

test('entered tax and insurance replace the fallbacks', () => {
  const house = knownHouse({ annualPropertyTax: 3000, annualInsurance: 1320 });
  const result = calculateFinancing(house, configuredSettings());
  assert.deepEqual(result.inputs.annualPropertyTax, { value: 3000, provenance: ENTERED });
  assert.deepEqual(result.inputs.annualInsurance, { value: 1320, provenance: ENTERED });
  assert.equal(result.monthlyPropertyTax, 250);
  assert.equal(result.monthlyInsurance, 110);
  assert.equal(result.prepaidInsurancePremium, 1320);
  assert.equal(result.initialInsuranceReserve, 330);
  assert.equal(result.initialTaxReserve, 750);
});

test('the tax fallback and loan follow the current listing price', () => {
  const house = knownHouse({
    priceHistory: [
      { id: 'a', price: 400000, date: '2026-10-01' },
      { id: 'b', price: 380000, date: '2026-10-08' },
    ],
  });
  const result = calculateFinancing(house, configuredSettings());
  assertClose(result.inputs.annualPropertyTax.value, 2090, 0.005, 'annual tax');
  assert.equal(result.loanAmount, 304000);
});

/* --------------------------------------------------------------------------
   HOA and solar
   -------------------------------------------------------------------------- */

test('unknown HOA leaves the monthly estimate incomplete with a known subtotal', () => {
  const complete = calculateFinancing(knownHouse(), configuredSettings());
  const result = calculateFinancing(knownHouse({ hoa: null }), configuredSettings());
  assert.equal(result.monthlyHoa, null);
  assert.equal(result.initialMonthlyCost, null);
  assert.equal(result.postRecastMonthlyCost, null);
  assert.deepEqual(result.monthlyMissing, [MISSING_HOA]);
  assertClose(result.initialMonthlyKnownSubtotal, complete.initialMonthlyCost, 0.005, 'known subtotal');
});

test('HOA yes with blank dues is unknown, and with dues is included', () => {
  const blank = calculateFinancing(knownHouse({ hoa: YES }), configuredSettings());
  assert.equal(blank.monthlyHoa, null);
  assert.equal(blank.initialMonthlyCost, null);

  const base = calculateFinancing(knownHouse(), configuredSettings());
  const withDues = calculateFinancing(knownHouse({ hoa: YES, hoaDues: 250 }), configuredSettings());
  assert.equal(withDues.monthlyHoa, 250);
  assertClose(withDues.initialMonthlyCost, base.initialMonthlyCost + 250, 0.005, 'monthly cost');
});

test('a confirmed no-HOA property has a known $0 HOA', () => {
  assert.equal(calculateFinancing(knownHouse({ hoa: NO }), configuredSettings()).monthlyHoa, 0);
});

test('solar is $0 when owned or absent and unknown until established', () => {
  const settings = configuredSettings();
  assert.equal(calculateFinancing(knownHouse({ solarStatus: 'owned' }), settings).monthlySolar, 0);
  assert.equal(calculateFinancing(knownHouse({ solarStatus: 'none' }), settings).monthlySolar, 0);

  const unknown = calculateFinancing(knownHouse({ solarStatus: null }), settings);
  assert.equal(unknown.monthlySolar, null);
  assert.equal(unknown.initialMonthlyCost, null);
  assert.deepEqual(unknown.monthlyMissing, [MISSING_SOLAR]);
});

test('financed solar needs its payment before the estimate is complete', () => {
  const settings = configuredSettings();
  const blank = calculateFinancing(knownHouse({ solarStatus: 'financed' }), settings);
  assert.equal(blank.monthlySolar, null);
  assert.equal(blank.initialMonthlyCost, null);

  const base = calculateFinancing(knownHouse(), settings);
  const paid = calculateFinancing(knownHouse({ solarStatus: 'financed', solarPayment: 120 }), settings);
  assertClose(paid.initialMonthlyCost, base.initialMonthlyCost + 120, 0.005, 'monthly cost');
  assertClose(paid.postRecastMonthlyCost, base.postRecastMonthlyCost + 120, 0.005, 'post-recast cost');
});

/* --------------------------------------------------------------------------
   Recast
   -------------------------------------------------------------------------- */

test('with no planned recast, post-recast figures equal the initial ones', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings());
  assert.equal(result.recastPrincipal, 320000);
  assert.equal(result.postRecastPI, result.monthlyPI);
  assert.equal(result.postRecastMonthlyCost, result.initialMonthlyCost);
});

test('a planned recast lowers principal and payment over the original term', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings({ plannedRecastPrincipal: 50000 }));
  assert.equal(result.recastPrincipal, 270000);
  assertClose(result.postRecastPI, mortgagePayment(270000, 7.125, 30), 0.005, 'post-recast P&I');
  assert.ok(result.postRecastMonthlyCost < result.initialMonthlyCost);
});

test('a recast larger than the loan stops at zero principal', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings({ plannedRecastPrincipal: 999999 }));
  assert.equal(result.recastPrincipal, 0);
  assert.equal(result.postRecastPI, 0);
  assertClose(result.postRecastMonthlyCost, result.monthlyPropertyTax + result.monthlyInsurance, 0.005, 'cost');
});

/* --------------------------------------------------------------------------
   Credits
   -------------------------------------------------------------------------- */

test('credits reduce Cash to Close but not the loan', () => {
  const settings = configuredSettings();
  const base = calculateFinancing(knownHouse(), settings);
  const credited = calculateFinancing(knownHouse({ sellerCredits: 10000, lenderCredits: 500 }), settings);
  assertClose(credited.cashToClose, base.cashToClose - 10500, 0.005, 'cash to close');
  assert.equal(credited.loanAmount, base.loanAmount);
  assert.equal(credited.fundsDueFromBorrower, base.fundsDueFromBorrower);
});

test('credits larger than funds due clamp Cash to Close at zero', () => {
  const result = calculateFinancing(knownHouse({ sellerCredits: 500000 }), configuredSettings());
  assert.equal(result.cashToClose, 0);
});

/* --------------------------------------------------------------------------
   Required work
   -------------------------------------------------------------------------- */

test('required work is unknown until every project area is answered', () => {
  const work = calculateRequiredWork(unanswered(knownHouse()));
  assert.deepEqual(work, { knownCost: 0, total: null, hasUncosted: false, answered: false, missing: [MISSING_PROJECT_ANSWERS] });
});

test('answered Projects with nothing to fix means $0 required work', () => {
  const work = calculateRequiredWork(knownHouse());
  assert.deepEqual(work, { knownCost: 0, total: 0, hasUncosted: false, answered: true, missing: [] });
});

test('required work sums Need to fix costs and ignores Want to fix', () => {
  let house = withProject(knownHouse(), 'roof', { state: PROJECT_NEED, cost: 18000 });
  house = withProject(house, 'sewer', { state: PROJECT_NEED, cost: 6000 });
  house = withProject(house, 'kitchen', { state: PROJECT_WANT, cost: 40000 });
  const work = calculateRequiredWork(house);
  assert.equal(work.knownCost, 24000);
  assert.equal(work.total, 24000);
  assert.equal(work.hasUncosted, false);
});

test('an uncosted Need to fix project makes required work unknown, not $0', () => {
  let house = withProject(knownHouse(), 'roof', { state: PROJECT_NEED, cost: 18000 });
  house = withProject(house, 'foundation', { state: PROJECT_NEED, cost: null });
  const work = calculateRequiredWork(house);
  assert.equal(work.knownCost, 18000);
  assert.equal(work.total, null);
  assert.equal(work.hasUncosted, true);
});

test('uncosted required work is reported even before every area is answered', () => {
  const house = withProject(unanswered(knownHouse()), 'roof', { state: PROJECT_NEED, cost: null });
  const work = calculateRequiredWork(house);
  assert.equal(work.hasUncosted, true);
  assert.equal(work.total, null);
});

test('a $0 required project is a known cost', () => {
  const work = calculateRequiredWork(withProject(knownHouse(), 'yard', { state: PROJECT_NEED, cost: 0 }));
  assert.equal(work.total, 0);
  assert.equal(work.hasUncosted, false);
});

test('Want to fix work totals the same way, separately from Need to fix', () => {
  let house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 40000 });
  house = withProject(house, 'yard', { state: PROJECT_WANT, cost: 7000 });
  house = withProject(house, 'roof', { state: PROJECT_NEED, cost: 18000 });
  assert.deepEqual(calculateProjectWork(house, PROJECT_WANT), { knownCost: 47000, total: 47000, hasUncosted: false, answered: true, missing: [] });
  const uncosted = withProject(house, 'office', { state: PROJECT_WANT, cost: null });
  assert.deepEqual(calculateProjectWork(uncosted, PROJECT_WANT), {
    knownCost: 47000,
    total: null,
    hasUncosted: true,
    answered: true,
    missing: [MISSING_WANT_COST],
  });
  assert.equal(calculateProjectWork(unanswered(knownHouse()), PROJECT_WANT).total, null);
});

test('a project total says why it is unknown: unanswered areas, then an uncosted project of that kind', () => {
  const house = withProject(unanswered(knownHouse()), 'roof', { state: PROJECT_NEED, cost: null });
  assert.deepEqual(calculateProjectWork(house, PROJECT_NEED).missing, [MISSING_PROJECT_ANSWERS, MISSING_PROJECT_COST]);
  assert.deepEqual(calculateProjectWork(house, PROJECT_WANT).missing, [MISSING_PROJECT_ANSWERS]);
  assert.deepEqual(calculateRequiredWork(knownHouse()).missing, []);
});

test('the closing-cost subtotal is every loan and closing cost, and with the down payment and prepaids makes the amount due', () => {
  const result = calculateFinancing(knownHouse(), configuredSettings());
  const parts = result.pointsCost + result.inputs.fixedLenderFee.value + result.thirdPartyFees + result.inputs.titleInsurance.value + result.governmentFees;
  assertClose(result.closingCosts, parts, 0.005, 'closing costs');
  assertClose(result.fundsDueFromBorrower, result.downPaymentAmount + result.closingCosts + result.prepaidsAndInitialEscrow, 0.005, 'funds due');
  assert.equal(calculateFinancing(knownHouse(), { ...configuredSettings(), pointsPercent: null }).closingCosts, null);
});

/* --------------------------------------------------------------------------
   Cash to Acquire
   -------------------------------------------------------------------------- */

test('Cash to Acquire is Cash to Close plus required work', () => {
  const house = withProject(knownHouse(), 'roof', { state: PROJECT_NEED, cost: 18000 });
  const result = calculateFinancing(house, configuredSettings());
  assertClose(result.cashToAcquire, result.cashToClose + 18000, 0.005, 'cash to acquire');
  assert.deepEqual(result.cashToAcquireMissing, []);
});

test('Cash to Acquire is unknown until every project area is answered, with a known minimum', () => {
  const result = calculateFinancing(unanswered(knownHouse()), configuredSettings());
  assert.notEqual(result.cashToClose, null);
  assert.equal(result.cashToAcquire, null);
  assert.equal(result.knownCashToAcquire, result.cashToClose);
  assert.deepEqual(result.cashToAcquireMissing, [MISSING_PROJECT_ANSWERS]);
});

test('Cash to Acquire is unknown while required work is uncosted', () => {
  let house = withProject(knownHouse(), 'roof', { state: PROJECT_NEED, cost: 18000 });
  house = withProject(house, 'sewer', { state: PROJECT_NEED, cost: null });
  const result = calculateFinancing(house, configuredSettings());
  assert.equal(result.cashToAcquire, null);
  assertClose(result.knownCashToAcquire, result.cashToClose + 18000, 0.005, 'known minimum');
  assert.deepEqual(result.cashToAcquireMissing, [MISSING_PROJECT_COST]);
});

test('only Want to fix projects: required work is $0 once every area is answered', () => {
  let house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 25000, excited: YES });
  house = withProject(house, 'office', { state: PROJECT_WANT, cost: 6000, excited: NO });
  house = withProject(house, 'yard', { state: PROJECT_WANT, cost: null, excited: YES });
  const result = calculateFinancing(house, configuredSettings());
  assert.deepEqual(result.requiredWork, { knownCost: 0, total: 0, hasUncosted: false, answered: true, missing: [] });
  assert.equal(result.cashToAcquire, result.cashToClose);
  assert.deepEqual(result.cashToAcquireMissing, []);
});

test('Want to fix plus Need to fix: only the Need to fix cost is acquisition cost', () => {
  // A $25,000 optional kitchen remodel and $8,000 of required roof work.
  let house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 25000, excited: YES });
  house = withProject(house, 'roof', { state: PROJECT_NEED, cost: 8000 });
  const result = calculateFinancing(house, configuredSettings());
  assert.equal(result.requiredWork.total, 8000);
  assertClose(result.cashToAcquire, result.cashToClose + 8000, 0.005, 'cash to acquire');
});

test('an unknown Want to fix cost leaves Cash to Acquire calculable', () => {
  let house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: null, excited: YES });
  house = withProject(house, 'roof', { state: PROJECT_NEED, cost: 8000 });
  const result = calculateFinancing(house, configuredSettings());
  assert.equal(result.requiredWork.hasUncosted, false);
  assertClose(result.cashToAcquire, result.cashToClose + 8000, 0.005, 'cash to acquire');
  assert.deepEqual(result.cashToAcquireMissing, []);
});

test('an unknown Need to fix cost leaves Cash to Acquire unknown, whatever the Want to fix costs', () => {
  let house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 25000, excited: YES });
  house = withProject(house, 'roof', { state: PROJECT_NEED, cost: null });
  const result = calculateFinancing(house, configuredSettings());
  assert.equal(result.requiredWork.total, null);
  assert.equal(result.cashToAcquire, null);
  assert.equal(result.knownCashToAcquire, result.cashToClose);
  assert.deepEqual(result.cashToAcquireMissing, [MISSING_PROJECT_COST]);
});

test('moving a project between Want to fix and Need to fix moves it in and out of Cash to Acquire', () => {
  const settings = configuredSettings();
  const wanted = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 25000, excited: YES });
  const needed = withProject(wanted, 'kitchen', { state: PROJECT_NEED, cost: 25000 });
  const wantedAgain = withProject(needed, 'kitchen', { state: PROJECT_WANT, cost: 25000, excited: YES });
  const cashToClose = calculateFinancing(wanted, settings).cashToClose;
  assert.equal(calculateFinancing(wanted, settings).cashToAcquire, cashToClose);
  assertClose(calculateFinancing(needed, settings).cashToAcquire, cashToClose + 25000, 0.005, 'as Need to fix');
  assert.equal(calculateFinancing(wantedAgain, settings).cashToAcquire, cashToClose);
  // An uncosted project blocks Cash to Acquire only while it is Need to fix.
  const uncosted = withProject(knownHouse(), 'kitchen', { state: PROJECT_NEED, cost: null });
  assert.equal(calculateFinancing(uncosted, settings).cashToAcquire, null);
  const optional = withProject(uncosted, 'kitchen', { state: PROJECT_WANT, cost: null, excited: YES });
  assert.notEqual(calculateFinancing(optional, settings).cashToAcquire, null);
});

test('the required-work cushion is the room below the maximum purchase price, never negative', () => {
  const settings = configuredSettings({ maximumPurchasePrice: 500000 });
  const examples = [[400000, 100000], [420000, 80000], [475000, 25000], [500000, 0], [525000, 0]];
  for (const [price, cushion] of examples) {
    const house = knownHouse({ priceHistory: [{ id: 'p', price, date: '2026-10-01' }] });
    assert.equal(calculateFinancing(house, settings).requiredWorkCushion, cushion, `price ${price}`);
  }
});

test('the cushion follows the current listing price and is unknown without a maximum', () => {
  const house = knownHouse({
    priceHistory: [
      { id: 'a', price: 480000, date: '2026-09-01' },
      { id: 'b', price: 455000, date: '2026-10-01' },
    ],
  });
  assert.equal(calculateFinancing(house, configuredSettings({ maximumPurchasePrice: 500000 })).requiredWorkCushion, 45000);
  assert.equal(calculateFinancing(house, configuredSettings({ maximumPurchasePrice: null })).requiredWorkCushion, null);
});

test('optional projects never add to Cash to Acquire', () => {
  const settings = configuredSettings();
  const base = calculateFinancing(knownHouse(), settings);
  const house = withProject(knownHouse(), 'kitchen', { state: PROJECT_WANT, cost: 40000 });
  assert.equal(calculateFinancing(house, settings).cashToAcquire, base.cashToAcquire);
});

/* --------------------------------------------------------------------------
   Inherited defaults and overrides
   -------------------------------------------------------------------------- */

test('a Settings change moves inheriting houses and leaves overrides alone', () => {
  const inheriting = knownHouse();
  const overridden = knownHouse({ downPaymentPercent: 25, titleInsurance: 1500, prepaidInterestDays: 5 });

  const before = configuredSettings();
  const after = configuredSettings({ downPaymentPercent: 30, titleInsurance: 1400, prepaidInterestDays: 20 });

  assert.equal(calculateFinancing(inheriting, before).downPaymentAmount, 80000);
  assert.equal(calculateFinancing(inheriting, after).downPaymentAmount, 120000);
  assert.equal(calculateFinancing(inheriting, after).inputs.titleInsurance.value, 1400);
  assert.equal(calculateFinancing(inheriting, after).inputs.downPaymentPercent.provenance, DEFAULT_ESTIMATE);

  const overriddenBefore = calculateFinancing(overridden, before);
  const overriddenAfter = calculateFinancing(overridden, after);
  assert.equal(overriddenBefore.downPaymentAmount, 100000);
  assert.equal(overriddenAfter.downPaymentAmount, 100000);
  assert.equal(overriddenAfter.inputs.titleInsurance.value, 1500);
  assert.equal(overriddenAfter.inputs.prepaidInterestDays.value, 5);
  assert.equal(overriddenAfter.inputs.downPaymentPercent.provenance, ENTERED);
  assert.equal(overriddenAfter.fundsDueFromBorrower, overriddenBefore.fundsDueFromBorrower);
});

test('the interest rate applies to every house from Settings alone', () => {
  const low = calculateFinancing(knownHouse(), configuredSettings({ interestRate: 6 }));
  const high = calculateFinancing(knownHouse(), configuredSettings({ interestRate: 7 }));
  assert.ok(high.monthlyPI > low.monthlyPI);
});

/* --------------------------------------------------------------------------
   Price per square foot
   -------------------------------------------------------------------------- */

test('price per square foot uses the current listing price', () => {
  assert.equal(pricePerSquareFoot(knownHouse({ squareFeet: 1600 })), 250);
  const reduced = knownHouse({ squareFeet: 1600, priceHistory: [{ id: 'a', price: 400000, date: '2026-10-01' }, { id: 'b', price: 360000, date: '2026-10-08' }] });
  assert.equal(pricePerSquareFoot(reduced), 225);
});

test('price per square foot is unavailable without a usable square footage', () => {
  assert.equal(pricePerSquareFoot(knownHouse()), null);
  assert.equal(pricePerSquareFoot(knownHouse({ squareFeet: 0 })), null);
});

/* --------------------------------------------------------------------------
   Derived form facts
   -------------------------------------------------------------------------- */

test('optionState separates untouched, answered without, and selected', () => {
  assert.equal(optionState(null, 'garage'), null);
  assert.equal(optionState([], 'garage'), NO);
  assert.equal(optionState(['driveway'], 'garage'), NO);
  assert.equal(optionState(['garage', 'driveway'], 'garage'), YES);
});

test('entrySupportCount counts yes answers only when all three are known', () => {
  assert.equal(entrySupportCount(knownHouse({ entryShoes: YES, entryCoat: NO, entryPurse: YES })), 2);
  assert.equal(entrySupportCount(knownHouse({ entryShoes: NO, entryCoat: NO, entryPurse: NO })), 0);
  assert.equal(entrySupportCount(knownHouse({ entryShoes: YES, entryCoat: YES, entryPurse: null })), null);
  assert.equal(entrySupportCount(knownHouse()), null);
});

/* --------------------------------------------------------------------------
   Listing price
   -------------------------------------------------------------------------- */

test('the current listing price is the most recent history entry', () => {
  const house = knownHouse({
    priceHistory: [
      { id: 'a', price: 475000, date: '2026-09-01' },
      { id: 'b', price: 460000, date: '2026-09-20' },
      { id: 'c', price: 450000, date: '2026-10-05' },
    ],
  });
  assert.equal(currentListingPrice(house), 450000);
});

test('a backdated entry does not become the current listing price', () => {
  const house = knownHouse({
    priceHistory: [
      { id: 'b', price: 460000, date: '2026-09-20' },
      { id: 'a', price: 499000, date: '2026-08-15' },
    ],
  });
  assert.equal(currentListingPrice(house), 460000);
});

test('with one entry, it is the current listing price', () => {
  assert.equal(currentListingPrice(knownHouse()), 400000);
});

test('a price change dated after the others becomes the current listing price', () => {
  let house = knownHouse();
  house = addPriceEntry(house, { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  assert.equal(currentListingPrice(house), 389000);
  // Recorded later but dated earlier, so it does not replace the current price.
  house = addPriceEntry(house, { price: 395000, date: '2026-10-05' }, fixedId('late'));
  assert.equal(currentListingPrice(house), 389000);
});

test('price history lists newest first with the change from the entry before', () => {
  let house = knownHouse();
  house = addPriceEntry(house, { price: 389000, date: '2026-10-12' }, fixedId('cut'));
  house = addPriceEntry(house, { price: 395000, date: '2026-10-05' }, fixedId('late'));
  const rows = [];
  for (const entry of priceHistoryChanges(house)) rows.push([entry.date, entry.price, entry.change]);
  assert.deepEqual(
    rows,
    [
      ['2026-10-12', 389000, -6000],
      ['2026-10-05', 395000, -5000],
      ['2026-10-01', 400000, null],
    ],
  );
});

/* --------------------------------------------------------------------------
   Days on Market
   -------------------------------------------------------------------------- */

test('days between counts calendar days across months, years, and daylight saving', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 0);
  assert.equal(daysBetween('2026-10-01', '2026-11-15'), 45);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2027-03-13', '2027-03-15'), 2);
  assert.equal(daysBetween('2026-10-05', '2026-10-01'), -4);
});

test('an available house counts days on market from the listing date to today', () => {
  assert.equal(daysOnMarket(knownHouse({ status: STATUS_AVAILABLE }), '2026-10-15'), 14);
});

test('under contract and sold stop counting at the status date', () => {
  const pending = knownHouse({ status: STATUS_UNDER_CONTRACT, statusDate: '2026-10-09' });
  assert.equal(daysOnMarket(pending, '2026-12-01'), 8);
  const sold = knownHouse({ status: STATUS_SOLD, statusDate: '2026-11-20' });
  assert.equal(daysOnMarket(sold, '2027-02-01'), 50);
});

test('a house back to available counts from the listing date again', () => {
  const back = knownHouse({ status: STATUS_AVAILABLE, statusDate: null });
  assert.equal(daysOnMarket(back, '2026-12-01'), 61);
});

test('days on market is never negative and unknown without a status date', () => {
  assert.equal(daysOnMarket(knownHouse({ listingDate: '2026-10-20' }), '2026-10-15'), 0);
  assert.equal(daysOnMarket(knownHouse({ status: STATUS_SOLD, statusDate: null }), '2026-10-15'), null);
});

test('price per lot square foot converts acres to square feet', () => {
  // 0.25 acres is 10,890 square feet.
  assertClose(pricePerLotSquareFoot(knownHouse({ lotAcres: 0.25 })), 400000 / 10890, 1e-9, 'per lot square foot');
  assertClose(pricePerLotSquareFoot(knownHouse({ lotAcres: 1 })), 400000 / 43560, 1e-9, 'one acre');
});

test('price per lot square foot is unavailable without a usable lot size', () => {
  assert.equal(pricePerLotSquareFoot(knownHouse()), null);
  assert.equal(pricePerLotSquareFoot(knownHouse({ lotAcres: 0 })), null);
});

/* --------------------------------------------------------------------------
   Map position
   -------------------------------------------------------------------------- */

const [MAP_X, MAP_Y, MAP_WIDTH, MAP_HEIGHT] = MAP.viewBox;

test('mapPoint puts the corners of the map’s bounds at the corners of its view box', () => {
  const northWest = mapPoint(MAP.bounds.north, MAP.bounds.west, MAP);
  const southEast = mapPoint(MAP.bounds.south, MAP.bounds.east, MAP);
  assert.ok(Math.abs(northWest.x - MAP_X) < 0.01);
  assert.ok(Math.abs(northWest.y - MAP_Y) < 0.01);
  assert.ok(Math.abs(southEast.x - (MAP_X + MAP_WIDTH)) < 0.01);
  assert.ok(Math.abs(southEast.y - (MAP_Y + MAP_HEIGHT)) < 0.01);
});

test('mapPoint follows Web Mercator, not a straight line between the bounds', () => {
  const middle = mapPoint((MAP.bounds.north + MAP.bounds.south) / 2, MAP.bounds.west, MAP);
  // Mercator stretches toward the pole, so the middle latitude sits below the view box's middle.
  assert.ok(middle.y > MAP_Y + MAP_HEIGHT / 2);
});

test('mapPoint places nothing without both coordinates or outside the map', () => {
  assert.equal(mapPoint(null, -111.93, MAP), null);
  assert.equal(mapPoint(40.77, null, MAP), null);
  assert.equal(mapPoint(41.5, -111.93, MAP), null);
  assert.equal(mapPoint(40.77, -112.5, MAP), null);
  assert.equal(mapPoint(-40.77, 111.93, MAP), null);
});

test('fitMapView shows the whole map when there are no houses', () => {
  const [x, y, width, height] = fitMapView([], MAP_WIDTH / MAP_HEIGHT, MAP);
  assert.ok(Math.abs(x - MAP_X) < 1e-6 && Math.abs(y - MAP_Y) < 1e-6);
  assert.ok(Math.abs(width - MAP_WIDTH) < 1e-6 && Math.abs(height - MAP_HEIGHT) < 1e-6);
});

test('fitMapView crops the map to fill a frame of another shape when there are no houses', () => {
  const [x, y, width, height] = fitMapView([], 1, MAP);
  assert.ok(Math.abs(width - MAP_WIDTH) < 1e-6 && Math.abs(height - MAP_WIDTH) < 1e-6);
  assert.ok(Math.abs(x - MAP_X) < 1e-6);
  assert.ok(y > MAP_Y && y + height < MAP_Y + MAP_HEIGHT);
});

test('fitMapView frames houses at the frame’s shape, with every house inside', () => {
  const points = [mapPoint(40.79, -111.94, MAP), mapPoint(40.76, -111.89, MAP)];
  const [x, y, width, height] = fitMapView(points, 4 / 3, MAP);
  assert.ok(Math.abs(width / height - 4 / 3) < 1e-9);
  for (const point of points) {
    assert.ok(point.x > x && point.x < x + width);
    assert.ok(point.y > y && point.y < y + height);
  }
  assert.ok(width < MAP_WIDTH / 4);
});

test('fitMapView never zooms closer than about 3 km, even for one house', () => {
  const [, , width, height] = fitMapView([mapPoint(40.77, -111.93, MAP)], 1, MAP);
  // About 52 map units to the kilometre at Salt Lake City's latitude.
  assert.ok(width > 140 && width < 170);
  assert.equal(width, height);
});

test('fitMapView slides the frame back onto the map near an edge', () => {
  const [x, y] = fitMapView([mapPoint(MAP.bounds.north, MAP.bounds.west, MAP)], 4 / 5, MAP);
  assert.ok(Math.abs(x - MAP_X) < 1e-6);
  assert.ok(Math.abs(y - MAP_Y) < 1e-6);
});

/* --------------------------------------------------------------------------
   Map camera
   -------------------------------------------------------------------------- */

const PHONE_FRAME = { width: 390, height: 614 };
const WIDE_FRAME = { width: 1048, height: 577 };

/**
 * Checks two numbers are equal to within rounding.
 * @param {number} actual - Value computed.
 * @param {number} expected - Value wanted.
 * @param {string} [message] - What is being checked.
 */
function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message || ''} ${actual} ≠ ${expected}`);
}

test('mapZoomLimits stops zooming out where the frame would show past the map’s edges', () => {
  const tall = mapZoomLimits(0.5, MAP);
  near(tall.max, MAP_HEIGHT * 0.5);
  const wide = mapZoomLimits(WIDE_FRAME.width / WIDE_FRAME.height, MAP);
  near(wide.max, MAP_WIDTH);
  near(wide.min, MAP_WIDTH / MAP_MAX_ZOOM);
});

test('clampMapView keeps the view on the map at every edge', () => {
  const width = 200;
  const height = 300;
  for (const [x, y] of [[MAP_X - 500, MAP_Y - 500], [MAP_X + MAP_WIDTH, MAP_Y + MAP_HEIGHT]]) {
    const view = clampMapView([x, y, width, height], MAP);
    assert.ok(view[0] >= MAP_X - 1e-9 && view[0] + view[2] <= MAP_X + MAP_WIDTH + 1e-9);
    assert.ok(view[1] >= MAP_Y - 1e-9 && view[1] + view[3] <= MAP_Y + MAP_HEIGHT + 1e-9);
    near(view[2], width);
  }
});

test('clampMapView brings a view outside the zoom limits back within them, keeping its shape', () => {
  const tooWide = clampMapView([MAP_X, MAP_Y, MAP_WIDTH * 2, MAP_WIDTH * 2], MAP);
  near(tooWide[2], MAP_WIDTH);
  near(tooWide[3], MAP_WIDTH);
  const tooClose = clampMapView([MAP_X + 500, MAP_Y + 500, 1, 2], MAP);
  near(tooClose[2], MAP_WIDTH / MAP_MAX_ZOOM);
  near(tooClose[3], (MAP_WIDTH / MAP_MAX_ZOOM) * 2);
});

test('mapPointAt finds the map position under a point in the frame', () => {
  const view = [6700, 7700, 195, 307];
  const point = mapPointAt(view, { x: 195, y: 307 }, PHONE_FRAME);
  near(point.x, 6700 + 195 / 2);
  near(point.y, 7700 + 307 / 2);
});

test('gestureMapView pans so the dragged map position follows the finger', () => {
  const start = [6700, 7700, 195, 307];
  const anchor = mapPointAt(start, { x: 100, y: 100 }, PHONE_FRAME);
  const view = gestureMapView(start, anchor, { x: 160, y: 40 }, 1, PHONE_FRAME, MAP);
  near(view[2], start[2]);
  const under = mapPointAt(view, { x: 160, y: 40 }, PHONE_FRAME);
  near(under.x, anchor.x);
  near(under.y, anchor.y);
});

test('gestureMapView zooms about the pointer, keeping the map position under it fixed', () => {
  const start = [6700, 7700, 195, 307];
  const point = { x: 300, y: 80 };
  const anchor = mapPointAt(start, point, PHONE_FRAME);
  const view = gestureMapView(start, anchor, point, 2, PHONE_FRAME, MAP);
  near(view[2], start[2] / 2);
  const under = mapPointAt(view, point, PHONE_FRAME);
  near(under.x, anchor.x);
  near(under.y, anchor.y);
});

test('gestureMapView follows a pinch: zooming by the fingers’ spread while their midpoint moves', () => {
  const start = [6700, 7700, 195, 307];
  const anchor = mapPointAt(start, { x: 200, y: 300 }, PHONE_FRAME);
  const view = gestureMapView(start, anchor, { x: 150, y: 260 }, 1.5, PHONE_FRAME, MAP);
  near(view[2], start[2] / 1.5);
  const under = mapPointAt(view, { x: 150, y: 260 }, PHONE_FRAME);
  near(under.x, anchor.x);
  near(under.y, anchor.y);
});

test('gestureMapView stops at the zoom limits instead of passing them', () => {
  const start = [6700, 7700, 195, 307];
  const anchor = mapPointAt(start, { x: 195, y: 307 }, PHONE_FRAME);
  near(gestureMapView(start, anchor, { x: 195, y: 307 }, 1000, PHONE_FRAME, MAP)[2], MAP_WIDTH / MAP_MAX_ZOOM);
  const out = gestureMapView(start, anchor, { x: 195, y: 307 }, 0.001, PHONE_FRAME, MAP);
  near(out[2], mapZoomLimits(PHONE_FRAME.width / PHONE_FRAME.height, MAP).max);
});
