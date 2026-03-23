const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'frontend', 'assets', 'js', 'main.js'),
  'utf8'
);

(function testSmartSearchUsesTouchSafeSuggestionSelection() {
  assert.match(
    source,
    /let pointerSelectionInProgress = false;[\s\S]*pointerSelectionEvent = typeof window !== 'undefined' && 'PointerEvent' in window[\s\S]*\?\s*'pointerdown'/,
    'smart search should track touch selection state and prefer pointerdown when available'
  );

  assert.match(
    source,
    /item\.addEventListener\(pointerSelectionEvent,\s*function \(event\)\s*\{[\s\S]*event\.preventDefault\(\);[\s\S]*pointerSelectionInProgress = true;[\s\S]*selectSuggestionByIndex\(/,
    'suggestion selection should resolve on pointerdown to avoid mobile blur races'
  );
})();

(function testBlurHandlerWaitsForTouchSelectionAndAnchorsUseStickyOffset() {
  assert.match(
    source,
    /searchInput\.addEventListener\('blur',\s*\(\)\s*=>\s*\{[\s\S]*if \(!pointerSelectionInProgress\)\s*\{[\s\S]*hideSuggestions\(\);/,
    'blur handler should not close suggestions while a touch selection is in progress'
  );

  assert.match(
    source,
    /const top = Math\.max\(targetTop - getStickyChromeOffset\(\) - 12,\s*0\);/,
    'player module scroll should account for the sticky navbar and filter bar'
  );

  assert.match(
    source,
    /window\.scrollTo\(\{[\s\S]*top:\s*top,[\s\S]*behavior:\s*'smooth'/,
    'anchor navigation should use explicit offset-based smooth scrolling'
  );
})();

console.log('frontend_smart_search_touch tests passed');
