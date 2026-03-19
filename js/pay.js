// ============================================================
// PAY TAB  (replaces B4XPayView.bas)
// Weekly pay breakdown by shift type + YTD summary.
// ============================================================

const PayTab = (() => {

  let weekStartStr = ShiftUtils.getWeekStart(ShiftUtils.todayStr());
  let initialized  = false;

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (!initialized) {
      initialized = true;
      document.getElementById('btn-pay-prev').addEventListener('click', () => navigate(-7));
      document.getElementById('btn-pay-next').addEventListener('click', () => navigate(7));
      document.getElementById('btn-pay-today').addEventListener('click', goToThisWeek);
      document.getElementById('btn-pay-export').addEventListener('click', exportCSV);
    }
    await loadWeekData();
  }

  // ── Navigation ────────────────────────────────────────────
  async function navigate(days) {
    weekStartStr = ShiftUtils.addDays(weekStartStr, days);
    // Prevent navigating into the future
    const thisWeek = ShiftUtils.getWeekStart(ShiftUtils.todayStr());
    if (weekStartStr > thisWeek) weekStartStr = thisWeek;
    await loadWeekData();
  }

  async function goToThisWeek() {
    weekStartStr = ShiftUtils.getWeekStart(ShiftUtils.todayStr());
    await loadWeekData();
  }

  // ── Load week data ────────────────────────────────────────
  async function loadWeekData() {
    const weekEndStr = ShiftUtils.getWeekEnd(weekStartStr);
    const thisWeek   = ShiftUtils.getWeekStart(ShiftUtils.todayStr());

    // Update header
    document.getElementById('pay-week-range').textContent = ShiftUtils.weekRangeLabel(weekStartStr);

    // Disable Next if already on current week
    const btnNext = document.getElementById('btn-pay-next');
    if (btnNext) btnNext.disabled = weekStartStr >= thisWeek;

    try {
      const summary = await DB.getWeeklySummary(weekStartStr, weekEndStr);
      renderPayTable(summary);
    } catch (e) {
      console.error('Pay load error:', e);
    }

    // Load YTD for the year of the displayed week
    try {
      const year     = weekStartStr.slice(0, 4);
      const ytdStart = `${year}-01-01`;
      const ytdEnd   = weekEndStr;
      const ytdShifts = await DB.getShiftsForRange(ytdStart, ytdEnd);
      renderYTD(ytdShifts, year);
    } catch (e) {
      console.error('YTD load error:', e);
    }
  }

  // ── Render pay table ──────────────────────────────────────
  function renderPayTable(s) {
    const settings = window.appSettings || ShiftUtils.DEFAULTS;

    const rows = [
      {
        type:   'Day',
        color:  ShiftUtils.COLORS.day,
        shifts: s.dayShifts,
        mins:   s.dayMinutes,
        rate:   settings.rateDay,
        pay:    s.dayPay
      },
      {
        type:   'Evening',
        color:  ShiftUtils.COLORS.evening,
        shifts: s.eveShifts,
        mins:   s.eveMinutes,
        rate:   settings.rateEvening,
        pay:    s.evePay
      },
      {
        type:   'Night',
        color:  ShiftUtils.COLORS.night,
        shifts: s.nightShifts,
        mins:   s.nightMinutes,
        rate:   settings.rateNight,
        pay:    s.nightPay
      },
      {
        type:   'Weekend Diff',
        color:  '#E65100',
        shifts: s.weekendDiffShifts,
        mins:   null,
        rate:   `+$${(settings.rateWeekendDiff || 0).toFixed(2)}`,
        pay:    s.weekendDiffPay
      }
    ];

    const tbody = document.getElementById('pay-table-body');
    tbody.innerHTML = '';

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="shift-dot" style="background:${r.color}"></span>
          ${r.type}
        </td>
        <td class="text-center">${r.shifts || 0}</td>
        <td class="text-center">${r.mins !== null ? ShiftUtils.formatDuration(r.mins) : '—'}</td>
        <td class="text-center">${typeof r.rate === 'number' ? ShiftUtils.formatCurrency(r.rate) : r.rate}</td>
        <td class="text-end fw-semibold">${ShiftUtils.formatCurrency(r.pay)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Total row
    const tfoot = document.getElementById('pay-table-foot');
    tfoot.innerHTML = `
      <tr class="table-secondary fw-bold">
        <td>TOTAL</td>
        <td class="text-center">${s.shifts || 0}</td>
        <td class="text-center">${ShiftUtils.formatDuration(s.totalMinutes)}</td>
        <td class="text-center">—</td>
        <td class="text-end text-success">${ShiftUtils.formatCurrency(s.totalPay)}</td>
      </tr>`;
  }

  // ── Render YTD ────────────────────────────────────────────
  function renderYTD(shifts, year) {
    const completed = shifts.filter(s => !s.isActive);
    const totalShifts = completed.length;
    const totalMins   = completed.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
    const totalPay    = completed.reduce((sum, s) => sum + (s.grossPay     || 0), 0);

    const el = id => document.getElementById(id);
    if (el('ytd-year'))   el('ytd-year').textContent   = year;
    if (el('ytd-shifts')) el('ytd-shifts').textContent = totalShifts;
    if (el('ytd-hours'))  el('ytd-hours').textContent  = ShiftUtils.formatDuration(totalMins);
    if (el('ytd-pay'))    el('ytd-pay').textContent    = ShiftUtils.formatCurrency(totalPay);
  }

  // ── CSV Export ────────────────────────────────────────────
  async function exportCSV() {
    const settings   = window.appSettings || {};
    const name       = settings.userName    || 'Nurse';
    const employer   = settings.employerName || '';
    const weekEndStr = ShiftUtils.getWeekEnd(weekStartStr);
    const filename   = `NurseTime_Pay_${name}_${weekStartStr}.csv`;

    try {
      const summary = await DB.getWeeklySummary(weekStartStr, weekEndStr);
      const shifts  = await DB.getShiftsForRange(weekStartStr, weekEndStr);
      const wdRate  = settings.rateWeekendDiff || ShiftUtils.DEFAULTS.rateWeekendDiff;

      let csv = '';
      // Header
      csv += `NurseTime Pay Summary\n`;
      csv += `Nurse,${name}\n`;
      csv += `Employer,${employer}\n`;
      csv += `Week,${ShiftUtils.weekRangeLabel(weekStartStr)}\n\n`;

      // Summary table
      csv += `Shift Type,# Shifts,Hours,Rate/hr,Gross Pay\n`;
      csv += `Day,${summary.dayShifts},${(summary.dayMinutes/60).toFixed(2)},${(settings.rateDay||0).toFixed(2)},${summary.dayPay.toFixed(2)}\n`;
      csv += `Evening,${summary.eveShifts},${(summary.eveMinutes/60).toFixed(2)},${(settings.rateEvening||0).toFixed(2)},${summary.evePay.toFixed(2)}\n`;
      csv += `Night,${summary.nightShifts},${(summary.nightMinutes/60).toFixed(2)},${(settings.rateNight||0).toFixed(2)},${summary.nightPay.toFixed(2)}\n`;
      csv += `Weekend Diff,${summary.weekendDiffShifts},—,+${wdRate.toFixed(2)},${summary.weekendDiffPay.toFixed(2)}\n`;
      csv += `TOTAL,${summary.shifts},${(summary.totalMinutes/60).toFixed(2)},—,${summary.totalPay.toFixed(2)}\n\n`;

      // Daily breakdown
      csv += `Date,Day,Shift Type,Clock In,Clock Out,Worked Hours,Break Minutes,Gross Pay\n`;
      shifts.filter(s => !s.isActive).forEach(sh => {
        const d = new Date(sh.date + 'T00:00:00');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        csv += `${sh.date},${dayName},${sh.shiftType},${sh.clockIn?.slice(0,5)||''},${sh.clockOut?.slice(0,5)||''},${(sh.totalMinutes/60).toFixed(2)},${sh.breakMinutes||0},${(sh.grossPay||0).toFixed(2)}\n`;
      });

      // YTD
      const year     = weekStartStr.slice(0, 4);
      const ytdShifts = await DB.getShiftsForRange(`${year}-01-01`, weekEndStr);
      const ytdComp   = ytdShifts.filter(s => !s.isActive);
      csv += `\nYear-to-Date (${year})\n`;
      csv += `Shifts,Hours,Gross Pay\n`;
      csv += `${ytdComp.length},${(ytdComp.reduce((s,x)=>s+(x.totalMinutes||0),0)/60).toFixed(2)},${ytdComp.reduce((s,x)=>s+(x.grossPay||0),0).toFixed(2)}\n`;

      ShiftUtils.downloadCSV(filename, csv);
    } catch (e) {
      console.error('Pay export error:', e);
    }
  }

  return { init };
})();
