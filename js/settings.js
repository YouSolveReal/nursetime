// ============================================================
// SETTINGS TAB  (replaces B4XSettingsView.bas)
// Load and save nurse profile and pay rate preferences.
// ============================================================

const SettingsTab = (() => {

  let initialized = false;

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (!initialized) {
      initialized = true;
      document.getElementById('btn-settings-save').addEventListener('click', saveSettings);
    }
    await loadSettings();
  }

  // ── Load settings into form ───────────────────────────────
  async function loadSettings() {
    try {
      const s = await DB.getSettings();
      window.appSettings = s; // keep global cache fresh

      setVal('set-user-name',       s.userName          || '');
      setVal('set-employer',        s.employerName       || '');
      setVal('set-rate-day',        s.rateDay            ?? 40);
      setVal('set-rate-evening',    s.rateEvening        ?? 44);
      setVal('set-rate-night',      s.rateNight          ?? 48);
      setVal('set-rate-weekend',    s.rateWeekendDiff    ?? 6);
      setVal('set-shift-day',       s.shiftDayStart      ?? 7);
      setVal('set-shift-evening',   s.shiftEveningStart  ?? 15);
      setVal('set-shift-night',     s.shiftNightStart    ?? 23);
    } catch (e) {
      showToast('Could not load settings.', 'danger');
      console.error(e);
    }
  }

  // ── Save settings ─────────────────────────────────────────
  async function saveSettings() {
    // Read values
    const userName         = getVal('set-user-name').trim();
    const employerName     = getVal('set-employer').trim();
    const rateDay          = parseFloat(getVal('set-rate-day'));
    const rateEvening      = parseFloat(getVal('set-rate-evening'));
    const rateNight        = parseFloat(getVal('set-rate-night'));
    const rateWeekendDiff  = parseFloat(getVal('set-rate-weekend'));
    const shiftDayStart    = parseInt(getVal('set-shift-day'),    10);
    const shiftEveningStart = parseInt(getVal('set-shift-evening'), 10);
    const shiftNightStart  = parseInt(getVal('set-shift-night'),  10);

    // Validate
    if (!userName) {
      showToast('Your name cannot be empty.', 'warning');
      return;
    }
    const rates = [rateDay, rateEvening, rateNight, rateWeekendDiff];
    if (rates.some(r => isNaN(r) || r < 0)) {
      showToast('All hourly rates must be valid numbers ≥ 0.', 'warning');
      return;
    }
    const hours = [shiftDayStart, shiftEveningStart, shiftNightStart];
    if (hours.some(h => isNaN(h) || h < 0 || h > 23)) {
      showToast('Shift start hours must be integers between 0 and 23.', 'warning');
      return;
    }

    const settings = {
      userName, employerName,
      rateDay, rateEvening, rateNight, rateWeekendDiff,
      shiftDayStart, shiftEveningStart, shiftNightStart
    };

    try {
      await DB.saveSettings(settings);
      showToast('Settings saved!', 'success');
    } catch (e) {
      showToast('Error saving settings: ' + e.message, 'danger');
      console.error(e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function showToast(msg, type) {
    if (typeof AppToast !== 'undefined') AppToast.show(msg, type);
  }

  return { init };
})();
