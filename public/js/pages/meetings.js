const MEETING_COLORS = ['#7B6CF6','#E84393','#4A90D9','#1DB954','#F5A623','#00CEC9','#E74C3C','#636E72'];

let _allMeetings = [];
let _teamMembers = [];
let _calMonth = new Date().getMonth();
let _calYear = new Date().getFullYear();

window.Pages.meetings = async function() {
  const kpis = document.getElementById('meetings-kpis');
  if (kpis && !kpis.children.length) kpis.innerHTML = '<div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>';
  try {
    const [meetings, team] = await Promise.all([
      API.getMeetings(),
      API.request('GET', '/api/team/workload')
    ]);
    _allMeetings = meetings;
    _teamMembers = team;
    _calMonth = new Date().getMonth();
    _calYear = new Date().getFullYear();

    renderMeetingKPIs();
    renderCalendar();
    renderMeetingsList();
    renderLegend();
  } catch (err) {
    console.error('Error cargando reuniones:', err);
  }
};

function getUserColor(userId) {
  const idx = _teamMembers.findIndex(m => m.id === userId);
  return MEETING_COLORS[idx >= 0 ? idx % MEETING_COLORS.length : 0];
}

function getUserName(userId) {
  const m = _teamMembers.find(m => m.id === userId);
  return m ? m.name : '?';
}

function renderMeetingKPIs() {
  const el = document.getElementById('meetings-kpis');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todayCount = _allMeetings.filter(m => m.date === today).length;
  const weekCount = _allMeetings.filter(m => m.date >= today && m.date <= weekEnd).length;
  const monthCount = _allMeetings.filter(m => m.date.startsWith(thisMonth)).length;

  const kpis = [
    { label: t('meetings_total'), value: _allMeetings.length, color: '#7B6CF6' },
    { label: t('meetings_today'), value: todayCount, color: '#1DB954' },
    { label: t('meetings_this_week'), value: weekCount, color: '#4A90D9' },
    { label: t('meetings_this_month'), value: monthCount, color: '#F5A623' },
  ];

  el.innerHTML = kpis.map((k, i) => `
    <div class="dashboard-kpi" style="--kpi-accent:${k.color}; animation-delay:${i * 60}ms">
      <div class="kpi-top">
        <div>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderCalendar() {
  const monthLabel = document.getElementById('cal-month-label');
  const grid = document.getElementById('cal-grid');
  const weekdays = document.getElementById('cal-weekdays');
  if (!grid) return;

  const locale = getDateLocale();
  const monthName = new Date(_calYear, _calMonth, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Weekday headers
  const dayNames = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, i + 1); // Mon=1 Jan 2024
    dayNames.push(d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2).toUpperCase());
  }
  weekdays.innerHTML = dayNames.map(d => `<div class="cal-weekday">${d}</div>`).join('');

  // Calendar days
  const firstDay = new Date(_calYear, _calMonth, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  // Build meeting map for this month
  const meetingMap = {};
  _allMeetings.forEach(m => {
    if (!meetingMap[m.date]) meetingMap[m.date] = [];
    meetingMap[m.date].push(m);
  });

  let html = '';
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayMeetings = meetingMap[dateStr] || [];
    const isToday = dateStr === today;

    const dots = dayMeetings.slice(0, 4).map(m =>
      `<span class="cal-dot" style="background:${getUserColor(m.user_id)}"></span>`
    ).join('');

    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${dayMeetings.length ? 'has-meetings' : ''}" data-date="${dateStr}">
        <span class="cal-day-num">${d}</span>
        ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
        ${dayMeetings.length > 0 ? `<span class="cal-day-count">${dayMeetings.length}</span>` : ''}
      </div>
    `;
  }

  grid.innerHTML = html;

  // Click to filter
  grid.querySelectorAll('.cal-day:not(.empty)').forEach(day => {
    day.onclick = () => {
      grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
      const date = day.dataset.date;
      const filtered = _allMeetings.filter(m => m.date === date);
      renderMeetingsList(filtered, date);
    };
  });
}

function renderLegend() {
  const el = document.getElementById('cal-legend');
  if (!el) return;
  const usersWithMeetings = new Set(_allMeetings.map(m => m.user_id));
  el.innerHTML = _teamMembers
    .filter(m => usersWithMeetings.has(m.id))
    .map(m => `<div class="cal-legend-item"><span class="cal-legend-dot" style="background:${getUserColor(m.id)}"></span>${esc(m.name)}</div>`)
    .join('');
}

function renderMeetingsList(meetings, dateFilter) {
  const container = document.getElementById('meetings-list');
  const titleEl = document.getElementById('meetings-list-title');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const list = meetings || _allMeetings.filter(m => m.date >= today).slice(0, 15);

  if (dateFilter) {
    const d = new Date(dateFilter + 'T12:00:00');
    titleEl.textContent = d.toLocaleDateString(getDateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  } else {
    titleEl.textContent = t('meetings_upcoming');
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:30px"><div class="icon">📅</div><p>${t('meetings_empty')}</p></div>`;
    return;
  }

  container.innerHTML = list.map((m, i) => {
    const color = getUserColor(m.user_id);
    const time = m.time_start ? `${m.time_start.slice(0,5)}${m.time_end ? ' - ' + m.time_end.slice(0,5) : ''}` : '';
    const dateLabel = new Date(m.date + 'T12:00:00').toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' });
    const attendeeNames = (m.attendees || []).map(id => getUserName(id)).filter(n => n !== '?');

    return `
    <div class="meeting-item" style="--meeting-color:${color}; animation-delay:${i * 40}ms">
      <div class="meeting-accent" style="background:${color}"></div>
      <div class="meeting-body">
        <div class="meeting-header">
          <strong>${esc(m.title)}</strong>
          <button class="meeting-delete-btn" onclick="event.stopPropagation();Pages.meetings.delete(${m.id})" title="${t('delete')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="meeting-meta">
          <span class="meeting-date-tag">📅 ${dateLabel}</span>
          ${time ? `<span class="meeting-time-tag">🕐 ${time}</span>` : ''}
        </div>
        <div class="meeting-footer">
          <div class="meeting-organizer">
            <span class="meeting-avatar" style="background:${color}">${getUserName(m.user_id).charAt(0)}</span>
            ${esc(m.user_name || getUserName(m.user_id))}
          </div>
          ${attendeeNames.length ? `<div class="meeting-attendees">${attendeeNames.map(n => `<span class="meeting-avatar-sm">${n.charAt(0)}</span>`).join('')} +${attendeeNames.length}</div>` : ''}
        </div>
        ${m.description ? `<div class="meeting-desc">${esc(m.description)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.Pages.meetings.prevMonth = function() {
  _calMonth--;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  renderCalendar();
};

window.Pages.meetings.nextMonth = function() {
  _calMonth++;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  renderCalendar();
};

window.Pages.meetings.delete = async function(id) {
  if (!confirm(t('confirm_delete'))) return;
  await API.deleteMeeting(id);
  clearCache('/api/meetings');
  _allMeetings = await API.getMeetings();
  renderMeetingKPIs();
  renderCalendar();
  renderMeetingsList();
  showToast(t('meetings_deleted'));
};

function setupTimeInput(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/[^0-9]/g, '');
    if (v.length >= 2) v = v.slice(0, 2) + ':' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5);
    input.value = v;
  });
  input.addEventListener('blur', () => {
    const parts = input.value.split(':');
    if (parts.length === 2) {
      let h = parseInt(parts[0]) || 0;
      let m = parseInt(parts[1]) || 0;
      if (h > 23) h = 23;
      if (m > 59) m = 59;
      input.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
  });
}

window.Pages.meetings.openNew = async function() {
  if (!_teamMembers.length) {
    _teamMembers = await API.request('GET', '/api/team/workload');
  }

  // Attendees picker
  const picker = document.getElementById('meeting-attendees-picker');
  picker.innerHTML = _teamMembers.map(m => {
    const color = getUserColor(m.id);
    return `<label class="attendee-chip" style="--chip-color:${color}">
      <input type="checkbox" value="${m.id}"> <span class="attendee-avatar" style="background:${color}">${m.name.charAt(0)}</span> ${esc(m.name)}
    </label>`;
  }).join('');

  document.getElementById('form-meeting').reset();
  document.getElementById('modal-meeting').classList.add('active');
  initDatePickers(document.getElementById('modal-meeting'));
  setupTimeInput(document.getElementById('meeting-time-start'));
  setupTimeInput(document.getElementById('meeting-time-end'));

  document.getElementById('form-meeting').onsubmit = async (e) => {
    e.preventDefault();
    const attendees = Array.from(picker.querySelectorAll('input:checked')).map(i => parseInt(i.value));
    await API.createMeeting({
      title: document.getElementById('meeting-title').value,
      date: document.getElementById('meeting-date').value,
      time_start: document.getElementById('meeting-time-start').value || null,
      time_end: document.getElementById('meeting-time-end').value || null,
      description: document.getElementById('meeting-description').value,
      attendees,
    });
    document.getElementById('modal-meeting').classList.remove('active');
    clearCache('/api/meetings');
    window.Pages.meetings();
    showToast(t('meetings_created'));
  };
};
