// SyncScript Dashboard Interactivity & Rhythm Engine
let timerSeconds = 25 * 60;
let timerInterval = null;
let isTimerRunning = false;

function toggleTimer() {
  const btn = document.getElementById('timer-toggle-btn');
  if (isTimerRunning) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    if (btn) btn.textContent = 'Resume Focus';
  } else {
    isTimerRunning = true;
    if (btn) btn.textContent = 'Pause';
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
        renderTimer();
      } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        alert('Focus block complete! Great work.');
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerSeconds = 25 * 60;
  renderTimer();
  const btn = document.getElementById('timer-toggle-btn');
  if (btn) btn.textContent = 'Start Focus';
}

function renderTimer() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  display.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function updateTaskProgress(checkbox) {
  const label = checkbox.closest('.check-item');
  if (label) {
    if (checkbox.checked) label.classList.add('checked');
    else label.classList.remove('checked');
  }
  const allChecks = document.querySelectorAll('#task-checklist input[type="checkbox"]');
  const checked = document.querySelectorAll('#task-checklist input[type="checkbox"]:checked');
  const countBadge = document.getElementById('completed-count');
  const taskMetric = document.getElementById('task-metric');
  const progressBar = document.getElementById('task-progress-bar');
  if (countBadge) countBadge.textContent = checked.length + '/' + allChecks.length + ' Done';
  if (taskMetric) taskMetric.textContent = (11 + checked.length) + ' / 18';
  if (progressBar) progressBar.style.width = Math.round(((11 + checked.length) / 18) * 100) + '%';
}

function navigateTab(tabId, el) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (el) el.classList.add('active');
}

function triggerQuickAction() {
  const title = prompt('Enter Focus Block Title:');
  if (title) {
    alert('Scheduled 90m high-energy block: "' + title + '"');
  }
}
