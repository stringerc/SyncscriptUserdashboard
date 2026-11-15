// Interactive Scripts for NexusVoice
console.log('⚡ [Live Sandbox] Booted: NexusVoice');

function triggerInteractiveDemo() {
  const consoleBox = document.getElementById('console-output');
  if (!consoleBox) return;
  const line = document.createElement('div');
  line.className = 'console-line';
  line.style.color = '#10b981';
  line.textContent = '→ dispatch :: user trigger at ' + new Date().toLocaleTimeString();
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function runSimulatedTask() {
  const consoleBox = document.getElementById('console-output');
  const metric = document.getElementById('metric-latency');
  if (metric) {
    const nextLatency = (Math.random() * 2 + 3.1).toFixed(1) + 'ms';
    metric.textContent = nextLatency;
  }
  if (!consoleBox) return;
  const steps = [
    'attending :: parsing neural state vector...',
    'integrating :: phi calculated at 1.28 (+0.04)',
    'executing :: closed-loop sensorimotor confirmed'
  ];
  steps.forEach((msg, idx) => {
    setTimeout(() => {
      const line = document.createElement('div');
      line.className = 'console-line';
      line.textContent = '» ' + msg;
      consoleBox.appendChild(line);
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }, idx * 300);
  });
}

function switchTab(tabName) {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(b => b.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }
  const consoleBox = document.getElementById('console-output');
  if (consoleBox) {
    const line = document.createElement('div');
    line.className = 'console-line';
    line.style.color = '#c084fc';
    line.textContent = 'tab :: switched to ' + tabName;
    consoleBox.appendChild(line);
  }
}
