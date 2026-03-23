const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylesheet = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css'),
  'utf8'
);
const html = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'frontend', 'index.html'),
  'utf8'
);

(function testFilterBarIncludesExpandableSearchToggleMarkup() {
  assert.match(
    html,
    /id="toggle-search-panel"[\s\S]*aria-controls="filter-search-panel"/,
    'filter bar should expose a toggle button bound to the expandable search panel'
  );
})();

(function testTabletAndMobileFilterBarRemainSticky() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*1024px\)\s*\{[\s\S]*body\s*\{[\s\S]*padding-top:\s*calc\(56px \+ var\(--compact-filter-bar-height,\s*92px\)\);[\s\S]*\[id\]\s*\{[\s\S]*scroll-margin-top:\s*calc\(56px \+ var\(--compact-filter-bar-height,\s*92px\) \+ 12px\);[\s\S]*\.filter-bar\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*56px;/,
    'tablet/mobile breakpoint should keep the filter bar fixed below the navbar and adjust scroll offset dynamically'
  );
})();

(function testCompactFilterLayoutUsesExpandableSearchPanel() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*1024px\)\s*\{[\s\S]*\.filter-search\s*\{[\s\S]*display:\s*none;[\s\S]*\.filter-bar\.filter-bar--search-open \.filter-search\s*\{[\s\S]*display:\s*flex;[\s\S]*\.filter-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'compact filter layout should hide the search panel by default, expand it on demand, and keep action buttons balanced'
  );
})();

console.log('frontend_filter_bar_responsive tests passed');
