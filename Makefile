PYTHON ?= python
NODE ?= node

.PHONY: etl test test-py test-fe check-js serve

etl:
	$(PYTHON) src/etl/pipeline.py

test:
	$(PYTHON) -m unittest discover tests

test-py:
	$(PYTHON) -m unittest discover tests

test-fe:
	$(NODE) tests/frontend_main.test.js
	$(NODE) tests/frontend_filtering.test.js
	$(NODE) tests/frontend_player_module.test.js
	$(NODE) tests/frontend_contextual_table.test.js
	$(NODE) tests/frontend_team_comparison_section.test.js
	$(NODE) tests/frontend_team_experience_section.test.js
	$(NODE) tests/frontend_age_performance_section.test.js
	$(NODE) tests/frontend_ml_projection_section.test.js
	$(NODE) tests/frontend_ml_projection_section_style.test.js

check-js:
	$(NODE) --check src/frontend/assets/js/main.js

serve:
	$(PYTHON) -m http.server 8000 --directory src/frontend
