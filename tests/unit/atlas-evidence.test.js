'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'data/player-atlas.js'), 'utf8').trim();
const atlas = JSON.parse(source.slice('globalThis.PLAYER_ATLAS = '.length, -1));
const proof = require('../../scripts/atlas-verification.json');
const index = require('../../scripts/atlas-native-index.json');
const maps = new Map(atlas.maps.map(map => [map.id, map]));

test('every verified layout retains its native title identity, place and exact doorway targets', () => {
  assert.equal(maps.size, proof.maps);
  assert.equal(index.maps.length, maps.size);
  for (const [key, value] of Object.entries(atlas.verification)) assert.equal(proof[key], value, key);
  const places = new Set();
  let exits = 0;
  for (const [scene, area, , , , titleRow, placeId] of index.maps) {
    const map = maps.get(`map-${scene}-${area}`);
    assert.equal(map.titleRow, titleRow);
    assert.ok(map.nativeTitle);
    assert.equal(map.placeId, placeId);
    const place = maps.get(placeId);
    assert.equal(place.placeId, placeId);
    assert.equal(place.scene, scene);
    places.add(placeId);
    for (const exit of map.exits) {
      const destination = maps.get(exit.to);
      assert.ok(destination, exit.to);
      assert.ok(exit.x > 0 && exit.x < 1 && exit.y > 0 && exit.y < 1);
      if (exit.variant) {
        const variant = destination.arrivalVariants.find(v => v.id === exit.variant);
        assert.ok(variant?.from.includes(map.id), map.id);
      }
      exits++;
    }
  }
  assert.equal(places.size, proof.places);
  assert.equal(exits, proof.exitPins);
});

test('the verified default and entrance-specific background images are present and content addressed', () => {
  const images = new Set();
  let variants = 0;
  for (const map of maps.values()) {
    images.add(map.image);
    for (const variant of map.arrivalVariants || []) {
      assert.ok(variant.from.length);
      for (const id of variant.from) {
        assert.ok(maps.get(id).exits.some(exit => exit.to === map.id && exit.variant === variant.id), id);
      }
      images.add(variant.image);
      variants++;
    }
  }
  assert.equal(variants, proof.arrivalVariants);
  assert.equal(images.size, proof.images);
  for (const file of images) {
    assert.match(file, /^[0-9a-f]{20}\.webp$/);
    const bytes = fs.readFileSync(path.join(root, 'maps', file));
    assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 20) + '.webp', file);
  }
});
