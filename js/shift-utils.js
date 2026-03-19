// ============================================================
// SHIFT UTILITIES  (replaces ShiftUtils.bas)
// Pure calculation functions — no Firebase, no DOM.
// ============================================================

const ShiftUtils = (() => {

  // ── Shift type constants ─────────────────────────────────
  const SHIFT_DAY     = 'Day';
  const SHIFT_EVENING = 'Evening';
  const SHIFT_NIGHT   = 'Night';

  // ── Default settings (overridden by saved settings) ──────
  const DEFAULTS = {
    rateDay:          40,
    rateEvening:      44,
    rateNight:        48,
    rateWeekendDiff:   6,
    shiftDayStart:     7,
    shiftEveningStart: 15,
    shiftNightStart:   23
  };

  // ── Colour palette ───────────────────────────────────────
  const COLORS = {
    day:       '#1E88E5',   // Material Blue
    evening:   '#FF8F00',   // Amber
    night:     '#6A1B9A',   // Deep Purple
    primary:   '#1565C0',
    success:   '#43A047',
    warning:   '#FF8F00',
    error:     '#E53935',
    surface:   '#FFFFFF',
    bg:        '#F5F5F5'
  };

  // ── Get current settings from app-level cache ─────────────
  function getSettings() {
    return window.appSettings || DEFAULTS;
  }

  // ── Shift type detection ──────────────────────────────────
  /**
   * @param {number} clockInHour  0-23
   * @returns {'Day'|'Evening'|'Night'}
   */
  function detectShiftType(clockInHour) {
    const s = getSettings();
    const h = clockInHour;
    if (h >= s.shiftDayStart && h < s.shiftEveningStart) return SHIFT_DAY;
    if (h >= s.shiftEveningStart && h < s.shiftNightStart) return SHIFT_EVENING;
    return SHIFT_NIGHT;
  }

  // ── Weekend detection ─────────────────────────────────────
  /**
   * @param {string} dateStr  'yyyy-MM-dd'
   * @returns {boolean}
   */
  function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay(); // 0=Sun, 6=Sat
    return dow === 0 || dow === 6;
  }

  // ── Hourly rate for shift type ────────────────────────────
  function getShiftRate(shiftType) {
    const s = getSettings();
    if (shiftType === SHIFT_DAY)     return s.rateDay;
    if (shiftType === SHIFT_EVENING) return s.rateEvening;
    return s.rateNight;
  }

  // ── Gross pay calculation ─────────────────────────────────
  /**
   * @param {string} shiftType
   * @param {number} workedMinutes   total worked (minus breaks)
   * @param {string} dateStr         'yyyy-MM-dd'
   * @returns {number}  gross pay in dollars
   */
  function calculatePay(shiftType, workedMinutes, dateStr) {
    const s = getSettings();
    let rate = getShiftRate(shiftType);
    if (isWeekend(dateStr)) rate += s.rateWeekendDiff;
    const hours = workedMinutes / 60;
    return Math.round(hours * rate * 100) / 100;
  }

  // ── Shift colour ──────────────────────────────────────────
  function getShiftColor(shiftType) {
    if (shiftType === SHIFT_DAY)     return COLORS.day;
    if (shiftType === SHIFT_EVENING) return COLORS.evening;
    return COLORS.night;
  }

  // ── Duration formatter ────────────────────────────────────
  /** @returns {string}  e.g. "8h 30m" */
  function formatDuration(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  // ── Currency formatter ────────────────────────────────────
  /** @returns {string}  e.g. "$40.00" */
  function formatCurrency(amount) {
    return '$' + (amount || 0).toFixed(2);
  }

  // ── Date/time helpers ─────────────────────────────────────
  /** Safe 'yyyy-MM-dd' from a Date — avoids toLocaleDateString locale quirks on iOS */
  function toYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /** @returns {string}  'yyyy-MM-dd' */
  function todayStr() {
    return toYMD(new Date());
  }

  /** @returns {string}  'HH:mm:ss' */
  function nowTimeStr() {
    return new Date().toTimeString().slice(0, 8);
  }

  /** @returns {string}  'Thursday, March 19' */
  function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  /** @returns {string}  'Mon 19 Mar' */
  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // ── Week boundary helpers ─────────────────────────────────
  /**
   * Monday of the ISO week containing dateStr.
   * @param {string} dateStr  'yyyy-MM-dd'
   * @returns {string}  'yyyy-MM-dd'
   */
  function getWeekStart(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay(); // 0=Sun
    const diff = (dow === 0) ? -6 : 1 - dow; // shift so Monday=0
    d.setDate(d.getDate() + diff);
    return toYMD(d);
  }

  /**
   * Sunday of the week (6 days after Monday).
   * @param {string} weekStartStr  'yyyy-MM-dd'  (must be Monday)
   * @returns {string}  'yyyy-MM-dd'
   */
  function getWeekEnd(weekStartStr) {
    const d = new Date(weekStartStr + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return toYMD(d);
  }

  /**
   * Human-readable week range label.
   * @param {string} weekStartStr  'yyyy-MM-dd'
   * @returns {string}  e.g. "Mar 18 – Mar 24"
   */
  function weekRangeLabel(weekStartStr) {
    const start = new Date(weekStartStr + 'T00:00:00');
    const end   = new Date(weekStartStr + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  /**
   * Add N days to a 'yyyy-MM-dd' string.
   * @param {string} dateStr
   * @param {number} days
   * @returns {string}
   */
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toYMD(d);
  }

  // ── Elapsed time helpers ──────────────────────────────────
  /**
   * Seconds elapsed since a 'HH:mm:ss' time string. Handles midnight crossing.
   * @param {string} timeStr  'HH:mm:ss'
   * @returns {number}  elapsed seconds (>= 0)
   */
  function secondsSince(timeStr) {
    const now       = new Date();
    const [h, m, s] = timeStr.split(':').map(Number);
    const start     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
    if (start > now) start.setDate(start.getDate() - 1);
    return Math.max(0, Math.floor((now - start) / 1000));
  }

  /** @deprecated use secondsSince — kept for clock-out math */
  function minutesSince(timeStr) {
    return Math.floor(secondsSince(timeStr) / 60);
  }

  /**
   * Format total seconds as HH:MM:SS string.
   * @param {number} totalSeconds
   * @returns {string}  e.g. "08:30:45"
   */
  function formatHHMMSS(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  /**
   * Countdown seconds remaining from a break start time + preset duration.
   * @param {string} breakStartStr  'HH:mm:ss'
   * @param {number} durationMinutes
   * @returns {number}  remaining seconds (negative = overrun)
   */
  function breakSecondsRemaining(breakStartStr, durationMinutes) {
    return durationMinutes * 60 - secondsSince(breakStartStr);
  }

  // ── CSV helpers ───────────────────────────────────────────
  /** Trigger a CSV file download in the browser. */
  function downloadCSV(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Month helpers ─────────────────────────────────────────
  /** 'yyyy-MM-dd' for the 1st of a given month. */
  function monthStart(year, month) {
    return `${year}-${String(month).padStart(2,'0')}-01`;
  }

  /** 'yyyy-MM-dd' for the last day of a given month. */
  function monthEnd(year, month) {
    const last = new Date(year, month, 0); // day 0 = last day of previous month
    return toYMD(last);
  }

  /** Parse 'yyyy-MM-dd' → { year, month, day } */
  function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  }

  // ── Public API ────────────────────────────────────────────
  return {
    SHIFT_DAY, SHIFT_EVENING, SHIFT_NIGHT,
    COLORS, DEFAULTS,
    detectShiftType,
    isWeekend,
    getShiftRate,
    calculatePay,
    getShiftColor,
    formatDuration,
    formatCurrency,
    formatDateDisplay,
    formatDateShort,
    todayStr,
    nowTimeStr,
    getWeekStart,
    getWeekEnd,
    weekRangeLabel,
    addDays,
    secondsSince,
    minutesSince,
    formatHHMMSS,
    breakSecondsRemaining,
    downloadCSV,
    monthStart,
    monthEnd,
    parseDate
  };
})();
