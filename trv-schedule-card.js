/*
 * trv-schedule-card.js  v1.0.0
 * Weekly schedule editor card for the SONOFF TRV-ZBL thermostatic radiator valve (Zigbee2MQTT)
 *
 * Minimal configuration:
 *   type: custom:trv-schedule-card
 *   entity: climate.living_room_trv
 *
 * Optional: title, language (en | de), or prefix instead of entity.
 * UI language follows the Home Assistant user language (German or English).
 * See README.md for installation.
 */

const CARD_VERSION = "1.0.0";


/* ------------------------------------------------------------------ */
/*  Shared constants & i18n                                            */
/* ------------------------------------------------------------------ */

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MAX_ROWS = 12;
const T_MIN = 5;
const T_MAX = 30;
const COPY_TARGETS = { weekdays: [0, 1, 2, 3, 4], weekend: [5, 6], all: [0, 1, 2, 3, 4, 5, 6] };

const STR = {
  en: {
    daysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    daysLong: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    decimal: ".",
    // card
    cardTitle: "Weekly schedule",
    group: "Group",
    active: "active",
    unsaved: "Unsaved",
    notFound: (e) => `Entity ${e} not found. Check the thermostat in the card configuration.`,
    ed_entity: "Thermostat",
    ed_entity_help: "Climate entity of the SONOFF TRV-ZBL",
    ed_title: "Title (optional)",
    ed_language: "Language",
    ed_auto: "Home Assistant language",
    badFormat: "The stored schedule has an unexpected format and will be replaced when you save:",
    points: (n) => `${n} of ${MAX_ROWS} switch points`,
    add: "+ Add switch point",
    maxReached: `Maximum of ${MAX_ROWS} switch points reached`,
    applyTo: (d) => `Apply ${d} to`,
    weekdays: "Mon–Fri",
    weekend: "Sat–Sun",
    allDays: "all days",
    discard: "Discard",
    save: "Save",
    saveN: (n) => `Save ${n} days`,
    saving: "Saving …",
    saved: (n) => `${n === 1 ? "1 day" : n + " days"} saved. The thermostat confirms the change the next time it reports.`,
    saveFailed: (e) => `Saving failed: ${e}`,
    loadingGroup: (g) => `Loading group ${g} …`,
    groupFailed: (e) => `Could not switch group: ${e}`,
    confirmGroup: "Discard unsaved changes and switch group?",
    copied: (d) => `Copied schedule from ${d}. Not saved yet.`,
    errFirst: "The first switch point must start at 00:00.",
    errMax: `No more than ${MAX_ROWS} switch points per day.`,
    errDup: (t) => `The time ${t} is used twice.`,
    errRange: (t) => `${t}: temperature must be between ${T_MIN} and ${T_MAX} °C.`,
    firstFixed: "The first switch point always starts at 00:00",
    now: "Now",
    hours: "24 h",
  },
  de: {
    daysShort: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    daysLong: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    decimal: ",",
    cardTitle: "Wochenplan",
    group: "Gruppe",
    active: "aktiv",
    unsaved: "Ungespeichert",
    notFound: (e) => `Entität ${e} nicht gefunden. Thermostat in der Kartenkonfiguration prüfen.`,
    ed_entity: "Thermostat",
    ed_entity_help: "Climate-Entität des SONOFF TRV-ZBL",
    ed_title: "Titel (optional)",
    ed_language: "Sprache",
    ed_auto: "Home-Assistant-Sprache",
    badFormat: "Der gespeicherte Plan hat ein unerwartetes Format und wird beim Speichern ersetzt:",
    points: (n) => `${n} von ${MAX_ROWS} Schaltpunkten`,
    add: "+ Schaltpunkt hinzufügen",
    maxReached: `Maximum von ${MAX_ROWS} Schaltpunkten erreicht`,
    applyTo: (d) => `${d} übernehmen für`,
    weekdays: "Mo–Fr",
    weekend: "Sa–So",
    allDays: "alle Tage",
    discard: "Verwerfen",
    save: "Speichern",
    saveN: (n) => `${n} Tage speichern`,
    saving: "Speichere …",
    saved: (n) => `${n === 1 ? "1 Tag" : n + " Tage"} gespeichert. Das Thermostat bestätigt die Änderung beim nächsten Melden.`,
    saveFailed: (e) => `Speichern fehlgeschlagen: ${e}`,
    loadingGroup: (g) => `Lade Gruppe ${g} …`,
    groupFailed: (e) => `Gruppe konnte nicht gewechselt werden: ${e}`,
    confirmGroup: "Ungespeicherte Änderungen verwerfen und Gruppe wechseln?",
    copied: (d) => `Plan von ${d} übernommen. Noch nicht gespeichert.`,
    errFirst: "Der erste Schaltpunkt muss um 00:00 beginnen.",
    errMax: `Maximal ${MAX_ROWS} Schaltpunkte pro Tag.`,
    errDup: (t) => `Die Uhrzeit ${t} kommt doppelt vor.`,
    errRange: (t) => `${t}: Temperatur muss zwischen ${T_MIN} und ${T_MAX} °C liegen.`,
    firstFixed: "Der erste Schaltpunkt beginnt immer um 00:00",
    now: "Jetzt",
    hours: "24 Uhr",
  },
};

const langOf = (hass, override) => {
  const l = (override && override !== "auto" ? override : hass?.locale?.language || hass?.language || "en").toLowerCase();
  return l.startsWith("de") ? "de" : "en";
};

/* ------------------------------------------------------------------ */
/*  Schedule helpers                                                   */
/* ------------------------------------------------------------------ */

const fmtTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtTemp = (v) => String(Math.round(v * 2) / 2);
const parseTime = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  if (!m) return null;
  const h = +m[1], min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : null;
};
const clampTemp = (v) => Math.min(T_MAX, Math.max(T_MIN, Math.round(v * 2) / 2));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function parseSchedule(str) {
  if (!str || ["unknown", "unavailable", ""].includes(str)) return null;
  const rows = [];
  for (const tok of str.trim().split(/\s+/)) {
    const m = /^(\d{1,2}):(\d{2})\/(\d+(?:[.,]\d+)?)$/.exec(tok);
    if (!m) return null;
    rows.push({ t: +m[1] * 60 + +m[2], v: parseFloat(m[3].replace(",", ".")) });
  }
  // The device always pads to 12 entries by repeating the last one
  // (e.g. "... 22:00/16 22:00/16 22:00/16"). Drop identical repeats.
  const unique = rows
    .sort((a, b) => a.t - b.t)
    .filter((r, i, arr) => i === 0 || r.t !== arr[i - 1].t || r.v !== arr[i - 1].v);
  return unique.length ? unique : null;
}

const serialize = (rows) =>
  [...rows].sort((a, b) => a.t - b.t).map((r) => `${fmtTime(r.t)}/${fmtTemp(r.v)}`).join(" ");

function validate(rows, L) {
  const errs = [];
  if (!rows.some((r) => r.t === 0)) errs.push(L.errFirst);
  if (rows.length > MAX_ROWS) errs.push(L.errMax);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.t)) errs.push(L.errDup(fmtTime(r.t)));
    seen.add(r.t);
    if (isNaN(r.v) || r.v < T_MIN || r.v > T_MAX) errs.push(L.errRange(fmtTime(r.t)));
  }
  return [...new Set(errs)];
}

// Cool (blue) → warm (red), weighted towards the usual living range of 14–24 °C
function tempColor(v) {
  const p = Math.min(1, Math.max(0, (v - 14) / 10));
  return `hsl(${(212 - p * 200).toFixed(0)}, 68%, ${(52 - p * 4).toFixed(0)}%)`;
}

const prefixFromConfig = (c) =>
  c?.entity ? String(c.entity).replace(/^climate\./, "") : c?.prefix || null;

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

class TrvScheduleCard extends HTMLElement {
  setConfig(config) {
    const prefix = prefixFromConfig(config);
    if (!prefix) throw new Error("Set 'entity' (e.g. climate.living_room_trv) or 'prefix' (e.g. living_room_trv)");
    this._config = config;
    this._prefix = prefix;
    this._drafts = {};
    this._dirty = new Set();
    this._orig = {};
    this._day = (new Date().getDay() + 6) % 7;
    this._msg = null;
    this._busy = false;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
      this.shadowRoot.addEventListener("change", (ev) => this._onChange(ev));
      // Commit times on blur, otherwise focus jumps while typing
      this.shadowRoot.addEventListener("focusout", (ev) => this._onTimeCommit(ev));
      this.shadowRoot.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && ev.target.dataset?.field) ev.target.blur();
      });
    }
    this._render();
  }

  static getStubConfig(hass) {
    // Pick the first climate entity that has the TRV-ZBL schedule entities
    const climate = Object.keys(hass?.states || {}).find(
      (id) => id.startsWith("climate.") && hass.states[`text.${id.slice(8)}_weekly_schedule_monday`]
    );
    return { entity: climate || "climate.my_trv" };
  }

  static getConfigElement() {
    return document.createElement("trv-schedule-card-editor");
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  getCardSize() {
    return 9;
  }

  get _L() {
    return STR[langOf(this._hass, this._config?.language)];
  }
  _eid(day) {
    return `text.${this._prefix}_weekly_schedule_${day}`;
  }
  get _groupEditEid() {
    return `select.${this._prefix}_schedule_group_to_edit`;
  }
  get _groupActiveEid() {
    return `select.${this._prefix}_schedule_active_group`;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const st = (id) => hass.states[id]?.state;
    const sig = [...DAY_KEYS.map((d) => st(this._eid(d))), st(this._groupEditEid), st(this._groupActiveEid)].join("|");
    if (sig === this._sig && !first) return;
    this._sig = sig;
    for (const d of DAY_KEYS) {
      const s = st(this._eid(d));
      if (this._orig[d] !== s) {
        this._orig[d] = s;
        if (!this._dirty.has(d)) delete this._drafts[d];
      }
    }
    this._render();
  }

  _rows(d) {
    return this._drafts[d] || parseSchedule(this._orig[d]) || [{ t: 0, v: 20 }];
  }

  _markDirty(d, rows) {
    const orig = parseSchedule(this._orig[d]);
    if (orig && serialize(orig) === serialize(rows)) this._dirty.delete(d);
    else this._dirty.add(d);
  }

  _edit(d, fn) {
    const rows = this._rows(d).map((r) => ({ ...r }));
    fn(rows);
    rows.sort((a, b) => a.t - b.t);
    this._drafts[d] = rows;
    this._markDirty(d, rows);
    this._msg = null;
    this._render();
  }

  _onClick(ev) {
    const el = ev.target.closest("[data-action]");
    if (!el || el.disabled || this._busy) return;
    const day = DAY_KEYS[this._day];
    const i = +el.dataset.i;
    switch (el.dataset.action) {
      case "day":
        this._day = +el.dataset.day;
        this._msg = null;
        this._render();
        break;
      case "add":
        this._edit(day, (rows) => {
          if (rows.length >= MAX_ROWS) return;
          const last = rows[rows.length - 1];
          let t = Math.min(last.t + 60, 23 * 60 + 30);
          while (rows.some((r) => r.t === t) && t > 0) t -= 30;
          if (!rows.some((r) => r.t === t)) rows.push({ t, v: last.v });
        });
        break;
      case "del":
        this._edit(day, (rows) => rows.splice(i, 1));
        break;
      case "step":
        this._edit(day, (rows) => (rows[i].v = clampTemp(rows[i].v + +el.dataset.d)));
        break;
      case "copy": {
        const src = this._rows(day);
        for (const idx of COPY_TARGETS[el.dataset.target]) {
          const d = DAY_KEYS[idx];
          if (d === day) continue;
          this._drafts[d] = src.map((r) => ({ ...r }));
          this._markDirty(d, src);
        }
        this._msg = { type: "info", text: this._L.copied(this._L.daysLong[this._day]) };
        this._render();
        break;
      }
      case "discard":
        this._drafts = {};
        this._dirty.clear();
        this._msg = null;
        this._render();
        break;
      case "save":
        this._save();
        break;
      case "group":
        this._setGroup(el.dataset.g);
        break;
    }
  }

  _onChange(ev) {
    const el = ev.target;
    if (el.dataset?.field !== "temp" || this._busy) return;
    const v = parseFloat(String(el.value).replace(",", "."));
    if (isNaN(v)) return this._render();
    const i = +el.dataset.i;
    this._edit(DAY_KEYS[this._day], (rows) => (rows[i].v = clampTemp(v)));
  }

  _onTimeCommit(ev) {
    const el = ev.target;
    if (el.dataset?.field !== "time" || this._busy) return;
    const day = DAY_KEYS[this._day];
    const i = +el.dataset.i;
    const t = parseTime(el.value);
    if (t === null) return this._render();
    if (this._rows(day)[i]?.t === t) return;
    this._edit(day, (rows) => (rows[i].t = t));
  }

  async _setGroup(g) {
    if (this._dirty.size && !confirm(this._L.confirmGroup)) return;
    this._drafts = {};
    this._dirty.clear();
    this._msg = { type: "info", text: this._L.loadingGroup(g) };
    this._render();
    try {
      await this._hass.callService("select", "select_option", { entity_id: this._groupEditEid, option: g });
    } catch (err) {
      this._msg = { type: "error", text: this._L.groupFailed(err.message || err) };
      this._render();
    }
  }

  async _save() {
    const L = this._L;
    const days = DAY_KEYS.filter((d) => this._dirty.has(d));
    for (const d of days) {
      const errs = validate(this._rows(d), L);
      if (errs.length) {
        this._day = DAY_KEYS.indexOf(d);
        this._msg = { type: "error", text: `${L.daysLong[this._day]}: ${errs.join(" ")}` };
        return this._render();
      }
    }
    this._busy = true;
    this._msg = { type: "info", text: L.saving };
    this._render();
    try {
      for (const d of days) {
        await this._hass.callService("text", "set_value", { entity_id: this._eid(d), value: serialize(this._rows(d)) });
        this._dirty.delete(d); // draft stays visible until the device reports the new state
      }
      this._msg = { type: "ok", text: L.saved(days.length) };
    } catch (err) {
      this._msg = { type: "error", text: L.saveFailed(err.message || err) };
    }
    this._busy = false;
    this._render();
  }

  _bar(rows, big, L) {
    const sorted = [...rows].sort((a, b) => a.t - b.t);
    const dec = (v) => fmtTemp(v).replace(".", L.decimal);
    return `<div class="bar ${big ? "big" : ""}">${sorted
      .map((r, i) => {
        const end = i + 1 < sorted.length ? sorted[i + 1].t : 1440;
        const w = ((end - r.t) / 1440) * 100;
        const label = big && w > 6 ? `<span>${dec(r.v)}°</span>` : "";
        return `<div class="seg" style="width:${w}%;background:${tempColor(r.v)}" title="${fmtTime(r.t)}–${fmtTime(end % 1440)}: ${dec(r.v)} °C">${label}</div>`;
      })
      .join("")}</div>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const L = this._L;
    const hass = this._hass;
    const day = DAY_KEYS[this._day];
    const dayName = L.daysLong[this._day];
    const rows = this._rows(day);
    const raw = this._orig[day];
    const unreadable = raw && !["unknown", "unavailable"].includes(raw) && !parseSchedule(raw) && !this._drafts[day];
    const missing = hass && !hass.states[this._eid(day)];
    const grpEdit = hass?.states[this._groupEditEid]?.state;
    const grpActive = hass?.states[this._groupActiveEid]?.state;
    // Older Zigbee2MQTT versions have no schedule groups: hide the selector then
    const hasGroups = !!hass?.states[this._groupEditEid];
    const errs = validate(rows, L);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isToday = this._day === (now.getDay() + 6) % 7;
    const dec = (v) => fmtTemp(v).replace(".", L.decimal);
    const canSave = this._dirty.size && !this._busy;

    const week = DAY_KEYS.map(
      (d, i) => `
      <button class="wk ${i === this._day ? "sel" : ""}" data-action="day" data-day="${i}" aria-pressed="${i === this._day}">
        <span class="wk-l">${L.daysShort[i]}${this._dirty.has(d) ? `<i class="dot" title="${L.unsaved}"></i>` : ""}</span>
        ${this._bar(this._rows(d), false, L)}
      </button>`
    ).join("");

    const rowHtml = rows
      .map(
        (r, i) => `
      <div class="row">
        <span class="idx">${i + 1}</span>
        <input type="time" step="300" value="${fmtTime(r.t)}" data-field="time" data-i="${i}"
          ${r.t === 0 && i === 0 ? `disabled title="${L.firstFixed}"` : ""} aria-label="${fmtTime(r.t)}">
        <div class="temp">
          <button class="ic" data-action="step" data-i="${i}" data-d="-0.5" ${r.v <= T_MIN ? "disabled" : ""} aria-label="−0.5 °C">−</button>
          <input type="text" inputmode="decimal" value="${dec(r.v)}" data-field="temp" data-i="${i}" aria-label="°C">
          <span class="unit">°C</span>
          <button class="ic" data-action="step" data-i="${i}" data-d="0.5" ${r.v >= T_MAX ? "disabled" : ""} aria-label="+0.5 °C">+</button>
        </div>
        <span class="sw" style="background:${tempColor(r.v)}"></span>
        <button class="ic del" data-action="del" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="✕">✕</button>
      </div>`
      )
      .join("");

    const groups = ["1", "2", "3"]
      .map(
        (g) => `<button class="chip ${grpEdit === g ? "sel" : ""}" data-action="group" data-g="${g}" ${grpEdit ? "" : "disabled"}>${g}${
          grpActive === g ? `<small>${L.active}</small>` : ""
        }</button>`
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
        h2 { margin:0; font-size:1.15rem; font-weight:500; color:var(--primary-text-color); }
        .groups { display:flex; align-items:center; gap:6px; color:var(--secondary-text-color); font-size:.85rem; }
        .chip { min-width:34px; height:30px; padding:0 10px; border-radius:15px; border:1px solid var(--divider-color);
          background:transparent; color:var(--primary-text-color); cursor:pointer; font:inherit; display:inline-flex; align-items:center; gap:4px; }
        .chip.sel { background:var(--primary-color); border-color:var(--primary-color); color:var(--text-primary-color,#fff); }
        .chip small { font-size:.65rem; opacity:.85; }
        .chip:disabled { opacity:.4; cursor:default; }
        .week { display:grid; gap:4px; margin-bottom:18px; }
        .wk { display:grid; grid-template-columns:38px 1fr; align-items:center; gap:8px; padding:3px 6px; border:0; border-radius:8px;
          background:transparent; cursor:pointer; color:var(--secondary-text-color); font:inherit; text-align:left; }
        .wk:hover, .wk.sel { background:var(--secondary-background-color); }
        .wk.sel { color:var(--primary-text-color); font-weight:600; }
        .wk-l { display:flex; align-items:center; gap:4px; font-size:.85rem; }
        .dot { width:7px; height:7px; border-radius:50%; background:var(--warning-color,#f0a020); display:inline-block; }
        .bar { display:flex; height:10px; border-radius:5px; overflow:hidden; }
        .bar.big { height:34px; border-radius:8px; }
        .seg { display:flex; align-items:center; justify-content:center; min-width:0; }
        .seg + .seg { box-shadow: inset 1px 0 0 rgba(255,255,255,.55); }
        .seg span { color:#fff; font-size:.8rem; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,.35); white-space:nowrap; }
        .day-head { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px; }
        .day-head h3 { margin:0; font-size:1rem; font-weight:500; color:var(--primary-text-color); }
        .count { font-size:.8rem; color:var(--secondary-text-color); }
        .timeline { position:relative; }
        .now { position:absolute; top:-3px; bottom:15px; width:2px; background:var(--primary-text-color); border-radius:1px; opacity:.7; }
        .ticks { display:flex; justify-content:space-between; font-size:.7rem; color:var(--secondary-text-color); margin:3px 0 14px; }
        .rows { display:grid; gap:6px; }
        .row { display:grid; grid-template-columns:22px minmax(92px,120px) 1fr 14px 32px; align-items:center; gap:8px; }
        .idx { font-size:.75rem; color:var(--secondary-text-color); text-align:right; font-variant-numeric:tabular-nums; }
        input { font:inherit; color:var(--primary-text-color); background:var(--secondary-background-color);
          border:1px solid transparent; border-radius:8px; height:36px; padding:0 8px; box-sizing:border-box; min-width:0; }
        input:focus-visible, button:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px; }
        input:disabled { opacity:.6; }
        .temp { display:flex; align-items:center; gap:4px; }
        .temp input { width:58px; text-align:center; font-variant-numeric:tabular-nums; }
        .unit { font-size:.8rem; color:var(--secondary-text-color); }
        .ic { width:32px; height:32px; border-radius:50%; border:0; background:transparent; color:var(--primary-text-color);
          font-size:1.1rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .ic:hover:not(:disabled) { background:var(--secondary-background-color); }
        .ic:disabled { opacity:.25; cursor:default; }
        .del { font-size:.85rem; color:var(--secondary-text-color); }
        .sw { width:14px; height:14px; border-radius:4px; }
        .add { margin-top:8px; width:100%; height:36px; border:1px dashed var(--divider-color); border-radius:8px; background:transparent;
          color:var(--primary-color); font:inherit; cursor:pointer; }
        .add:disabled { color:var(--secondary-text-color); cursor:default; }
        .copy { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:16px; font-size:.85rem; color:var(--secondary-text-color); }
        .copy .chip { height:28px; font-size:.85rem; }
        .msg { margin-top:14px; padding:10px 12px; border-radius:8px; font-size:.9rem; }
        .msg.info { background:var(--secondary-background-color); color:var(--primary-text-color); }
        .msg.ok { background:rgba(67,160,71,.15); color:var(--success-color,#43a047); }
        .msg.error, .errs { background:rgba(219,68,55,.12); color:var(--error-color,#db4437); }
        .errs { margin-top:10px; padding:8px 12px; border-radius:8px; font-size:.85rem; }
        .warn { margin-bottom:12px; padding:10px 12px; border-radius:8px; font-size:.85rem; background:rgba(240,160,32,.15); color:var(--primary-text-color); }
        .warn code { word-break:break-all; }
        .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
        .btn { height:36px; padding:0 16px; border-radius:18px; font:inherit; font-weight:500; cursor:pointer; border:1px solid var(--divider-color);
          background:transparent; color:var(--primary-text-color); }
        .btn.primary { background:var(--primary-color); border-color:var(--primary-color); color:var(--text-primary-color,#fff); }
        .btn:disabled { opacity:.4; cursor:default; }
        @media (max-width:420px) { .row { grid-template-columns:18px 88px 1fr 28px; } .sw { display:none; } }
      </style>
      <ha-card>
        <div class="head">
          <h2>${esc(this._config.title || L.cardTitle)}</h2>
          ${hasGroups ? `<div class="groups">${L.group} ${groups}</div>` : ""}
        </div>
        <div class="week">${week}</div>
        ${missing ? `<div class="warn">${esc(L.notFound(this._eid(day)))}</div>` : ""}
        ${unreadable ? `<div class="warn">${L.badFormat}<br><code>${esc(raw)}</code></div>` : ""}
        <div class="day-head"><h3>${dayName}</h3><span class="count">${L.points(rows.length)}</span></div>
        <div class="timeline">
          ${this._bar(rows, true, L)}
          ${isToday ? `<div class="now" style="left:calc(${(nowMin / 1440) * 100}% - 1px)" title="${L.now}"></div>` : ""}
          <div class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>${L.hours}</span></div>
        </div>
        <div class="rows">${rowHtml}</div>
        <button class="add" data-action="add" ${rows.length >= MAX_ROWS ? "disabled" : ""}>${rows.length >= MAX_ROWS ? L.maxReached : L.add}</button>
        ${errs.length ? `<div class="errs">${errs.map(esc).join("<br>")}</div>` : ""}
        <div class="copy">
          ${esc(L.applyTo(dayName))}
          <button class="chip" data-action="copy" data-target="weekdays">${L.weekdays}</button>
          <button class="chip" data-action="copy" data-target="weekend">${L.weekend}</button>
          <button class="chip" data-action="copy" data-target="all">${L.allDays}</button>
        </div>
        ${this._msg ? `<div class="msg ${this._msg.type}">${esc(this._msg.text)}</div>` : ""}
        <div class="actions">
          <button class="btn" data-action="discard" ${canSave ? "" : "disabled"}>${L.discard}</button>
          <button class="btn primary" data-action="save" ${canSave ? "" : "disabled"}>${this._dirty.size > 1 ? L.saveN(this._dirty.size) : L.save}</button>
        </div>
      </ha-card>`;
  }
}


/* ------------------------------------------------------------------ */
/*  Visual editor                                                      */
/* ------------------------------------------------------------------ */

class TrvScheduleCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    else this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    const L = STR[langOf(this._hass)];
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => this._changed(ev.detail.value));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = {
      entity: this._config.entity || (this._config.prefix ? `climate.${this._config.prefix}` : ""),
      title: this._config.title || "",
      language: this._config.language || "auto",
    };
    this._form.schema = [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "climate" } } } },
      { name: "title", selector: { text: {} } },
      {
        name: "language",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: L.ed_auto },
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
            ],
          },
        },
      },
    ];
    this._form.computeLabel = (s) => L[`ed_${s.name}`] || s.name;
    this._form.computeHelper = (s) => (s.name === "entity" ? L.ed_entity_help : undefined);
  }

  _changed(value) {
    const cfg = { ...this._config, ...value };
    if (cfg.entity) delete cfg.prefix;
    if (!cfg.title) delete cfg.title;
    if (!cfg.language || cfg.language === "auto") delete cfg.language;
    this._config = cfg;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
  }
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

if (!customElements.get("trv-schedule-card")) customElements.define("trv-schedule-card", TrvScheduleCard);
if (!customElements.get("trv-schedule-card-editor")) customElements.define("trv-schedule-card-editor", TrvScheduleCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "trv-schedule-card",
  name: "TRV-ZBL weekly schedule",
  description: "Graphical weekly schedule editor for the SONOFF TRV-ZBL (Zigbee2MQTT)",
  preview: true,
});
console.info(
  `%c TRV-SCHEDULE-CARD %c ${CARD_VERSION} `,
  "background:#e8590c;color:#fff;border-radius:3px 0 0 3px",
  "background:#555;color:#fff;border-radius:0 3px 3px 0"
);
