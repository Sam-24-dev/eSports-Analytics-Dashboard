const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testSquadUsageCardsUseExplicitTransitions() {
  assert.match(
    stylesheet,
    /\.squad-usage-summary-card\s*\{[\s\S]*transition:\s*transform [^;]+,\s*border-color [^;]+,\s*box-shadow [^;]+,\s*background-color [^;]+;/,
    'squad usage summary cards should use explicit transitions'
  );
})();

(function testSquadUsageDesktopLayoutIsExplicit() {
  assert.match(
    stylesheet,
    /\.squad-usage-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    'desktop summary grid should use four columns'
  );
  assert.match(
    stylesheet,
    /\.squad-usage-main-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s*minmax\(0,\s*1\.28fr\);/,
    'desktop main grid should use explicit two-column balance'
  );
})();

(function testSquadUsageUsesCompactRepartitionInsteadOfCanvasChart() {
  assert.match(
    stylesheet,
    /\.squad-usage-context-meta\s*\{[\s\S]*justify-items:\s*center;/,
    'context meta block should be defined for quantitative copy'
  );
  assert.match(
    stylesheet,
    /\.squad-usage-repartition__track\s*\{[\s\S]*min-height:\s*18px;/,
    'compact repartition track should be defined'
  );
  assert.match(
    stylesheet,
    /\.squad-usage-repartition__legend\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'desktop legend should use two columns'
  );
})();

(function testSquadUsageNumericValuesUseTabularNums() {
  assert.match(
    stylesheet,
    /\.squad-usage-summary-card__value,[\s\S]*\.squad-usage-repartition__item-value\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/,
    'squad usage numeric values should use tabular numbers'
  );
})();

(function testSquadUsageGapTonesAndTableScrollAreDefined() {
  assert.match(stylesheet, /\.squad-usage-gap--positive\s*\{[\s\S]*color:/, 'positive gap tone should exist');
  assert.match(stylesheet, /\.squad-usage-gap--negative\s*\{[\s\S]*color:/, 'negative gap tone should exist');
  assert.match(stylesheet, /\.squad-usage-gap--not-comparable\s*\{[\s\S]*color:/, 'muted gap tone should exist');
  assert.match(
    stylesheet,
    /\.squad-usage-table-card \.table-responsive\s*\{[\s\S]*max-width:\s*100%;[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*auto;[\s\S]*max-height:\s*clamp\(220px,\s*46vh,\s*430px\);[\s\S]*contain:\s*paint;/,
    'table wrapper should control horizontal and vertical scroll'
  );
})();

(function testSquadUsageResponsiveRulesAreExplicit() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*1024px\)\s*\{[\s\S]*\.squad-usage-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*\.squad-usage-main-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'tablet breakpoint should reduce summary grid and stack the main layout'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.squad-usage-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*\.squad-usage-repartition__legend\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'mobile breakpoint should keep summary cards compact and stack repartition legend'
  );
  assert.match(
    stylesheet,
    /#plantilla-team-table\s*\{[\s\S]*min-width:\s*560px;[\s\S]*@media \(max-width:\s*768px\)\s*\{[\s\S]*#plantilla-team-table\s*\{[\s\S]*min-width:\s*520px;[\s\S]*#plantilla-team-table\.plantilla-team-table--compact\s*\{[\s\S]*min-width:\s*440px;/,
    'mobile breakpoint should reduce the Plantilla table min-width without letting it escape the wrapper'
  );
})();

console.log('frontend_squad_usage_section_style tests passed');

