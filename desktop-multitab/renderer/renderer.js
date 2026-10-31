const statusText = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');
const spinner = document.getElementById('spinner');
const actionButtons = document.getElementById('action-buttons');
const closeBtn = document.getElementById('close-btn');
const retryBtn = document.getElementById('retry-btn');
const titlebarClose = document.getElementById('titlebar-close');
// Live log console removed for streamlined UI



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
  }
});

function triggerClose() {
  if (window.electronAPI) {
    if (typeof window.electronAPI.closeApp === 'function') {
      window.electronAPI.closeApp();
    } else if (typeof window.electronAPI.closeWindow === 'function') {
      window.electronAPI.closeWindow();
    }
  } else {
    window.close();
  }
}

if (closeBtn) {
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    triggerClose();
  });
}

if (titlebarClose) {
  titlebarClose.addEventListener('click', (e) => {
    e.preventDefault();
    triggerClose();
  });
}

if (retryBtn) {
  retryBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideButtons();
    spinner.classList.remove('hidden');
    statusText.textContent = '⏳ Retrying Launch...';
    statusDetail.textContent = 'Re-establishing session...';
    statusDetail.className = '';
    if (window.electronAPI) {
      if (typeof window.electronAPI.retrySession === 'function') {
        window.electronAPI.retrySession();
      } else if (typeof window.electronAPI.retryLaunch === 'function') {
        window.electronAPI.retryLaunch();
      }
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    triggerClose();
  }
});
