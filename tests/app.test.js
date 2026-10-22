import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import { VIEW_STYLESHEETS, matchRoute } from '../scripts/app.js';
import { MAP_STYLESHEET } from '../scripts/render.js';

test('the top-level views match their addresses and nav links', () => {
  assert.deepEqual(matchRoute('#/'), { name: 'houses', title: 'Houses', nav: '#/' });
  assert.deepEqual(matchRoute('#/ladder'), { name: 'ladder', title: 'Price Ladder', nav: '#/ladder' });
  assert.deepEqual(matchRoute('#/add'), { name: 'add', title: 'Add House', nav: '#/add' });
  assert.deepEqual(matchRoute('#/settings'), { name: 'settings', title: 'Settings', nav: '#/settings' });
});

test('an empty address is Houses, and a trailing slash is ignored', () => {
  assert.equal(matchRoute('').name, 'houses');
  assert.equal(matchRoute('#').name, 'houses');
  assert.equal(matchRoute(undefined).name, 'houses');
  assert.equal(matchRoute('#/settings/').name, 'settings');
  assert.equal(matchRoute('#/house/abc/').houseId, 'abc');
});

test('a house address gives its id, decoded, for House Detail and its editor', () => {
  assert.deepEqual(matchRoute('#/house/abc'), { name: 'house', title: 'House', nav: '#/', houseId: 'abc' });
  assert.deepEqual(matchRoute('#/house/abc/edit'), { name: 'houseEdit', title: 'Edit house', nav: '#/', houseId: 'abc' });
  assert.equal(matchRoute('#/house/a%20b').houseId, 'a b');
});

test('a house is addressed by its MLS number, and a comparison by both houses\' numbers', () => {
  assert.equal(matchRoute('#/house/1000001').houseId, '1000001');
  assert.equal(matchRoute('#/house/1000001/edit').name, 'houseEdit');
  assert.deepEqual(matchRoute('#/compare/1000001/1000002').houseIds, ['1000001', '1000002']);
});

test('a comparison needs exactly two different houses', () => {
  assert.deepEqual(matchRoute('#/compare/a/b'), { name: 'compare', title: 'Compare', nav: '#/', houseIds: ['a', 'b'] });
  assert.equal(matchRoute('#/compare/a/a').name, 'notFound');
  assert.equal(matchRoute('#/compare/a').name, 'notFound');
  assert.equal(matchRoute('#/compare/a/b/c').name, 'notFound');
});

test('anything else is not found and marks no nav link', () => {
  for (const hash of ['#/nope', '#/house', '#/house/abc/delete', '#settings']) {
    assert.deepEqual(matchRoute(hash), { name: 'notFound', title: 'Page not found', nav: null }, hash);
  }
});

// A stylesheet that fails to load is skipped so the view still appears, so a renamed file would go unnoticed.
test('every view stylesheet exists, and every feature stylesheet is loaded by some view', () => {
  const listed = new Set([...Object.values(VIEW_STYLESHEETS).flat(), MAP_STYLESHEET]);
  for (const href of listed) assert.ok(existsSync(new URL(`../${href}`, import.meta.url)), href);
  const features = readdirSync(new URL('../styles/', import.meta.url))
    .filter((name) => name.endsWith('.css') && name !== 'styles.css')
    .map((name) => `styles/${name}`);
  assert.deepEqual([...listed].sort(), features.sort());
});
