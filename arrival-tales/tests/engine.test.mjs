import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY, planStory } from '../dist/engine.mjs';

const ids = plan => plan.scenes.map(scene => scene.id);
const requiredIds = STORY.scenes.filter(scene => scene.kind === 'required').map(scene => scene.id);
const canonicalIndices = new Map(STORY.scenes.map((scene, index) => [scene.id, index]));

test('the six demo ETA scenarios are deterministic, bounded and retain an ending', () => {
  const expected = new Map([[0, 'arrived'], [2, 'closing'], [5, 'focused'], [9, 'focused'], [14, 'focused'], [20, 'full']]);
  for (const [remainingMinutes, mode] of expected) {
    const plan = planStory({ remainingMinutes });
    assert.deepEqual(plan, planStory({ remainingMinutes }));
    assert.equal(plan.mode, mode, `${remainingMinutes} minutes`);
    assert.ok(plan.scenes.at(-1).ending);
    assert.ok(Number.isFinite(plan.totalMinutes));
    assert.ok(Number.isFinite(plan.reserveMinutes));
    assert.ok(plan.totalMinutes + plan.reserveMinutes <= remainingMinutes + 0.011);
    assert.equal(new Set(ids(plan)).size, plan.scenes.length);
    for (const scene of plan.scenes) {
      assert.ok(scene.title && scene.text && scene.id);
      assert.ok(Number.isFinite(scene.minutes) && scene.minutes >= 0);
    }
  }
});

test('normal plans retain every causal beat in canonical order', () => {
  for (const remainingMinutes of [5, 9, 14, 20, 100]) {
    const plan = planStory({ remainingMinutes });
    assert.deepEqual(plan.scenes.filter(scene => scene.kind === 'required').map(scene => scene.id), requiredIds);
    assert.deepEqual(ids(plan).map(id => canonicalIndices.get(id)), ids(plan).map(id => canonicalIndices.get(id)).toSorted((a, b) => a - b));
  }
  assert.equal(planStory({ remainingMinutes: 5 }).totalMinutes, 4);
  assert.equal(planStory({ remainingMinutes: 9 }).totalMinutes, 8);
  assert.equal(planStory({ remainingMinutes: 20 }).totalMinutes, 14);
});

test('a sharp ETA drop bridges the current scene and preserves every remaining required beat', () => {
  const state = { completedIds: ['promise'], currentId: 'cloud-post' };
  const before = planStory({ ...state, remainingMinutes: 14 });
  const after = planStory({ ...state, remainingMinutes: 2 });
  assert.equal(before.scenes[0].id, 'cloud-post');
  assert.equal(after.mode, 'closing');
  assert.equal(after.scenes[0].continuationOf, 'cloud-post');
  assert.deepEqual(after.scenes[0].beats, ['dim-seed', 'shared-light', 'home']);
  assert.ok(after.scenes[0].text.includes('등대'));
  assert.ok(after.scenes[0].text.includes('집으로'));
});

test('ETA growth can restore only future optional scenes and never rewind the story', () => {
  const state = { completedIds: ['promise', 'dim-seed'], currentId: 'shared-light' };
  const short = planStory({ ...state, remainingMinutes: 5 });
  const long = planStory({ ...state, remainingMinutes: 20 });
  assert.equal(long.scenes[0].id, 'shared-light');
  assert.ok(long.scenes.length > short.scenes.length);
  assert.ok(ids(long).includes('star-bridge'));
  for (const past of ['promise', 'cloud-post', 'dim-seed', 'forest-song']) {
    assert.ok(!ids(long).includes(past), `must not reopen ${past}`);
  }
});

test('a currently playing optional scene is preserved when the budget allows it', () => {
  const plan = planStory({ remainingMinutes: 7, completedIds: ['promise'], currentId: 'cloud-post' });
  assert.equal(plan.scenes[0].id, 'cloud-post');
  assert.equal(plan.scenes[0].text, STORY.scenes.find(scene => scene.id === 'cloud-post').text);
  assert.deepEqual(plan.scenes.filter(scene => scene.kind === 'required').map(scene => scene.id), ['dim-seed', 'shared-light', 'home']);
});

test('an oversized current scene switches to a coherent closing instead of exceeding its budget', () => {
  const plan = planStory({ remainingMinutes: 3, completedIds: ['promise'], currentId: 'cloud-post' });
  assert.equal(plan.mode, 'closing');
  assert.equal(plan.scenes[0].continuationOf, 'cloud-post');
  assert.ok(plan.totalMinutes + plan.reserveMinutes <= 3);
});

test('completed endings never replay, including after a later increase in ETA', () => {
  for (const ending of ['home', 'brief-ending', 'arrival']) {
    for (const remainingMinutes of [0, 2, 20]) {
      const plan = planStory({ remainingMinutes, completedIds: [ending] });
      assert.deepEqual(plan.scenes, []);
      assert.equal(plan.mode, 'complete');
      assert.equal(plan.totalMinutes, 0);
    }
  }
});

test('invalid and unusual input cannot produce NaN or an exception', () => {
  assert.equal(planStory().mode, 'arrived');
  for (const remainingMinutes of [NaN, Infinity, -Infinity, -9, undefined, null, '9', {}, 0.01, 1e308]) {
    const plan = planStory({ remainingMinutes, completedIds: null, currentId: 'unknown' });
    assert.ok(Number.isFinite(plan.totalMinutes));
    assert.ok(Number.isFinite(plan.reserveMinutes));
    assert.ok(plan.totalMinutes >= 0 && plan.reserveMinutes >= 0);
  }
});

test('fractional and tiny ETA values stay within budget after display rounding', () => {
  for (const remainingMinutes of [0.001, 0.019, 0.046, 0.054, 1.879, 2.999, 4.999, 6.249, 9.999]) {
    const plan = planStory({ remainingMinutes });
    assert.ok(plan.totalMinutes + plan.reserveMinutes <= remainingMinutes + 1e-9, `${remainingMinutes} minutes`);
  }
});

test('a stale current ID cannot replay completed content or corrupt a newer frontier', () => {
  const plan = planStory({ remainingMinutes: 20, completedIds: ['promise', 'dim-seed'], currentId: 'promise' });
  assert.ok(!ids(plan).includes('promise'));
  assert.ok(!ids(plan).includes('dim-seed'));
  assert.equal(plan.scenes[0].id, 'forest-song');
});

test('arrival is a display-only conclusion, not an impossible zero-duration audio claim', () => {
  const plan = planStory({ remainingMinutes: 0, completedIds: ['promise', 'dim-seed', 'shared-light'] });
  assert.equal(plan.scenes[0].displayOnly, true);
  assert.equal(plan.scenes[0].minutes, 0);
  assert.deepEqual(plan.scenes[0].beats, ['home']);
});

test('replanning never mutates the library or previous results', () => {
  const original = JSON.stringify(STORY);
  const first = planStory({ remainingMinutes: 9 });
  const snapshot = JSON.stringify(first);
  planStory({ remainingMinutes: 2, currentId: 'cloud-post' });
  assert.equal(JSON.stringify(STORY), original);
  assert.equal(JSON.stringify(first), snapshot);
});
