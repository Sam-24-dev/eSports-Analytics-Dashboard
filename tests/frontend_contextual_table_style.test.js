const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testContextualTableResponsiveContainerIsScrollable() {
  assert.match(
    stylesheet,
    /\.contextual-table-card \.table-responsive\s*\{[\s\S]*max-height:\s*[0-9]+px;[\s\S]*max-width:\s*100%;[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*auto;[\s\S]*contain:\s*paint;/,
    'contextual table container should have controlled horizontal/vertical scroll with max-height'
  );
})();

(function testContextualTableHeaderIsSticky() {
  assert.match(
    stylesheet,
    /\.contextual-table-card \.table thead th\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/,
    'contextual table header should be sticky inside the scroll container'
  );
})();

(function testVariationPillUsesPremiumTreatment() {
  assert.match(
    stylesheet,
    /\.contextual-table-value\s*\{[\s\S]*padding:\s*[^;]+;[\s\S]*border-radius:\s*999px;[\s\S]*font-variant-numeric:\s*tabular-nums;/,
    'variation values should render as readable pills with tabular numbers'
  );
})();

(function testNotComparableVariationUsesSubtleTreatment() {
  assert.match(
    stylesheet,
    /\.contextual-table-value--not-comparable\s*\{[\s\S]*background:\s*transparent;[\s\S]*border-color:\s*transparent;/,
    'not-comparable annual variation should use a subtle low-emphasis treatment'
  );
})();

(function testContextualTableHoverIsSoftAndStickyColumnShadowIsLight() {
  assert.match(
    stylesheet,
    /\.contextual-table-card \.table tbody tr:hover\s*\{[\s\S]*background:\s*rgba\(0,\s*212,\s*255,\s*0\.[0-9]+\);/,
    'contextual table hover should use a dedicated soft background'
  );
  assert.match(
    stylesheet,
    /\.contextual-table-col--primary\s*\{[\s\S]*background:\s*rgba\(24[0-9],\s*25[0-9],\s*25[0-9],\s*0\.9[0-9]\);[\s\S]*box-shadow:\s*[^;]+rgba\(0,\s*212,\s*255,\s*0\.[0-9]+\)[^;]*;/,
    'sticky primary column should keep a light separation shadow'
  );
})();

(function testContextualTableUsesRowSeparatorInsteadOfCellBorderOnStickyColumn() {
  assert.match(
    stylesheet,
    /\.contextual-table-card \.table tbody tr\s*\{[\s\S]*box-shadow:\s*inset 0 -1px 0 rgba\(0,\s*212,\s*255,\s*0\.[0-9]+\);/,
    'row separator should be handled at row level'
  );
  assert.match(
    stylesheet,
    /\.contextual-table-card \.table tbody td\s*\{[\s\S]*border-bottom:\s*0;/,
    'contextual table cells should not draw their own bottom border'
  );
})();

(function testMobileTableKeepsControlledMinimumWidth() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.contextual-table-card \.table\s*\{[\s\S]*min-width:\s*[0-9]+px;/,
    'mobile breakpoint should keep a minimum table width to avoid unreadable compression'
  );
})();

(function testMobileDisablesStickyPrimaryColumnToPreventDocumentBleed() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.contextual-table-col--primary,[\s\S]*position:\s*static;[\s\S]*left:\s*auto;[\s\S]*box-shadow:\s*none;/,
    'mobile breakpoint should disable sticky primary column treatment to keep overflow inside the table wrapper'
  );
})();

console.log('frontend_contextual_table_style tests passed');
