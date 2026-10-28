const statusText = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');
const spinner = document.getElementById('spinner');
const actionButtons = document.getElementById('action-buttons');
const closeBtn = document.getElementById('close-btn');
const retryBtn = document.getElementById('retry-btn');
const logConsole = document.getElementById('log-console');
const toggleLogBtn = document.getElementById('toggle-log-btn');

const ICONS = {
  connecting: '🔗',
  downloading: '⬇️',
  extracting: '📦',
  launching: '🚀',
  success: '✅',
  error: '❌',
  idle: '⏳',
};

function hideButtons() {
  actionButtons.classList.add('hidden');
}

if (toggleLogBtn && logConsole) {
  toggleLogBtn.addEventListener('click', () => {
    if (logConsole.classList.contains('hidden')) {
      logConsole.classList.remove('hidden');
      toggleLogBtn.textContent = 'Hide';
    } else {
      logConsole.classList.add('hidden');
      toggleLogBtn.textContent = 'Show';
    }
  });
}

function appendLogLine(text) {
  if (!logConsole) return;
  const lineEl = document.createElement('div');
  lineEl.className = 'log-line';
  if (text.includes('[COOKIE]')) lineEl.classList.add('cookie');
  else if (text.includes('[NAV]') || text.includes('[TAB]')) lineEl.classList.add('nav');
  else if (text.includes('[SUCCESS]') || text.includes('Success')) lineEl.classList.add('success');
  else if (text.includes('[ERROR]') || text.includes('Error') || text.includes('failed')) lineEl.classList.add('error');
  else if (text.includes('[WARN]')) lineEl.classList.add('warn');
  else lineEl.classList.add('info');

  lineEl.textContent = text;
  logConsole.appendChild(lineEl);
  logConsole.scrollTop = logConsole.scrollHeight;
}

if (window.electronAPI && window.electronAPI.onSessionLog) {
  window.electronAPI.onSessionLog((data) => {
    appendLogLine(data.text || data);
  });
}

window.electronAPI.onSessionStatus(({ status, detail }) => {
  const icon = ICONS[status] || '';

  switch (status) {
    case 'connecting':
      hideButtons();
      spinner.classList.remove('hidden');
      statusText.textContent = `${icon} Validating Session`;
      statusDetail.textContent = detail || '';
      statusDetail.className = '';
      break;

    case 'downloading':
      hideButtons();
      spinner.classList.remove('hidden');
      statusText.textContent = `${icon} Downloading Profile`;
      statusDetail.textContent = detail || '';
      statusDetail.className = '';
      break;

    case 'extracting':
      hideButtons();
      spinner.classList.remove('hidden');
      statusText.textContent = `${icon} Extracting Profile`;
      statusDetail.textContent = detail || '';
      statusDetail.className = '';
      break;

    case 'launching':
      hideButtons();
      spinner.classList.remove('hidden');
      statusText.textContent = `${icon} Launching Browser`;
      statusDetail.textContent = detail || '';
      statusDetail.className = '';
      break;

    case 'success':
      spinner.classList.add('hidden');
      statusText.textContent = `${ICONS.success} Success!`;
      statusDetail.textContent = detail || 'Session opened successfully';
      statusDetail.className = 'success';
      actionButtons.classList.remove('hidden');
      closeBtn.textContent = 'Close';
      retryBtn.classList.add('hidden');
      break;

    case 'error':
      spinner.classList.add('hidden');
      statusText.textContent = `${ICONS.error} Error`;
      statusDetail.textContent = detail || 'An unexpected error occurred';
      statusDetail.className = 'error';
      actionButtons.classList.remove('hidden');
      closeBtn.textContent = 'Close';
      retryBtn.classList.remove('hidden');
      break;

    case 'idle':
      hideButtons();
      spinner.classList.remove('hidden');
      statusText.textContent = '⏳ Waiting for Session';
      statusDetail.textContent = detail || 'Click "Open Session" in the WebFixx dashboard';
      statusDetail.className = '';
      break;

    default:
      statusText.textContent = detail || status;
      break;
  }
});

closeBtn.addEventListener('click', () => window.electronAPI.closeApp());
retryBtn.addEventListener('click', () => window.electronAPI.retrySession());
