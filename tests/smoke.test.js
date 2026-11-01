// Smoke test: loads the card in jsdom with a fake hass object and checks
// parsing, editing, copying and saving. Run with: npm test
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
w.console.info = () => {};
w.eval(fs.readFileSync(path.join(__dirname, "..", "trv-schedule-card.js"), "utf8"));

const prefix = "test_trv";
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
// Real device output: padded to 12 entries by repeating the last one
const deviceString =
  "00:00/16 06:00/19 09:00/16 16:00/19 22:00/16 22:00/16 22:00/16 22:00/16 22:00/16 22:00/16 22:00/16 22:00/16";

const states = { [`climate.${prefix}`]: { state: "auto" } };
for (const d of days) states[`text.${prefix}_weekly_schedule_${d}`] = { state: deviceString };

const calls = [];
const hass = { states, language: "en", callService: async (...a) => calls.push(a) };

(async () => {
  const Card = w.customElements.get("trv-schedule-card");
  assert.ok(Card, "card is registered");
  assert.ok(w.customElements.get("trv-schedule-card-editor"), "editor is registered");
  // Objects come from the jsdom realm, so compare them as JSON
  const json = (o) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(json(Card.getStubConfig(hass)), { entity: `climate.${prefix}` }, "stub config finds the TRV");

  const card = w.document.createElement("trv-schedule-card");
  w.document.body.appendChild(card);
  card.setConfig({ entity: `climate.${prefix}` });
  card.hass = hass;
  const sr = card.shadowRoot;

  assert.equal(sr.querySelectorAll(".row").length, 5, "padding repeats are hidden");
  assert.equal(sr.querySelector(".groups"), null, "group selector hidden without group entities");
  assert.equal(sr.querySelector(".errs"), null, "no validation errors for device data");

  // The card opens on today's weekday, so pick Monday explicitly
  sr.querySelector('[data-action=day][data-day="0"]').click();
  sr.querySelector('[data-action=step][data-i="1"][data-d="0.5"]').click();
  sr.querySelector("[data-action=copy][data-target=weekdays]").click();
  assert.match(sr.querySelector("[data-action=save]").textContent, /Save 5 days/);

  sr.querySelector("[data-action=save]").click();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls.length, 5, "five days saved");
  assert.deepEqual(json(calls[0]), [
    "text",
    "set_value",
    { entity_id: `text.${prefix}_weekly_schedule_monday`, value: "00:00/16 06:00/19.5 09:00/16 16:00/19 22:00/16" },
  ]);

  // Validation blocks saving duplicate times
  sr.querySelector('[data-action=day][data-day="6"]').click();
  sr.querySelector("[data-action=add]").click();
  const times = sr.querySelectorAll('input[data-field="time"]');
  const last = times[times.length - 1];
  last.value = "22:00";
  last.dispatchEvent(new w.FocusEvent("focusout", { bubbles: true }));
  assert.ok(sr.querySelector(".errs"), "duplicate time is flagged");

  console.log("All smoke tests passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
