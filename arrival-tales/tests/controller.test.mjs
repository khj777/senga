import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { STORY, planStory } from '../dist/engine.mjs';

// Execute the actual controller with fake DOM, speech and timers. Import wiring
// is replaced only to inject the real engine into the isolated VM. Browser
// callbacks are manually delivered so late/cancelled speech events are tested
// deterministically rather than relying on a particular installed voice.
const controller = fs.readFileSync(new URL('../dist/app.mjs', import.meta.url), 'utf8')
  .replace(/^import\s+\{\s*STORY,\s*planStory\s*\}\s+from\s+['"]\.\/engine\.mjs['"];?\s*\n/, '');

function createElement() {
  const listeners = new Map();
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', style: {}, dataset: {}, children: [],
    hidden: false, disabled: false, value: '', attributes: {},
    classList: {
      toggle(name, value) {
        const enabled = value === undefined ? !classes.has(name) : value;
        if (enabled) classes.add(name); else classes.delete(name);
      },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, extra = {}) {
      for (const callback of listeners.get(type) || []) callback({ target: this, ...extra });
    },
    click() { if (!this.disabled) this.dispatch('click'); },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    scrollIntoView() {},
    showModal() { this.open = true; },
    close() { this.open = false; }
  };
}

function fixture() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const scenarios = ['shorter', 'longer', 'guidance', 'arrive'].map(name => {
    const button = createElement(); button.dataset.scenario = name; return button;
  });
  const timers = new Map();
  const windowListeners = new Map();
  let timerId = 0;
  const speech = {
    calls: [], cancellations: [], active: null,
    cancel() { this.cancellations.push(this.active); this.active = null; },
    getVoices() { return [{ lang: 'ko-KR', name: 'Test Korean voice' }]; },
    speak(utterance) { this.calls.push(utterance); this.active = utterance; },
    end(utterance = this.active) {
      if (this.active === utterance) this.active = null;
      utterance?.onend?.();
    }
  };
  class Utterance { constructor(text) { this.text = text; } }
  const context = {
    STORY, planStory,
    document: {
      getElementById: get,
      querySelector: selector => get(selector),
      querySelectorAll: selector => selector === '[data-scenario]' ? scenarios : [],
      createElement
    },
    window: {
      speechSynthesis: speech,
      SpeechSynthesisUtterance: Utterance,
      addEventListener(name, callback) { windowListeners.set(name, callback); }
    },
    SpeechSynthesisUtterance: Utterance,
    performance: { now: () => 0 },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() {}
  };
  vm.runInNewContext(`${controller}\nglobalThis.testState = state;`, context, { filename: 'app.mjs' });
  return {
    state: context.testState, get, speech, timers,
    click: id => get(id).click(),
    scenario: name => scenarios.find(button => button.dataset.scenario === name).click(),
    eta(value) { get('eta-slider').value = String(value); get('eta-slider').dispatch('input'); },
    runTimer(id) {
      const timer = timers.get(id);
      assert.ok(timer, `timer ${id} must exist`);
      timers.delete(id); timer.callback();
    },
    emitWindow: name => windowListeners.get(name)?.(),
    startAudio() { get('sound-button').click(); get('play-button').click(); }
  };
}

test('ETA replanning preserves active navigation audio and resumes the revised scene afterwards', () => {
  const f = fixture();
  f.startAudio();
  f.scenario('guidance');
  const guidance = f.speech.active;
  assert.equal(guidance.text, '잠시 후 우회전입니다.');
  const cancellations = f.speech.cancellations.length;
  const spoken = f.speech.calls.length;

  f.scenario('arrive');
  assert.equal(f.state.current.id, 'brief-ending');
  assert.equal(f.state.guidance, true);
  assert.equal(f.speech.active, guidance);
  assert.equal(f.speech.cancellations.length, cancellations);
  assert.equal(f.speech.calls.length, spoken, 'story cannot start over guidance');

  f.speech.end(guidance);
  f.runTimer(f.state.guidanceTimer);
  assert.equal(f.state.guidance, false);
  assert.equal(f.state.playing, true);
  assert.equal(f.speech.calls.length, spoken + 1);
  assert.ok(f.state.current.text.startsWith(f.speech.active.text));
});

test('pausing during guidance preserves navigation audio and does not auto-resume the story', () => {
  const f = fixture();
  f.startAudio();
  const interruptedStory = f.speech.active;
  f.scenario('guidance');
  const guidance = f.speech.active;
  const cancellations = f.speech.cancellations.length;
  const spoken = f.speech.calls.length;
  f.click('play-button');
  assert.equal(f.state.playing, false);
  assert.equal(f.speech.active, guidance);
  assert.equal(f.speech.cancellations.length, cancellations);

  // A cancelled narration's late completion must not advance a sentence.
  f.speech.end(interruptedStory);
  assert.equal(f.state.sentence, 0);
  f.speech.end(guidance);
  f.runTimer(f.state.guidanceTimer);
  assert.equal(f.state.guidance, false);
  assert.equal(f.state.playing, false);
  assert.equal(f.speech.calls.length, spoken);

  f.click('play-button');
  assert.equal(f.speech.active.text, interruptedStory.text, 'manual resume starts at the interrupted sentence');
});

test('reset invalidates both old guidance completion and fallback callbacks', () => {
  const f = fixture();
  f.startAudio();
  f.scenario('guidance');
  const oldGuidance = f.speech.active;
  const oldFallback = f.timers.get(f.state.guidanceTimer).callback;
  f.click('restart-button');
  f.click('play-button');
  f.scenario('guidance');
  const newGuidance = f.speech.active;
  const newTimer = f.state.guidanceTimer;
  const spoken = f.speech.calls.length;

  f.speech.end(oldGuidance);
  oldFallback();
  assert.equal(f.state.guidanceTimer, newTimer);
  assert.equal(f.timers.get(newTimer).delay, 5000);
  assert.equal(f.state.guidance, true);
  assert.equal(f.speech.active, newGuidance);
  assert.equal(f.speech.calls.length, spoken);

  f.speech.end(newGuidance);
  f.runTimer(f.state.guidanceTimer);
  assert.equal(f.state.guidance, false);
  assert.equal(f.speech.calls.length, spoken + 1);
});

test('arrival invalidates guidance callbacks and retains the terminal message without extra speech', () => {
  const f = fixture();
  f.startAudio();
  f.scenario('guidance');
  const guidance = f.speech.active;
  const fallback = f.timers.get(f.state.guidanceTimer).callback;
  f.eta(0);
  const arrivalNote = f.get('event-note').textContent;
  const spoken = f.speech.calls.length;
  assert.equal(f.state.finished, true);
  assert.equal(f.state.playing, false);
  assert.equal(f.state.guidance, false);
  assert.equal(f.state.current.displayOnly, true);

  f.speech.end(guidance);
  fallback();
  assert.equal(f.get('event-note').textContent, arrivalNote);
  assert.equal(f.speech.calls.length, spoken);
  assert.equal(f.state.finished, true);
  assert.equal(f.speech.active, null);
});

test('the transcript preserves the exact brief ending that was completed', () => {
  const f = fixture();
  f.click('play-button');
  f.click('next-button');
  assert.equal(f.state.completed[0], 'promise');
  f.scenario('arrive');
  const ending = f.state.current;
  assert.equal(ending.id, 'brief-ending');
  f.click('next-button');
  assert.equal(f.state.finished, true);
  f.click('transcript-button');
  const articles = f.get('transcript-content').children;
  assert.equal(articles.length, 2);
  assert.equal(articles[0].children[0].textContent, STORY.scenes[0].title);
  assert.equal(articles[1].children[0].textContent, ending.title);
  assert.equal(articles[1].children[1].textContent, ending.text);
});

test('reset clears transcript history so a new journey cannot inherit a completed ending', () => {
  const f = fixture();
  f.click('play-button');
  f.scenario('arrive');
  f.click('next-button');
  assert.equal(f.state.history.length, 1);
  f.click('restart-button');
  assert.equal(f.state.history.length, 0);
  f.click('transcript-button');
  const titles = f.get('transcript-content').children.map(article => article.children[0].textContent);
  assert.ok(!titles.includes('달빛을 따라, 집으로'));
});

test('sound-off during guidance prevents story resumption while allowing the navigation cue to finish', () => {
  const f = fixture();
  f.startAudio();
  f.scenario('guidance');
  const guidance = f.speech.active;
  const spoken = f.speech.calls.length;
  f.click('sound-button');
  assert.equal(f.state.sound, false);
  assert.equal(f.speech.active, guidance);
  f.speech.end(guidance);
  f.runTimer(f.state.guidanceTimer);
  assert.equal(f.state.playing, true, 'visual scenario may continue');
  assert.equal(f.speech.calls.length, spoken, 'narration stays muted');
});

test('page exit invalidates pending guidance callbacks and cancels its audio', () => {
  const f = fixture();
  f.startAudio();
  f.scenario('guidance');
  const guidance = f.speech.active;
  const fallback = f.timers.get(f.state.guidanceTimer).callback;
  const spoken = f.speech.calls.length;
  f.emitWindow('pagehide');
  f.speech.end(guidance);
  fallback();
  assert.equal(f.speech.active, null);
  assert.equal(f.speech.calls.length, spoken);
});
