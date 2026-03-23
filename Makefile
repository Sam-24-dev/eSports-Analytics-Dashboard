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
	@for test_file in tests/frontend_*.test.js; do \
		$(NODE) $$test_file; \
	done

check-js:
	$(NODE) --check src/frontend/assets/js/main.js

serve:
	$(PYTHON) -m http.server 8000 --directory src/frontend
