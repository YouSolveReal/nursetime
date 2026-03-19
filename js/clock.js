// ============================================================
// CLOCK TAB  (replaces B4XClockView.bas)
// Real-time shift tracking, break management.
// Digital HH:MM:SS timers with DSEG7 font + glow animation.
// ============================================================

const ClockTab = (() => {

  // ── State ─────────────────────────────────────────────────
  let clockTimer            = null;
  let isClockedIn           = false;
  let isOnBreak             = false;
  let activeShift           = null;   // { id, date, clockIn, shiftType }
  let activeBreak           = null;   // { id, startTime, durationMinutes }
  let completedBreakSeconds = 0;      // sum of all finished breaks this shift
  let breakEndNotified      = false;  // prevent repeat notifications
  let initialized           = false;

  // ── DOM helpers ───────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (initialized) { refreshClock(); return; }
    initialized = true;

    // Set ghost digits for the DSEG7 "dim background" effect
    $('clk-elapsed').setAttribute('data-ghost', '88:88:88');
    $('clk-break-countdown').setAttribute('data-ghost', '88:88:88');

    $('btn-clock-inout').addEventListener('click', handleClockInOut);
    $('btn-break-15').addEventListener('click', () => startBreak(15));
    $('btn-break-30').addEventListener('click', () => startBreak(30));
    $('btn-break-60').addEventListener('click', () => startBreak(60));
    $('btn-end-break').addEventListener('click', endCurrentBreak);

    // ── Start clock immediately — no Firebase wait ────────
    // Time and date show instantly; shift state loads in background.
    startClockTimer();

    // ── Restore active shift state from Firestore (background) ─
    try {
      activeShift = await DB.getActiveShift();
      if (activeShift) {
        isClockedIn = true;
        activeBreak = await DB.getActiveBreak(activeShift.id);
        if (activeBreak) {
          isOnBreak        = true;
          breakEndNotified = false;
        }
        const completedMins = await DB.getTotalBreakMinutes(activeShift.id);
        completedBreakSeconds = completedMins * 60;
      }
    } catch (e) {
      console.error('Clock init error:', e);
    }

    // Update UI once Firebase state is known
    updateButtonStates();
  }

  function destroy() {
    stopClockTimer();
    initialized           = false;
    isClockedIn           = false;
    isOnBreak             = false;
    activeShift           = null;
    activeBreak           = null;
    completedBreakSeconds = 0;
    breakEndNotified      = false;
  }

  // ── Timer ─────────────────────────────────────────────────
  function startClockTimer() {
    stopClockTimer();
    clockTimer = setInterval(refreshClock, 1000);
  }
  function stopClockTimer() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  // ── Main refresh (every 1 second) ─────────────────────────
  function refreshClock() {
    const now = new Date();

    // ── Wall clock ─────────────────────────────────────────
    const timeEl = $('clk-time');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    }

    const dateEl = $('clk-date');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'short'
      });
    }

    // ── Shift badge ────────────────────────────────────────
    const badge = $('clk-shift-badge');
    if (badge) {
      const type = (isClockedIn && activeShift)
        ? activeShift.shiftType
        : ShiftUtils.detectShiftType(now.getHours());
      badge.textContent = type + ' Shift';
      badge.style.backgroundColor = ShiftUtils.getShiftColor(type);
      badge.classList.remove('d-none');
    }

    // ── Elapsed worked timer ───────────────────────────────
    const elapsedEl = $('clk-elapsed');
    const labelEl   = $('clk-elapsed-label');
    if (elapsedEl && isClockedIn && activeShift) {
      const totalElapsed  = ShiftUtils.secondsSince(activeShift.clockIn);
      const currentBreak  = isOnBreak && activeBreak
        ? ShiftUtils.secondsSince(activeBreak.startTime) : 0;
      const workedSeconds = Math.max(0, totalElapsed - completedBreakSeconds - currentBreak);

      const newText = ShiftUtils.formatHHMMSS(workedSeconds);
      if (elapsedEl.textContent !== newText) {
        elapsedEl.textContent = newText;
      }
      if (labelEl) labelEl.textContent = isOnBreak ? 'PAUSED' : 'WORKED';
    } else if (elapsedEl) {
      elapsedEl.textContent = '00:00:00';
      if (labelEl) labelEl.textContent = 'WORKED';
    }

    // ── Break countdown ────────────────────────────────────
    if (isOnBreak && activeBreak) {
      refreshBreakCountdown();
    }

    updateButtonStates();
  }

  // ── Break countdown (called from refreshClock) ────────────
  function refreshBreakCountdown() {
    const el       = $('clk-break-countdown');
    const overrunEl = $('clk-break-overrun');
    if (!el || !activeBreak) return;

    const remaining = ShiftUtils.breakSecondsRemaining(
      activeBreak.startTime,
      activeBreak.durationMinutes
    );

    if (remaining >= 0) {
      const newText = ShiftUtils.formatHHMMSS(remaining);
      if (el.textContent !== newText) {
        el.textContent = newText;
      }
      el.classList.remove('overrun');
      if (overrunEl) overrunEl.classList.add('d-none');

      // Fire notification when countdown hits zero
      if (remaining === 0 && !breakEndNotified) {
        breakEndNotified = true;
        const worked = $('clk-elapsed') ? $('clk-elapsed').textContent : '';
        if (typeof window.sendBreakEndNotification === 'function') {
          window.sendBreakEndNotification(worked);
        }
        showToast('Break time is over — back to work! 💪', 'warning');
      }
    } else {
      // Overrun — show how long over
      const overSecs = Math.abs(remaining);
      el.textContent = '+' + ShiftUtils.formatHHMMSS(overSecs);
      el.classList.add('overrun');
      if (overrunEl) overrunEl.classList.remove('d-none');
    }
  }

  // ── Button state manager ──────────────────────────────────
  function updateButtonStates() {
    const btn = $('btn-clock-inout');
    if (!btn) return;

    if (isClockedIn) {
      btn.textContent = 'CLOCK OUT';
      btn.color       = 'danger';
      btn.disabled    = isOnBreak;
      $('clk-break-buttons')?.classList.toggle('d-none',  isOnBreak);
      $('clk-break-panel')?.classList.toggle('d-none', !isOnBreak);
    } else {
      btn.textContent = 'CLOCK IN';
      btn.color       = 'success';
      btn.disabled    = false;
      $('clk-break-buttons')?.classList.add('d-none');
      $('clk-break-panel')?.classList.add('d-none');
    }
  }

  // ── Clock In / Out ────────────────────────────────────────
  async function handleClockInOut() {
    isClockedIn ? await clockOut() : await clockIn();
  }

  async function clockIn() {
    $('btn-clock-inout').disabled = true;
    try {
      const now       = new Date();
      const dateStr   = ShiftUtils.todayStr();
      const timeStr   = ShiftUtils.nowTimeStr();
      const shiftType = ShiftUtils.detectShiftType(now.getHours());

      const shiftId = await DB.startShift(dateStr, timeStr, shiftType);
      activeShift           = { id: shiftId, date: dateStr, clockIn: timeStr, shiftType };
      isClockedIn           = true;
      isOnBreak             = false;
      completedBreakSeconds = 0;

      showToast(`Clocked in — ${shiftType} Shift`, 'success');
    } catch (err) {
      showToast('Error clocking in: ' + err.message, 'danger');
      console.error(err);
    }
    updateButtonStates();
  }

  async function clockOut() {
    $('btn-clock-inout').disabled = true;
    try {
      const timeStr    = ShiftUtils.nowTimeStr();
      const elapsedMin = Math.floor(ShiftUtils.secondsSince(activeShift.clockIn) / 60);
      const breakMin   = await DB.getTotalBreakMinutes(activeShift.id);
      const workedMin  = Math.max(0, elapsedMin - breakMin);
      const grossPay   = ShiftUtils.calculatePay(activeShift.shiftType, workedMin, activeShift.date);

      await DB.endShift(activeShift.id, timeStr, workedMin, breakMin, grossPay);
      showToast(
        `Clocked out — ${ShiftUtils.formatDuration(workedMin)} worked · ${ShiftUtils.formatCurrency(grossPay)} earned`,
        'success'
      );

      isClockedIn           = false;
      isOnBreak             = false;
      activeShift           = null;
      activeBreak           = null;
      completedBreakSeconds = 0;
      breakEndNotified      = false;
      $('clk-elapsed').textContent = '00:00:00';
    } catch (err) {
      showToast('Error clocking out: ' + err.message, 'danger');
      console.error(err);
    }
    updateButtonStates();
  }

  // ── Breaks ────────────────────────────────────────────────
  async function startBreak(minutes) {
    try {
      const timeStr = ShiftUtils.nowTimeStr();
      const breakId = await DB.startBreak(activeShift.id, timeStr);
      activeBreak      = { id: breakId, startTime: timeStr, durationMinutes: minutes };
      isOnBreak        = true;
      breakEndNotified = false;
      updateButtonStates();
      showToast(`${minutes} min break started`, 'warning');
    } catch (err) {
      showToast('Error starting break: ' + err.message, 'danger');
      console.error(err);
    }
  }

  async function endCurrentBreak() {
    try {
      const timeStr = ShiftUtils.nowTimeStr();
      const durSecs = ShiftUtils.secondsSince(activeBreak.startTime);
      const dur     = Math.floor(durSecs / 60);
      await DB.endBreak(activeBreak.id, timeStr, dur);
      completedBreakSeconds += durSecs;
      activeBreak  = null;
      isOnBreak    = false;
      $('clk-break-countdown').textContent = '00:00:00';
      $('clk-break-countdown').classList.remove('overrun');
      updateButtonStates();
      showToast('Break ended — welcome back!', 'success');
    } catch (err) {
      showToast('Error ending break: ' + err.message, 'danger');
      console.error(err);
    }
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    if (typeof AppToast !== 'undefined') AppToast.show(msg, type);
  }

  return { init, destroy };
})();
