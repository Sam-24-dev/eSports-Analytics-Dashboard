const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testTeamComparisonDesktopLayoutsAreExplicit() {
  assert.match(
    stylesheet,
    /\.team-comparison-main-grid--compare\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'compare layout should collapse to a single wide column after removing the radar'
  );
  assert.match(
    stylesheet,
    /\.team-comparison-main-grid--profile\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px,\s*0\.[0-9]+fr\)\s*minmax\(0,\s*1\.[0-9]+fr\);/,
    'profile layout should keep the two-column premium composition'
  );
})();

(function testTeamComparisonPanelsUseExplicitPremiumTransitions() {
  assert.match(
    stylesheet,
    /\.team-comparison-panel\s*\{[\s\S]*transition:\s*transform [^;]+,\s*border-color [^;]+,\s*box-shadow [^;]+,\s*background-color [^;]+;/,
    'team comparison panels should use explicit premium transitions'
  );
})();

(function testTeamComparisonTableWrapperControlsScroll() {
  assert.match(
    stylesheet,
    /\.team-comparison-panel \.table-responsive\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*auto;[\s\S]*max-height:\s*clamp\(240px,\s*44vh,\s*460px\);/,
    'team comparison table wrapper should control horizontal and vertical scroll'
  );
})();

(function testTeamComparisonPrizeValuesUseReadableBodyTone() {
  assert.match(
    stylesheet,
    /\.team-comparison-table-value--body\s*\{[\s\S]*color:\s*rgba\(15,\s*23,\s*42,\s*0\.9\);/,
    'table prize values should use a dark readable tone over the light table body'
  );
})();

(function testTeamComparisonResponsiveRulesAreExplicit() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.team-comparison-main-grid,\s*[\s\S]*\.team-comparison-main-grid--profile\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'tablet/mobile breakpoint should stack the compare and profile layouts'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*420px\)\s*\{[\s\S]*\.team-comparison-leaders-grid,\s*[\s\S]*\.team-comparison-profile__metrics\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'small mobile breakpoint should collapse leader and profile metric grids to one column'
  );
})();

(function testTeamComparisonStylesNoLongerExposeRadarClasses() {
  assert.doesNotMatch(
    stylesheet,
    /\.team-comparison-radar/,
    'radar-specific team comparison styles should be removed once the radar leaves the UX'
  );
})();

console.log('frontend_team_comparison_section_style tests passed');
