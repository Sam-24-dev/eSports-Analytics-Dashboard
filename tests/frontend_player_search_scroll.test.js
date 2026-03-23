const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMainExports(overrides = {}) {
  const sourcePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'js', 'main.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const wrapped = `${source}

module.exports = {
  shouldAutoScrollToPlayerModule,
  scrollToPlayerModule
};
`;

  const elements = overrides.elements || {};
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    window: Object.assign({
      Filtering: {
        getEmptyData: () => ({}),
        normalizeText: (value) => value,
        buildFilteredData: () => ({})
      },
      addEventListener: () => {},
      history: { replaceState: () => {} },
      location: { search: '', pathname: '/index.html' },
      matchMedia: () => ({ matches: false }),
      pageYOffset: 0,
      scrollTo: () => {}
    }, overrides.window || {}),
    document: {
      addEventListener: () => {},
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      querySelector: (selector) => elements[selector] || null
    },
    IntersectionObserver: function () {
      return { observe: () => {}, disconnect: () => {} };
    },
    URLSearchParams,
    Chart: undefined
  };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  return sandbox.module.exports;
}

function readMainSource() {
  const sourcePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'js', 'main.js');
  return fs.readFileSync(sourcePath, 'utf8');
}

(function testShouldAutoScrollForEligibleReasonsWithExactPlayer() {
  const main = loadMainExports();
  const playerView = { selectedPlayer: 'Julian Torres' };

  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'search-select', playerView }), true);
  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'search-enter', playerView }), true);
  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'deep-link', playerView }), true);
})();

(function testShouldNotAutoScrollForIneligibleReasons() {
  const main = loadMainExports();
  const playerView = { selectedPlayer: 'Julian Torres' };

  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'search-input', playerView }), false);
  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'filters-change', playerView }), false);
  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'clear', playerView }), false);
})();

(function testShouldNotAutoScrollWithoutExactPlayer() {
  const main = loadMainExports();

  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'search-enter', playerView: { selectedPlayer: null } }), false);
  assert.strictEqual(main.shouldAutoScrollToPlayerModule({ reason: 'deep-link', playerView: null }), false);
})();

(function testScrollToPlayerModuleUsesNavbarOffset() {
  const calls = [];
  const main = loadMainExports({
    window: {
      pageYOffset: 100,
      scrollTo: (options) => calls.push(options)
    },
    elements: {
      '.player-module-card': {
        getBoundingClientRect: () => ({ top: 420 })
      },
      'main-navbar': {
        getBoundingClientRect: () => ({ height: 72 })
      }
    }
  });

  main.scrollToPlayerModule();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(JSON.stringify(calls[0]), JSON.stringify({
    top: 436,
    behavior: 'smooth'
  }));
})();

(function testScrollToPlayerModuleNoOpsWhenTargetMissing() {
  const calls = [];
  const main = loadMainExports({
    window: {
      scrollTo: (options) => calls.push(options)
    },
    elements: {}
  });

  main.scrollToPlayerModule();

  assert.strictEqual(calls.length, 0);
})();

(function testSmartSearchDoesNotOpenSuggestionsOnEmptyFocus() {
  const source = readMainSource();

  assert.match(
    source,
    /searchInput\.addEventListener\('focus',\s*\(\)\s*=>\s*\{[\s\S]*if\s*\(!shouldOpenSuggestions\(searchInput\.value\)\)\s*\{[\s\S]*hideSuggestions\(\);[\s\S]*return;/,
    'empty focus should hide suggestions instead of opening the overlay'
  );
})();

(function testSmartSearchClosesSuggestionsOnEmptyInputAndBlur() {
  const source = readMainSource();

  assert.match(
    source,
    /searchInput\.addEventListener\('input',\s*\(e\)\s*=>\s*\{[\s\S]*if\s*\(!shouldOpenSuggestions\(e\.target\.value\)\)\s*\{[\s\S]*hideSuggestions\(\);[\s\S]*return;/,
    'empty input should close suggestions'
  );
  assert.match(
    source,
    /searchInput\.addEventListener\('blur',\s*\(\)\s*=>\s*\{[\s\S]*setTimeout\(hideSuggestions,\s*120\);[\s\S]*\}\);/,
    'blur should close suggestions after allowing click selection'
  );
})();

(function testApplyFiltersAlwaysHidesSuggestionOverlay() {
  const source = readMainSource();

  assert.match(
    source,
    /function applyFilters\(options = \{\}\)\s*\{[\s\S]*document\.getElementById\('search-suggestions'\)\?\.\s*classList\.add\('d-none'\);/,
    'applyFilters should always close the suggestion overlay when filters change'
  );
})();
