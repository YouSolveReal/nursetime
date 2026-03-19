// ============================================================
// CALENDAR TAB
// Monthly grid, day detail modal, monthly summary, CSV export.
// ============================================================

const CalendarTab = (() => {

  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1; // 1-12
  let dayDataMap   = {};  // { 'yyyy-MM-dd': shiftObj (with computed values) }
  let initialized  = false;

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (!initialized) {
      initialized = true;
      document.getElementById('btn-cal-prev').addEventListener('click', () => navigate(-1));
      document.getElementById('btn-cal-next').addEventListener('click', () => navigate(1));
      document.getElementById('btn-cal-export').addEventListener('click', exportCSV);
    }
    await loadAndRender();
  }

  // ── Navigation ────────────────────────────────────────────
  function navigate(delta) {
    currentMonth += delta;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
    loadAndRender();
  }

  // ── Time string → minutes helper ──────────────────────────
  function timeToMins(t) {
    if (!t) return 0;
    const parts = t.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
  }

  // ── Normalise a stored date to 'yyyy-MM-dd' ───────────────
  // Handles non-zero-padded dates that toLocaleDateString('en-CA') may produce
  // on some iOS/macOS locales (e.g. '2026-3-5' → '2026-03-05').
  function normalizeDate(d) {
    if (!d) return d;
    const parts = String(d).split('-');
    if (parts.length !== 3) return d;
    return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
  }

  // ── Recalculate a shift's worked minutes + pay ─────────────
  // Always recompute from clockIn/clockOut timestamps when available so that
  // stale, zero, or missing stored values are never shown in the calendar.
  function ensureComputed(sh) {
    const out = { ...sh };
    // Normalise the date field itself (fix any non-padded dates stored on device)
    out.date = normalizeDate(out.date);

    if (out.clockIn && out.clockOut) {
      let diff = timeToMins(out.clockOut) - timeToMins(out.clockIn);
      if (diff < 0) diff += 1440; // midnight crossing
      const mins = Math.max(0, diff - (out.breakMinutes || 0));
      out.totalMinutes = mins;
      out.grossPay = ShiftUtils.calculatePay(out.shiftType || 'Day', mins, out.date);
    }
    return out;
  }

  // ── Load data and render ──────────────────────────────────
  async function loadAndRender() {
    const start = ShiftUtils.monthStart(currentYear, currentMonth);
    const end   = ShiftUtils.monthEnd(currentYear, currentMonth);

    document.getElementById('cal-month-label').textContent =
      new Date(currentYear, currentMonth - 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    try {
      const shifts = await DB.getShiftsForRange(start, end);
      dayDataMap = {};
      shifts.forEach(sh => {
        const computed = ensureComputed(sh);
        // Key by the normalised date so it matches the grid's zero-padded dateStr
        dayDataMap[computed.date] = computed;
      });
    } catch (e) {
      console.error('Calendar load error:', e);
    }

    renderMonthlySummary();
    renderGrid();
  }

  // ── Monthly summary card ──────────────────────────────────
  function renderMonthlySummary() {
    let totalMins = 0, totalPay = 0, shiftCount = 0;
    Object.values(dayDataMap).forEach(sh => {
      if (!sh.isActive) {
        totalMins  += sh.totalMinutes || 0;
        totalPay   += sh.grossPay     || 0;
        shiftCount++;
      }
    });

    const el = id => document.getElementById(id);
    if (el('cal-total-shifts')) el('cal-total-shifts').textContent = shiftCount;
    if (el('cal-total-hours'))  el('cal-total-hours').textContent  = ShiftUtils.formatDuration(totalMins);
    if (el('cal-total-earn'))   el('cal-total-earn').textContent   = ShiftUtils.formatCurrency(totalPay);
  }

  // ── Render the 6×7 calendar grid ─────────────────────────
  function renderGrid() {
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    const today  = ShiftUtils.todayStr();
    const firstDay        = new Date(currentYear, currentMonth - 1, 1);
    const startDow        = (firstDay.getDay() + 6) % 7; // 0=Mon … 6=Sun
    const daysInMonth     = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;
        const dayOffset = cellIndex - startDow;
        let dayNum, dateStr, isCurrentMonth;

        if (dayOffset < 0) {
          dayNum = daysInPrevMonth + dayOffset + 1;
          const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
          const prevYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
          dateStr = `${prevYear}-${String(prevMonth).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
          isCurrentMonth = false;
        } else if (dayOffset >= daysInMonth) {
          dayNum = dayOffset - daysInMonth + 1;
          const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
          const nextYear  = currentMonth === 12 ? currentYear + 1 : currentYear;
          dateStr = `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
          isCurrentMonth = false;
        } else {
          dayNum  = dayOffset + 1;
          dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
          isCurrentMonth = true;
        }

        const shift    = dayDataMap[dateStr];
        const isToday  = dateStr === today;
        const isWeekend = col >= 5;

        const cell = buildDayCell(dayNum, dateStr, shift, isCurrentMonth, isToday, isWeekend);
        grid.appendChild(cell);
      }

      // Week summary row
      const weekStart = (() => {
        const firstCellOffset = row * 7 - startDow;
        let d;
        if (firstCellOffset < 0) {
          d = new Date(currentYear, currentMonth - 1, 1);
          d.setDate(d.getDate() + firstCellOffset);
        } else {
          d = new Date(currentYear, currentMonth - 1, firstCellOffset + 1);
        }
        // Use explicit formatting — toLocaleDateString('en-CA') is unreliable on iOS
        const y = d.getFullYear(), mo = d.getMonth()+1, dy = d.getDate();
        return `${y}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
      })();
      const weekEnd = ShiftUtils.addDays(weekStart, 6);
      grid.appendChild(buildWeekSummaryRow(weekStart, weekEnd));
    }
  }

  function buildDayCell(dayNum, dateStr, shift, isCurrentMonth, isToday, isWeekend) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell' +
      (isCurrentMonth ? '' : ' cal-cell--other-month') +
      (isToday        ? ' cal-cell--today'             : '') +
      (isWeekend && isCurrentMonth ? ' cal-cell--weekend' : '');

    let innerHTML = `<span class="cal-day-num">${dayNum}</span>`;

    if (shift && !shift.isActive) {
      const color = ShiftUtils.getShiftColor(shift.shiftType);
      innerHTML += `
        <span class="cal-shift-badge" style="background:${color}">${shift.shiftType[0]}</span>
        <span class="cal-duration">${ShiftUtils.formatDuration(shift.totalMinutes)}</span>
        <span class="cal-pay">${ShiftUtils.formatCurrency(shift.grossPay)}</span>
      `;
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => showDayDetail(dateStr, shift));
    } else if (shift && shift.isActive) {
      innerHTML += `<span class="cal-active-badge">Active</span>`;
    }

    cell.innerHTML = innerHTML;
    return cell;
  }

  function buildWeekSummaryRow(weekStart, weekEnd) {
    const row = document.createElement('div');
    row.className = 'cal-week-summary';

    let totalMins = 0;
    let totalPay  = 0;

    for (let i = 0; i < 7; i++) {
      const d  = ShiftUtils.addDays(weekStart, i);
      const sh = dayDataMap[d];
      if (sh && !sh.isActive) {
        totalMins += sh.totalMinutes || 0;
        totalPay  += sh.grossPay     || 0;
      }
    }

    if (totalMins > 0 || totalPay > 0) {
      row.innerHTML = `
        <span class="cal-week-label">Week:</span>
        <span class="cal-week-hours">${ShiftUtils.formatDuration(totalMins)}</span>
        <span class="cal-week-pay">${ShiftUtils.formatCurrency(totalPay)}</span>`;
    }
    return row;
  }

  // ── Day Detail Modal ──────────────────────────────────────
  function showDayDetail(dateStr, shift) {
    const color   = ShiftUtils.getShiftColor(shift.shiftType);
    const content = document.getElementById('day-detail-body');
    content.innerHTML = `
      <div class="text-center mb-3">
        <div class="fw-bold fs-5">${ShiftUtils.formatDateDisplay(dateStr)}</div>
        <span class="badge rounded-pill px-3 py-2 mt-1" style="background:${color}">${shift.shiftType} Shift</span>
      </div>
      <div class="list-group list-group-flush">
        <div class="list-group-item d-flex justify-content-between">
          <span class="text-muted">Clock In</span>
          <strong>${shift.clockIn ? shift.clockIn.slice(0,5) : '—'}</strong>
        </div>
        <div class="list-group-item d-flex justify-content-between">
          <span class="text-muted">Clock Out</span>
          <strong>${shift.clockOut ? shift.clockOut.slice(0,5) : '—'}</strong>
        </div>
        <div class="list-group-item d-flex justify-content-between">
          <span class="text-muted">Unpaid Breaks</span>
          <strong>${ShiftUtils.formatDuration(shift.breakMinutes)}</strong>
        </div>
        <div class="list-group-item d-flex justify-content-between">
          <span class="text-muted">Hours Worked</span>
          <strong>${ShiftUtils.formatDuration(shift.totalMinutes)}</strong>
        </div>
        <div class="list-group-item d-flex justify-content-between align-items-center border-top-0 pt-3">
          <span class="fw-semibold">Gross Pay</span>
          <span class="fs-4 fw-bold text-success">${ShiftUtils.formatCurrency(shift.grossPay)}</span>
        </div>
      </div>`;

    document.getElementById('dayDetailModal').present();
  }

  // ── CSV Export ────────────────────────────────────────────
  async function exportCSV() {
    const settings = window.appSettings || {};
    const name     = settings.userName || 'Nurse';
    const mm       = String(currentMonth).padStart(2,'0');
    const filename = `NurseTime_${name}_${currentYear}_${mm}.csv`;

    let csv = 'Date,Day,Shift Type,Clock In,Clock Out,Worked Hours,Break Minutes,Gross Pay\n';

    const start = ShiftUtils.monthStart(currentYear, currentMonth);
    const end   = ShiftUtils.monthEnd(currentYear, currentMonth);

    try {
      const shifts = await DB.getShiftsForRange(start, end);
      let totMins = 0, totPay = 0;

      shifts.filter(s => !s.isActive).forEach(raw => {
        const sh = ensureComputed(raw);
        const d  = new Date(sh.date + 'T00:00:00');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        const hours   = ((sh.totalMinutes || 0) / 60).toFixed(2);
        csv += `${sh.date},${dayName},${sh.shiftType},${sh.clockIn?.slice(0,5) || ''},${sh.clockOut?.slice(0,5) || ''},${hours},${sh.breakMinutes || 0},${(sh.grossPay || 0).toFixed(2)}\n`;
        totMins += sh.totalMinutes || 0;
        totPay  += sh.grossPay     || 0;
      });

      csv += `,,,,TOTAL,${(totMins/60).toFixed(2)},,${totPay.toFixed(2)}\n`;
      ShiftUtils.downloadCSV(filename, csv);
    } catch (e) {
      console.error('Export error:', e);
    }
  }

  return { init };
})();
