const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stylePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'css', 'style.css');
const stylesheet = fs.readFileSync(stylePath, 'utf8');

(function testTeamExperienceDesktopLayoutsAreExplicit() {
  assert.match(
    stylesheet,
    /\.team-experience-main-grid--compare\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px,\s*0\.[0-9]+fr\)\s*minmax\(0,\s*1\.[0-9]+fr\);/,
    'compare layout should use a stable two-column composition for map + table'
  );
  assert.doesNotMatch(
    stylesheet,
    /\.team-experience-main-grid--profile\s*\{[\s\S]*grid-template-columns:/,
    'profile mode should no longer define a two-column grid because the table is removed'
  );
})();

(function testTeamExperienceRangeMapUsesExplicitTrackAndMarkerClasses() {
  assert.match(
    stylesheet,
    /\.team-experience-range-map__track\s*\{/,
    'range map should define an explicit track class'
  );
  assert.match(
    stylesheet,
    /\.team-experience-range-map__avg-marker\s*\{/,
    'range map should define an explicit average marker class'
  );
  assert.match(
    stylesheet,
    /\.team-experience-range-map\s*\{[\s\S]*max-height:/,
    'range map container should cap its height for long contexts'
  );
  assert.match(
    stylesheet,
    /\.team-experience-range-map\s*\{[\s\S]*overflow-y:\s*auto;/,
    'range map container should scroll vertically when there are many teams'
  );
  assert.match(
    stylesheet,
    /\.team-experience-range-map__track\s*\{[\s\S]*cursor:\s*help;/,
    'range map track should indicate tooltip affordance'
  );
  assert.match(
    stylesheet,
    /\.team-experience-range-map__track\[data-tooltip\]:is\(:hover,\s*:focus-visible\)::after\s*\{[\s\S]*content:\s*attr\(data-tooltip\);/,
    'range map track should render tooltip content from data-tooltip on hover/focus'
  );
  assert.doesNotMatch(
    stylesheet,
    /\.team-experience-range-map__labels\s*\{/,
    'range map should no longer render per-row labels below the bar'
  );
})();

(function testTeamExperienceRoleBadgeStylesExist() {
  assert.match(
    stylesheet,
    /\.team-experience-role-badge--starter\s*\{/,
    'starter veteran badge style should exist'
  );
  assert.match(
    stylesheet,
    /\.team-experience-role-badge--substitute\s*\{/,
    'substitute veteran badge style should exist'
  );
  assert.match(
    stylesheet,
    /\.team-experience-role-badge--mixed\s*\{/,
    'mixed veteran badge style should exist'
  );
})();

(function testTeamExperienceResponsiveRulesAreExplicit() {
  assert.match(
    stylesheet,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*\.team-experience-main-grid--compare\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'tablet/mobile breakpoint should stack compare mode panels'
  );
  assert.match(
    stylesheet,
    /@media \(max-width:\s*420px\)\s*\{[\s\S]*\.team-experience-leaders-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    'small mobile breakpoint should collapse leaders to one column'
  );
})();

(function testTeamExperiencePanelsDoNotForceEqualHeight() {
  assert.match(
    stylesheet,
    /\.team-experience-panel\s*\{[\s\S]*height:\s*auto;/,
    'team experience panels should size to content instead of inheriting equal heights'
  );
  assert.match(
    stylesheet,
    /\.team-experience-panel--profile\s*\{[\s\S]*max-width:\s*min\(100%,\s*[0-9]+px\);[\s\S]*margin-inline:\s*auto;/,
    'profile mode should constrain its width and center the spotlight card'
  );
})();

console.log('frontend_team_experience_section_style tests passed');
