.PHONY: setup infra-up infra-down migrate seed dev dev-browser test check

setup:
	npm run install:deps

infra-up:
	npm run infra:up

infra-down:
	npm run infra:down

migrate:
	npm run platform:migrate

seed:
	npm run platform:seed

dev:
	npm run dev

dev-browser:
	npm run dev:browser

test:
	npm test

check:
	npm run check
