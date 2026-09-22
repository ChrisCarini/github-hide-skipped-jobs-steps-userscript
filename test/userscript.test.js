const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

const script = readFileSync(join(__dirname, '..', 'GitHub-Hide-Skipped-Jobs-Steps.user.js'), 'utf8');
const storageKey = 'github-hide-skipped-jobs-steps-should-show-skipped-jobs';
const controlId = (action) => `github-hide-skipped-jobs-steps-cog-setting-${action}`;

function createPage({ conclusions = [], setting = null, menuAvailable = true } = {}) {
  const hiddenWrites = [];
  const observers = [];
  const storage = new Map(setting === null ? [] : [[storageKey, setting]]);

  function createElement(conclusion) {
    let hidden = false;
    return {
      conclusion,
      style: '',
      classList: '',
      listeners: {},
      get hidden() {
        return hidden;
      },
      set hidden(value) {
        hiddenWrites.push(this);
        hidden = value;
      },
      addEventListener(type, listener) {
        this.listeners[type] = listener;
      }
    };
  }

  const page = {
    steps: conclusions.map(createElement),
    menuAvailable,
    hiddenWrites,
    observers,
    storage,
    menu: {
      children: [],
      append(element) {
        element.parentElement = this;
        this.children.push(element);
      }
    },
    addStep(conclusion) {
      const step = createElement(conclusion);
      this.steps.push(step);
      return step;
    },
    control(action) {
      return document.getElementById(controlId(action));
    },
    click(action) {
      let prevented = false;
      this.control(action).listeners.click({
        preventDefault() {
          prevented = true;
        }
      });
      assert.equal(prevented, true, 'The toggle should not navigate away from the live job');
    },
    mutate(record = { type: 'childList' }) {
      for (const observer of observers) {
        const options = observer.options;
        if (options[record.type] && (record.type !== 'attributes' ||
            !options.attributeFilter || options.attributeFilter.includes(record.attributeName))) {
          observer.callback([record], observer);
        }
      }
    }
  };
  page.menu.append(createElement());

  // Model only the DOM APIs used by the userscript; mutations are delivered explicitly.
  const document = {
    documentElement: {},
    createElement: () => createElement(),
    getElementById: (id) => page.menuAvailable
      ? page.menu.children.find((element) => element.id === id) || null
      : null,
    querySelectorAll(selector) {
      if (selector === '.WorkflowRunLogsScroll > .js-socket-channel > check-step[data-conclusion="skipped"]') {
        return page.steps.filter((step) => step.conclusion === 'skipped');
      }
      assert.equal(selector, 'div.CheckRun-search > details > details-menu > a');
      return page.menuAvailable ? page.menu.children : [];
    }
  };

  runInNewContext(script, {
    document,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
      }
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target, options) {
        assert.equal(target, document.documentElement);
        assert.equal(options.subtree, true);
        this.options = options;
      }
    }
  });
  return page;
}

test('hides skipped steps initially without hiding other step states', () => {
  const page = createPage({ conclusions: ['skipped', 'success', 'failure', null] });
  assert.deepEqual(page.steps.map((step) => step.hidden), [true, false, false, false]);
  assert.equal(page.control('show').hidden, false);
  assert.equal(page.control('hide').hidden, true);
});

test('hides newly added skipped steps even when the first skipped step is already hidden', () => {
  const page = createPage({ conclusions: ['skipped'] });
  for (let index = 0; index < 3; index++) {
    const addedStep = page.addStep('skipped');
    page.mutate();
    assert.equal(addedStep.hidden, true);
  }
  assert.ok(page.steps.every((step) => step.hidden));
});

test('hides existing pending steps as their conclusions change to skipped', () => {
  const page = createPage({ conclusions: ['skipped', null, null] });
  for (const step of page.steps.slice(1)) {
    step.conclusion = 'skipped';
    page.mutate({ type: 'attributes', attributeName: 'data-conclusion' });
    assert.equal(step.hidden, true);
  }
});

test('reapplies hiding when GitHub unhides a step or replaces the step list', () => {
  const page = createPage({ conclusions: ['skipped'] });
  page.steps[0].hidden = false;
  page.mutate({ type: 'attributes', attributeName: 'hidden' });
  assert.equal(page.steps[0].hidden, true);

  page.steps = [];
  const replacement = page.addStep('skipped');
  page.mutate();
  assert.equal(replacement.hidden, true);
});

test('honors a saved Show setting initially and for newly updated steps', () => {
  const page = createPage({ conclusions: ['skipped'], setting: 'true' });
  assert.equal(page.steps[0].hidden, false);
  assert.equal(page.hiddenWrites.includes(page.steps[0]), false);
  const newStep = page.addStep('skipped');
  newStep.hidden = true;
  page.mutate();
  assert.equal(newStep.hidden, false);
  assert.equal(page.control('show').hidden, true);
  assert.equal(page.control('hide').hidden, false);
});

test('toggles apply to current and future steps without creating more observers', () => {
  const page = createPage({ conclusions: ['skipped'] });
  page.click('show');
  assert.equal(page.storage.get(storageKey), 'true');
  const shownStep = page.addStep('skipped');
  page.mutate();
  assert.equal(shownStep.hidden, false);
  assert.ok(page.steps.every((step) => !step.hidden));

  page.click('hide');
  assert.equal(page.storage.get(storageKey), 'false');
  const hiddenStep = page.addStep('skipped');
  page.mutate();
  assert.equal(hiddenStep.hidden, true);
  assert.ok(page.steps.every((step) => step.hidden));
  assert.equal(page.observers.length, 1);
});

test('does not rewrite hidden attributes once steps and controls are synchronized', () => {
  const page = createPage({ conclusions: ['skipped', 'skipped'] });
  for (const action of ['show', 'hide']) {
    page.click(action);
    page.hiddenWrites.length = 0;
    page.mutate({ type: 'attributes', attributeName: 'hidden' });
    page.mutate();
    assert.equal(page.hiddenWrites.length, 0);
  }
});

test('keeps hiding steps while the cog menu is absent and adds controls when it arrives', () => {
  const page = createPage({ menuAvailable: false });
  const step = page.addStep('skipped');
  page.mutate();
  assert.equal(step.hidden, true);
  page.menuAvailable = true;
  page.mutate();
  assert.equal(page.control('show').hidden, false);
  assert.equal(page.control('hide').hidden, true);
});

test('uses the saved preference for controls before any steps are skipped', () => {
  const page = createPage({ setting: 'true' });
  assert.equal(page.control('hide').hidden, false);
  page.click('hide');
  const step = page.addStep('skipped');
  page.mutate();
  assert.equal(step.hidden, true);
});

test('recreates missing controls after partial or complete menu replacements', () => {
  const page = createPage({ setting: 'true' });
  for (const action of ['show', 'hide']) {
    page.menu.children = page.menu.children.filter((element) => element.id !== controlId(action));
    page.mutate();
    assert.equal(page.menu.children.length, 3);
    assert.equal(page.control('show').hidden, true);
    assert.equal(page.control('hide').hidden, false);
  }
  page.menu.children = page.menu.children.filter((element) => !element.id);
  page.mutate();
  assert.equal(page.menu.children.length, 3);
  assert.equal(page.control('show').hidden, true);
  assert.equal(page.control('hide').hidden, false);
});
