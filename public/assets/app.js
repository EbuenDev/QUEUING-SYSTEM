let state = {
  patients: [],
  nextQueueNumber: 1,
  consultationHistory: [],
  messages: [],
  unreadCount: 0,
  prescriptions: [],
  videoConfig: {
    id: 1,
    playlistId: '',
    playlistTitle: '',
    playlistUrl: '',
    isEnabled: false,
    updatedAt: null,
    updatedBy: null
  },
};

let updateChannel = null;
let lastNotificationId = 0;
let notificationAudio = null;

// Doctor notification state
let doctorNotificationState = {
  previousPatientCount: 0,
  isNotificationVisible: false,
  notificationElement: null,
  soundElement: null,
  autoHideTimeout: null
};

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

const DOCTOR_CREDENTIALS = {
  username: 'doctor',
  password: 'doctor123',
};

// Doctor notification functions
function initDoctorNotification() {
  const notification = document.getElementById('doctor-notification');
  const closeBtn = document.getElementById('notification-close');
  const messageElement = document.getElementById('notification-message');

  if (notification) {
    doctorNotificationState.notificationElement = notification;
    doctorNotificationState.previousPatientCount = state.patients.length;
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', hideDoctorNotification);
  }

  // Create audio element for sound effect
  doctorNotificationState.soundElement = new Audio('assets/sounds/sound-9.mp3');
  doctorNotificationState.soundElement.volume = 0.5; // Set volume to 50%
}

function showDoctorNotification(patientName, queueNumber) {
  if (!doctorNotificationState.notificationElement || doctorNotificationState.isNotificationVisible) {
    return;
  }

  const messageElement = document.getElementById('notification-message');
  if (messageElement) {
    messageElement.textContent = `Patient #${queueNumber} — ${patientName} has been added to the queue.`;
  }

  doctorNotificationState.notificationElement.classList.add('visible');
  doctorNotificationState.isNotificationVisible = true;

  // Play sound effect
  if (doctorNotificationState.soundElement) {
    doctorNotificationState.soundElement.currentTime = 0;
    doctorNotificationState.soundElement.play().catch(error => {
      console.warn('Unable to play notification sound:', error);
    });
  }

  // Clear any existing auto-hide timeout
  if (doctorNotificationState.autoHideTimeout) {
    clearTimeout(doctorNotificationState.autoHideTimeout);
  }

  // Auto-hide after 10 seconds
  doctorNotificationState.autoHideTimeout = setTimeout(() => {
    hideDoctorNotification();
  }, 10000);
}

function hideDoctorNotification() {
  if (!doctorNotificationState.notificationElement) {
    return;
  }

  // Clear auto-hide timeout if exists
  if (doctorNotificationState.autoHideTimeout) {
    clearTimeout(doctorNotificationState.autoHideTimeout);
    doctorNotificationState.autoHideTimeout = null;
  }

  doctorNotificationState.notificationElement.classList.remove('visible');
  doctorNotificationState.isNotificationVisible = false;
}

function checkForNewPatients() {
  if (!isDoctorAuthenticated() || !doctorNotificationState.notificationElement) {
    return;
  }

  const currentPatientCount = state.patients.length;

  // Check if new patients were added (count increased)
  if (currentPatientCount > doctorNotificationState.previousPatientCount) {
    const newPatientsCount = currentPatientCount - doctorNotificationState.previousPatientCount;

    // Get the most recently added patient(s)
    const newPatients = state.patients.slice(-newPatientsCount);

    // Show notification for new patients (only if notification isn't already visible)
    if (!doctorNotificationState.isNotificationVisible && newPatients.length > 0) {
      // Show notification for the most recent patient
      const latestPatient = newPatients[newPatients.length - 1];
      showDoctorNotification(latestPatient.name, latestPatient.queueNumber);
    }
  }

  // Update the previous count
  doctorNotificationState.previousPatientCount = currentPatientCount;
}

function isAdminAuthenticated() {
  try {
    return sessionStorage.getItem('queue-admin-auth') === 'true';
  } catch (error) {
    console.warn('Unable to read admin auth state', error);
    return false;
  }
}

function isDoctorAuthenticated() {
  try {
    return sessionStorage.getItem('queue-doctor-auth') === 'true';
  } catch (error) {
    console.warn('Unable to read doctor auth state', error);
    return false;
  }
}

//This function sets the authentication state of the admin user in sessionStorage. It allows the application to remember whether the admin is logged in or not across page reloads within the same session.
function setAdminAuthenticated(isAuthenticated) {
  try {
    if (isAuthenticated) {
      sessionStorage.setItem('queue-admin-auth', 'true');
    } else {
      sessionStorage.removeItem('queue-admin-auth');
    }
  } catch (error) {
    console.warn('Unable to persist admin auth state', error);
  }
}

function setDoctorAuthenticated(isAuthenticated) {
  try {
    if (isAuthenticated) {
      sessionStorage.setItem('queue-doctor-auth', 'true');
    } else {
      sessionStorage.removeItem('queue-doctor-auth');
      // Reset notification state on logout
      doctorNotificationState.previousPatientCount = 0;
      hideDoctorNotification();
    }
  } catch (error) {
    console.warn('Unable to persist doctor auth state', error);
  }
}

//This function updates the visibility of the admin login form, admin panel, and logout button based on the authentication state of the admin user. It ensures that only authenticated users can access the admin functionalities.
function setAdminView(isAuthenticated) {
  const loginCard = document.getElementById('login-card');
  const adminPanel = document.getElementById('admin-panel');
  const logoutButton = document.getElementById('logout-btn');
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const messageBtn = document.getElementById('message-btn');
  const adminSidebar = document.querySelector('.admin-sidebar');
  const menuLogout = document.getElementById('menu-logout');

  if (loginCard) {
    loginCard.hidden = isAuthenticated;
  }

  if (adminPanel) {
    adminPanel.hidden = !isAuthenticated;
  }

  if (adminSidebar) {
    adminSidebar.hidden = !isAuthenticated;
  }

  if (logoutButton) {
    logoutButton.hidden = !isAuthenticated;
  }

  if (menuLogout) {
    menuLogout.hidden = !isAuthenticated;
  }

  if (hamburgerBtn) {
    hamburgerBtn.hidden = !isAuthenticated;
  }

  if (hamburgerMenu) {
    hamburgerMenu.hidden = true;
  }

  if (messageBtn) {
    messageBtn.hidden = !isAuthenticated;
  }
}

function setDoctorView(isAuthenticated) {
  const loginCard = document.getElementById('doctor-login-card');
  const doctorPanel = document.getElementById('doctor-panel');
  const logoutButton = document.getElementById('doctor-logout-btn');
  const mainBoard = document.getElementById('doctor-main-board');
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const messageBtn = document.getElementById('message-btn');
  const doctorSidebar = document.querySelector('.admin-sidebar');
  const menuLogout = document.getElementById('menu-logout');

  if (loginCard) {
    loginCard.hidden = isAuthenticated;
  }

  if (doctorPanel) {
    doctorPanel.hidden = !isAuthenticated;
  }

  if (doctorSidebar) {
    doctorSidebar.hidden = !isAuthenticated;
  }

  if (menuLogout) {
    menuLogout.hidden = !isAuthenticated;
  }

  if (logoutButton) {
    logoutButton.hidden = !isAuthenticated;
  }

  if (hamburgerBtn) {
    hamburgerBtn.hidden = !isAuthenticated;
  }

  if (hamburgerMenu) {
    hamburgerMenu.hidden = true;
  }

  if (messageBtn) {
    messageBtn.hidden = !isAuthenticated;
  }

  if (mainBoard) {
    if (!isAuthenticated) {
      mainBoard.classList.add('centered');
    } else {
      mainBoard.classList.remove('centered');
    }
  }
}

function showAdminLoginError(message) {
  const loginError = document.getElementById('login-error');
  if (loginError) {
    loginError.textContent = message;
  }
}

function showDoctorLoginError(message) {
  const loginError = document.getElementById('doctor-login-error');
  if (loginError) {
    loginError.textContent = message;
  }
}

//This function broadcasts the current state of the queue to other browser tabs or windows using the BroadcastChannel API and localStorage. It ensures that all instances of the application stay in sync with the latest queue state.
function broadcastState(nextState) {
  if (updateChannel) {
    updateChannel.postMessage({ type: 'queue-state-update', state: nextState });
  }

  try {
    const payload = { state: nextState, timestamp: Date.now() };
    localStorage.setItem('queue-state-sync', JSON.stringify(payload));
    localStorage.setItem('queue-state-event', String(payload.timestamp));
  } catch (error) {
    console.warn('Unable to broadcast queue state', error);
  }
}

// Track last processed remote command sequence to avoid duplicate executions
let lastProcessedCommandSeq = 0;
let isInitialStateFetched = false;
let heartbeatWorker = null;

function startHeartbeat(callback, intervalMs = 1000) {
  try {
    const workerBlob = new Blob([
      `setInterval(() => { postMessage('tick'); }, ${intervalMs});`
    ], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    heartbeatWorker = new Worker(workerUrl);
    heartbeatWorker.onmessage = () => {
      try { callback(); } catch (err) { console.warn('Heartbeat callback error:', err); }
    };
  } catch (err) {
    console.warn('Web Worker heartbeat unavailable, falling back to setInterval:', err);
    setInterval(callback, intervalMs);
  }
}

function processIncomingVideoCommand(payload) {
  if (!payload || !payload.command) return;
  const seq = Number(payload.seq) || 0;
  if (seq && seq <= lastProcessedCommandSeq) {
    return; // Already processed!
  }
  if (seq) {
    lastProcessedCommandSeq = seq;
  }
  handleRemoteVideoCommand(payload.command, payload.videoConfig);
}

// Broadcasts real-time video playback commands (play, stop, pause, resume, next, prev, unmute)
function broadcastVideoCommand(command, videoConfig = null, seq = null) {
  const currentSeq = seq || Date.now();
  const payload = {
    type: 'video-command',
    command,
    seq: currentSeq,
    videoConfig: videoConfig || state.videoConfig,
    timestamp: Date.now()
  };

  if (updateChannel) {
    try {
      updateChannel.postMessage(payload);
    } catch (e) {
      console.warn('Unable to post message on updateChannel', e);
    }
  }

  try {
    localStorage.setItem('queue-video-command', JSON.stringify(payload));
    localStorage.setItem('queue-video-event', String(payload.timestamp));
  } catch (error) {
    console.warn('Unable to broadcast video command to storage', error);
  }
}

//This function initializes real-time synchronization of the queue state across multiple browser tabs or windows. It uses the BroadcastChannel API if available, and also listens for changes in localStorage to update the state accordingly.
function initRealtimeSync() {
  if (typeof BroadcastChannel !== 'undefined') {
    updateChannel = new BroadcastChannel('queue-system-sync');
    updateChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'queue-state-update' && event.data.state) {
        state = event.data.state;
        render();
        checkForNewPatients();
        if (document.body.classList.contains('waiting-room')) {
          updateYouTubePlayer();
          if (state.videoConfig && state.videoConfig.commandSeq && state.videoConfig.commandSeq > lastProcessedCommandSeq) {
            processIncomingVideoCommand({
              command: state.videoConfig.lastCommand,
              seq: state.videoConfig.commandSeq,
              videoConfig: state.videoConfig
            });
          }
        }
      } else if (event.data?.type === 'video-command') {
        processIncomingVideoCommand(event.data);
      } else if (event.data?.type === 'yakap-prescriptions-update') {
        if (Array.isArray(event.data.prescriptions)) {
          syncPrescriptionsFromBackend(event.data.prescriptions);
        }
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'rhu-prescriptions-sync' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        if (Array.isArray(payload?.prescriptions)) {
          syncPrescriptionsFromBackend(payload.prescriptions);
        }
      } catch (e) {
        console.warn('Error syncing prescriptions from storage', e);
      }
      return;
    }

    if (event.key === 'queue-video-command' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        processIncomingVideoCommand(payload);
      } catch (e) {
        console.warn('Error parsing storage video command', e);
      }
      return;
    }

    if (event.key !== 'queue-state-sync' && event.key !== 'queue-state-event') {
      return;
    }

    if (event.key === 'queue-state-sync' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        if (payload?.state) {
          state = payload.state;
          render();
          checkForNewPatients();
          if (document.body.classList.contains('waiting-room')) {
            updateYouTubePlayer();
            if (state.videoConfig && state.videoConfig.commandSeq && state.videoConfig.commandSeq > lastProcessedCommandSeq) {
              processIncomingVideoCommand({
                command: state.videoConfig.lastCommand,
                seq: state.videoConfig.commandSeq,
                videoConfig: state.videoConfig
              });
            }
          }
        }
      } catch (error) {
        console.warn('Unable to sync queue state from storage', error);
      }
    }
  });

  // Initial fetch
  fetchState();

  // Set up unthrottled Web Worker heartbeat polling for LAN sync across computers
  // Bypasses Chrome background-tab 60s throttling so remote waiting rooms react instantly
  startHeartbeat(() => {
    const isWaitingRoom = document.body.classList.contains('waiting-room');
    if (!document.hidden || isWaitingRoom) {
      fetchState();
      pollNotifications();
    }
  }, 1000);

  // Scheduled polling for background message notifications (when popup is closed)
  setInterval(() => {
    if (!document.hidden && (isAdminAuthenticated() || isDoctorAuthenticated())) {
      const popup = document.getElementById('message-popup');
      if (!popup || popup.hidden) {
        pollMessages();
      }
    }
  }, 1500);
}

function applyNewQueueState(newState) {
  if (!newState || typeof newState !== 'object') return;
  const currentMessages = Array.isArray(state?.messages) ? state.messages : [];
  const currentUnread = typeof state?.unreadCount === 'number' ? state.unreadCount : 0;
  const currentPrescriptions = Array.isArray(state?.prescriptions) ? state.prescriptions : [];
  state = {
    ...newState,
    messages: currentMessages,
    unreadCount: currentUnread,
    prescriptions: Array.isArray(newState.prescriptions) ? newState.prescriptions : currentPrescriptions
  };
}

//This function fetches the current state of the queue from the backend API and updates the local state accordingly. It also handles any errors that may occur during the fetch operation.
async function fetchState() {
  try {
    const userRole = getCurrentUserRole();
    const roleParam = userRole ? `&role=${encodeURIComponent(userRole)}` : '';
    const apiUrl = `${getBackendApiUrl()}?_t=${Date.now()}${roleParam}`;
    const response = await fetch(apiUrl, { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (data?.success && data.state) {
      applyNewQueueState(data.state);
      syncMessagesFromBackend(data.messages || [], data.unreadCount || 0);
      if (Array.isArray(data.prescriptions)) {
        syncPrescriptionsFromBackend(data.prescriptions);
      }
      render();
      checkForNewPatients();
      updateMessageBadge();

      // Synchronize waiting room video player with latest database state and remote commands
      if (document.body.classList.contains('waiting-room')) {
        updateYouTubePlayer();
        const cfg = state.videoConfig;
        if (cfg) {
          const cfgSeq = Number(cfg.commandSeq) || 0;
          if (!isInitialStateFetched) {
            isInitialStateFetched = true;
            lastProcessedCommandSeq = cfgSeq;
            if (cfg.isPaused) {
              handleRemoteVideoCommand('pause', cfg);
            }
          } else if (cfgSeq > lastProcessedCommandSeq) {
            processIncomingVideoCommand({
              command: cfg.lastCommand,
              seq: cfgSeq,
              videoConfig: cfg
            });
          } else if (cfg.isPaused) {
            // State enforcement: if database state indicates pause, keep player paused
            postToPlayerIframe('pauseVideo');
          }
        }
      }

      // Sync admin remote pause button state across all admin sessions
      if (document.body.classList.contains('admin-body') && state.videoConfig) {
        updateRemotePauseUI(Boolean(state.videoConfig.isPaused));
      }
    }
  } catch (error) {
    console.error('Unable to load queue state', error);
  }
}

//This function sends a POST request to the backend API with the specified action and payload. It updates the local state based on the response and handles any errors that may occur during the request.
async function postAction(action, payload = {}) {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
//This is to handle the case where the user is not authenticated
    const data = await response.json();
    if (response.status === 401) {
      setAdminAuthenticated(false);
      setAdminView(false);
      showAdminLoginError('Your session has expired. Please log in again.');
      setDoctorAuthenticated(false);
      setDoctorView(false);
      showDoctorLoginError('Your session has expired. Please log in again.');
      return;
    }

    //this is to ensure that the state is updated after any action is performed, and the UI reflects the latest state.
    if (data?.success && data.state) {
      applyNewQueueState(data.state);
      render();
      broadcastState(data.state);
      checkForNewPatients();
      await fetchState();
    }
  } catch (error) {
    console.error('Unable to update queue state', error);
  }
}

// this function simulates an admin login by checking against hardcoded credentials.
async function loginAdmin(username, password) {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'login', username, password }),
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const data = await response.json();
    if (response.ok && data?.success) {
      setAdminAuthenticated(true);
      setAdminView(true);
      fetchState();
      window.location.reload();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Unable to login as admin', error);
    return false;
  }
}

function getBackendApiUrl() {
  const path = window.location.pathname;
  const projectMatch = path.match(/^(\/[^\/]+)?\/public\//i);
  if (projectMatch && projectMatch[1]) {
    return `${projectMatch[1]}/backend/api_postgres.php`;
  }
  if (path.includes('/public/')) {
    return '../backend/api_postgres.php';
  }
  return '/backend/api_postgres.php';
}

function ensureLogoutModal() {
  let modal = document.getElementById('logout-confirm-modal');
  if (modal) {
    return modal;
  }

  modal = document.createElement('div');
  modal.id = 'logout-confirm-modal';
  modal.className = 'modern-modal-overlay';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modern-modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
      <div class="modern-modal-icon-wrapper">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
      </div>
      <div class="modern-modal-content">
        <h3 id="logout-modal-title">Confirm Logout</h3>
        <p>Are you sure you want to end your session? You will need to enter your credentials to log in again.</p>
      </div>
      <div class="modern-modal-actions">
        <button id="cancel-logout-btn" type="button" class="modal-btn modal-btn-cancel">
          Cancel
        </button>
        <button id="confirm-logout-btn" type="button" class="modal-btn modal-btn-confirm">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>Log Out</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openLogoutModal(onConfirm) {
  const modal = ensureLogoutModal();
  const cancelBtn = modal.querySelector('#cancel-logout-btn');
  const confirmBtn = modal.querySelector('#confirm-logout-btn');

  // Reset button states
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i><span>Log Out</span>';
  }
  if (cancelBtn) {
    cancelBtn.disabled = false;
  }

  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (cancelBtn) {
      cancelBtn.focus();
    }
  });

  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      modal.hidden = true;
    }, 250);
    cleanup();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };

  const onCancelClick = (e) => {
    e.preventDefault();
    closeModal();
  };

  const onConfirmClick = async (e) => {
    e.preventDefault();
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Logging out...</span>';
    }
    if (cancelBtn) {
      cancelBtn.disabled = true;
    }

    if (typeof onConfirm === 'function') {
      try {
        await onConfirm();
      } catch (err) {
        console.error('Logout error:', err);
        closeModal();
      }
    }
  };

  function cleanup() {
    document.removeEventListener('keydown', handleKeydown);
    modal.removeEventListener('click', handleBackdropClick);
    if (cancelBtn) {
      cancelBtn.removeEventListener('click', onCancelClick);
    }
    if (confirmBtn) {
      confirmBtn.removeEventListener('click', onConfirmClick);
    }
  }

  document.addEventListener('keydown', handleKeydown);
  modal.addEventListener('click', handleBackdropClick);
  if (cancelBtn) {
    cancelBtn.addEventListener('click', onCancelClick, { once: true });
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', onConfirmClick, { once: true });
  }
}

async function logoutAdmin() {
  try {
    const apiUrl = getBackendApiUrl();
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'logout' }),
      cache: 'no-store',
    }).catch(err => {
      console.warn('Backend logout request failed, continuing local logout', err);
    });
  } catch (error) {
    console.error('Unable to log out from server', error);
  } finally {
    setAdminAuthenticated(false);
    setAdminView(false);
    try {
      sessionStorage.removeItem('queue-admin-auth');
    } catch (e) {
      console.warn('Unable to clear admin sessionStorage', e);
    }
    window.location.reload();
  }
}

async function loginDoctor(username, password) {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'doctor-login', username, password }),
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const data = await response.json();
    if (response.ok && data?.success) {
      setDoctorAuthenticated(true);
      setDoctorView(true);
      fetchState();
      window.location.reload();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Unable to login as doctor', error);
    return false;
  }
}

async function logoutDoctor() {
  try {
    const apiUrl = getBackendApiUrl();
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'doctor-logout' }),
      credentials: 'same-origin',
      cache: 'no-store',
    }).catch(err => {
      console.warn('Backend doctor logout failed, continuing local logout', err);
    });
  } catch (error) {
    console.error('Unable to log out as doctor', error);
  } finally {
    setDoctorAuthenticated(false);
    setDoctorView(false);
    try {
      sessionStorage.removeItem('queue-doctor-auth');
    } catch (e) {
      console.warn('Unable to clear doctor sessionStorage', e);
    }
    window.location.reload();
  }
}

async function pollNotifications() {
  if (!isDoctorAuthenticated()) {
    console.log('Polling skipped: Doctor not authenticated');
    return;
  }

  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'poll-notifications',
        lastNotificationId: lastNotificationId 
      }),
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const data = await response.json();
    console.log('Poll response:', data);
    
    if (data?.success && data.notifications && data.notifications.length > 0) {
      console.log('Found', data.notifications.length, 'new notifications');
      // Process new notifications
      data.notifications.forEach(notification => {
        showNotificationPopup(notification);
        playNotificationSound();
        
        // Update last notification ID
        if (notification.id > lastNotificationId) {
          lastNotificationId = notification.id;
        }
      });

      // Mark notifications as read
      const notificationIds = data.notifications.map(n => n.id);
      await markNotificationsAsRead(notificationIds);
    } else {
      console.log('No new notifications');
    }
  } catch (error) {
    console.error('Unable to poll notifications', error);
  }
}

async function markNotificationsAsRead(notificationIds) {
  try {
    const apiUrl = getBackendApiUrl();
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'mark-notifications-read',
        notificationIds: notificationIds 
      }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    console.error('Unable to mark notifications as read', error);
  }
}

function showNotificationPopup(notification) {
  // Create notification popup if it doesn't exist
  let popup = document.getElementById('notification-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'notification-popup';
    popup.className = 'card edit-modal notification-popup';
    popup.innerHTML = `
      <h3><i class="fa-solid fa-bell"></i> New Notification</h3>
      <div id="notification-content"></div>
      <div class="toolbar">
        <button type="button" id="close-notification-btn" class="btn btn-secondary">Close</button>
      </div>
    `;
    document.body.appendChild(popup);

    // Add close button handler
    document.getElementById('close-notification-btn').addEventListener('click', () => {
      popup.hidden = true;
    });
  }

  // Update content
  const content = document.getElementById('notification-content');
  const queueNumber = notification.queue_number ? `#${notification.queue_number}` : 'N/A';
  const patientName = notification.patient_name || 'Unknown';
  const message = notification.message || 'No message';
  const notificationType = notification.notification_type || 'notification';

  content.innerHTML = `
    <p><strong>Queue Number:</strong> ${queueNumber}</p>
    <p><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
    <p><strong>Type:</strong> ${escapeHtml(notificationType)}</p>
    <p><strong>Message:</strong> ${escapeHtml(message)}</p>
  `;

  // Show popup
  popup.hidden = false;
}

function playNotificationSound() {
  try {
    console.log('Attempting to play notification sound...');

    if (!notificationAudio) {
      notificationAudio = new Audio('/assets/sounds/sound-9.mp3');
      console.log('Created new Audio object for /assets/sounds/sound-9.mp3');
    }

    // Reset and play
    notificationAudio.currentTime = 0;
    notificationAudio.volume = 0.5;
    const playPromise = notificationAudio.play();

    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('✓ Sound played successfully');
      }).catch(error => {
        console.warn('✗ Unable to play notification sound:', error);
        console.log('Browser may require user interaction first. Try clicking anywhere on the page.');
      });
    }
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

function getCurrentServingPatient() {
  return state.patients.find((patient) => patient.status === 'serving') || null;
}

function getWaitingPatients() {
  return state.patients.filter((patient) => patient.status === 'waiting');
}

function getFollowUpPatients() {
  return state.patients.filter((patient) => patient.status === 'follow-up');
}

//This function renders the patient board, displaying the current serving patient, the next patient in line, and the waiting list. It updates the UI elements based on the current state of the queue.
function renderPatientBoard() {
  const isWaitingRoom = document.body.classList.contains('waiting-room');

  if (isWaitingRoom) {
    renderWaitingRoomDisplay();
  } else {
    renderClassicPatientBoard();
  }
}

function renderWaitingRoomDisplay() {
  const currentServing = document.getElementById('current-serving');
  const currentServingMessage = document.getElementById('current-serving-message');
  const nextPatient = document.getElementById('next-patient');
  const waitingList = document.getElementById('waiting-list');
  const queueCount = document.getElementById('queue-count');
  const followUpList = document.getElementById('followup-list');
  const followUpSection = document.getElementById('followup-section');
  const nowServingCard = document.querySelector('.now-serving-card');

  const servingPatient = getCurrentServingPatient();
  const nextPatientEntry = getWaitingPatients()[0] || null;
  const followUpPatients = getFollowUpPatients();

  // Toggle is-serving class on the card
  if (nowServingCard) {
    if (servingPatient) {
      nowServingCard.classList.add('is-serving');
    } else {
      nowServingCard.classList.remove('is-serving');
    }
  }

  // Render current serving
  if (servingPatient) {
    currentServing.innerHTML = `<span class="queue-number">#${servingPatient.queueNumber}</span><span class="patient-name">${escapeHtml(servingPatient.name)}</span>`;
    currentServingMessage.textContent = 'Please proceed to the doctor';
  } else if (state.patients.length > 0) {
    currentServing.innerHTML = '<span class="queue-number">---</span><span class="patient-name">Waiting</span>';
    currentServingMessage.textContent = 'Please wait for your turn';
  } else {
    currentServing.innerHTML = '<span class="queue-number">---</span><span class="patient-name">No patient</span>';
    currentServingMessage.textContent = 'Waiting for the first patient';
  }

  // Render next patient
  if (nextPatientEntry) {
    nextPatient.innerHTML = `<span class="queue-number">#${nextPatientEntry.queueNumber}</span><span class="patient-name">${escapeHtml(nextPatientEntry.name)}</span>`;
  } else {
    nextPatient.innerHTML = '<span class="queue-number">---</span><span class="patient-name">No patient</span>';
  }

  // Render queue count
  queueCount.textContent = `${getWaitingPatients().length} patients`;

  // Render waiting list (queue numbers and names for waiting room)
  if (getWaitingPatients().length === 0) {
    waitingList.innerHTML = '<li class="empty">No patients currently waiting</li>';
  } else {
    waitingList.innerHTML = getWaitingPatients()
      .map((patient) => `<li><span class="queue-number">#${patient.queueNumber}</span><span class="patient-name">${escapeHtml(patient.name)}</span></li>`)
      .join('');
  }

  // Render follow-up patients
  if (followUpSection && followUpList) {
    if (followUpPatients.length === 0) {
      followUpSection.hidden = true;
      followUpList.innerHTML = '';
    } else {
      followUpSection.hidden = false;
      followUpList.innerHTML = followUpPatients
        .map((patient) => `<li><span class="queue-number">#${patient.queueNumber}</span><span class="patient-name">${escapeHtml(patient.name)}</span></li>`)
        .join('');
    }
  }

  // Initialize YouTube player for waiting room
  initYouTubePlayer();
}

function renderClassicPatientBoard() {
  const currentServing = document.getElementById('current-serving');
  const currentServingHeading = document.getElementById('current-serving-heading');
  const currentServingName = document.getElementById('current-serving-name');
  const nextPatient = document.getElementById('next-patient');
  const waitingList = document.getElementById('waiting-list');
  const queueCount = document.getElementById('queue-count');
  const spotlightCard = document.querySelector('.spotlight');
  const followUpList = document.getElementById('followup-list');
  const followUpSection = document.getElementById('followup-section');

  const servingPatient = getCurrentServingPatient();
  const nextPatientEntry = getWaitingPatients()[0] || null;
  const followUpPatients = getFollowUpPatients();

  if (currentServingHeading) {
    currentServingHeading.hidden = !servingPatient;
  }

  if (spotlightCard) {
    spotlightCard.classList.toggle('is-serving', Boolean(servingPatient));
  }

  if (servingPatient) {
    currentServing.textContent = `#${servingPatient.queueNumber}`;
    currentServingName.textContent = servingPatient.name;
  } else if (state.patients.length > 0) {
    currentServing.textContent = 'Wait for the Doctors Doorbell';
    currentServingName.textContent = 'A patient is waiting to be called.';
  } else {
    currentServing.textContent = 'Waiting for the first patient';
    currentServingName.textContent = 'No patient is being served yet.';
  }

  if (nextPatientEntry) {
    nextPatient.textContent = `#${nextPatientEntry.queueNumber} — ${nextPatientEntry.name}`;
  } else {
    nextPatient.textContent = 'No queue yet';
  }

  queueCount.textContent = `${getWaitingPatients().length} patients`;

  if (getWaitingPatients().length === 0) {
    waitingList.innerHTML = '<li class="empty-state">The waiting list is empty.</li>';
  } else {
    waitingList.innerHTML = getWaitingPatients()
      .map(
        (patient) => {
          const patientType = patient.type || 'regular';
          return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
              <small>Waiting for service</small>
            </div>
            <div class="badge-group">
              <span class="badge waiting">Waiting</span>
              <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
            </div>
          </li>
        `;
        },
      )
      .join('');
  }

  // Render follow-up patients
  if (followUpSection && followUpList) {
    if (followUpPatients.length === 0) {
      followUpSection.hidden = true;
      followUpList.innerHTML = '';
    } else {
      followUpSection.hidden = false;
      followUpList.innerHTML = followUpPatients
        .map((patient) => {
          const isReady = (patient.followUpStatus || 'none') === 'ready_for_doctor';
          const statusText = isReady ? '✓ Ready for Doctor' : 'Waiting for Procedure';
          const reasonText = patient.followUpReason || 'Follow-up';
          return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
              <small>${escapeHtml(reasonText)}</small>
              <small>${statusText}</small>
            </div>
            <div class="badge-group">
              <span class="badge follow-up">Follow-up</span>
              ${isReady ? '<span class="badge ready">Ready</span>' : '<span class="badge waiting">Waiting</span>'}
            </div>
          </li>
        `;
        })
        .join('');
    }
  }
}


//This function renders the consultation history, displaying a list of completed consultations along with their queue numbers and names. It updates the UI elements based on the current state of the consultation history.
function renderConsultationHistory() {
  const historyList = document.getElementById('consultation-history');
  const historyCount = document.getElementById('history-count');
  const historySort = document.getElementById('history-sort');

  if (!historyList || !historyCount) {
    return;
  }

  historyCount.textContent = `${state.consultationHistory?.length || 0} entries`;

  if (!state.consultationHistory || state.consultationHistory.length === 0) {
    historyList.innerHTML = '<li class="empty-state">No consultation history yet.</li>';
    return;
  }

  // Get sort preference
  const sortOrder = historySort?.value || 'newest';

  // Sort and render history
  let sortedHistory = state.consultationHistory.slice();

  if (sortOrder === 'newest') {
    sortedHistory.reverse();
  }
  // If 'oldest', keep as is (already sorted by date ascending)

  historyList.innerHTML = sortedHistory
    .map(
      (entry) => {
        // Convert UTC timestamp to local time
        let displayTime = 'Completed';
        if (entry.finishedAt) {
          try {
            const date = new Date(entry.finishedAt + 'Z'); // Treat as UTC
            displayTime = date.toLocaleString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            });
          } catch (e) {
            displayTime = entry.finishedAt;
          }
        }

        return `
          <li class="queue-item">
            <div>
              <strong>#${entry.queueNumber} — ${escapeHtml(entry.name)}</strong>
              <small>${escapeHtml(displayTime)}</small>
              <small>PH ID: ${escapeHtml(entry.philHealthId || 'N/A')}</small>
              <small>ICD: ${escapeHtml(entry.icdCode || 'N/A')}</small>
              <small>Consultation: ${escapeHtml(entry.consultationDetails || 'No notes recorded')}</small>
            </div>
            <div class="actions">
              <button class="btn btn-secondary" type="button" data-action="edit-history" data-id="${entry.id || ''}">Edit</button>
            </div>
          </li>
        `;
      }
    )
    .join('');
}

function openHistoryEditModal(id) {
  const entry = state.consultationHistory.find((item) => (item.id || '') === id);
  if (!entry) {
    return;
  }

  const modal = document.getElementById('edit-history-modal');
  const historyIdInput = document.getElementById('edit-history-id');
  const icdCodeInput = document.getElementById('edit-history-icd-code');
  const consultationInput = document.getElementById('edit-history-consultation');

  if (!modal || !historyIdInput || !icdCodeInput || !consultationInput) {
    return;
  }

  historyIdInput.value = entry.id || '';
  icdCodeInput.value = entry.icdCode || '';
  consultationInput.value = entry.consultationDetails || '';
  modal.hidden = false;
}

function initHistoryEditForm() {
  const historyEditForm = document.getElementById('edit-history-form');
  const cancelHistoryEditButton = document.getElementById('cancel-history-edit-btn');

  if (historyEditForm) {
    historyEditForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const historyId = document.getElementById('edit-history-id')?.value || '';
      const icdCode = document.getElementById('edit-history-icd-code')?.value || '';
      const consultationDetails = document.getElementById('edit-history-consultation')?.value || '';

      if (!historyId) {
        return;
      }

      postAction('edit-history', { id: historyId, icdCode, consultationDetails });
      historyEditForm.reset();
      closeHistoryEditModal();
    });
  }

  if (cancelHistoryEditButton) {
    cancelHistoryEditButton.addEventListener('click', closeHistoryEditModal);
  }
}

function closeHistoryEditModal() {
  const modal = document.getElementById('edit-history-modal');
  if (modal) {
    modal.hidden = true;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function patientTypeLabel(type) {
  const labels = {
    pwd: 'PWD',
    senior: 'Senior',
    emergency: 'Emergency',
    regular: 'Regular',
  };
  return labels[type] || 'Regular';
}

function printConsultationHistory() {
  const historyEntries = state.consultationHistory?.slice().reverse() || [];
  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    return;
  }

  const entryMarkup = historyEntries.length > 0
    ? historyEntries
        .map((entry) => `
          <tr>
            <td>#${escapeHtml(entry.queueNumber ?? 'N/A')} — ${escapeHtml(entry.name ?? 'Unknown')}</td>
            <td>${escapeHtml(entry.finishedAt || 'Completed')}</td>
            <td>${escapeHtml(entry.philHealthId || 'N/A')}</td>
            <td>${escapeHtml(entry.icdCode || 'N/A')}</td>
            <td>${escapeHtml(entry.consultationDetails || 'No notes recorded')}</td>
          </tr>
        `)
        .join('')
    : '<tr><td colspan="5">No consultation history yet.</td></tr>';

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Consultation History Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #18324b; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d3e0ee; padding: 10px; text-align: left; vertical-align: top; }
          th { background: #e8f1ff; }
          .subtitle { color: #5f7794; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>Consultation History</h1>
        <div class="subtitle">RHU II Patient Report</div>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date & Time</th>
              <th>PhilHealth ID</th>
              <th>ICD Code</th>
              <th>Consultation Details</th>
            </tr>
          </thead>
          <tbody>
            ${entryMarkup}
          </tbody>
        </table>
      </body>
    </html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function renderAdminQueue() {
  const patientList = document.getElementById('patient-list');
  const adminCount = document.getElementById('admin-count');
  const adminPatientCount = document.getElementById('admin-patient-count');
  const adminCurrentPatient = document.getElementById('admin-current-patient');
  const adminNextPatient = document.getElementById('admin-next-patient');
  const adminFollowupList = document.getElementById('admin-followup-list');
  const adminFollowupSection = document.getElementById('admin-followup-section');
  const isAdminPage = Boolean(document.getElementById('patient-form'));

  if (!patientList || !adminCount) {
    return;
  }

  adminCount.textContent = `${state.patients.length} patients`;
  if (adminPatientCount) {
    adminPatientCount.textContent = `${state.patients.length} patients in queue`;
  }

  // Render current patient (doctor-style display)
  if (adminCurrentPatient && isAdminPage) {
    const currentServing = state.patients.find((patient) => patient.status === 'serving');
    if (currentServing) {
      const patientType = currentServing.patientStatus || currentServing.type || 'regular';
      const philHealthStatus = currentServing.philHealthStatus || 'no-philhealth';
      adminCurrentPatient.innerHTML = `
        <strong>#${currentServing.queueNumber} — ${escapeHtml(currentServing.name)}</strong>
        <div class="badge-group">
          <span class="badge ${currentServing.status}">${currentServing.status}</span>
          <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
          <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
        </div>
        <small>PH ID: ${escapeHtml(currentServing.philHealthId || 'N/A')}</small>
      `;
    } else {
      adminCurrentPatient.innerHTML = `
        <strong>No patient is being served yet.</strong>
        <div class="badge-group">
          <span class="badge waiting">Waiting</span>
        </div>
        <small>Queue # — Full Name</small>
        <small>PH ID: N/A</small>
      `;
    }
  }

  // Render next patient
  if (adminNextPatient && isAdminPage) {
    const waitingPatients = state.patients.filter((patient) => patient.status === 'waiting');
    if (waitingPatients.length > 0) {
      const nextPatient = waitingPatients[0];
      const patientType = nextPatient.patientStatus || nextPatient.type || 'regular';
      const philHealthStatus = nextPatient.philHealthStatus || 'no-philhealth';
      adminNextPatient.innerHTML = `
        <strong>#${nextPatient.queueNumber} — ${escapeHtml(nextPatient.name)}</strong>
        <div class="badge-group">
          <span class="badge ${nextPatient.status}">${nextPatient.status}</span>
          <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
          <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
        </div>
        <small>PH ID: ${escapeHtml(nextPatient.philHealthId || 'N/A')}</small>
      `;
    } else {
      adminNextPatient.innerHTML = `
        <strong>No queue yet.</strong>
        <small>Awaiting the next patient.</small>
      `;
    }
  }

  // Render follow-up patients
  if (adminFollowupList && adminFollowupSection && isAdminPage) {
    const followupPatients = state.patients.filter((patient) => patient.status === 'follow-up');
    if (followupPatients.length > 0) {
      adminFollowupSection.hidden = false;
      adminFollowupList.innerHTML = followupPatients
        .map((patient) => {
          const patientType = patient.patientStatus || patient.type || 'regular';
          const philHealthStatus = patient.philHealthStatus || 'no-philhealth';
          const followUpReason = patient.followUpReason || 'Pending';
          return `
            <li class="queue-item">
              <div>
                <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
                <div class="badge-group">
                  <span class="badge ${patient.status}">${patient.status}</span>
                  <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
                  <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
                  <span class="badge followup-reason">${escapeHtml(followUpReason)}</span>
                </div>
                <small>PH ID: ${escapeHtml(patient.philHealthId || 'N/A')}</small>
              </div>
              <div class="actions">
                <button class="btn btn-primary" data-doctor-action="call-followup" data-id="${patient.id}">Call Patient</button>
                <button class="btn btn-secondary" data-doctor-action="ready-for-doctor" data-id="${patient.id}">Ready for Doctor</button>
              </div>
            </li>
          `;
        })
        .join('');
    } else {
      adminFollowupSection.hidden = true;
      adminFollowupList.innerHTML = '';
    }
  }

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map(
      (patient) => {
        const patientType = patient.patientStatus || patient.type || 'regular';
        const philHealthStatus = patient.philHealthStatus || 'no-philhealth';
        const actionButtons = [];

        if (isAdminPage) {
          actionButtons.push(`<button class="btn btn-secondary" data-action="edit" data-id="${patient.id}">Edit</button>`);
          const isCurrentPatient = patient.status === 'serving';
          actionButtons.push(`<button class="btn btn-primary" data-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${patient.id}">${isCurrentPatient ? 'Done' : 'Serve'}</button>`);
          actionButtons.push(`<button class="btn btn-warning" data-action="skip" data-id="${patient.id}">Skip</button>`);
          actionButtons.push(`<button class="btn btn-danger" data-action="delete" data-id="${patient.id}">Delete</button>`);
        }

        return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
              <div class="badge-group">
                <span class="badge ${patient.status}">${patient.status}</span>
                <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
                <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
              </div>
              <small>PH ID: ${escapeHtml(patient.philHealthId || 'N/A')}</small>
            </div>
            <div class="actions">
              ${actionButtons.join('')}
            </div>
          </li>
        `;
      },
    )
    .join('');
}

function renderDoctorQueue() {
  const patientList = document.getElementById('doctor-patient-list');
  const patientCountLabel = document.getElementById('doctor-patient-count');
  const currentPatientCard = document.getElementById('doctor-current-patient');
  const nextPatientCard = document.getElementById('doctor-next-patient');
  const followUpPatientList = document.getElementById('doctor-followup-list');
  const followUpSection = document.getElementById('doctor-followup-section');

  if (!patientList || !patientCountLabel) {
    return;
  }

  const activeField = document.activeElement;
  const activeFieldId = activeField?.id;
  const activeFieldSelectionStart = activeField?.selectionStart ?? activeField?.selectionEnd ?? null;
  const activeFieldSelectionEnd = activeField?.selectionEnd ?? activeField?.selectionStart ?? null;
  const draftIcdCode = document.getElementById('doctor-icd-code')?.value || '';
  const draftConsultationDetails = document.getElementById('doctor-consultation-note')?.value || '';

  patientCountLabel.textContent = `${state.patients.length} patients in queue`;

  const servingPatient = getCurrentServingPatient();
  const nextPatient = state.patients.find((patient) => patient.status === 'waiting') || null;
  const followUpPatients = getFollowUpPatients();

  if (currentPatientCard) {
    if (servingPatient) {
      currentPatientCard.innerHTML = `
        <div id="doctor-status-indicator" class="doctor-status-indicator serving"></div>
        <div class="doctor-current-patient-details">
          <strong>#${servingPatient.queueNumber} — ${escapeHtml(servingPatient.name)}</strong>
          <div class="badge-group">
            <span class="badge serving">Serving</span>
            <span class="badge type-${servingPatient.patientStatus || servingPatient.type || 'regular'}">${patientTypeLabel(servingPatient.patientStatus || servingPatient.type)}</span>
          </div>
          <small>Queue #${servingPatient.queueNumber}</small>
          <small>PH ID: ${escapeHtml(servingPatient.philHealthId || 'N/A')}</small>
        </div>
        <div class="doctor-note-fields">
          <label class="field-label" for="doctor-icd-code">ICD Code</label>
          <input id="doctor-icd-code" type="text" placeholder="ICD code" value="${escapeHtml(draftIcdCode || servingPatient.icdCode || '')}" />
          <label class="field-label" for="doctor-consultation-note">Consultation Details</label>
          <textarea id="doctor-consultation-note" rows="4" placeholder="Enter consultation details for this patient">${escapeHtml(draftConsultationDetails || servingPatient.consultationDetails || '')}</textarea>
        </div>
      `;
    } else {
      currentPatientCard.innerHTML = `
        <div id="doctor-status-indicator" class="doctor-status-indicator"></div>
        <div class="doctor-current-patient-details">
          <strong>No patient is being served yet.</strong>
          <div class="badge-group">
            <span class="badge waiting">Waiting</span>
          </div>
          <small>Queue # — Full Name</small>
          <small>PH ID: N/A</small>
        </div>
        <div class="doctor-note-fields">
          <label class="field-label" for="doctor-icd-code">ICD Code</label>
          <input id="doctor-icd-code" type="text" placeholder="ICD code" value="${escapeHtml(draftIcdCode)}" disabled />
          <label class="field-label" for="doctor-consultation-note">Consultation Details</label>
          <textarea id="doctor-consultation-note" rows="4" placeholder="Enter consultation details for this patient" disabled>${escapeHtml(draftConsultationDetails)}</textarea>
        </div>
      `;
    }
  }

  if (activeFieldId) {
    const restoredField = document.getElementById(activeFieldId);
    if (restoredField) {
      restoredField.focus();
      if (typeof activeFieldSelectionStart === 'number' && typeof activeFieldSelectionEnd === 'number') {
        restoredField.setSelectionRange(activeFieldSelectionStart, activeFieldSelectionEnd);
      }
    }
  }

  if (nextPatientCard) {
    if (nextPatient) {
      nextPatientCard.innerHTML = `
        <strong>#${nextPatient.queueNumber} — ${escapeHtml(nextPatient.name)}</strong>
        <div class="badge-group">
          <span class="badge waiting">Waiting</span>
          <span class="badge type-${nextPatient.patientStatus || nextPatient.type || 'regular'}">${patientTypeLabel(nextPatient.patientStatus || nextPatient.type)}</span>
        </div>
        <small>PH ID: ${escapeHtml(nextPatient.philHealthId || 'N/A')}</small>
      `;
    } else {
      nextPatientCard.innerHTML = `
        <strong>No queue yet.</strong>
        <small>Awaiting the next patient.</small>
      `;
    }
  }

  // Only show non-follow-up patients in main list
  const normalPatients = state.patients.filter((patient) => patient.status !== 'follow-up');

  if (state.patients.length === 0) {
    patientList.innerHTML = '<tr><td class="queue-table-empty" colspan="6">No patients have been added yet.</td></tr>';
  } else if (normalPatients.length === 0) {
    patientList.innerHTML = '<tr><td class="queue-table-empty" colspan="6">No patients in normal queue.</td></tr>';
  } else {
    patientList.innerHTML = normalPatients
      .map((patient) => {
        const patientType = patient.patientStatus || patient.type || 'regular';
        const isCurrentPatient = patient.status === 'serving';
        return `
        <tr>
          <td class="queue-table-number">#${patient.queueNumber}</td>
          <td class="queue-table-name">${escapeHtml(patient.name)}</td>
          <td><span class="badge ${patient.status}">${patient.status}</span></td>
          <td><span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span></td>
          <td>${escapeHtml(patient.philHealthId || 'N/A')}</td>
          <td>
            <div class="actions">
              <button class="btn btn-primary" data-doctor-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${patient.id}">${isCurrentPatient ? 'Done' : 'Serve'}</button>
              <button class="btn btn-warning" data-doctor-action="skip" data-id="${patient.id}">Skip</button>
              <button class="btn btn-secondary" data-doctor-action="recall" data-id="${patient.id}">Recall</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  // Render follow-up patients section
  if (followUpSection && followUpPatientList) {
    followUpSection.hidden = false;
    const followupCountLabel = document.getElementById('doctor-followup-count');
    if (followupCountLabel) {
      followupCountLabel.textContent = `${followUpPatients.length} patient${followUpPatients.length === 1 ? '' : 's'}`;
    }

    if (followUpPatients.length === 0) {
      followUpPatientList.innerHTML = '<li class="empty-state">No patients in follow-up queue.</li>';
    } else {
      followUpPatientList.innerHTML = followUpPatients
        .map((patient) => {
          const patientType = patient.patientStatus || patient.type || 'regular';
          const isReady = (patient.followUpStatus || 'none') === 'ready_for_doctor';
          const reasonText = patient.followUpReason || 'Follow-up';
          return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
              <div class="badge-group">
                <span class="badge follow-up">Follow-up</span>
                <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
              </div>
              <small>${escapeHtml(reasonText)}</small>
              <small>${isReady ? '✓ Ready for Doctor' : 'Waiting for Procedure'}</small>
            </div>
            <div class="actions">
              ${isReady ? `<button class="btn btn-primary" data-doctor-action="call-followup" data-id="${patient.id}">Call Patient</button>` : ''}
              <button class="btn btn-secondary" data-doctor-action="ready-for-doctor" data-id="${patient.id}">Ready for Doctor</button>
            </div>
          </li>
        `;
        })
        .join('');
    }
  }
}

function renderBhwQueue() {
  const patientList = document.getElementById('bhw-patient-list');
  const countLabel = document.getElementById('bhw-count');

  if (!patientList || !countLabel) {
    return;
  }

  countLabel.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map((patient) => {
      const patientType = patient.type || 'regular';
      return `
      <li class="queue-item">
        <div>
          <strong>#${patient.queueNumber} — ${escapeHtml(patient.name)}</strong>
          <div class="badge-group">
            <span class="badge ${patient.status}">${patient.status}</span>
            <span class="badge type-${patientType}">${patientTypeLabel(patientType)}</span>
          </div>
        </div>
      </li>
    `;
    })
    .join('');
}

function addPatient(fields) {
  const trimmedName = (fields.name || '').trim();
  const philHealthId = (fields.philHealthId || '').trim();
  const patientStatus = fields.patientStatus || 'regular';
  const philHealthStatus = fields.philHealthStatus || 'no-philhealth';

  if (!trimmedName) {
    return;
  }

  postAction('add', {
    name: trimmedName,
    philHealthId,
    patientStatus,
    philHealthStatus,
  });
}

function editPatient(id, fields) {
  const trimmedName = (fields.name || '').trim();
  const philHealthId = (fields.philHealthId || '').trim();
  const patientStatus = fields.patientStatus || 'regular';
  const philHealthStatus = fields.philHealthStatus || 'no-philhealth';

  if (!trimmedName) {
    return;
  }

  postAction('edit', {
    id,
    name: trimmedName,
    philHealthId,
    patientStatus,
    philHealthStatus,
  });
}

function deletePatient(id) {
  postAction('delete', { id });
}

function servePatient(id) {
  postAction('serve', { id });
}

function finishPatient(id) {
  // Only use doctor inputs for consultation details
  // Admin doesn't have consultation inputs, so they will be empty
  const doctorConsultationNoteInput = document.getElementById('doctor-consultation-note');
  const doctorIcdCodeInput = document.getElementById('doctor-icd-code');

  const consultationDetails = doctorConsultationNoteInput?.value || '';
  const icdCode = doctorIcdCodeInput?.value || '';

  if (doctorConsultationNoteInput) {
    doctorConsultationNoteInput.value = '';
  }

  if (doctorIcdCodeInput) {
    doctorIcdCodeInput.value = '';
  }

  // Admin can finish without consultation details, doctor needs them
  postAction('finish', { id, consultationDetails, icdCode });
}

function skipPatient(id) {
  postAction('skip', { id });
}

function recallPatient(id) {
  postAction('recall', { id });
}

function serveNextPatient() {
  postAction('serve-next');
}

function resetQueue() {
  postAction('reset');
}

function render() {
  if (document.getElementById('patient-list')) {
    renderAdminQueue();
  }

  if (document.getElementById('waiting-list')) {
    renderPatientBoard();
  }

  if (document.getElementById('doctor-patient-list')) {
    renderDoctorQueue();
  }

  if (document.getElementById('bhw-patient-list')) {
    renderBhwQueue();
  }

  if (document.getElementById('consultation-history')) {
    renderConsultationHistory();
  }

  // Update dashboard stats if on admin page
  if (document.body.classList.contains('admin-body')) {
    updateDashboardStats();
  }

  // Check for new patients on doctor page
  checkForNewPatients();

  // Render Yakap Prescriptions if present on page
  if (document.getElementById('doctor-prescriptions-table-body') || document.getElementById('yakap-dropzone')) {
    renderDoctorPrescriptions();
  }
  if (document.getElementById('admin-yakap-prescriptions-table-body')) {
    renderAdminPrescriptions();
  }
}

function updateRemotePauseUI(isPaused) {
  const remoteToggleBtn = document.getElementById('video-remote-toggle-btn');
  if (!remoteToggleBtn) return;
  remoteToggleBtn.dataset.paused = isPaused ? 'true' : 'false';
  if (isPaused) {
    remoteToggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
    remoteToggleBtn.className = 'btn btn-secondary';
    remoteToggleBtn.title = 'Resume video on waiting room display';
  } else {
    remoteToggleBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    remoteToggleBtn.className = 'btn btn-primary';
    remoteToggleBtn.title = 'Pause video on waiting room display';
  }
}

async function sendRemoteCommand(command) {
  const seq = Date.now();

  // Optimistically update remote toggle button UI
  if (command === 'pause') {
    updateRemotePauseUI(true);
  } else if (command === 'resume') {
    updateRemotePauseUI(false);
  }

  // 1. Broadcast immediately to open tabs/windows on this browser
  broadcastVideoCommand(command, state.videoConfig, seq);

  // 2. Persist to PostgreSQL backend for LAN synchronization across all devices
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'video-control', command: command, seq: seq }),
      cache: 'no-store'
    });
    const data = await response.json();
    if (data?.success && data?.state) {
      applyNewQueueState(data.state);
      broadcastState(data.state);
    }
  } catch (err) {
    console.warn('sendRemoteCommand backend sync error:', err);
  }
}

async function loadVideoConfigDisplay() {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-video-config' }),
      cache: 'no-store'
    });
    const data = await response.json();

    if (data?.success && data?.videoConfig) {
      const config = data.videoConfig;

      // Populate form fields
      const playlistUrlInput = document.getElementById('video-playlist-url');
      const playlistTitleInput = document.getElementById('video-playlist-title');
      const enabledSelect = document.getElementById('video-enabled');
      const enabledToggle = document.getElementById('video-enabled-toggle');
      const toggleText = document.getElementById('video-toggle-text');

      if (playlistUrlInput) playlistUrlInput.value = config.playlistUrl || '';
      if (playlistTitleInput) playlistTitleInput.value = config.playlistTitle || '';
      if (enabledSelect) enabledSelect.value = config.isEnabled ? 'true' : 'false';
      if (enabledToggle) {
        enabledToggle.checked = config.isEnabled;
      }
      if (toggleText) {
        toggleText.textContent = config.isEnabled ? 'Broadcasting' : 'Disabled';
      }

      // Update Status Banner
      const statusDot = document.getElementById('video-status-dot');
      const bannerLabel = document.getElementById('video-banner-label');
      const bannerInfo = document.getElementById('video-banner-info');

      if (statusDot && bannerLabel && bannerInfo) {
        statusDot.className = 'status-dot';
        if (config.isEnabled && config.playlistId) {
          statusDot.classList.add('active');
          bannerLabel.textContent = 'Live — Broadcasting to Waiting Room';
          bannerInfo.textContent = config.playlistTitle || 'Untitled Playlist';
        } else if (config.playlistId && !config.isEnabled) {
          statusDot.classList.add('disabled');
          bannerLabel.textContent = 'Playlist Set — Broadcasting Paused';
          bannerInfo.textContent = config.playlistTitle || 'Untitled Playlist';
        } else {
          bannerLabel.textContent = 'Not Configured';
          bannerInfo.textContent = 'No playlist set';
        }
      }

      // Update Preview
      const previewPlaceholder = document.getElementById('video-preview-placeholder');
      const previewFrame = document.getElementById('video-preview-frame');
      const previewBadge = document.getElementById('video-preview-badge');

      if (previewPlaceholder && previewFrame && previewBadge) {
        if (config.playlistId) {
          previewPlaceholder.style.display = 'none';
          previewFrame.hidden = false;
          const embedUrl = buildYouTubeEmbedUrl(config.playlistId, { autoplay: 0, controls: 1 });
          previewFrame.innerHTML = `<iframe id="admin-preview-iframe" src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
          previewBadge.textContent = config.isEnabled ? 'Live' : 'Preview Only';
          previewBadge.className = 'badge ' + (config.isEnabled ? 'serving' : 'waiting');
        } else {
          previewPlaceholder.style.display = '';
          previewFrame.hidden = true;
          previewFrame.innerHTML = '';
          previewBadge.textContent = 'No Preview';
          previewBadge.className = 'badge waiting';
        }
      }

      // Update Detail List
      const detailTitle = document.getElementById('video-detail-title');
      const detailId = document.getElementById('video-detail-id');
      const detailStatus = document.getElementById('video-detail-status');
      const detailUpdated = document.getElementById('video-detail-updated');
      const detailUpdatedBy = document.getElementById('video-detail-updated-by');
      const detailUrlLink = document.getElementById('video-detail-url-link');
      const detailUrlText = document.getElementById('video-detail-url-text');

      if (detailTitle) detailTitle.textContent = config.playlistTitle || '—';
      if (detailId) {
        if (!config.playlistId) {
          detailId.textContent = '—';
        } else if (config.playlistId.includes(',')) {
          const parts = config.playlistId.split(',');
          detailId.textContent = `${parts.length} videos queued (${parts[0]} +${parts.length - 1} more)`;
          detailId.title = config.playlistId;
        } else {
          detailId.textContent = config.playlistId;
          detailId.title = config.playlistId;
        }
      }
      if (detailStatus) {
        if (config.isEnabled && config.playlistId) {
          detailStatus.innerHTML = '<span class="badge serving">Active & Broadcasting</span>';
        } else if (config.playlistId && !config.isEnabled) {
          detailStatus.innerHTML = '<span class="badge follow-up">Paused</span>';
        } else {
          detailStatus.innerHTML = '<span class="badge waiting">Not Active</span>';
        }
      }
      if (detailUpdated) {
        if (config.updatedAt) {
          try {
            const date = new Date(config.updatedAt);
            detailUpdated.textContent = date.toLocaleString('en-PH', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
            });
          } catch (e) {
            detailUpdated.textContent = config.updatedAt;
          }
        } else {
          detailUpdated.textContent = '—';
        }
      }
      if (detailUpdatedBy) detailUpdatedBy.textContent = config.updatedBy || '—';
      if (detailUrlLink && detailUrlText) {
        if (config.playlistUrl) {
          detailUrlLink.href = config.playlistUrl;
          detailUrlLink.style.display = '';
          detailUrlText.style.display = 'none';
        } else {
          detailUrlLink.style.display = 'none';
          detailUrlText.style.display = '';
          detailUrlText.textContent = '—';
        }
      }

      // Update Remote Control Buttons
      const remotePrevBtn = document.getElementById('video-remote-prev-btn');
      const remoteToggleBtn = document.getElementById('video-remote-toggle-btn');
      const remoteNextBtn = document.getElementById('video-remote-next-btn');
      const remoteUnmuteBtn = document.getElementById('video-remote-unmute-btn');
      const hasActiveVideo = Boolean(config.isEnabled && config.playlistId);

      if (remotePrevBtn) remotePrevBtn.disabled = !hasActiveVideo;
      if (remoteToggleBtn) {
        remoteToggleBtn.disabled = !hasActiveVideo;
        updateRemotePauseUI(Boolean(config.isPaused));
      }
      if (remoteNextBtn) remoteNextBtn.disabled = !hasActiveVideo;
      if (remoteUnmuteBtn) remoteUnmuteBtn.disabled = !hasActiveVideo;

      // Update Quick Action Buttons
      const openYoutubeBtn = document.getElementById('video-open-youtube-btn');
      const copyUrlBtn = document.getElementById('video-copy-url-btn');

      if (openYoutubeBtn) {
        openYoutubeBtn.disabled = !config.playlistUrl;
        openYoutubeBtn.onclick = () => {
          if (config.playlistUrl) window.open(config.playlistUrl, '_blank');
        };
      }
      if (copyUrlBtn) {
        copyUrlBtn.disabled = !config.playlistUrl;
        copyUrlBtn.onclick = async () => {
          if (config.playlistUrl) {
            try {
              await navigator.clipboard.writeText(config.playlistUrl);
              const originalHTML = copyUrlBtn.innerHTML;
              copyUrlBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
              setTimeout(() => { copyUrlBtn.innerHTML = originalHTML; }, 2000);
            } catch (e) {
              console.warn('Failed to copy URL:', e);
            }
          }
        };
      }
    }
  } catch (error) {
    console.error('Error loading video config display:', error);
  }
}

function initVideoManagement() {
  // Toggle switch sync with hidden select
  const enabledToggle = document.getElementById('video-enabled-toggle');
  const enabledSelect = document.getElementById('video-enabled');
  const toggleText = document.getElementById('video-toggle-text');

  if (enabledToggle && enabledSelect) {
    enabledToggle.addEventListener('change', () => {
      enabledSelect.value = enabledToggle.checked ? 'true' : 'false';
      if (toggleText) {
        toggleText.textContent = enabledToggle.checked ? 'Broadcasting' : 'Disabled';
      }
    });
  }

  // Live Remote Controls for Waiting Room
  const remotePrevBtn = document.getElementById('video-remote-prev-btn');
  const remoteToggleBtn = document.getElementById('video-remote-toggle-btn');
  const remoteNextBtn = document.getElementById('video-remote-next-btn');
  const remoteUnmuteBtn = document.getElementById('video-remote-unmute-btn');

  if (remotePrevBtn) {
    remotePrevBtn.onclick = () => {
      sendRemoteCommand('prev');
      postToPlayerIframe('previousVideo');
      postToPlayerIframe('prevVideo');
      const original = remotePrevBtn.innerHTML;
      remotePrevBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Prev';
      setTimeout(() => { remotePrevBtn.innerHTML = original; }, 600);
    };
  }

  if (remoteToggleBtn) {
    remoteToggleBtn.onclick = () => {
      const isCurrentlyPaused = remoteToggleBtn.dataset.paused === 'true';
      const cmd = !isCurrentlyPaused ? 'pause' : 'resume';
      sendRemoteCommand(cmd);
      postToPlayerIframe(cmd === 'pause' ? 'pauseVideo' : 'playVideo');
    };
  }

  if (remoteNextBtn) {
    remoteNextBtn.onclick = () => {
      sendRemoteCommand('next');
      postToPlayerIframe('nextVideo');
      const original = remoteNextBtn.innerHTML;
      remoteNextBtn.innerHTML = 'Next <i class="fa-solid fa-circle-notch fa-spin"></i>';
      setTimeout(() => { remoteNextBtn.innerHTML = original; }, 600);
    };
  }

  if (remoteUnmuteBtn) {
    remoteUnmuteBtn.onclick = () => {
      sendRemoteCommand('unmute');
      postToPlayerIframe('unMute');
      postToPlayerIframe('setVolume', [100]);
      const original = remoteUnmuteBtn.innerHTML;
      remoteUnmuteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Unmuted!';
      setTimeout(() => { remoteUnmuteBtn.innerHTML = original; }, 2000);
    };
  }

  // Video configuration form — Save & Apply
  const videoConfigForm = document.getElementById('video-config-form');
  if (videoConfigForm) {
    videoConfigForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const saveBtn = document.getElementById('video-save-btn');
      const originalHTML = saveBtn ? saveBtn.innerHTML : '';

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
      }

      const playlistUrl = document.getElementById('video-playlist-url')?.value || '';
      const playlistTitle = document.getElementById('video-playlist-title')?.value || '';
      const isEnabled = document.getElementById('video-enabled')?.value === 'true';

      await postAction('save-video-config', {
        playlistUrl,
        playlistTitle,
        isEnabled
      });

      // Broadcast video command immediately to waiting room displays
      broadcastVideoCommand(isEnabled ? 'play' : 'stop');

      // Refresh video config display and library
      await loadVideoConfigDisplay();
      await loadPlaylistLibrary();

      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHTML;
        }, 2000);
      }
    });
  }

  // Clear playlist button
  const clearBtn = document.getElementById('video-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear the playlist? This will stop the video on the waiting room display.')) {
        return;
      }

      const playlistUrlInput = document.getElementById('video-playlist-url');
      const playlistTitleInput = document.getElementById('video-playlist-title');
      const enabledToggle = document.getElementById('video-enabled-toggle');
      const enabledSelect = document.getElementById('video-enabled');
      const toggleText = document.getElementById('video-toggle-text');

      if (playlistUrlInput) playlistUrlInput.value = '';
      if (playlistTitleInput) playlistTitleInput.value = '';
      if (enabledToggle) enabledToggle.checked = false;
      if (enabledSelect) enabledSelect.value = 'false';
      if (toggleText) toggleText.textContent = 'Disabled';

      await postAction('save-video-config', {
        playlistUrl: '',
        playlistTitle: '',
        isEnabled: false
      });

      // Instantly stop video on waiting room displays
      broadcastVideoCommand('stop', {
        playlistId: '',
        playlistUrl: '',
        playlistTitle: '',
        isEnabled: false
      });

      await loadVideoConfigDisplay();
      await loadPlaylistLibrary();
    });
  }

  // Add to Library button
  const addToLibraryBtn = document.getElementById('video-add-to-library-btn');
  if (addToLibraryBtn) {
    addToLibraryBtn.addEventListener('click', async () => {
      const playlistUrl = document.getElementById('video-playlist-url')?.value?.trim() || '';
      const playlistTitle = document.getElementById('video-playlist-title')?.value?.trim() || '';

      if (!playlistUrl) {
        alert('Please enter a YouTube playlist URL first.');
        document.getElementById('video-playlist-url')?.focus();
        return;
      }

      const originalHTML = addToLibraryBtn.innerHTML;
      addToLibraryBtn.disabled = true;
      addToLibraryBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Adding...';

      try {
        const apiUrl = getBackendApiUrl();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-to-playlist-library',
            playlistUrl,
            playlistTitle: playlistTitle || 'Untitled Playlist'
          }),
          cache: 'no-store'
        });

        const data = await response.json();
        if (data?.success) {
          addToLibraryBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
          await loadPlaylistLibrary();
        } else {
          alert(data?.message || 'Failed to add playlist to library.');
        }
      } catch (error) {
        console.error('Error adding to library:', error);
        alert('Failed to add playlist to library.');
      }

      setTimeout(() => {
        addToLibraryBtn.disabled = false;
        addToLibraryBtn.innerHTML = originalHTML;
      }, 1500);
    });
  }

  // Load video config and playlist library on page load
  loadVideoConfigDisplay();
  loadPlaylistLibrary();
}

// ========== Playlist Library Functions ==========

async function loadPlaylistLibrary() {
  const libraryList = document.getElementById('video-library-list');
  const libraryCount = document.getElementById('video-library-count');

  if (!libraryList) return;

  try {
    const apiUrl = getBackendApiUrl();
    const [libraryResponse, configResponse] = await Promise.all([
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-playlist-library' }),
        cache: 'no-store'
      }),
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-video-config' }),
        cache: 'no-store'
      })
    ]);

    const libraryData = await libraryResponse.json();
    const configData = await configResponse.json();

    const activePlaylistId = configData?.videoConfig?.playlistId || '';
    const isEnabled = configData?.videoConfig?.isEnabled || false;

    if (!libraryData?.success || !libraryData.library || libraryData.library.length === 0) {
      if (libraryCount) libraryCount.textContent = '0 playlists';
      libraryList.innerHTML = `
        <div class="video-library-empty">
          <i class="fa-solid fa-folder-open"></i>
          <p>No playlists in your library yet</p>
          <small>Add a playlist URL above and click "Add to Library" to get started</small>
        </div>
      `;
      return;
    }

    const library = libraryData.library;
    if (libraryCount) libraryCount.textContent = `${library.length} playlist${library.length !== 1 ? 's' : ''}`;

    libraryList.innerHTML = library.map(item => {
      const isPlaying = activePlaylistId === item.playlistId && isEnabled;
      const isSet = activePlaylistId === item.playlistId && !isEnabled;

      let addedDate = '';
      if (item.addedAt) {
        try {
          const d = new Date(item.addedAt);
          addedDate = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
          addedDate = '';
        }
      }

      const isMulti = item.playlistId && item.playlistId.includes(',');
      const parts = isMulti ? item.playlistId.split(',').map(s => s.trim()).filter(Boolean) : [item.playlistId];
      const firstVidId = parts[0] && !isYoutubePlaylistId(parts[0]) ? parts[0] : '';
      const thumbHtml = firstVidId
        ? `<img src="https://img.youtube.com/vi/${encodeURIComponent(firstVidId)}/hqdefault.jpg" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fa-brands fa-youtube\\'></i>'" alt="thumbnail" />`
        : `<i class="fa-solid fa-list-ul"></i>`;

      const displayId = isMulti
        ? `${parts.length} videos queued (${parts[0]} +${parts.length - 1})`
        : (item.playlistId || '—');

      return `
        <div class="playlist-library-item ${isPlaying ? 'now-playing' : ''}">
          <div class="playlist-item-thumbnail">
            ${thumbHtml}
          </div>
          <div class="playlist-item-info">
            <div class="playlist-item-title">${escapeHtml(item.playlistTitle)}</div>
            <div class="playlist-item-meta">
              <span class="playlist-item-id" title="${escapeHtml(item.playlistId)}">${escapeHtml(displayId)}</span>
              ${addedDate ? `<span class="playlist-item-date">${addedDate}</span>` : ''}
              ${isPlaying ? '<span class="playlist-item-badge"><i class="fa-solid fa-circle"></i> Now Playing</span>' : ''}
              ${isSet ? '<span class="playlist-item-badge" style="color:#d97706;background:#fef3c7;border-color:#fde68a;animation:none;"><i class="fa-solid fa-pause"></i> Paused</span>' : ''}
            </div>
          </div>
          <div class="playlist-item-actions">
            <button class="btn btn-play ${isPlaying ? 'playing' : ''}" type="button"
                    data-library-action="${isPlaying ? 'stop' : 'play'}"
                    data-playlist-id="${escapeHtml(item.playlistId)}"
                    data-playlist-url="${escapeHtml(item.playlistUrl)}"
                    data-playlist-title="${escapeHtml(item.playlistTitle)}">
              <i class="fa-solid ${isPlaying ? 'fa-stop' : 'fa-play'}"></i>
              ${isPlaying ? 'Stop' : 'Play'}
            </button>
            <button class="btn btn-secondary" type="button"
                    data-library-action="open"
                    data-playlist-url="${escapeHtml(item.playlistUrl)}">
              <i class="fa-brands fa-youtube"></i>
            </button>
            <button class="btn btn-danger" type="button"
                    data-library-action="delete"
                    data-library-id="${item.id}"
                    data-playlist-title="${escapeHtml(item.playlistTitle)}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach library item action handlers via delegation
    libraryList.onclick = async (event) => {
      const btn = event.target.closest('button[data-library-action]');
      if (!btn) return;

      const action = btn.dataset.libraryAction;

      if (action === 'play') {
        const playlistUrl = btn.dataset.playlistUrl;
        const playlistTitle = btn.dataset.playlistTitle;
        const playlistId = btn.dataset.playlistId;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        await postAction('save-video-config', {
          playlistUrl,
          playlistTitle,
          isEnabled: true
        });

        // Broadcast to waiting room display to immediately start playback
        broadcastVideoCommand('play', {
          playlistId,
          playlistUrl,
          playlistTitle,
          isEnabled: true
        });

        // Also update the form fields to reflect the now-playing playlist
        const urlInput = document.getElementById('video-playlist-url');
        const titleInput = document.getElementById('video-playlist-title');
        const enabledToggle = document.getElementById('video-enabled-toggle');
        const enabledSelect = document.getElementById('video-enabled');
        const toggleText = document.getElementById('video-toggle-text');

        if (urlInput) urlInput.value = playlistUrl;
        if (titleInput) titleInput.value = playlistTitle;
        if (enabledToggle) enabledToggle.checked = true;
        if (enabledSelect) enabledSelect.value = 'true';
        if (toggleText) toggleText.textContent = 'Broadcasting';

        await loadVideoConfigDisplay();
        await loadPlaylistLibrary();
      }

      if (action === 'stop') {
        const playlistUrl = btn.dataset.playlistUrl;
        const playlistTitle = btn.dataset.playlistTitle;
        const playlistId = btn.dataset.playlistId;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        await postAction('save-video-config', {
          playlistUrl,
          playlistTitle,
          isEnabled: false
        });

        // Broadcast to waiting room display to immediately stop playback
        broadcastVideoCommand('stop', {
          playlistId,
          playlistUrl,
          playlistTitle,
          isEnabled: false
        });

        const enabledToggle = document.getElementById('video-enabled-toggle');
        const enabledSelect = document.getElementById('video-enabled');
        const toggleText = document.getElementById('video-toggle-text');
        if (enabledToggle) enabledToggle.checked = false;
        if (enabledSelect) enabledSelect.value = 'false';
        if (toggleText) toggleText.textContent = 'Disabled';

        await loadVideoConfigDisplay();
        await loadPlaylistLibrary();
      }

      if (action === 'open') {
        const url = btn.dataset.playlistUrl;
        if (url) window.open(url, '_blank');
      }

      if (action === 'delete') {
        const libraryId = btn.dataset.libraryId;
        const title = btn.dataset.playlistTitle;
        if (!confirm(`Remove "${title}" from the library?`)) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
          const apiUrl = getBackendApiUrl();
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-from-playlist-library', id: parseInt(libraryId) }),
            cache: 'no-store'
          });
          await loadPlaylistLibrary();
        } catch (error) {
          console.error('Error deleting playlist:', error);
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        }
      }
    };

  } catch (error) {
    console.error('Error loading playlist library:', error);
    libraryList.innerHTML = `
      <div class="video-library-empty">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Failed to load playlist library</p>
        <small>Please try refreshing the page</small>
      </div>
    `;
  }
}

function initAdminPage() {
  const patientForm = document.getElementById('patient-form');
  const patientNameInput = document.getElementById('patient-name');
  const philHealthIdInput = document.getElementById('patient-philhealth-id');
  const patientStatusSelect = document.getElementById('patient-status');
  const philHealthStatusSelect = document.getElementById('philhealth-status');
  const editModal = document.getElementById('edit-patient-modal');
  const editPatientForm = document.getElementById('edit-patient-form');
  const editPatientIdInput = document.getElementById('edit-patient-id');
  const editPatientNameInput = document.getElementById('edit-patient-name');
  const editPhilHealthIdInput = document.getElementById('edit-patient-philhealth-id');
  const editPatientStatusSelect = document.getElementById('edit-patient-status');
  const editPhilHealthStatusSelect = document.getElementById('edit-philhealth-status');
  const cancelEditButton = document.getElementById('cancel-edit-btn');
  const printConsultationButton = document.getElementById('print-consultation-btn');
  const serveNextButton = document.getElementById('serve-next-btn');
  const resetButton = document.getElementById('reset-btn');

  // Admin-specific doctor controls
  const adminServeNextButton = document.getElementById('admin-serve-next-btn');
  const adminRecallButton = document.getElementById('admin-recall-btn');
  const adminSkipButton = document.getElementById('admin-skip-btn');
  const adminFinishButton = document.getElementById('admin-finish-btn');
  const adminFollowupButton = document.getElementById('admin-followup-btn');
  const adminFollowupModal = document.getElementById('followup-modal');
  const adminFollowupForm = document.getElementById('followup-form');
  const adminCancelFollowupButton = document.getElementById('cancel-followup-btn');

  if (patientForm && patientNameInput) {
    patientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addPatient({
        name: patientNameInput.value,
        philHealthId: philHealthIdInput?.value || '',
        patientStatus: patientStatusSelect?.value || 'regular',
        philHealthStatus: philHealthStatusSelect?.value || 'no-philhealth',
      });
      patientForm.reset();
    });
  }

  if (editPatientForm) {
    editPatientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const id = editPatientIdInput?.value || '';
      if (!id) {
        return;
      }

      editPatient(id, {
        name: editPatientNameInput?.value || '',
        philHealthId: editPhilHealthIdInput?.value || '',
        patientStatus: editPatientStatusSelect?.value || 'regular',
        philHealthStatus: editPhilHealthStatusSelect?.value || 'no-philhealth',
      });

      if (editModal) {
        editModal.hidden = true;
      }
    });
  }

  if (cancelEditButton && editModal) {
    cancelEditButton.addEventListener('click', () => {
      editModal.hidden = true;
    });
  }

  initHistoryEditForm();

  // History sort dropdown
  const historySort = document.getElementById('history-sort');
  if (historySort) {
    historySort.addEventListener('change', () => {
      renderConsultationHistory();
    });
  }

  // Chart year dropdown
  const chartYear = document.getElementById('chart-year');
  if (chartYear) {
    chartYear.addEventListener('change', () => {
      updateConsultationChart();
    });
  }

  if (printConsultationButton) {
    printConsultationButton.addEventListener('click', printConsultationHistory);
  }

  if (serveNextButton) {
    serveNextButton.addEventListener('click', serveNextPatient);
  }

  if (resetButton) {
    resetButton.addEventListener('click', resetQueue);
  }

  // Admin-specific doctor controls
  if (adminServeNextButton) {
    adminServeNextButton.addEventListener('click', serveNextPatient);
  }

  if (adminRecallButton) {
    adminRecallButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        recallPatient(currentServing.id);
      }
    });
  }

  if (adminSkipButton) {
    adminSkipButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        skipPatient(currentServing.id);
      }
    });
  }

  if (adminFinishButton) {
    adminFinishButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        finishPatient(currentServing.id);
      }
    });
  }

  if (adminFollowupButton) {
    adminFollowupButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (!currentServing) {
        return;
      }

      const followupPatientName = document.getElementById('followup-patient-name');
      const followupPatientId = document.getElementById('followup-patient-id');

      if (followupPatientName && followupPatientId) {
        followupPatientName.textContent = `Patient: #${currentServing.queueNumber} — ${currentServing.name}`;
        followupPatientId.value = currentServing.id;
        adminFollowupModal.hidden = false;
      }
    });
  }

  if (adminCancelFollowupButton && adminFollowupModal) {
    adminCancelFollowupButton.addEventListener('click', () => {
      adminFollowupModal.hidden = true;
      adminFollowupForm.reset();
    });
  }

  if (adminFollowupForm) {
    adminFollowupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const patientId = document.getElementById('followup-patient-id')?.value || '';
      const followUpReason = document.getElementById('followup-reason')?.value || '';

      if (!patientId) {
        return;
      }

      postAction('send-to-followup', { id: patientId, followUpReason });
      adminFollowupModal.hidden = true;
      adminFollowupForm.reset();
    });
  }

  // Video management panel
  initVideoManagement();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    if (action === 'edit') {
      const patient = state.patients.find((item) => item.id === id);
      if (!patient) {
        return;
      }

      const editModal = document.getElementById('edit-patient-modal');
      const editPatientIdInput = document.getElementById('edit-patient-id');
      const editPatientNameInput = document.getElementById('edit-patient-name');
      const editPhilHealthIdInput = document.getElementById('edit-patient-philhealth-id');
      const editPatientStatusSelect = document.getElementById('edit-patient-status');
      const editPhilHealthStatusSelect = document.getElementById('edit-philhealth-status');

      if (editModal && editPatientIdInput && editPatientNameInput && editPhilHealthIdInput && editPatientStatusSelect && editPhilHealthStatusSelect) {
        editPatientIdInput.value = patient.id;
        editPatientNameInput.value = patient.name || '';
        editPhilHealthIdInput.value = patient.philHealthId || '';
        editPatientStatusSelect.value = patient.patientStatus || patient.type || 'regular';
        editPhilHealthStatusSelect.value = patient.philHealthStatus || 'no-philhealth';
        editModal.hidden = false;
      }
    } else if (action === 'edit-history') {
      openHistoryEditModal(id);
    } else if (action === 'delete') {
      deletePatient(id);
    } else if (action === 'serve') {
      servePatient(id);
    } else if (action === 'finish') {
      finishPatient(id);
    } else if (action === 'skip') {
      skipPatient(id);
    }

    // Handle admin-specific doctor actions
    const doctorButton = event.target.closest('button[data-doctor-action]');
    if (doctorButton) {
      const { doctorAction, id: doctorId } = doctorButton.dataset;
      if (doctorAction === 'serve') {
        servePatient(doctorId);
      } else if (doctorAction === 'finish') {
        finishPatient(doctorId);
      } else if (doctorAction === 'skip') {
        skipPatient(doctorId);
      } else if (doctorAction === 'recall') {
        recallPatient(doctorId);
      } else if (doctorAction === 'ready-for-doctor') {
        postAction('ready-for-doctor', { id: doctorId });
      } else if (doctorAction === 'call-followup') {
        postAction('call-followup', { id: doctorId });
      }
    }
  });

  // Initialize Admin YAKAP Prescriptions Desk
  initAdminYakapPrescription();
}

function initBhwPage() {
  const addForm = document.getElementById('bhw-add-form');
  const addNameInput = document.getElementById('bhw-patient-name');

  if (addForm && addNameInput) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const patientStatus = addForm.querySelector('input[name="patient-type"]:checked')?.value || 'regular';
      addPatient({ name: addNameInput.value, patientStatus });
      addForm.reset();
    });
  }
}

function initDoctorPage() {
  // Initialize doctor notification system
  initDoctorNotification();

  const serveNextButton = document.getElementById('doctor-serve-next-btn');
  const recallButton = document.getElementById('doctor-recall-btn');
  const skipButton = document.getElementById('doctor-skip-btn');
  const finishButton = document.getElementById('doctor-finish-btn');

  if (serveNextButton) {
    serveNextButton.addEventListener('click', serveNextPatient);
  }

  if (recallButton) {
    recallButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        recallPatient(currentServing.id);
      }
    });
  }

  if (skipButton) {
    skipButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        skipPatient(currentServing.id);
      }
    });
  }

  if (finishButton) {
    finishButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (currentServing) {
        finishPatient(currentServing.id);
      }
    });
  }

  // Follow-up button handler
  const followupButton = document.getElementById('doctor-followup-btn');
  const followupModal = document.getElementById('followup-modal');
  const followupForm = document.getElementById('followup-form');
  const cancelFollowupButton = document.getElementById('cancel-followup-btn');

  if (followupButton) {
    followupButton.addEventListener('click', () => {
      const currentServing = getCurrentServingPatient();
      if (!currentServing) {
        return;
      }

      const followupPatientName = document.getElementById('followup-patient-name');
      const followupPatientId = document.getElementById('followup-patient-id');

      if (followupPatientName && followupPatientId) {
        followupPatientName.textContent = `Patient: #${currentServing.queueNumber} — ${currentServing.name}`;
        followupPatientId.value = currentServing.id;
        followupModal.hidden = false;
      }
    });
  }

  if (cancelFollowupButton && followupModal) {
    cancelFollowupButton.addEventListener('click', () => {
      followupModal.hidden = true;
      followupForm.reset();
    });
  }

  if (followupForm) {
    followupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const patientId = document.getElementById('followup-patient-id')?.value || '';
      const followUpReason = document.getElementById('followup-reason')?.value || '';

      if (!patientId) {
        return;
      }

      postAction('send-to-followup', { id: patientId, followUpReason });
      followupModal.hidden = true;
      followupForm.reset();
    });
  }

  initHistoryEditForm();

  const quickQueueBtn = document.getElementById('doctor-quick-queue-btn');
  if (quickQueueBtn) {
    quickQueueBtn.addEventListener('click', () => {
      const queueNav = document.querySelector('.nav-item[data-page="queue"]');
      if (queueNav) {
        queueNav.click();
      }
    });
  }

  // Add click handler for edit-history button in consultation history
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) {
      const { action, id } = button.dataset;
      if (action === 'edit-history') {
        openHistoryEditModal(id);
      }
    }

    const doctorButton = event.target.closest('button[data-doctor-action]');
    if (!doctorButton) {
      return;
    }

    const { doctorAction, id } = doctorButton.dataset;
    if (doctorAction === 'serve') {
      servePatient(id);
    } else if (doctorAction === 'finish') {
      finishPatient(id);
    } else if (doctorAction === 'skip') {
      skipPatient(id);
    } else if (doctorAction === 'recall') {
      recallPatient(id);
    } else if (doctorAction === 'ready-for-doctor') {
      postAction('ready-for-doctor', { id });
    } else if (doctorAction === 'call-followup') {
      postAction('call-followup', { id });
    }
  });

  // Initialize Doctor YAKAP Prescriptions Feature
  initDoctorYakapPrescription();
}

function updateLiveClock() {
  const liveClock = document.getElementById('live-clock');
  const liveDate = document.getElementById('live-date');
  
  if (!liveClock) {
    return;
  }

  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const meridiem = now.getHours() >= 12 ? 'PM' : 'AM';
  liveClock.textContent = `${hours}:${minutes}:${seconds} ${meridiem}`;

  // Update date if element exists (for waiting room)
  if (liveDate) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    liveDate.textContent = now.toLocaleDateString('en-US', options);
  }
}

function initAdminAuth() {
  const loginForm = document.getElementById('admin-login-form');
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const logoutButton = document.getElementById('logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAdminLoginError('');

      const username = usernameInput?.value.trim() || '';
      const password = passwordInput?.value || '';
      const isAuthenticated = await loginAdmin(username, password);

      if (!isAuthenticated) {
        showAdminLoginError('Invalid username or password.');
      } else {
        loginForm.reset();
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', (event) => {
      event.preventDefault();
      openLogoutModal(async () => {
        await logoutAdmin();
      });
    });
  }

  setAdminView(isAdminAuthenticated());
}

function initDoctorAuth() {
  const loginForm = document.getElementById('doctor-login-form');
  const usernameInput = document.getElementById('doctor-username');
  const passwordInput = document.getElementById('doctor-password');
  const logoutButton = document.getElementById('doctor-logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showDoctorLoginError('');

      const username = usernameInput?.value.trim() || '';
      const password = passwordInput?.value || '';
      const isAuthenticated = await loginDoctor(username, password);

      if (!isAuthenticated) {
        showDoctorLoginError('Invalid username or password.');
      } else {
        loginForm.reset();
        // Reset notification state on successful login
        doctorNotificationState.previousPatientCount = state.patients.length;
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await logoutDoctor();
      setDoctorAuthenticated(false);
      setDoctorView(false);
      showDoctorLoginError('');
      setTimeout(() => {
        if (usernameInput) {
          usernameInput.focus();
        }
      }, 100);
    });
  }

  setDoctorView(isDoctorAuthenticated());
}

function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const closeHamburgerPopupBtn = document.getElementById('close-hamburger-popup');
  const consultationHistoryLink = document.getElementById('menu-consultation-history');
  const menuLogoutBtn = document.getElementById('menu-logout');
  const consultationHistorySection = document.getElementById('consultation-history-section');

  // Check if this is admin or doctor page
  const isAdminPage = document.getElementById('patient-list') !== null;
  const isDoctorPage = document.getElementById('doctor-patient-list') !== null;

  // Initially hide hamburger menu if not authenticated
  if (hamburgerBtn) {
    if (isAdminPage && !isAdminAuthenticated()) {
      hamburgerBtn.hidden = true;
    } else if (isDoctorPage && !isDoctorAuthenticated()) {
      hamburgerBtn.hidden = true;
    }
  }
  if (hamburgerMenu) {
    if (isAdminPage && !isAdminAuthenticated()) {
      hamburgerMenu.hidden = true;
    } else if (isDoctorPage && !isDoctorAuthenticated()) {
      hamburgerMenu.hidden = true;
    }
  }

  if (hamburgerBtn && hamburgerMenu) {
    // Toggle menu visibility
    hamburgerBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      hamburgerMenu.hidden = !hamburgerMenu.hidden;
      hamburgerBtn.classList.toggle('active', !hamburgerMenu.hidden);
    });

    // Close menu when clicking close button
    if (closeHamburgerPopupBtn) {
      closeHamburgerPopupBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        hamburgerMenu.hidden = true;
        hamburgerBtn.classList.remove('active');
      });
    }

    // Close menu when clicking outside (works for both desktop and mobile)
    document.addEventListener('click', (event) => {
      if (!hamburgerBtn.contains(event.target) && !hamburgerMenu.contains(event.target)) {
        hamburgerMenu.hidden = true;
        hamburgerBtn.classList.remove('active');
      }
    });

    // Consultation history link handler (doctor only)
    if (consultationHistoryLink && consultationHistorySection) {
      consultationHistoryLink.addEventListener('click', (event) => {
        event.preventDefault();
        consultationHistorySection.hidden = !consultationHistorySection.hidden;
        hamburgerMenu.hidden = true;
        hamburgerBtn.classList.remove('active');
      });
    }

    // Menu logout button handler
    if (menuLogoutBtn) {
      menuLogoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        openLogoutModal(async () => {
          if (isDoctorPage) {
            await logoutDoctor();
            hideDoctorNotification();
          } else if (isAdminPage) {
            await logoutAdmin();
          }
          if (hamburgerMenu) {
            hamburgerMenu.hidden = true;
          }
          if (hamburgerBtn) {
            hamburgerBtn.classList.remove('active');
          }
        });
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeSync();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  if (document.getElementById('patient-list')) {
    initAdminPage();
  }

  if (document.getElementById('admin-login-form')) {
    initAdminAuth();
  }

  if (document.getElementById('bhw-add-form')) {
    initBhwPage();
  }

  if (document.getElementById('doctor-patient-list')) {
    initDoctorPage();
  }

  if (document.getElementById('doctor-login-form')) {
    initDoctorAuth();
  }

  if (document.getElementById('hamburger-menu-btn')) {
    initHamburgerMenu();
  }

  if (document.getElementById('message-btn')) {
    initMessaging();
  }

});

// ============================================================================
// Modern Responsive Real-time Messaging (Doctor <-> Admin Direct Chat)
// ============================================================================
let chatBroadcastChannel = null;
let lastMessageId = 0;
let maxReadReceiptId = 0;
let soundEnabled = localStorage.getItem('messageSoundEnabled') !== 'false'; // Default to true
let isPollingMessages = false;
let messagePollInterval = null;

function getCurrentUserRole() {
  const isDoctorPage = Boolean(
    document.getElementById('doctor-patient-list') ||
    document.getElementById('doctor-login-form') ||
    document.getElementById('doctor-main-board') ||
    window.location.pathname.toLowerCase().includes('doctor')
  );

  const isAdminPage = Boolean(
    document.body.classList.contains('admin-body') ||
    document.getElementById('patient-list') ||
    document.getElementById('admin-login-form') ||
    window.location.pathname.toLowerCase().includes('admin')
  );

  if (isDoctorPage) {
    return 'doctor';
  }

  if (isAdminPage) {
    return 'admin';
  }

  if (isDoctorAuthenticated()) return 'doctor';
  if (isAdminAuthenticated()) return 'admin';
  return '';
}

function getChatPartnerRole() {
  const role = getCurrentUserRole();
  if (role === 'admin') return 'doctor';
  if (role === 'doctor') return 'admin';
  return '';
}

function getRoleDisplayName(role) {
  if (role === 'doctor') return 'Doc. Renz Sale';
  if (role === 'admin') return 'Admin Desk';
  return role ? role.toUpperCase() : 'Staff';
}

// Pleasant chime for new messages using Web Audio API + audio file fallback
function playMessageNotificationSound() {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // High-pitched gentle clinic bell (F5 -> A5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(698.46, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
      return;
    }
  } catch (e) {}

  try {
    const audio = new Audio('/assets/sounds/sound-9.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (e) {}
}

// Gentle tactile pop when user sends a message
function playSentMessageSound() {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {}
}

function showDesktopNotification(senderTitle, messageText) {
  if (!document.hidden) return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(`RHU II Chat: ${senderTitle}`, {
        body: messageText,
        icon: '/assets/logo.png',
        tag: 'rhu-chat-msg'
      });
      notification.onclick = () => {
        window.focus();
        const popup = document.getElementById('message-popup');
        if (popup && popup.hidden) {
          toggleMessagePopup();
        }
      };
    } catch (e) {}
  }
}

function broadcastChatEvent(payload) {
  const data = { ...payload, timestamp: Date.now() };
  if (chatBroadcastChannel) {
    try {
      chatBroadcastChannel.postMessage(data);
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }
  try {
    localStorage.setItem('queue-chat-event', JSON.stringify(data));
    localStorage.setItem('queue-chat-ts', String(data.timestamp));
  } catch (e) {}
}

function handleIncomingChatEvent(data) {
  if (!data || !data.type) return;

  if (data.type === 'new-message' && data.message) {
    const msg = data.message;
    const userRole = getCurrentUserRole();
    if (!userRole) return;

    if (!Array.isArray(state.messages)) state.messages = [];
    const exists = state.messages.some(m => m.id === msg.id || (m.tempId && m.message === msg.message && m.senderRole === msg.senderRole));

    if (!exists) {
      state.messages.push(msg);
      if (msg.id > lastMessageId) lastMessageId = msg.id;

      appendMessageToDom(msg);

      if (msg.senderRole !== userRole) {
        const popup = document.getElementById('message-popup');
        if (popup && !popup.hidden) {
          markMessagesAsRead();
        } else {
          state.unreadCount = (state.unreadCount || 0) + 1;
          updateMessageBadge();
          playMessageNotificationSound();
          showDesktopNotification(getRoleDisplayName(msg.senderRole), msg.message);
        }
      }
      smartScrollToBottom(true);
    }
  } else if (data.type === 'messages-read') {
    const userRole = getCurrentUserRole();
    if (data.readerRole && data.readerRole !== userRole) {
      markDomSentMessagesAsRead(data.maxId || 0);
    }
  } else if (data.type === 'cleanup') {
    state.messages = [];
    state.unreadCount = 0;
    lastMessageId = 0;
    renderAllMessages(true);
    updateMessageBadge();
  }
}

function initChatSync() {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      chatBroadcastChannel = new BroadcastChannel('queue-chat-channel');
      chatBroadcastChannel.addEventListener('message', (event) => {
        handleIncomingChatEvent(event.data);
      });
    } catch (e) {
      console.warn('BroadcastChannel init error:', e);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'queue-chat-event' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        handleIncomingChatEvent(payload);
      } catch (e) {}
    }
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('messageSoundEnabled', soundEnabled.toString());
  updateSoundButton();
  if (soundEnabled) {
    playMessageNotificationSound();
  }
}

function updateSoundButton() {
  const toggleSoundBtn = document.getElementById('toggle-sound-btn');
  if (toggleSoundBtn) {
    toggleSoundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-solid fa-bell-slash"></i>';
    toggleSoundBtn.title = soundEnabled ? 'Notification sound enabled (click to mute)' : 'Notification sound muted (click to enable)';
    toggleSoundBtn.classList.toggle('muted', !soundEnabled);
  }
}

function updateMessageBadge() {
  const messageBadge = document.getElementById('message-badge');
  if (messageBadge) {
    const count = Number(state.unreadCount) || 0;
    if (count > 0) {
      messageBadge.textContent = count > 9 ? '9+' : String(count);
      messageBadge.hidden = false;
    } else {
      messageBadge.hidden = true;
    }
  }
}

function updateChatHeaderInfo() {
  const userRole = getCurrentUserRole();
  const titleEl = document.getElementById('message-partner-title');
  const iconEl = document.getElementById('message-partner-icon');
  const statusEl = document.getElementById('message-partner-status');

  if (userRole === 'doctor') {
    if (titleEl) titleEl.textContent = 'Admin Desk';
    if (iconEl) iconEl.className = 'fa-solid fa-shield-halved';
    if (statusEl) statusEl.textContent = 'Online & Ready';
  } else if (userRole === 'admin') {
    if (titleEl) titleEl.textContent = 'Doc. Renz Sale';
    if (iconEl) iconEl.className = 'fa-solid fa-user-doctor';
    if (statusEl) statusEl.textContent = 'Consultation Room';
  }
}

function setupQuickReplies() {
  const quickContainer = document.getElementById('message-quick-replies');
  if (!quickContainer) return;

  const userRole = getCurrentUserRole();
  let replies = [];

  if (userRole === 'doctor') {
    replies = [
      { text: 'Next patient please', icon: 'fa-user-check' },
      { text: 'Needs laboratory test', icon: 'fa-flask-vial' },
      { text: 'Send patient to pharmacy', icon: 'fa-prescription-bottle-medical' },
      { text: 'Taking a 5-min break', icon: 'fa-mug-hot' },
      { text: 'Ready for consult', icon: 'fa-stethoscope' }
    ];
  } else if (userRole === 'admin') {
    replies = [
      { text: 'Next patient is ready', icon: 'fa-user-clock' },
      { text: 'Urgent / Priority patient', icon: 'fa-triangle-exclamation' },
      { text: 'Patient stepped out briefly', icon: 'fa-person-walking-arrow-right' },
      { text: 'Chart & vitals updated', icon: 'fa-clipboard-check' },
      { text: 'Noted, doctor', icon: 'fa-thumbs-up' }
    ];
  }

  quickContainer.innerHTML = replies.map(r => `
    <button type="button" class="quick-chip" data-text="${escapeHtml(r.text)}">
      <i class="fa-solid ${r.icon}"></i>
      <span>${escapeHtml(r.text)}</span>
    </button>
  `).join('');

  quickContainer.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = btn.getAttribute('data-text');
      if (text) {
        await sendMessage(text);
      }
    });
  });
}

function getChatDateLabel(dateString) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Today';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Today';
  }
}

function formatMessageTime(dateString) {
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function markDomSentMessagesAsRead(maxId) {
  const messageList = document.getElementById('message-list');
  if (!messageList) return;

  const sentItems = messageList.querySelectorAll('.message-item.sent');
  sentItems.forEach(item => {
    const id = Number(item.getAttribute('data-id')) || 0;
    if (!maxId || id <= maxId) {
      const statusSpan = item.querySelector('.msg-status');
      if (statusSpan) {
        statusSpan.className = 'msg-status read';
        statusSpan.innerHTML = '<i class="fa-solid fa-check-double" title="Read"></i>';
      }
    }
  });
}

function smartScrollToBottom(force = false) {
  const messageList = document.getElementById('message-list');
  const scrollBtn = document.getElementById('message-scroll-bottom-btn');
  if (!messageList) return;

  // Always scroll to bottom when force is true (new message arrived)
  messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
  if (scrollBtn) scrollBtn.hidden = true;
}

function renderAllMessages(forceScrollToBottom = false) {
  const messageList = document.getElementById('message-list');
  if (!messageList) return;

  if (!Array.isArray(state.messages) || state.messages.length === 0) {
    messageList.innerHTML = `
      <div class="message-empty-state">
        <i class="fa-solid fa-comments"></i>
        <strong>No messages yet</strong>
        <p>Send a message or select a quick reply below to communicate directly between Doctor and Admin.</p>
      </div>
    `;
    return;
  }

  const userRole = getCurrentUserRole();
  let lastDate = '';
  let html = '';

  state.messages.forEach(msg => {
    const dateLabel = getChatDateLabel(msg.createdAt);
    if (dateLabel !== lastDate) {
      html += `<div class="chat-date-divider">${dateLabel}</div>`;
      lastDate = dateLabel;
    }

    const isSent = msg.senderRole === userRole;
    const time = formatMessageTime(msg.createdAt);
    const senderName = getRoleDisplayName(msg.senderRole);
    const isRead = Boolean(msg.isRead) || (isSent && maxReadReceiptId >= msg.id);

    html += `
      <div class="message-item ${isSent ? 'sent' : 'received'}" data-id="${msg.id || ''}">
        ${!isSent ? `<div class="message-sender"><i class="fa-solid ${msg.senderRole === 'doctor' ? 'fa-user-doctor' : 'fa-shield-halved'}"></i> ${escapeHtml(senderName)}</div>` : ''}
        <div class="message-text">${escapeHtml(msg.message)}</div>
        <div class="message-footer">
          <span class="message-time">${time}</span>
          ${isSent ? `<span class="msg-status ${isRead ? 'read' : ''}"><i class="fa-solid fa-check${isRead ? '-double' : ''}" title="${isRead ? 'Read' : 'Sent'}"></i></span>` : ''}
        </div>
      </div>
    `;
  });

  messageList.innerHTML = html;

  // Always scroll to bottom when rendering messages
  messageList.scrollTop = messageList.scrollHeight;
}

// Backwards-compatible alias for existing callers
function renderMessages(forceScrollToBottom = false) {
  renderAllMessages(forceScrollToBottom);
}

function appendMessageToDom(msg) {
  const messageList = document.getElementById('message-list');
  if (!messageList) return;

  const emptyState = messageList.querySelector('.message-empty-state');
  if (emptyState) {
    messageList.innerHTML = '';
  }

  const userRole = getCurrentUserRole();
  const isSent = msg.senderRole === userRole;
  const time = formatMessageTime(msg.createdAt);
  const senderName = getRoleDisplayName(msg.senderRole);
  const isRead = Boolean(msg.isRead) || (isSent && maxReadReceiptId >= msg.id);

  // Check if date divider is needed
  const dateLabel = getChatDateLabel(msg.createdAt);
  const lastDivider = messageList.querySelector('.chat-date-divider:last-of-type');
  if (!lastDivider || lastDivider.textContent !== dateLabel) {
    const divider = document.createElement('div');
    divider.className = 'chat-date-divider';
    divider.textContent = dateLabel;
    messageList.appendChild(divider);
  }

  const item = document.createElement('div');
  item.className = `message-item ${isSent ? 'sent' : 'received'}`;
  if (msg.id) item.setAttribute('data-id', msg.id);
  if (msg.tempId) item.setAttribute('data-temp-id', msg.tempId);

  item.innerHTML = `
    ${!isSent ? `<div class="message-sender"><i class="fa-solid ${msg.senderRole === 'doctor' ? 'fa-user-doctor' : 'fa-shield-halved'}"></i> ${escapeHtml(senderName)}</div>` : ''}
    <div class="message-text">${escapeHtml(msg.message)}</div>
    <div class="message-footer">
      <span class="message-time">${time}</span>
      ${isSent ? `<span class="msg-status ${isRead ? 'read' : ''}"><i class="fa-solid fa-check${isRead ? '-double' : ''}" title="${isRead ? 'Read' : 'Sent'}"></i></span>` : ''}
    </div>
  `;

  messageList.appendChild(item);
}

// Merges incoming state messages without clearing user viewport
function syncMessagesFromBackend(incomingMessages = [], unreadCount = 0) {
  if (!Array.isArray(incomingMessages)) return;

  const userRole = getCurrentUserRole();
  if (!userRole) return;

  if (!Array.isArray(state.messages)) {
    state.messages = [];
  }

  const oldUnreadCount = state.unreadCount || 0;
  state.unreadCount = unreadCount;

  let hasNew = false;
  incomingMessages.forEach(msg => {
    if (!msg || !msg.id) return;
    const exists = state.messages.some(m => m.id === msg.id);
    if (!exists) {
      hasNew = true;
      state.messages.push(msg);
      if (msg.id > lastMessageId) lastMessageId = msg.id;

      const popup = document.getElementById('message-popup');
      if (popup && !popup.hidden) {
        appendMessageToDom(msg);
      }
    }
  });

  if (hasNew) {
    const popup = document.getElementById('message-popup');
    if (popup && !popup.hidden) {
      smartScrollToBottom(true);
      markMessagesAsRead();
    }
  }

  // If popup is open but empty state is showing while messages exist in state, re-render
  const popup = document.getElementById('message-popup');
  if (popup && !popup.hidden) {
    const messageList = document.getElementById('message-list');
    if (messageList && messageList.querySelector('.message-empty-state') && state.messages.length > 0) {
      renderAllMessages(true);
    }
  }

  if (oldUnreadCount !== state.unreadCount) {
    updateMessageBadge();
  }
}

// Lightweight incremental polling
async function pollMessages() {
  if (!isAdminAuthenticated() && !isDoctorAuthenticated()) return;
  if (isPollingMessages) return;
  isPollingMessages = true;

  try {
    const apiUrl = getBackendApiUrl();
    const userRole = getCurrentUserRole();
    if (!userRole) return;

    if (!Array.isArray(state.messages)) {
      state.messages = [];
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'poll-messages',
        userRole: userRole,
        lastId: lastMessageId
      }),
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const data = await response.json();
    if (data?.success) {
      if (typeof data.maxReadId === 'number') {
        maxReadReceiptId = data.maxReadId;
        markDomSentMessagesAsRead(maxReadReceiptId);
      }

      const newMessages = data.messages || [];

      if (lastMessageId === 0) {
        // Initial load
        state.messages = newMessages;
        if (newMessages.length > 0) {
          lastMessageId = Math.max(...newMessages.map(m => m.id));
        }
        renderAllMessages(true);
      } else if (newMessages.length > 0) {
        let hasForeignNew = false;

        newMessages.forEach(msg => {
          if (!msg || !msg.id) return;
          const exists = state.messages.some(m => m.id === msg.id);
          if (!exists) {
            state.messages.push(msg);
            if (msg.id > lastMessageId) lastMessageId = msg.id;

            appendMessageToDom(msg);

            if (msg.senderRole !== userRole) {
              hasForeignNew = true;
            }
          }
        });

        const popup = document.getElementById('message-popup');
        if (popup && !popup.hidden) {
          smartScrollToBottom(true);
          if (hasForeignNew) {
            markMessagesAsRead();
          }
        } else if (hasForeignNew) {
          playMessageNotificationSound();
          const lastMsg = newMessages[newMessages.length - 1];
          showDesktopNotification(getRoleDisplayName(lastMsg.senderRole), lastMsg.message);
        }
      }

      // If popup is open but empty state is showing while messages exist in state, re-render
      const popup = document.getElementById('message-popup');
      if (popup && !popup.hidden) {
        const messageList = document.getElementById('message-list');
        if (messageList && messageList.querySelector('.message-empty-state') && state.messages.length > 0) {
          renderAllMessages(true);
        }
      }

      state.unreadCount = data.unreadCount || 0;
      updateMessageBadge();
    }
  } catch (error) {
    console.warn('Message polling error:', error);
  } finally {
    isPollingMessages = false;
  }
}

async function markMessagesAsRead() {
  const userRole = getCurrentUserRole();
  if (!userRole) return;

  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark-messages-read',
        userRole: userRole
      }),
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const data = await response.json();
    if (data?.success) {
      state.unreadCount = 0;
      updateMessageBadge();

      broadcastChatEvent({
        type: 'messages-read',
        readerRole: userRole,
        maxId: lastMessageId
      });
    }
  } catch (e) {
    console.warn('markMessagesAsRead error:', e);
  }
}

async function sendMessage(message) {
  const text = (message || '').trim();
  if (!text) return;

  const userRole = getCurrentUserRole();
  const receiverRole = getChatPartnerRole();
  if (!userRole || !receiverRole) return;

  if (!Array.isArray(state.messages)) {
    state.messages = [];
  }

  const tempId = 'temp_' + Date.now();
  const optimisticMsg = {
    id: 0,
    tempId,
    senderRole: userRole,
    receiverRole: receiverRole,
    message: text,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  state.messages.push(optimisticMsg);
  appendMessageToDom(optimisticMsg);
  playSentMessageSound();
  smartScrollToBottom(true);

  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-message',
        message: text,
        senderRole: userRole,
        receiverRole: receiverRole
      }),
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const data = await response.json();
    if (data?.success && data.data) {
      const savedMsg = data.data;
      optimisticMsg.id = savedMsg.id;
      optimisticMsg.createdAt = savedMsg.createdAt;
      if (savedMsg.id > lastMessageId) lastMessageId = savedMsg.id;

      const messageList = document.getElementById('message-list');
      if (messageList) {
        const item = messageList.querySelector(`[data-temp-id="${tempId}"]`);
        if (item) {
          item.setAttribute('data-id', savedMsg.id);
          item.removeAttribute('data-temp-id');
          const timeSpan = item.querySelector('.message-time');
          if (timeSpan) timeSpan.textContent = formatMessageTime(savedMsg.createdAt);
          const statusSpan = item.querySelector('.msg-status');
          if (statusSpan) statusSpan.innerHTML = '<i class="fa-solid fa-check" title="Sent"></i>';
        }
      }

      broadcastChatEvent({
        type: 'new-message',
        message: savedMsg
      });
    } else {
      console.error('Failed to send message:', data?.message);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

function startFastMessagePolling() {
  stopFastMessagePolling();
  messagePollInterval = setInterval(() => {
    if (!document.hidden && (isAdminAuthenticated() || isDoctorAuthenticated())) {
      pollMessages();
    }
  }, 800);
}

function stopFastMessagePolling() {
  if (messagePollInterval) {
    clearInterval(messagePollInterval);
    messagePollInterval = null;
  }
}

async function toggleMessagePopup(forceOpen = false) {
  const messagePopup = document.getElementById('message-popup');
  if (!messagePopup) return;

  const willBeOpen = forceOpen || messagePopup.hidden;
  messagePopup.hidden = !willBeOpen;

  if (willBeOpen) {
    if (!Array.isArray(state.messages)) state.messages = [];
    updateChatHeaderInfo();
    setupQuickReplies();
    updateSoundButton();
    renderAllMessages(true);

    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }

    setTimeout(() => {
      markMessagesAsRead();
    }, 350);

    const input = document.getElementById('message-input');
    if (input) {
      setTimeout(() => input.focus(), 150);
    }

    // Immediately fetch latest messages from server
    pollMessages();
    startFastMessagePolling();
  } else {
    stopFastMessagePolling();
  }
}

function closeMessagePopup() {
  const messagePopup = document.getElementById('message-popup');
  if (messagePopup) {
    messagePopup.hidden = true;
    stopFastMessagePolling();
  }
}

function initMessaging() {
  const messageBtn = document.getElementById('message-btn');
  const closeMessagePopupBtn = document.getElementById('close-message-popup');
  const cleanupMessagesBtn = document.getElementById('cleanup-messages-btn');
  const toggleSoundBtn = document.getElementById('toggle-sound-btn');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const messagePopup = document.getElementById('message-popup');
  const scrollBottomBtn = document.getElementById('message-scroll-bottom-btn');
  const messageList = document.getElementById('message-list');

  initChatSync();

  if (messageBtn) {
    messageBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMessagePopup();
    });
  }

  if (closeMessagePopupBtn) {
    closeMessagePopupBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMessagePopup();
    });
  }

  if (cleanupMessagesBtn) {
    cleanupMessagesBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (confirm('Delete all messages older than 24 hours?')) {
        await postAction('cleanup-messages');
        state.messages = [];
        state.unreadCount = 0;
        lastMessageId = 0;
        renderAllMessages(true);
        updateMessageBadge();
        broadcastChatEvent({ type: 'cleanup' });
      }
    });
  }

  if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSound();
    });
  }



  if (messageForm && messageInput) {
    messageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const message = messageInput.value.trim();
      if (message) {
        messageInput.value = '';
        messageInput.focus();
        await sendMessage(message);
      }
    });
  }

  // Close popup when clicking outside (works for both desktop and mobile)
  if (messagePopup) {
    document.addEventListener('click', (event) => {
      if (!messagePopup.hidden && !messagePopup.contains(event.target) && messageBtn && !messageBtn.contains(event.target)) {
        closeMessagePopup();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !messagePopup.hidden) {
        closeMessagePopup();
      }
    });
  }

  // Visibility based on authentication
  if (messageBtn && !isAdminAuthenticated() && !isDoctorAuthenticated()) {
    messageBtn.hidden = true;
  }

  // Initial poll for messages if authenticated
  if (isAdminAuthenticated() || isDoctorAuthenticated()) {
    pollMessages();
  }
}

// YouTube Playlist Player for Waiting Room
let youtubePlayer = null;
let currentLoadedPlaylistId = null;
let currentPlaylistEnabled = null;
let pendingVideoPlay = false;

function isYoutubePlaylistId(id) {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim();
  return /^(PL|UU|LL|FL|RD|OL|TL)[a-zA-Z0-9_-]+$/i.test(clean) || (clean.length > 20 && !clean.includes(','));
}

function buildYouTubeEmbedUrl(mediaId, options = {}) {
  const origin = window.location.origin || '';
  const autoplay = options.autoplay ? 1 : 0;
  const controls = options.controls !== undefined ? options.controls : 1;
  const cleanId = (mediaId || '').trim();

  if (!cleanId) return '';

  if (cleanId.includes(',')) {
    const ids = cleanId.split(',').map(s => s.trim()).filter(Boolean);
    const firstId = ids[0] || '';
    return `https://www.youtube.com/embed/${encodeURIComponent(firstId)}?playlist=${encodeURIComponent(ids.join(','))}&autoplay=${autoplay}&controls=${controls}&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
  } else if (isYoutubePlaylistId(cleanId)) {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(cleanId)}&autoplay=${autoplay}&controls=${controls}&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
  } else {
    return `https://www.youtube.com/embed/${encodeURIComponent(cleanId)}?playlist=${encodeURIComponent(cleanId)}&loop=1&autoplay=${autoplay}&controls=${controls}&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
  }
}

function postToPlayerIframe(func, args = []) {
  try {
    const iframes = document.querySelectorAll(
      '#youtube-player iframe, iframe#youtube-player, .youtube-player-container iframe, #video-preview-frame iframe, iframe#admin-preview-iframe'
    );
    iframes.forEach((iframe) => {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: func,
          args: args
        }), '*');
      }
    });
  } catch (err) {
    console.warn('postToPlayerIframe error:', err);
  }
}

function showUnmuteNotice() {
  const notice = document.getElementById('video-unmute-notice');
  if (notice) {
    notice.hidden = false;
  }
}

function hideUnmuteNotice() {
  const notice = document.getElementById('video-unmute-notice');
  if (notice) {
    notice.hidden = true;
  }
}

function unmuteYouTubePlayer() {
  if (youtubePlayer) {
    try {
      if (typeof youtubePlayer.unMute === 'function') youtubePlayer.unMute();
      if (typeof youtubePlayer.setVolume === 'function') youtubePlayer.setVolume(100);
    } catch (e) {}
  }
  postToPlayerIframe('unMute');
  postToPlayerIframe('setVolume', [100]);
  hideUnmuteNotice();

  // If the browser strictly blocked audio due to autoplay policy requiring user interaction, re-show notice
  setTimeout(() => {
    try {
      if (youtubePlayer && typeof youtubePlayer.isMuted === 'function' && youtubePlayer.isMuted()) {
        showUnmuteNotice();
      }
    } catch (e) {}
  }, 400);
}

function forceAutoplay(player) {
  if (!player) return;

  // Ensure iframe permissions and referrer policy allow autoplay and cross-origin embed across all browsers
  try {
    const iframe = typeof player.getIframe === 'function' ? player.getIframe() : (typeof player.getIFrame === 'function' ? player.getIFrame() : document.querySelector('#youtube-player iframe, iframe#youtube-player'));
    if (iframe) {
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', '1');
    }
  } catch (e) {}

  // 1. First attempt: unmuted playback
  try {
    if (typeof player.playVideo === 'function') {
      player.playVideo();
    }
  } catch (e) {}
  postToPlayerIframe('playVideo');

  // 2. Browser Autoplay Policy Verification:
  // If the browser blocked unmuted autoplay, player will stay unstarted (-1) or paused (2).
  // Muting guarantees immediate autoplay without requiring navigation or interaction on index.html.
  setTimeout(() => {
    try {
      const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
      // 1 = playing, 3 = buffering
      if (playerState !== 1 && playerState !== 3) {
        console.log('Autoplay with audio blocked by browser policy. Automatically muting to ensure automatic playback on patient display...');
        if (typeof player.mute === 'function') {
          player.mute();
        }
        postToPlayerIframe('mute');
        if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
        postToPlayerIframe('playVideo');
        showUnmuteNotice();
      } else {
        // Playing with audio succeeded!
        hideUnmuteNotice();
      }
    } catch (err) {
      console.warn('Player state check error, applying mute fallback:', err);
      try {
        if (typeof player.mute === 'function') player.mute();
        postToPlayerIframe('mute');
        if (typeof player.playVideo === 'function') player.playVideo();
        postToPlayerIframe('playVideo');
        showUnmuteNotice();
      } catch (e) {}
    }
  }, 600);
}

function advancePlaylistNext() {
  let handled = false;
  if (youtubePlayer) {
    try {
      if (typeof youtubePlayer.nextVideo === 'function') {
        youtubePlayer.nextVideo();
        handled = true;
      }
    } catch (e) {
      console.warn('advancePlaylistNext nextVideo error:', e);
    }
    if (!handled) {
      try {
        if (typeof youtubePlayer.getPlaylistIndex === 'function' && typeof youtubePlayer.playVideoAt === 'function') {
          const curIdx = youtubePlayer.getPlaylistIndex();
          const playlist = typeof youtubePlayer.getPlaylist === 'function' ? youtubePlayer.getPlaylist() : null;
          if (playlist && playlist.length > 0) {
            const nextIdx = (curIdx >= 0) ? ((curIdx + 1) % playlist.length) : 0;
            youtubePlayer.playVideoAt(nextIdx);
            handled = true;
          }
        }
      } catch (e) {
        console.warn('advancePlaylistNext playVideoAt error:', e);
      }
    }
  }
  postToPlayerIframe('nextVideo');
}

function advancePlaylistPrev() {
  let handled = false;
  if (youtubePlayer) {
    try {
      if (typeof youtubePlayer.previousVideo === 'function') {
        youtubePlayer.previousVideo();
        handled = true;
      }
    } catch (e) {
      console.warn('advancePlaylistPrev previousVideo error:', e);
    }
    if (!handled) {
      try {
        if (typeof youtubePlayer.getPlaylistIndex === 'function' && typeof youtubePlayer.playVideoAt === 'function') {
          const curIdx = youtubePlayer.getPlaylistIndex();
          const playlist = typeof youtubePlayer.getPlaylist === 'function' ? youtubePlayer.getPlaylist() : null;
          if (playlist && playlist.length > 0) {
            const prevIdx = (curIdx > 0) ? (curIdx - 1) : (playlist.length - 1);
            youtubePlayer.playVideoAt(prevIdx);
            handled = true;
          }
        }
      } catch (e) {
        console.warn('advancePlaylistPrev playVideoAt error:', e);
      }
    }
  }
  postToPlayerIframe('previousVideo');
  postToPlayerIframe('prevVideo');
}

function stopYouTubePlayer() {
  const placeholder = document.getElementById('youtube-placeholder');
  const subtitle = document.querySelector('.video-card .card-subtitle');
  if (subtitle) subtitle.textContent = 'YouTube playlist';
  if (placeholder) {
    placeholder.hidden = false;
    const placeholderText = document.querySelector('.placeholder-text');
    if (placeholderText) {
      placeholderText.textContent = 'Broadcasting paused by administrator';
    }
  }

  if (youtubePlayer) {
    try {
      if (typeof youtubePlayer.stopVideo === 'function') {
        youtubePlayer.stopVideo();
      }
      if (typeof youtubePlayer.destroy === 'function') {
        youtubePlayer.destroy();
      }
    } catch (e) {}
    youtubePlayer = null;
  }
  postToPlayerIframe('stopVideo');

  const playerEl = document.getElementById('youtube-player');
  if (playerEl) {
    playerEl.remove();
  }

  currentLoadedPlaylistId = null;
  currentPlaylistEnabled = false;
  hideUnmuteNotice();
}

function recreateYouTubePlayer(forcePlay = true) {
  if (youtubePlayer) {
    try {
      if (typeof youtubePlayer.destroy === 'function') {
        youtubePlayer.destroy();
      }
    } catch (e) {}
    youtubePlayer = null;
  }
  const existingPlayer = document.getElementById('youtube-player');
  if (existingPlayer) {
    existingPlayer.remove();
  }
  currentLoadedPlaylistId = null;
  currentPlaylistEnabled = null;
  initYouTubePlayer(forcePlay);
}

function handleRemoteVideoCommand(command, videoConfig = null) {
  const isWaitingRoom = document.body.classList.contains('waiting-room');
  const isAdmin = document.body.classList.contains('admin-body');

  console.log('Remote video command received:', command, videoConfig);

  if (command === 'play') {
    if (videoConfig && videoConfig.playlistId) {
      state.videoConfig = videoConfig;
      if (isWaitingRoom) recreateYouTubePlayer(true);
      if (isAdmin) loadVideoConfigDisplay();
    } else {
      fetchState().then(() => {
        if (isWaitingRoom) recreateYouTubePlayer(true);
        if (isAdmin) loadVideoConfigDisplay();
      });
    }
  } else if (command === 'stop') {
    if (videoConfig) state.videoConfig = videoConfig;
    if (isWaitingRoom) stopYouTubePlayer();
    if (isAdmin) loadVideoConfigDisplay();
  } else if (command === 'pause') {
    if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
      try { youtubePlayer.pauseVideo(); } catch (e) {}
    }
    postToPlayerIframe('pauseVideo');
    if (isAdmin) updateRemotePauseUI(true);
  } else if (command === 'resume') {
    if (youtubePlayer && typeof youtubePlayer.playVideo === 'function') {
      try { youtubePlayer.playVideo(); } catch (e) {}
    }
    postToPlayerIframe('playVideo');
    if (isAdmin) updateRemotePauseUI(false);
  } else if (command === 'next') {
    advancePlaylistNext();
  } else if (command === 'prev') {
    advancePlaylistPrev();
  } else if (command === 'unmute') {
    unmuteYouTubePlayer();
  }
}

let consecutiveVideoErrors = 0;

function initYouTubePlayer(forcePlay = false) {
  const videoConfig = state.videoConfig;
  const placeholder = document.getElementById('youtube-placeholder');
  const playerContainer = document.getElementById('youtube-player-container');
  const subtitle = document.querySelector('.video-card .card-subtitle');

  if (!videoConfig || !videoConfig.isEnabled || !videoConfig.playlistId) {
    stopYouTubePlayer();
    const placeholderText = document.querySelector('.placeholder-text');
    if (placeholderText) {
      placeholderText.textContent = 'No playlist configured';
    }
    return;
  }

  // Active playlist configured
  if (subtitle && videoConfig.playlistTitle) {
    subtitle.textContent = videoConfig.playlistTitle;
  }

  // If already playing this playlist and not forced, don't restart it on every poll
  if (currentLoadedPlaylistId === videoConfig.playlistId && currentPlaylistEnabled === true && !forcePlay && youtubePlayer) {
    const playerEl = document.getElementById('youtube-player');
    if (playerEl) playerEl.style.display = '';
    if (placeholder) placeholder.hidden = true;
    return;
  }

  // YouTube API might not be loaded yet
  if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
    pendingVideoPlay = true;
    return;
  }

  // If forcePlay requested or playlist changed, cleanly destroy existing player first
  if (youtubePlayer && (forcePlay || currentLoadedPlaylistId !== videoConfig.playlistId)) {
    try {
      if (typeof youtubePlayer.destroy === 'function') {
        youtubePlayer.destroy();
      }
    } catch (e) {}
    youtubePlayer = null;
    const existingEl = document.getElementById('youtube-player');
    if (existingEl) existingEl.remove();
  }

  if (placeholder) placeholder.hidden = true;

  // Ensure fresh player div element exists in container
  let playerDiv = document.getElementById('youtube-player');
  if (!playerDiv) {
    playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player';
    playerDiv.className = 'youtube-player';
    if (playerContainer) playerContainer.appendChild(playerDiv);
  }
  playerDiv.style.display = '';

  const cleanId = (videoConfig.playlistId || '').trim();
  const isPlaylist = isYoutubePlaylistId(cleanId);
  const isMulti = cleanId.includes(',');
  const isPaused = Boolean(videoConfig.isPaused);

  let playerConfig = {
    height: '100%',
    width: '100%',
    playerVars: {
      'autoplay': isPaused ? 0 : 1,
      'controls': 1,
      'rel': 0,
      'loop': 1,
      'modestbranding': 1,
      'playsinline': 1,
      'enablejsapi': 1,
      'origin': window.location.origin
    },
    events: {
      'onReady': (event) => {
        if (placeholder) placeholder.hidden = true;
        try {
          const iframe = typeof event.target.getIframe === 'function' ? event.target.getIframe() : (typeof event.target.getIFrame === 'function' ? event.target.getIFrame() : document.querySelector('#youtube-player iframe, iframe#youtube-player'));
          if (iframe) {
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
            iframe.setAttribute('allowfullscreen', '1');
          }
        } catch (e) {}

        if (state.videoConfig && state.videoConfig.isPaused) {
          try { event.target.pauseVideo(); } catch (e) {}
          postToPlayerIframe('pauseVideo');
        } else {
          forceAutoplay(event.target);
        }
      },
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  };

  if (isPlaylist) {
    playerConfig.playerVars.list = cleanId;
    playerConfig.playerVars.listType = 'playlist';
  } else if (isMulti) {
    const ids = cleanId.split(',').map(s => s.trim()).filter(Boolean);
    playerConfig.videoId = ids[0];
    playerConfig.playerVars.playlist = ids.join(',');
  } else {
    playerConfig.videoId = cleanId;
    playerConfig.playerVars.playlist = cleanId;
  }

  // Create new player with autoplay, loop, and API enabled
  try {
    youtubePlayer = new YT.Player('youtube-player', playerConfig);
    currentLoadedPlaylistId = videoConfig.playlistId;
    currentPlaylistEnabled = true;
  } catch (err) {
    console.error('Error creating YouTube player:', err);
  }
}

function onPlayerStateChange(event) {
  // YT.PlayerState.PLAYING = 1
  if (event.data === 1) {
    consecutiveVideoErrors = 0;
  }
  // YT.PlayerState.ENDED = 0
  if (event.data === 0) {
    console.log('Video finished. Auto-advancing to next video in playlist...');
    advancePlaylistNext();
  }
}

function onPlayerError(event) {
  console.warn('YouTube player error code:', event.data);
  consecutiveVideoErrors++;

  // Auto-recovery: if a video in a playlist encounters an error (e.g. 100, 101, 150, 153),
  // automatically advance to the next video in the playlist
  if (consecutiveVideoErrors < 10) {
    console.log('Skipping unplayable video to next video in playlist...');
    advancePlaylistNext();
    return;
  }

  // If every video in the playlist failed:
  console.warn('All videos in playlist failed or playlist is private.');
  const placeholder = document.getElementById('youtube-placeholder');
  const placeholderText = document.querySelector('.placeholder-text');
  if (placeholder) {
    placeholder.hidden = false;
    if (placeholderText) {
      placeholderText.textContent = 'Playlist or video unavailable. Please verify YouTube privacy is set to Public/Unlisted.';
    }
  }
}

// Update YouTube player when video config changes
function updateYouTubePlayer() {
  if (document.body.classList.contains('waiting-room')) {
    initYouTubePlayer();
  }
}

// YouTube API callback
function onYouTubeIframeAPIReady() {
  if (document.body.classList.contains('waiting-room')) {
    initYouTubePlayer(pendingVideoPlay);
    pendingVideoPlay = false;
  }
}

// Waiting Room: Global click/touch listener to unmute video once user interacts
if (document.body.classList.contains('waiting-room')) {
  document.addEventListener('click', () => {
    unmuteYouTubePlayer();
  });

  document.addEventListener('keydown', () => {
    unmuteYouTubePlayer();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const noticeBtn = document.getElementById('video-unmute-notice');
    if (noticeBtn) {
      noticeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unmuteYouTubePlayer();
      });
    }
  });
}

// Admin Dashboard Navigation
function initAdminNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pageSections = document.querySelectorAll('.page-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPage = item.dataset.page;

      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show target page section
      pageSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `page-${targetPage}`) {
          section.classList.add('active');
        }
      });

      // Special handling when navigating to YAKAP Prescription tab
      if (targetPage === 'yakap-prescription') {
        if (document.getElementById('doctor-prescriptions-table-body')) {
          updateDoctorServingBadge();
          renderDoctorPrescriptions();
        }
        if (document.getElementById('admin-yakap-prescriptions-table-body')) {
          renderAdminPrescriptions();
        }
      }
    });
  });
}

// Professional Sidebar Collapse & Tooltip State Manager (Admin & Doctor)
function initSidebarCollapse() {
  const sidebar = document.querySelector('.admin-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar) return;

  // Restore persisted collapse state from localStorage
  const isSavedCollapsed = localStorage.getItem('rhu_sidebar_collapsed') === 'true';
  if (isSavedCollapsed) {
    sidebar.classList.add('collapsed');
    if (toggleBtn) {
      toggleBtn.setAttribute('title', 'Expand sidebar');
      toggleBtn.setAttribute('aria-label', 'Expand sidebar');
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isCollapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem('rhu_sidebar_collapsed', isCollapsed ? 'true' : 'false');
      toggleBtn.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
      toggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });
  }
}

// Update Dashboard Statistics
function updateDashboardStats() {
  const queueCount = getWaitingPatients().length;
  const servingPatient = getCurrentServingPatient();
  const followUpCount = getFollowUpPatients().length;
  const completedToday = state.consultationHistory?.filter(entry => {
    const today = new Date().toDateString();
    return new Date(entry.finishedAt).toDateString() === today;
  }).length || 0;

  const statQueueCount = document.getElementById('stat-queue-count');
  const statServing = document.getElementById('stat-serving');
  const statCompleted = document.getElementById('stat-completed');
  const statFollowup = document.getElementById('stat-followup');

  if (statQueueCount) statQueueCount.textContent = queueCount;
  if (statServing) statServing.textContent = servingPatient ? `#${servingPatient.queueNumber}` : '---';
  if (statCompleted) statCompleted.textContent = completedToday;
  if (statFollowup) statFollowup.textContent = followUpCount;

  // Real-time Sidebar Badges (Admin & Doctor)
  const sidebarQueueBadge = document.getElementById('sidebar-queue-badge');
  const sidebarFollowupBadge = document.getElementById('sidebar-followup-badge');

  if (sidebarQueueBadge) {
    sidebarQueueBadge.textContent = queueCount;
    sidebarQueueBadge.hidden = queueCount <= 0;
  }
  if (sidebarFollowupBadge) {
    sidebarFollowupBadge.textContent = followUpCount;
    sidebarFollowupBadge.hidden = followUpCount <= 0;
  }

  // Update chart
  updateConsultationChart();
}

// Consultation Chart
let consultationChart = null;
let lastChartUpdateDate = null;
let lastChartUpdateYear = null;

function updateConsultationChart() {
  const canvas = document.getElementById('consultation-chart');
  const yearSelect = document.getElementById('chart-year');

  if (!canvas || !yearSelect) {
    return;
  }

  // Only update chart once per day or when year changes
  const today = new Date().toDateString();
  const selectedYear = parseInt(yearSelect.value);

  if (lastChartUpdateDate === today && lastChartUpdateYear === selectedYear) {
    return; // Skip update if already updated today for this year
  }

  // Populate year dropdown based on consultation history
  if (state.consultationHistory && state.consultationHistory.length > 0) {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    state.consultationHistory.forEach(entry => {
      if (entry.finishedAt) {
        try {
          const date = new Date(entry.finishedAt + 'Z');
          years.add(date.getFullYear());
        } catch (e) {
          // Skip invalid dates
        }
      }
    });

    // Clear existing options
    yearSelect.innerHTML = '';

    // Add years in descending order
    Array.from(years).sort((a, b) => b - a).forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    });
  } else {
    // No history, show current year only
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = `<option value="${currentYear}" selected>${currentYear}</option>`;
  }

  // Process consultation history by quarter
  const quarterlyData = [0, 0, 0, 0]; // Q1, Q2, Q3, Q4

  if (state.consultationHistory && state.consultationHistory.length > 0) {
    state.consultationHistory.forEach(entry => {
      if (entry.finishedAt) {
        try {
          const date = new Date(entry.finishedAt + 'Z');
          const entryYear = date.getFullYear();

          if (entryYear === selectedYear) {
            const month = date.getMonth(); // 0-11
            const quarter = Math.floor(month / 3); // 0-3
            quarterlyData[quarter]++;
          }
        } catch (e) {
          // Skip invalid dates
        }
      }
    });
  }

  // Destroy existing chart if it exists
  if (consultationChart) {
    consultationChart.destroy();
  }

  // Create new chart
  const ctx = canvas.getContext('2d');
  consultationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'],
      datasets: [{
        label: 'Consultations',
        data: quarterlyData,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2563EB',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#2563EB',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#64748B',
            stepSize: 1
          },
          grid: {
            color: '#E2E8F0'
          }
        },
        x: {
          ticks: {
            color: '#64748B'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  // Mark as updated
  lastChartUpdateDate = today;
  lastChartUpdateYear = selectedYear;
}

// Initialize admin navigation on page load
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('admin-body')) {
    initAdminNavigation();
    initSidebarCollapse();

    // Connect logout button with modern confirmation modal
    const logoutBtn = document.getElementById('menu-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        openLogoutModal(async () => {
          if (document.getElementById('doctor-patient-list')) {
            await logoutDoctor();
            hideDoctorNotification();
          } else {
            await logoutAdmin();
          }
        });
      });
    }

    // Auto-initialize Yakap features on DOMContentLoaded if elements exist
    if (document.getElementById('yakap-dropzone') || document.getElementById('doctor-prescriptions-table-body')) {
      initDoctorYakapPrescription();
    }
    if (document.getElementById('admin-yakap-prescriptions-table-body')) {
      initAdminYakapPrescription();
    }
  }
});

// ============================================================================
// YAKAP PRESCRIPTION SYSTEM (Doctor Drag & Drop PDF -> PNG -> Admin Half-A4 Print)
// ============================================================================

let yakapSelectedPdfFile = null;
let yakapConvertedPngPages = [];
let yakapCurrentPrintingRxId = null;

/**
 * Broadcasts prescription state updates to all open windows/tabs and stores in localStorage
 */
function broadcastPrescriptions(prescriptions) {
  if (updateChannel) {
    try {
      updateChannel.postMessage({ type: 'yakap-prescriptions-update', prescriptions });
    } catch (e) {
      console.warn('BroadcastChannel yakap update error:', e);
    }
  }
  try {
    localStorage.setItem('rhu-prescriptions-sync', JSON.stringify({ prescriptions, timestamp: Date.now() }));
    localStorage.setItem('rhu-prescriptions-event', String(Date.now()));
  } catch (e) {
    console.warn('localStorage yakap update error:', e);
  }
}

/**
 * Synchronizes prescriptions into local state and triggers re-renders
 */
function syncPrescriptionsFromBackend(prescriptions) {
  if (!Array.isArray(prescriptions)) return;
  state.prescriptions = prescriptions;

  try {
    localStorage.setItem('rhu_yakap_prescriptions_cache', JSON.stringify(prescriptions));
  } catch (e) {}

  if (document.getElementById('doctor-prescriptions-table-body')) {
    renderDoctorPrescriptions();
  }
  if (document.getElementById('admin-yakap-prescriptions-table-body')) {
    renderAdminPrescriptions();
  }
}

/**
 * Helper to get the displayable PNG image URL for a prescription
 */
function getPrescriptionPngUrl(rx) {
  if (!rx) return 'assets/logo.png';
  if (rx.pngPath) return rx.pngPath;
  if (Array.isArray(rx.pngPaths) && rx.pngPaths.length > 0) return rx.pngPaths[0];
  if (Array.isArray(rx.pngPages) && rx.pngPages.length > 0) return rx.pngPages[0];
  if (rx.pngData) return rx.pngData;
  return 'assets/logo.png';
}

/**
 * Reads a File object as Base64 Data URL
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a PDF File into high-resolution PNG Data URLs using PDF.js
 * Each page is rendered at scale 2.0 (~150-200 DPI) on a solid white canvas
 */
async function convertPdfFileToPngPages(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js conversion library is not loaded. Please verify assets/pdf.min.js.');
  }

  // Ensure worker is configured
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
  }

  let arrayBuffer;
  if (typeof file.arrayBuffer === 'function') {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const renderedPages = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    // Scale 2.0 renders crisp text and graphics ideal for Half-A4 (A5) printing
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');

    // Fill white background to prevent dark or transparent rendering on print
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    const pngDataUrl = canvas.toDataURL('image/png', 0.95);

    renderedPages.push({
      pageNum,
      dataUrl: pngDataUrl,
      width: viewport.width,
      height: viewport.height,
      isLandscape: viewport.width >= viewport.height
    });
  }

  return renderedPages;
}

/**
 * Handles Doctor PDF file selection from Drag & Drop or file dialog.
 * STRICT REQUIREMENT: Only PDF files are accepted. Any other format is rejected with an alert.
 */
async function handleDoctorPdfSelection(file) {
  if (!file) return;

  const dropError = document.getElementById('yakap-drop-error');
  const dropErrorText = document.getElementById('yakap-drop-error-text');
  const dropzone = document.getElementById('yakap-dropzone');
  const processingCard = document.getElementById('yakap-file-processing');
  const fileNameEl = document.getElementById('yakap-file-name');
  const fileDetailsEl = document.getElementById('yakap-file-details');
  const conversionStatus = document.getElementById('yakap-conversion-status');
  const conversionText = document.getElementById('yakap-conversion-text');
  const previewContainer = document.getElementById('yakap-png-preview-container');
  const sendBtn = document.getElementById('btn-send-prescription-admin');

  // STRICT VALIDATION: Check file type and filename extension
  const isPdf = file && (
    file.type === 'application/pdf' ||
    (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf'))
  );

  if (!isPdf) {
    if (dropError) {
      if (dropErrorText) {
        dropErrorText.innerHTML = `<strong>Invalid File Type!</strong> Strictly PDF files only. You selected <code>${escapeHtml(file.name || 'unrecognized file')}</code> (${file.type || 'unknown format'}). Please drag and drop a valid .pdf file.`;
      }
      dropError.hidden = false;
      dropError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (dropzone) {
      dropzone.classList.add('shake');
      setTimeout(() => dropzone.classList.remove('shake'), 600);
    }
    if (processingCard) processingCard.hidden = true;
    const fileInput = document.getElementById('yakap-pdf-file-input');
    if (fileInput) fileInput.value = '';
    return;
  }

  // File is valid PDF: hide error alert
  if (dropError) dropError.hidden = true;

  yakapSelectedPdfFile = file;
  yakapConvertedPngPages = [];

  // Update file info display
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileDetailsEl) {
    const sizeKb = (file.size / 1024).toFixed(1);
    fileDetailsEl.textContent = `${sizeKb} KB • PDF Document`;
  }

  // Pre-fill patient details if doctor is currently serving
  linkDoctorServingPatientToYakap(false);

  // Show processing card, hide dropzone
  if (processingCard) processingCard.hidden = false;
  if (dropzone) dropzone.style.display = 'none';

  // Set converting status UI
  if (conversionStatus) {
    conversionStatus.className = 'yakap-conversion-status converting';
    if (conversionText) {
      conversionText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting PDF pages to high-resolution PNG for printing...';
    }
  }

  if (previewContainer) {
    previewContainer.innerHTML = `
      <div style="padding: 36px 16px; text-align: center; color: var(--text-muted, #64748b);">
        <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #2563eb; margin-bottom: 10px;"></i>
        <p style="margin: 0; font-size: 0.95rem;">Rendering PDF pages to PNG (High-DPI)...</p>
      </div>
    `;
  }

  if (sendBtn) sendBtn.disabled = true;

  try {
    const pages = await convertPdfFileToPngPages(file);
    yakapConvertedPngPages = pages;

    if (conversionStatus) {
      conversionStatus.className = 'yakap-conversion-status success';
      if (conversionText) {
        conversionText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Converted ${pages.length} page${pages.length > 1 ? 's' : ''} to high-resolution PNG successfully (Ready for Half-A4 Landscape print)`;
      }
    }

    // Render Preview
    if (previewContainer && pages.length > 0) {
      const primaryPage = pages[0];
      const pageCounter = document.getElementById('yakap-page-counter');
      if (pageCounter) {
        pageCounter.textContent = `Page 1 of ${pages.length}`;
      }

      previewContainer.innerHTML = `
        <div class="yakap-png-preview-card" style="cursor: zoom-in; position: relative;" title="Click to view full-resolution PNG">
          <img src="${primaryPage.dataUrl}" alt="Converted PNG Preview" class="yakap-preview-img" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);" />
          <div style="margin-top: 10px; font-size: 0.85rem; color: #2563eb; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600;">
            <i class="fa-solid fa-magnifying-glass-plus"></i> Click preview to inspect full size PNG
          </div>
        </div>
      `;

      previewContainer.querySelector('.yakap-png-preview-card')?.addEventListener('click', () => {
        openImageViewModal(primaryPage.dataUrl, `Prescription Preview — ${file.name}`);
      });
    }

    if (sendBtn) sendBtn.disabled = false;
  } catch (err) {
    console.error('PDF Conversion error:', err);
    if (conversionStatus) {
      conversionStatus.className = 'yakap-conversion-status error';
      if (conversionText) {
        conversionText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error converting PDF: ${escapeHtml(err.message || 'Unknown error')}`;
      }
    }
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #dc2626;">
          <i class="fa-solid fa-circle-xmark fa-2x" style="margin-bottom: 8px;"></i>
          <p>Failed to convert PDF. Please make sure the file is a valid PDF document.</p>
        </div>
      `;
    }
    if (sendBtn) sendBtn.disabled = true;
  }
}

/**
 * Resets the Doctor PDF upload state back to clean dropzone
 */
function resetDoctorPdfUpload() {
  yakapSelectedPdfFile = null;
  yakapConvertedPngPages = [];

  const dropzone = document.getElementById('yakap-dropzone');
  const fileInput = document.getElementById('yakap-pdf-file-input');
  const processingCard = document.getElementById('yakap-file-processing');
  const dropError = document.getElementById('yakap-drop-error');
  const previewContainer = document.getElementById('yakap-png-preview-container');
  const sendBtn = document.getElementById('btn-send-prescription-admin');

  if (fileInput) fileInput.value = '';
  if (dropError) dropError.hidden = true;
  if (processingCard) processingCard.hidden = true;
  if (dropzone) {
    dropzone.style.display = 'block';
    dropzone.classList.remove('dragover');
  }
  if (previewContainer) previewContainer.innerHTML = '';
  if (sendBtn) sendBtn.disabled = true;

  const patInput = document.getElementById('doctor-prescription-patient');
  const queueInput = document.getElementById('doctor-prescription-queue');
  const notesInput = document.getElementById('doctor-prescription-notes');
  if (patInput) patInput.value = '';
  if (queueInput) queueInput.value = '';
  if (notesInput) notesInput.value = '';
}

/**
 * Updates the Doctor Serving Badge in the Yakap prescription header
 */
function updateDoctorServingBadge() {
  const serving = getCurrentServingPatient();
  const servingBadge = document.getElementById('doctor-serving-badge');
  const servingText = document.getElementById('doctor-serving-text');

  if (servingText) {
    if (serving) {
      servingText.innerHTML = `<strong>Serving:</strong> #${serving.queueNumber} — ${escapeHtml(serving.name)}`;
      if (servingBadge) servingBadge.classList.add('active');
    } else {
      servingText.textContent = 'No active patient serving';
      if (servingBadge) servingBadge.classList.remove('active');
    }
  }
}

/**
 * Pre-fills patient name and queue # from currently serving patient
 */
function linkDoctorServingPatientToYakap(showAlert = false) {
  const serving = getCurrentServingPatient();
  const patInput = document.getElementById('doctor-prescription-patient');
  const queueInput = document.getElementById('doctor-prescription-queue');

  if (serving) {
    if (patInput && (!patInput.value.trim() || showAlert)) {
      patInput.value = serving.name || '';
    }
    if (queueInput && (!queueInput.value.trim() || showAlert)) {
      queueInput.value = serving.queueNumber || '';
    }
    updateDoctorServingBadge();
    if (showAlert) {
      alert(`Linked patient #${serving.queueNumber} — ${serving.name} to this prescription.`);
    }
  } else {
    updateDoctorServingBadge();
    if (showAlert) {
      alert('No patient is currently being served. You can enter the patient name manually.');
    }
  }
}

/**
 * Doctor submits the prescription: sends converted PNG and PDF to Admin
 */
async function sendPrescriptionToAdmin() {
  if (!yakapSelectedPdfFile || !yakapConvertedPngPages || yakapConvertedPngPages.length === 0) {
    alert('Please select and convert a PDF prescription first.');
    return;
  }

  const patientInput = document.getElementById('doctor-prescription-patient');
  const queueInput = document.getElementById('doctor-prescription-queue');
  const notesInput = document.getElementById('doctor-prescription-notes');
  const sendBtn = document.getElementById('btn-send-prescription-admin');

  const patientName = patientInput?.value?.trim() || '';
  if (!patientName) {
    alert('Please enter the patient name for this prescription.');
    patientInput?.focus();
    return;
  }

  const queueNumber = queueInput?.value ? parseInt(queueInput.value, 10) : null;
  const notes = notesInput?.value?.trim() || '';

  const originalBtnHtml = sendBtn.innerHTML;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Converted PNG to Admin...';

  try {
    let pdfBase64 = '';
    try {
      pdfBase64 = await readFileAsBase64(yakapSelectedPdfFile);
    } catch (e) {
      console.warn('Could not read PDF as base64', e);
    }

    const payload = {
      action: 'upload-prescription-pdf',
      patientName,
      queueNumber,
      notes,
      fileName: yakapSelectedPdfFile.name,
      doctorName: 'Doc. Renz Sale, MD',
      pdfBase64,
      pngPages: yakapConvertedPngPages.map((p) => p.dataUrl)
    };

    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const data = await response.json();
    if (data?.success) {
      if (Array.isArray(data.prescriptions)) {
        syncPrescriptionsFromBackend(data.prescriptions);
        broadcastPrescriptions(data.prescriptions);
      }

      alert(`Prescription for ${patientName} uploaded and converted to PNG successfully!\nAdmin desk has received it and can now print on landscape half-A4 paper.`);

      resetDoctorPdfUpload();
      renderDoctorPrescriptions();
    } else {
      alert(`Failed to upload prescription: ${data?.message || 'Server error'}`);
    }
  } catch (err) {
    console.error('Error sending prescription to admin:', err);
    alert('Failed to send prescription. Check network or server connection.');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnHtml;
    }
  }
}

/**
 * Renders Doctor's Sent Prescriptions History Table
 */
function renderDoctorPrescriptions() {
  const tableBody = document.getElementById('doctor-prescriptions-table-body');
  const countPill = document.getElementById('doctor-rx-count-pill');
  if (!tableBody) return;

  const prescriptions = Array.isArray(state.prescriptions) ? state.prescriptions : [];
  if (countPill) {
    countPill.textContent = `${prescriptions.length} sent`;
  }

  updateDoctorServingBadge();

  if (prescriptions.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted, #64748b);">
          <i class="fa-solid fa-file-prescription fa-2x" style="margin-bottom: 8px; display: block; opacity: 0.6;"></i>
          No prescriptions sent yet today. Drag and drop a PDF above to prescribe and send directly to Admin.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = prescriptions.map((rx) => {
    const pngUrl = getPrescriptionPngUrl(rx);
    const isPrinted = rx.status === 'printed';

    return `
      <tr>
        <td>
          <div class="yakap-table-thumb-wrap" data-rx-id="${rx.id}" title="Click to view full PNG" style="cursor: zoom-in;">
            <img src="${pngUrl}" alt="Rx PNG" class="yakap-table-thumb" />
          </div>
        </td>
        <td><strong class="mono-code" style="font-family: monospace; color: #1e40af;">${escapeHtml(rx.rxNumber)}</strong></td>
        <td>
          <strong>${escapeHtml(rx.patientName)}</strong>
          ${rx.clinicalNotes ? `<br><small class="text-muted">${escapeHtml(rx.clinicalNotes)}</small>` : ''}
        </td>
        <td>
          ${rx.queueNumber ? `<span class="badge queue-num-badge">#${rx.queueNumber}</span>` : '<span class="text-muted">—</span>'}
        </td>
        <td>
          <span style="font-size: 0.85rem; color: #475569;"><i class="fa-solid fa-file-pdf" style="color: #ef4444; margin-right: 4px;"></i>${escapeHtml(rx.fileName || 'prescription.pdf')}</span>
        </td>
        <td><small class="time-stamp">${formatDateTimeDisplay(rx.createdAt)}</small></td>
        <td>
          <span class="status-badge ${isPrinted ? 'printed' : 'pending'}">
            <i class="fa-solid ${isPrinted ? 'fa-circle-check' : 'fa-clock'}"></i>
            ${isPrinted ? 'Printed' : 'Pending Print'}
          </span>
          ${rx.printedAt ? `<br><small class="text-muted" style="font-size: 0.72rem;">Printed at ${formatTimeOnly(rx.printedAt)}</small>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm btn-view-doctor-rx" data-rx-id="${rx.id}" title="View Converted PNG">
              <i class="fa-solid fa-eye"></i> View PNG
            </button>
            ${rx.pdfPath ? `
              <a href="${rx.pdfPath}" download="${escapeHtml(rx.fileName || 'prescription.pdf')}" class="btn btn-outline-secondary btn-sm" title="Download original PDF">
                <i class="fa-solid fa-download"></i> PDF
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Initializes Doctor YAKAP Prescriptions events & controls
 */
function initDoctorYakapPrescription() {
  const dropzone = document.getElementById('yakap-dropzone');
  const fileInput = document.getElementById('yakap-pdf-file-input');
  const browseBtn = document.getElementById('btn-browse-pdf');
  const removePdfBtn = document.getElementById('btn-remove-selected-pdf');
  const cancelUploadBtn = document.getElementById('btn-cancel-pdf-upload');
  const sendAdminBtn = document.getElementById('btn-send-prescription-admin');
  const linkPatientBtn = document.getElementById('btn-use-serving-patient');
  const prescribeBtn = document.getElementById('doctor-prescribe-btn');
  const doctorTable = document.getElementById('doctor-prescriptions-table-body');

  // Drag and Drop handlers on #yakap-dropzone
  if (dropzone && !dropzone.dataset.initialized) {
    dropzone.dataset.initialized = 'true';

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'dragend'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleDoctorPdfSelection(e.dataTransfer.files[0]);
      }
    });

    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn && !browseBtn?.contains(e.target) && fileInput) {
        fileInput.click();
      }
    });

    dropzone.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && fileInput) {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  if (browseBtn && fileInput && !browseBtn.dataset.initialized) {
    browseBtn.dataset.initialized = 'true';
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (fileInput && !fileInput.dataset.initialized) {
    fileInput.dataset.initialized = 'true';
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleDoctorPdfSelection(fileInput.files[0]);
      }
    });
  }

  if (removePdfBtn && !removePdfBtn.dataset.initialized) {
    removePdfBtn.dataset.initialized = 'true';
    removePdfBtn.addEventListener('click', resetDoctorPdfUpload);
  }

  if (cancelUploadBtn && !cancelUploadBtn.dataset.initialized) {
    cancelUploadBtn.dataset.initialized = 'true';
    cancelUploadBtn.addEventListener('click', resetDoctorPdfUpload);
  }

  if (sendAdminBtn && !sendAdminBtn.dataset.initialized) {
    sendAdminBtn.dataset.initialized = 'true';
    sendAdminBtn.addEventListener('click', sendPrescriptionToAdmin);
  }

  if (linkPatientBtn && !linkPatientBtn.dataset.initialized) {
    linkPatientBtn.dataset.initialized = 'true';
    linkPatientBtn.addEventListener('click', () => {
      linkDoctorServingPatientToYakap(true);
    });
  }

  if (prescribeBtn && !prescribeBtn.dataset.initialized) {
    prescribeBtn.dataset.initialized = 'true';
    prescribeBtn.addEventListener('click', () => {
      const yakapNav = document.querySelector('.nav-item[data-page="yakap-prescription"]');
      if (yakapNav) {
        yakapNav.click();
      }
      linkDoctorServingPatientToYakap(false);
    });
  }

  if (doctorTable && !doctorTable.dataset.initialized) {
    doctorTable.dataset.initialized = 'true';
    doctorTable.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.btn-view-doctor-rx');
      const thumbWrap = e.target.closest('.yakap-table-thumb-wrap');
      if (viewBtn || thumbWrap) {
        const rxId = (viewBtn || thumbWrap).dataset.rxId;
        const rx = state.prescriptions.find((p) => String(p.id) === String(rxId));
        if (rx) {
          const imgSrc = getPrescriptionPngUrl(rx);
          openImageViewModal(imgSrc, `Prescription — ${rx.rxNumber} (${rx.patientName})`);
        }
      }
    });
  }

  renderDoctorPrescriptions();
}

/**
 * Renders Admin Prescriptions Registry Table & Dashboard Stats
 */
function renderAdminPrescriptions() {
  const tableBody = document.getElementById('admin-yakap-prescriptions-table-body');
  const totalStat = document.getElementById('stat-yakap-total');
  const activeStat = document.getElementById('stat-yakap-active');
  const dispensedStat = document.getElementById('stat-yakap-dispensed');
  const countPill = document.getElementById('yakap-rx-count-pill');
  const searchInput = document.getElementById('admin-yakap-search');
  const filterSelect = document.getElementById('admin-yakap-filter');

  if (!tableBody) return;

  const prescriptions = Array.isArray(state.prescriptions) ? state.prescriptions : [];

  // Calculate stats
  const totalCount = prescriptions.length;
  const pendingCount = prescriptions.filter((p) => p.status !== 'printed').length;
  const printedCount = prescriptions.filter((p) => p.status === 'printed').length;

  if (totalStat) totalStat.textContent = totalCount;
  if (activeStat) activeStat.textContent = pendingCount;
  if (dispensedStat) dispensedStat.textContent = printedCount;
  if (countPill) countPill.textContent = `${totalCount} prescription${totalCount !== 1 ? 's' : ''}`;

  // Apply filters
  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  const filterStatus = filterSelect?.value || 'all';

  const filtered = prescriptions.filter((rx) => {
    if (filterStatus === 'active' && rx.status === 'printed') return false;
    if (filterStatus === 'printed' && rx.status !== 'printed') return false;

    if (searchTerm) {
      const matchName = (rx.patientName || '').toLowerCase().includes(searchTerm);
      const matchRx = (rx.rxNumber || '').toLowerCase().includes(searchTerm);
      const matchQueue = String(rx.queueNumber || '').includes(searchTerm);
      const matchNotes = (rx.clinicalNotes || '').toLowerCase().includes(searchTerm);
      return matchName || matchRx || matchQueue || matchNotes;
    }
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" style="text-align: center; padding: 40px 16px; color: var(--text-muted, #64748b);">
          <i class="fa-solid fa-file-prescription fa-2x" style="margin-bottom: 8px; display: block; opacity: 0.6;"></i>
          ${prescriptions.length === 0
            ? 'No prescriptions received from Doctor yet. When a doctor uploads a PDF prescription, it is automatically converted to PNG and appears here ready for Landscape Half-A4 printing.'
            : 'No prescriptions match your search / filter criteria.'}
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map((rx) => {
    const pngUrl = getPrescriptionPngUrl(rx);
    const isPrinted = rx.status === 'printed';

    return `
      <tr>
        <td>
          <div class="yakap-table-thumb-wrap" data-rx-id="${rx.id}" title="Click to view full PNG" style="cursor: zoom-in;">
            <img src="${pngUrl}" alt="Rx PNG" class="yakap-table-thumb" />
          </div>
        </td>
        <td><strong class="mono-code" style="font-family: monospace; color: #1e40af;">${escapeHtml(rx.rxNumber)}</strong></td>
        <td>
          <strong>${escapeHtml(rx.patientName)}</strong>
          ${rx.clinicalNotes ? `<br><small class="text-muted">${escapeHtml(rx.clinicalNotes)}</small>` : ''}
        </td>
        <td>
          ${rx.queueNumber ? `<span class="badge queue-num-badge">#${rx.queueNumber}</span>` : '<span class="text-muted">—</span>'}
        </td>
        <td><small class="time-stamp">${formatDateTimeDisplay(rx.createdAt)}</small></td>
        <td><span class="doctor-badge"><i class="fa-solid fa-user-doctor"></i> ${escapeHtml(rx.doctorName || 'Doctor')}</span></td>
        <td>
          <span class="status-badge ${isPrinted ? 'printed' : 'pending'}">
            <i class="fa-solid ${isPrinted ? 'fa-circle-check' : 'fa-clock'}"></i>
            ${isPrinted ? 'Printed' : 'Pending Print'}
          </span>
          ${rx.printedAt ? `<br><small class="text-muted" style="font-size: 0.72rem;">Printed at ${formatTimeOnly(rx.printedAt)}</small>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn-print-half-a4" data-rx-id="${rx.id}" title="Print in Landscape Mode Half of an A4 Paper">
              <i class="fa-solid fa-print"></i> Print (Half A4)
            </button>
            <button type="button" class="action-btn-sm btn-view-rx-png" data-rx-id="${rx.id}" title="View Full PNG">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="action-btn-sm danger btn-delete-rx" data-rx-id="${rx.id}" title="Delete Prescription">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Opens dedicated Half-A4 Landscape print preview modal
 */
function openHalfA4PrintModal(rxId) {
  const rx = state.prescriptions.find((p) => String(p.id) === String(rxId));
  if (!rx) {
    alert('Prescription not found.');
    return;
  }

  yakapCurrentPrintingRxId = rx.id;
  const modal = document.getElementById('yakap-half-a4-print-modal');
  const printImg = document.getElementById('yakap-print-png-img');
  const modalTitle = document.getElementById('print-modal-title');

  const pngUrl = getPrescriptionPngUrl(rx);
  if (printImg) {
    printImg.src = pngUrl;
    printImg.alt = `Prescription ${rx.rxNumber} - ${rx.patientName}`;
  }

  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fa-solid fa-print"></i> Print Prescription: <strong>${escapeHtml(rx.patientName)}</strong> (#${escapeHtml(rx.rxNumber)})`;
  }

  if (modal) {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('active'));
  }
}

/**
 * Triggers landscape half of an A4 paper print and marks status as 'printed' in database
 */
async function triggerHalfA4Print() {
  if (!yakapCurrentPrintingRxId) return;
  const rxId = yakapCurrentPrintingRxId;

  // Trigger browser print dialog for Half-A4 Landscape print
  window.print();

  // Mark prescription as printed in database
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark-prescription-printed',
        id: rxId,
        printedBy: 'Admin'
      }),
      cache: 'no-store'
    });

    const data = await response.json();
    if (data?.success && Array.isArray(data.prescriptions)) {
      syncPrescriptionsFromBackend(data.prescriptions);
      broadcastPrescriptions(data.prescriptions);
    } else {
      // Optimistic update
      const rx = state.prescriptions.find((p) => String(p.id) === String(rxId));
      if (rx) {
        rx.status = 'printed';
        rx.printedAt = new Date().toISOString();
        renderAdminPrescriptions();
        renderDoctorPrescriptions();
        broadcastPrescriptions(state.prescriptions);
      }
    }
  } catch (err) {
    console.error('Error marking prescription printed:', err);
  }
}

/**
 * Deletes a prescription record
 */
async function deletePrescription(rxId) {
  const rx = state.prescriptions.find((p) => String(p.id) === String(rxId));
  const confirmMsg = rx
    ? `Are you sure you want to delete the prescription for ${rx.patientName} (${rx.rxNumber})?`
    : 'Are you sure you want to delete this prescription?';

  if (!confirm(confirmMsg)) return;

  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-prescription', id: rxId }),
      cache: 'no-store'
    });
    const data = await response.json();
    if (data?.success && Array.isArray(data.prescriptions)) {
      syncPrescriptionsFromBackend(data.prescriptions);
      broadcastPrescriptions(data.prescriptions);
    } else {
      state.prescriptions = state.prescriptions.filter((p) => String(p.id) !== String(rxId));
      renderAdminPrescriptions();
      renderDoctorPrescriptions();
      broadcastPrescriptions(state.prescriptions);
    }
  } catch (err) {
    console.error('Error deleting prescription:', err);
    alert('Failed to delete prescription.');
  }
}

/**
 * Universal full-resolution image viewer modal
 */
function openImageViewModal(imgSrc, title = 'Prescription Preview') {
  const modal = document.getElementById('yakap-image-view-modal');
  const imgEl = document.getElementById('yakap-view-img');
  const titleEl = document.getElementById('yakap-view-title');
  const downloadBtn = document.getElementById('btn-download-rx-png');
  const closeBtn = document.getElementById('btn-close-view-modal');

  if (!modal || !imgEl) return;

  imgEl.src = imgSrc;
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-image"></i> ${escapeHtml(title)}`;
  }
  if (downloadBtn) {
    downloadBtn.href = imgSrc;
    downloadBtn.download = `${title.replace(/[^a-z0-9_-]/gi, '_')}.png`;
  }

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('active'));

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => { modal.hidden = true; }, 200);
  };

  if (closeBtn) {
    closeBtn.onclick = closeModal;
  }
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
}

/**
 * Initializes Admin YAKAP Prescriptions Desk events & controls
 */
function initAdminYakapPrescription() {
  const searchInput = document.getElementById('admin-yakap-search');
  const filterSelect = document.getElementById('admin-yakap-filter');
  const refreshBtn = document.getElementById('btn-refresh-prescriptions');
  const triggerPrintBtn = document.getElementById('btn-trigger-half-a4-print');
  const closePrintModalBtn = document.getElementById('btn-close-print-modal');
  const printModal = document.getElementById('yakap-half-a4-print-modal');
  const adminTable = document.getElementById('admin-yakap-prescriptions-table-body');

  if (searchInput && !searchInput.dataset.initialized) {
    searchInput.dataset.initialized = 'true';
    searchInput.addEventListener('input', () => {
      renderAdminPrescriptions();
    });
  }

  if (filterSelect && !filterSelect.dataset.initialized) {
    filterSelect.dataset.initialized = 'true';
    filterSelect.addEventListener('change', () => {
      renderAdminPrescriptions();
    });
  }

  if (refreshBtn && !refreshBtn.dataset.initialized) {
    refreshBtn.dataset.initialized = 'true';
    refreshBtn.addEventListener('click', async () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      await fetchState();
      setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
      }, 500);
    });
  }

  if (triggerPrintBtn && !triggerPrintBtn.dataset.initialized) {
    triggerPrintBtn.dataset.initialized = 'true';
    triggerPrintBtn.addEventListener('click', triggerHalfA4Print);
  }

  if (closePrintModalBtn && printModal && !closePrintModalBtn.dataset.initialized) {
    closePrintModalBtn.dataset.initialized = 'true';
    closePrintModalBtn.addEventListener('click', () => {
      printModal.classList.remove('active');
      setTimeout(() => { printModal.hidden = true; }, 200);
    });
  }

  if (adminTable && !adminTable.dataset.initialized) {
    adminTable.dataset.initialized = 'true';
    adminTable.addEventListener('click', (e) => {
      const printBtn = e.target.closest('.btn-print-half-a4');
      if (printBtn) {
        const rxId = printBtn.dataset.rxId;
        openHalfA4PrintModal(rxId);
        return;
      }

      const viewBtn = e.target.closest('.btn-view-rx-png');
      const thumbWrap = e.target.closest('.yakap-table-thumb-wrap');
      if (viewBtn || thumbWrap) {
        const rxId = (viewBtn || thumbWrap).dataset.rxId;
        const rx = state.prescriptions.find((p) => String(p.id) === String(rxId));
        if (rx) {
          const imgSrc = getPrescriptionPngUrl(rx);
          openImageViewModal(imgSrc, `Prescription — ${rx.rxNumber} (${rx.patientName})`);
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-rx');
      if (deleteBtn) {
        const rxId = deleteBtn.dataset.rxId;
        deletePrescription(rxId);
        return;
      }
    });
  }

  renderAdminPrescriptions();
}

/**
 * Format helper for readable date & time
 */
function formatDateTimeDisplay(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format helper for time only
 */
function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
}

