const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testMlProjectionDesktopLayoutsAreCompactAndCentered() {
  assert.match(
    stylesheet,
    /\.ml-projection-insights-grid--count-4\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(220px,\s*1fr\)\);/,
    'desktop should support four premium insight cards'
  );
  assert.match(
    stylesheet,
    /\.ml-projection-insights-grid--count-3\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(220px,\s*320px\)\);/,
    'three visible insight cards should stay compact and centered'
  );
  assert.match(
    stylesheet,
    /\.ml-projection-watchlists\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'watchlists should render as two balanced panels on desktop'
  );
})();

(function testMlProjectionTablesAndPanelsContainScrollSafely() {
  assert.match(
    stylesheet,
    /\.ml-projection-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;/,
    'advanced projection table should scroll inside its wrapper'
  );
  assert.match(
    stylesheet,
    /\.ml-projection-state-panel\s*\{[\s\S]*max-width:\s*min\(100%,\s*880px\);/,
    'empty/partial ML state should stay compact'
  );
})();

(function testMlProjectionResponsiveRulesAreExplicit() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.ml-projection-watchlists\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'tablet/mobile breakpoint should stack watchlists'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*420px\)\s*\{[\s\S]*\.ml-projection-insights-grid--count-4,[\s\S]*\.ml-projection-insights-grid--count-1[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'small mobile breakpoint should collapse insight cards into one column'
  );
})();

console.log('frontend_ml_projection_section_style tests passed');
