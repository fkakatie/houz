import test from 'node:test';
import assert from 'node:assert/strict';

import { HOUSE_FIELDS, PROJECT_AREAS, STATUSES } from '../scripts/data.js';
import { CATEGORIES } from '../scripts/scoring.js';
import {
  HOUSE_SECTIONS,
  LADDER_POSITIVE_LABELS,
  OPTION_LABELS,
  PROJECT_LABELS,
  SECTION_ORDERS,
  STATUS_LABELS,
} from '../scripts/render.js';

// The view's label tables and section layout must cover the data model exactly, or a value renders blank.

test('every select and multi-select option has a label, in the field’s own order', () => {
  for (const [name, field] of Object.entries(HOUSE_FIELDS)) {
    if (field.options === undefined) continue;
    assert.ok(OPTION_LABELS[name], `${name} has labels`);
    assert.deepEqual(Object.keys(OPTION_LABELS[name]), field.options, name);
  }
  for (const name of Object.keys(OPTION_LABELS)) {
    assert.ok(HOUSE_FIELDS[name] && HOUSE_FIELDS[name].options, `${name} labels a field with options`);
  }
});

test('every property field appears in exactly one form section', () => {
  const counts = {};
  for (const section of HOUSE_SECTIONS) {
    for (const field of section.fields) counts[field.name] = (counts[field.name] || 0) + 1;
  }
  assert.deepEqual(Object.keys(counts).sort(), Object.keys(HOUSE_FIELDS).sort());
  for (const [name, count] of Object.entries(counts)) assert.equal(count, 1, name);
});

test('both section orders list every form section once', () => {
  const ids = HOUSE_SECTIONS.map((section) => section.id).sort();
  for (const [name, order] of Object.entries(SECTION_ORDERS)) {
    assert.deepEqual([...order].sort(), ids, name);
  }
});

test('every criterion phrased as a drawback has a positive name for the Price Ladder', () => {
  const drawbacks = [];
  for (const category of CATEGORIES) {
    for (const subcategory of category.subcategories) {
      for (const criterion of subcategory.criteria) {
        if (criterion.type === 'no') drawbacks.push(criterion.id);
      }
    }
  }
  assert.deepEqual(Object.keys(LADDER_POSITIVE_LABELS).sort(), drawbacks.sort());
});

test('every project area and status has a label', () => {
  assert.deepEqual(Object.keys(PROJECT_LABELS), PROJECT_AREAS);
  assert.deepEqual(Object.keys(STATUS_LABELS), STATUSES);
});
