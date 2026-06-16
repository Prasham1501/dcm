'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

function makePrintWorker(configStore = null, printResult = { pages: 1, layoutId: '1x1' }) {
  return { configStore, print: async () => printResult, printDirect: async () => printResult };
}
function makeLogger() { return { info: () => {}, warn: () => {}, error: () => {} }; }

function makeQueue(overrides = {}) {
  const { JobQueue } = require('./jobQueue');
  const q = new JobQueue({
    logger: makeLogger(),
    parseStudyUid: () => 'study-1',
    printWorker: overrides.printWorker ?? makePrintWorker(),
    printedRoot: '/tmp/printed',
    failedRoot: '/tmp/failed',
  });
  q._move = () => {};
  return q;
}

function makeSlot(extra = {}) {
  return { id: 's1', name: 'S1', studyDebounceSeconds: 0, ...extra };
}

// ── Central preflight gate (the only quota enforcement) ───────────────────────

test('preflight block=true prevents print and emits failed', async () => {
  const q = makeQueue();
  q.setPreflightCheck(async () => ({ block: true, reason: 'Central quota exhausted' }));

  const results = { printed: [], failed: [] };
  q.on('printed', (j) => results.printed.push(j));
  q.on('failed',  (j) => results.failed.push(j));

  q.queue.push({ slot: makeSlot(), studyUid: 'study-1', files: [{ filepath: '/a.dcm' }] });
  await q._tick();

  assert.equal(results.printed.length, 0, 'must NOT print');
  assert.equal(results.failed.length, 1);
  assert.match(results.failed[0].error, /Central quota exhausted/);
});

test('preflight block=false allows print', async () => {
  const configStore = { get: () => ({ slots: [makeSlot()] }) };
  const q = makeQueue({ printWorker: makePrintWorker(configStore) });
  q.setPreflightCheck(async () => ({ block: false }));

  const results = { printed: [], failed: [] };
  q.on('printed', (j) => results.printed.push(j));
  q.on('failed',  (j) => results.failed.push(j));

  q.queue.push({ slot: makeSlot(), studyUid: 'study-1', files: [{ filepath: '/a.dcm' }] });
  await q._tick();

  assert.equal(results.printed.length, 1, 'must print when preflight passes');
  assert.equal(results.failed.length, 0);
});

test('preflight error is non-fatal — print continues', async () => {
  const configStore = { get: () => ({ slots: [makeSlot()] }) };
  const q = makeQueue({ printWorker: makePrintWorker(configStore) });
  q.setPreflightCheck(async () => { throw new Error('network timeout'); });

  const results = { printed: [], failed: [] };
  q.on('printed', (j) => results.printed.push(j));
  q.on('failed',  (j) => results.failed.push(j));

  q.queue.push({ slot: makeSlot(), studyUid: 'study-1', files: [{ filepath: '/a.dcm' }] });
  await q._tick();

  assert.equal(results.printed.length, 1, 'preflight error must not block print');
  assert.equal(results.failed.length, 0);
});

test('no preflight wired → prints freely', async () => {
  const configStore = { get: () => ({ slots: [makeSlot()] }) };
  const q = makeQueue({ printWorker: makePrintWorker(configStore) });

  const results = { printed: [], failed: [] };
  q.on('printed', (j) => results.printed.push(j));
  q.on('failed',  (j) => results.failed.push(j));

  q.queue.push({ slot: makeSlot(), studyUid: 'study-1', files: [{ filepath: '/a.dcm' }] });
  await q._tick();

  assert.equal(results.printed.length, 1);
  assert.equal(results.failed.length, 0);
});
