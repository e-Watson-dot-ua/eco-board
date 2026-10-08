import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { positiveIntFromEnv } from '../src/env.js';

const NAME = 'ECO_BOARD_TEST_VALUE';

describe('positiveIntFromEnv', () => {
  afterEach(() => {
    delete process.env[NAME];
  });

  it('returns the fallback when the variable is missing or empty', () => {
    assert.equal(positiveIntFromEnv(NAME, 42), 42);
    process.env[NAME] = '';
    assert.equal(positiveIntFromEnv(NAME, 42), 42);
  });

  it('returns the value when it is a positive whole number', () => {
    process.env[NAME] = '3000';
    assert.equal(positiveIntFromEnv(NAME, 42), 3000);
  });

  it('stops with a clear error for anything else', () => {
    for (const bad of ['abc', '0', '-5', '2.5']) {
      process.env[NAME] = bad;
      assert.throws(() => positiveIntFromEnv(NAME, 42), {
        message: `${NAME} must be a positive integer, got "${bad}".`,
      });
    }
  });
});
