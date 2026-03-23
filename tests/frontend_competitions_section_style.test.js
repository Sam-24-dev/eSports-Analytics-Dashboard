const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testCompetitionCardsAvoidTransitionAllAndUseCompactHover() {
  assert.match(
    stylesheet,
    /\.competition-card\s*\{[\s\S]*transition:\s*transform [^;]+,\s*box-shadow [^;]+,\s*border-color [^;]+,\s*background-color [^;]+;/,
    'competition cards should use explicit transitions'
  );
})();

(function testCompetitionCatalogAndSpotlightHaveDedicatedStructure() {
  assert.match(
    stylesheet,
    /\.competitions-catalog-grid\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    'competition catalog should use an explicit grid layout'
  );
  assert.match(
    stylesheet,
    /\.competition-spotlight-metrics--primary\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    'spotlight primary metrics should use a 4-column grid on desktop'
  );
  assert.match(
    stylesheet,
    /\.competition-country-panel__metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    'country participation metrics should use a 4-column grid on desktop'
  );
})();

(function testCompetitionNumericValuesUseTabularNumbers() {
  assert.match(
    stylesheet,
    /\.competition-year,\s*\.prize-amount,\s*\.competition-spotlight-value\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/,
    'competition numeric values should use tabular figures'
  );
})();

(function testCompetitionResponsiveBreakpointsAreExplicit() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*1024px\)\s*\{[\s\S]*\.competition-spotlight-metrics--primary\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*\.competition-country-panel__metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'tablet breakpoint should reduce spotlight metrics to two columns'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.competitions-catalog-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(1,\s*minmax\(0,\s*1fr\)\);[\s\S]*\.competition-country-panel__metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(1,\s*minmax\(0,\s*1fr\)\);/,
    'mobile breakpoint should collapse the competition catalog to one column'
  );
})();

console.log('frontend_competitions_section_style tests passed');
