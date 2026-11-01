# trv-schedule-card

Home Assistant dashboard card for editing the weekly schedule of the SONOFF TRV-ZBL
thermostatic radiator valve (Zigbee2MQTT). Distributed through the Home Assistant
Marketplace (HACS before HA 2026.11) as type `plugin` / Dashboard.

## Structure

- `trv-schedule-card.js` – the whole card, plain JavaScript, no build step, no dependencies.
  The Marketplace finds it because the file name matches the repository name. Do not rename it.
- `hacs.json` – Marketplace manifest. `homeassistant` is the minimum supported HA version.
- `tests/smoke.test.js` – jsdom smoke test with a fake `hass` object. Run `npm test`.
- `.github/workflows/validate.yml` – HACS action (`category: plugin`) and tests on every push/PR.
- `.github/workflows/release.yml` – a pushed tag `vX.Y.Z` creates the GitHub release and attaches the JS file.
- `docs/` – screenshots used in the README. The catalog requires images in the README.

## Rules for changes

- Keep it a single, dependency-free file. No frameworks, no bundler, no external requests.
- Every user-facing string lives in `STR` and must exist in both `en` and `de`.
- Colours only via Home Assistant theme variables (`--primary-color`, …) so light and dark themes work.
- The device format is `HH:mm/temp` separated by spaces, max. 12 points, first at 00:00, 5–30 °C in 0.5 steps.
  The device pads to 12 entries by repeating the last one; `parseSchedule` drops those repeats. Keep that.
- Entity IDs are derived from the climate entity (`climate.<prefix>` → `text.<prefix>_weekly_schedule_<day>`,
  `select.<prefix>_schedule_group_to_edit`, `select.<prefix>_schedule_active_group`).
- Add or adjust a smoke test for every behaviour change, and run `npm test` before proposing a commit.
- Update `README.md` when options or behaviour change.

## Releasing

1. Bump `CARD_VERSION` in `trv-schedule-card.js` (semantic versioning).
2. Add an entry to `CHANGELOG.md`.
3. Commit, then create the tag `vX.Y.Z` (must equal `CARD_VERSION`, the release workflow checks this).
4. Pushing the tag publishes the release. Users get the update under Settings → Updates.

## Issues

When triaging issues, ask for the HA version, the Zigbee2MQTT version and the raw schedule text the card shows.
Label as `bug`, `enhancement` or `question`. Never close issues without the maintainer's confirmation.
