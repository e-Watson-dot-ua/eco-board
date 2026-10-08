import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAge, formatInterval } from '../public/js/format.js';

describe('formatAge', () => {
  it('says "just now" for the first few seconds', () => {
    assert.equal(formatAge(0), 'just now');
    assert.equal(formatAge(4), 'just now');
  });

  it('counts seconds up to one minute', () => {
    assert.equal(formatAge(5), '5 s ago');
    assert.equal(formatAge(59), '59 s ago');
  });

  it('rounds down to whole minutes, hours and days', () => {
    assert.equal(formatAge(60), '1 min ago');
    assert.equal(formatAge(119), '1 min ago');
    assert.equal(formatAge(3599), '59 min ago');
    assert.equal(formatAge(3600), '1 h ago');
    assert.equal(formatAge(86_399), '23 h ago');
    assert.equal(formatAge(86_400), '1 d ago');
  });
});

describe('formatInterval', () => {
  it('uses seconds, minutes or hours', () => {
    assert.equal(formatInterval(10_000), '10 s');
    assert.equal(formatInterval(300_000), '5 min');
    assert.equal(formatInterval(3_600_000), '1 h');
  });
});
