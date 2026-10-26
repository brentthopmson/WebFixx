const statusText = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');
const spinner = document.getElementById('spinner');
const actionButtons = document.getElementById('action-buttons');
const closeBtn = document.getElementById('close-btn');
const retryBtn = document.getElementById('retry-btn');

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
