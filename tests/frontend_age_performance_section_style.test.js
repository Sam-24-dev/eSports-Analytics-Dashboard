const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testAgePerformanceLeaderGridSupportsCenteredCompactCounts() {
  assert.match(
    stylesheet,
    /\.age-performance-leaders-grid--count-3\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(220px,\s*320px\)\);/,
    'three leader cards should use a centered compact grid'
  );
  assert.match(
    stylesheet,
    /\.age-performance-leaders-grid--count-2\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(240px,\s*340px\)\);/,
    'two leader cards should use a centered compact grid'
  );
})();

(function testAgePerformanceBandSummarySupportsCompactCountsAndPartialPanel() {
  assert.match(
    stylesheet,
    /\.age-performance-band-grid--count-1\s*\{[\s\S]*grid-template-columns:\s*minmax\(240px,\s*360px\);/,
    'single visible band should stay compact and centered'
  );
  assert.match(
    stylesheet,
    /\.age-performance-summary-panel--compact\s*\{[\s\S]*width:\s*min\(100%,\s*920px\);/,
    'compact band summary panel should cap width when few tramos are visible'
  );
  assert.match(
    stylesheet,
    /\.age-performance-state-panel--partial\s*\.card-body\s*\{[\s\S]*min-height:\s*220px;/,
    'partial state panel should use a dedicated compact height'
  );
})();

(function testAgePerformanceNotesAndResponsiveRulesAreExplicit() {
  assert.match(
    stylesheet,
    /\.age-performance-section-notes\s*\{[\s\S]*justify-content:\s*center;/,
    'omission notes should be centered as a single contextual bar'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.age-performance-leaders-grid--count-4,[\s\S]*grid-template-columns:\s*minmax\(0,\s*320px\);/,
    'tablet/mobile breakpoint should collapse leader grids into centered narrow columns'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*420px\)\s*\{[\s\S]*\.age-performance-band-grid--count-1[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'small mobile breakpoint should collapse band grids to one column'
  );
})();

console.log('frontend_age_performance_section_style tests passed');
