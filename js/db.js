// ============================================================
// DATABASE MANAGER  (replaces DBManager.bas)
// All Firestore CRUD operations.  Requires firebase-config.js loaded first.
// ============================================================

const DB = (() => {

  function uid() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.uid;
  }

  function userRef() {
    return db.collection('users').doc(uid());
  }

  // ── Settings ──────────────────────────────────────────────

  const DEFAULT_SETTINGS = {
    userName:          '',
    employerName:      '',
    rateDay:           40,
    rateEvening:       44,
    rateNight:         48,
    rateWeekendDiff:    6,
    shiftDayStart:      7,
    shiftEveningStart: 15,
    shiftNightStart:   23
  };

  async function getSettings() {
    const snap = await userRef().collection('meta').doc('settings').get();
    const data = snap.exists ? snap.data() : {};
    return { ...DEFAULT_SETTINGS, ...data };
  }

  async function saveSettings(settingsObj) {
    await userRef().collection('meta').doc('settings').set(settingsObj, { merge: true });
    // Update in-memory cache so ShiftUtils picks up new rates immediately
    window.appSettings = { ...DEFAULT_SETTINGS, ...settingsObj };
  }

  // ── Shifts ────────────────────────────────────────────────

  function shiftsCol() {
    return userRef().collection('shifts');
  }

  /**
   * Start a new shift.
   * @returns {string}  new shift document ID
   */
  async function startShift(dateStr, clockInStr, shiftType) {
    const ref = await shiftsCol().add({
      date:         dateStr,
      clockIn:      clockInStr,
      clockOut:     null,
      shiftType:    shiftType,
      totalMinutes: 0,
      breakMinutes: 0,
      grossPay:     0,
      isActive:     true,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  /**
   * End an active shift.
   */
  async function endShift(shiftId, clockOutStr, totalMinutes, breakMinutes, grossPay) {
    await shiftsCol().doc(shiftId).update({
      clockOut:     clockOutStr,
      totalMinutes: totalMinutes,
      breakMinutes: breakMinutes,
      grossPay:     grossPay,
      isActive:     false
    });
  }

  /**
   * Get the currently active shift (if any).
   * @returns {object|null}  { id, ...data } or null
   */
  async function getActiveShift() {
    const snap = await shiftsCol().where('isActive', '==', true).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Get shift for a specific date.
   * @returns {object|null}
   */
  async function getShiftForDate(dateStr) {
    const snap = await shiftsCol().where('date', '==', dateStr).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Get all shifts within a date range (inclusive).
   * @param {string} startDate  'yyyy-MM-dd'
   * @param {string} endDate    'yyyy-MM-dd'
   * @returns {Array<object>}
   */
  async function getShiftsForRange(startDate, endDate) {
    const snap = await shiftsCol()
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ── Breaks ────────────────────────────────────────────────

  function breaksCol() {
    return userRef().collection('breaks');
  }

  /**
   * Start a break for a shift.
   * @returns {string}  new break document ID
   */
  async function startBreak(shiftId, startTimeStr) {
    const ref = await breaksCol().add({
      shiftId:         shiftId,
      startTime:       startTimeStr,
      endTime:         null,
      durationMinutes: 0,
      isActive:        true,
      createdAt:       firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  /**
   * End an active break.
   */
  async function endBreak(breakId, endTimeStr, durationMinutes) {
    await breaksCol().doc(breakId).update({
      endTime:         endTimeStr,
      durationMinutes: durationMinutes,
      isActive:        false
    });
  }

  /**
   * Get the currently active break for a shift.
   * @returns {object|null}
   */
  async function getActiveBreak(shiftId) {
    const snap = await breaksCol()
      .where('shiftId', '==', shiftId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Sum all completed break minutes for a shift.
   * @returns {number}
   */
  async function getTotalBreakMinutes(shiftId) {
    const snap = await breaksCol()
      .where('shiftId', '==', shiftId)
      .where('isActive', '==', false)
      .get();
    return snap.docs.reduce((sum, d) => sum + (d.data().durationMinutes || 0), 0);
  }

  /**
   * Get all breaks for a shift.
   * @returns {Array<object>}
   */
  async function getBreaksForShift(shiftId) {
    const snap = await breaksCol()
      .where('shiftId', '==', shiftId)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ── Reporting ─────────────────────────────────────────────

  /**
   * Weekly summary: total shifts, hours, and pay broken down by shift type.
   * @param {string} weekStart  'yyyy-MM-dd'
   * @param {string} weekEnd    'yyyy-MM-dd'
   * @returns {object}  { shifts, dayShifts, eveShifts, nightShifts, weekendDiffShifts,
   *                      totalMinutes, dayMinutes, eveMinutes, nightMinutes,
   *                      totalPay, dayPay, evePay, nightPay, weekendDiffPay }
   */
  async function getWeeklySummary(weekStart, weekEnd) {
    const shifts = await getShiftsForRange(weekStart, weekEnd);
    const summary = {
      shifts: shifts.length,
      dayShifts: 0, eveShifts: 0, nightShifts: 0, weekendDiffShifts: 0,
      totalMinutes: 0, dayMinutes: 0, eveMinutes: 0, nightMinutes: 0,
      totalPay: 0, dayPay: 0, evePay: 0, nightPay: 0, weekendDiffPay: 0
    };
    const s = window.appSettings || {};
    const wdRate = s.rateWeekendDiff || ShiftUtils.DEFAULTS.rateWeekendDiff;

    shifts.filter(sh => !sh.isActive).forEach(sh => {
      summary.totalMinutes += sh.totalMinutes || 0;
      summary.totalPay     += sh.grossPay     || 0;

      if (sh.shiftType === ShiftUtils.SHIFT_DAY) {
        summary.dayShifts++;
        summary.dayMinutes += sh.totalMinutes || 0;
        summary.dayPay     += sh.grossPay     || 0;
      } else if (sh.shiftType === ShiftUtils.SHIFT_EVENING) {
        summary.eveShifts++;
        summary.eveMinutes += sh.totalMinutes || 0;
        summary.evePay     += sh.grossPay     || 0;
      } else {
        summary.nightShifts++;
        summary.nightMinutes += sh.totalMinutes || 0;
        summary.nightPay     += sh.grossPay     || 0;
      }

      // Weekend differential row (separate from base pay)
      if (ShiftUtils.isWeekend(sh.date)) {
        summary.weekendDiffShifts++;
        const hours = (sh.totalMinutes || 0) / 60;
        summary.weekendDiffPay += Math.round(hours * wdRate * 100) / 100;
      }
    });
    summary.totalPay = Math.round(summary.totalPay * 100) / 100;
    return summary;
  }

  // ── Public API ────────────────────────────────────────────
  return {
    getSettings,
    saveSettings,
    startShift,
    endShift,
    getActiveShift,
    getShiftForDate,
    getShiftsForRange,
    startBreak,
    endBreak,
    getActiveBreak,
    getTotalBreakMinutes,
    getBreaksForShift,
    getWeeklySummary
  };
})();
