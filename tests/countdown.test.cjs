const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const deadline = new Date('2022-01-01T00:00:00').getTime();

function loadCountdown(now) {
  const elements = Object.fromEntries(
    ['days', 'hours', 'minutes', 'seconds', 'countdown-status'].map(id => [id, { hidden: true }])
  );
  let tick;
  let cleared = false;
  class Clock extends Date {
    static now() { return now; }
  }
  runInNewContext(script, {
    Date: Clock,
    document: { getElementById: id => elements[id] },
    setInterval: (callback, delay) => {
      assert.equal(delay, 1000);
      tick = callback;
      return 1;
    },
    clearInterval: id => {
      assert.equal(id, 1);
      cleared = true;
    }
  });
  return {
    elements,
    get scheduled() { return Boolean(tick); },
    get cleared() { return cleared; },
    advanceTo(time) { now = time; tick(); },
    values() { return ['days', 'hours', 'minutes', 'seconds'].map(id => elements[id].textContent); }
  };
}

test('renders the remaining time immediately, with padded units', () => {
  const countdown = loadCountdown(deadline - ((86400 + 7200 + 180 + 4) * 1000));
  assert.deepEqual(countdown.values(), ['01', '02', '03', '04']);
  assert.equal(countdown.elements['countdown-status'].hidden, true);
  assert.equal(countdown.scheduled, true);
});

test('an expired countdown stays at zero and does not start an interval', () => {
  for (const now of [deadline, deadline + 365 * 86400000]) {
    const countdown = loadCountdown(now);
    assert.deepEqual(countdown.values(), ['00', '00', '00', '00']);
    assert.equal(countdown.elements['countdown-status'].hidden, false);
    assert.equal(countdown.scheduled, false);
  }
});

test('stops ticking and shows the ended state when the deadline passes', () => {
  const countdown = loadCountdown(deadline - 1000);
  assert.deepEqual(countdown.values(), ['00', '00', '00', '01']);
  countdown.advanceTo(deadline + 500);
  assert.deepEqual(countdown.values(), ['00', '00', '00', '00']);
  assert.equal(countdown.elements['countdown-status'].hidden, false);
  assert.equal(countdown.cleared, true);
});
