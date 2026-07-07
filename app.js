let state = {
  patients: [],
  nextQueueNumber: 1,
  consultationHistory: [],
};

let updateChannel = null;

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

function isAdminAuthenticated() {
  try {
    return sessionStorage.getItem('queue-admin-auth') === 'true';
  } catch (error) {
    console.warn('Unable to read admin auth state', error);
    return false;
  }
}

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

function setAdminView(isAuthenticated) {
  const loginCard = document.getElementById('login-card');
  const adminPanel = document.getElementById('admin-panel');
  const logoutButton = document.getElementById('logout-btn');

  if (loginCard) {
    loginCard.hidden = isAuthenticated;
  }

  if (adminPanel) {
    adminPanel.hidden = !isAuthenticated;
  }

  if (logoutButton) {
    logoutButton.hidden = !isAuthenticated;
  }
}

function showAdminLoginError(message) {
  const loginError = document.getElementById('login-error');
  if (loginError) {
    loginError.textContent = message;
  }
}

function broadcastState(nextState) {
  if (updateChannel) {
    updateChannel.postMessage({ type: 'queue-state-update', state: nextState });
  }

  try {
    localStorage.setItem('queue-state-sync', JSON.stringify({ state: nextState, timestamp: Date.now() }));
  } catch (error) {
    console.warn('Unable to broadcast queue state', error);
  }
}

function initRealtimeSync() {
  if (typeof BroadcastChannel !== 'undefined') {
    updateChannel = new BroadcastChannel('queue-system-sync');
    updateChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'queue-state-update' && event.data.state) {
        state = event.data.state;
        render();
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== 'queue-state-sync' || !event.newValue) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue);
      if (payload?.state) {
        state = payload.state;
        render();
      }
    } catch (error) {
      console.warn('Unable to sync queue state from storage', error);
    }
  });
}

async function fetchState() {
  try {
    const response = await fetch('backend/api.php', { cache: 'no-store' });
    const data = await response.json();
    if (data?.success && data.state) {
      state = data.state;
      render();
    }
  } catch (error) {
    console.error('Unable to load queue state', error);
  }
}

async function postAction(action, payload = {}) {
  try {
    const response = await fetch('backend/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });

    const data = await response.json();
    if (response.status === 401) {
      setAdminAuthenticated(false);
      setAdminView(false);
      return;
    }

    if (data?.success && data.state) {
      state = data.state;
      render();
      broadcastState(data.state);
    }
  } catch (error) {
    console.error('Unable to update queue state', error);
  }
}

async function loginAdmin(username, password) {
  try {
    const response = await fetch('backend/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'login', username, password }),
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

function getCurrentServingPatient() {
  return state.patients.find((patient) => patient.status === 'serving') || null;
}

function getWaitingPatients() {
  return state.patients.filter((patient) => patient.status === 'waiting');
}

function renderPatientBoard() {
  const currentServing = document.getElementById('current-serving');
  const currentServingHeading = document.getElementById('current-serving-heading');
  const currentServingName = document.getElementById('current-serving-name');
  const nextPatient = document.getElementById('next-patient');
  const waitingList = document.getElementById('waiting-list');
  const queueCount = document.getElementById('queue-count');
  const spotlightCard = document.querySelector('.spotlight');

  const servingPatient = getCurrentServingPatient();
  const nextPatientEntry = getWaitingPatients()[0] || null;

  if (currentServingHeading) {
    currentServingHeading.hidden = !servingPatient;
  }

  if (spotlightCard) {
    spotlightCard.classList.toggle('is-serving', Boolean(servingPatient));
  }

  if (servingPatient) {
    currentServing.textContent = `#${servingPatient.queueNumber}`;
    currentServingName.textContent = `${servingPatient.name} is being consulted now.`;
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
    return;
  }

  waitingList.innerHTML = getWaitingPatients()
    .map(
      (patient) => `
        <li class="queue-item">
          <div>
            <strong>#${patient.queueNumber} — ${patient.name}</strong>
            <small>Waiting for service</small>
          </div>
          <span class="badge waiting">Waiting</span>
        </li>
      `,
    )
    .join('');
}



function renderConsultationHistory() {
  const historyList = document.getElementById('consultation-history');
  const historyCount = document.getElementById('history-count');

  if (!historyList || !historyCount) {
    return;
  }

  historyCount.textContent = `${state.consultationHistory?.length || 0} entries`;

  if (!state.consultationHistory || state.consultationHistory.length === 0) {
    historyList.innerHTML = '<li class="empty-state">No consultation history yet.</li>';
    return;
  }

  historyList.innerHTML = state.consultationHistory
    .slice()
    .reverse()
    .map(
      (entry) => `
        <li class="queue-item">
          <div>
            <strong>#${entry.queueNumber} — ${entry.name}</strong>
            <small>${entry.finishedAt || 'Completed'}</small>
          </div>
          <span class="badge serving">Completed</span>
        </li>
      `,
    )
    .join('');
}

function renderAdminQueue() {
  const patientList = document.getElementById('patient-list');
  const adminCount = document.getElementById('admin-count');
  const isAdminPage = Boolean(document.getElementById('patient-form'));

  adminCount.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map(
      (patient) => {
        const actionButtons = [
          `<button class="btn btn-secondary" data-action="edit" data-id="${patient.id}">Edit</button>`,
        ];

        const isCurrentPatient = patient.status === 'serving';
        actionButtons.push(`<button class="btn btn-primary" data-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${patient.id}">${isCurrentPatient ? 'Done' : 'Serve'}</button>`);

        if (isAdminPage) {
          actionButtons.push(`<button class="btn btn-danger" data-action="delete" data-id="${patient.id}">Delete</button>`);
        }

        return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${patient.name}</strong>
              <span class="badge ${patient.status}">${patient.status}</span>
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

function addPatient(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  postAction('add', { name: trimmedName });
}

function editPatient(id) {
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) {
    return;
  }

  const nextName = window.prompt('Update patient name', patient.name);
  if (nextName === null) {
    return;
  }

  const trimmedName = nextName.trim();
  if (!trimmedName) {
    return;
  }

  postAction('edit', { id, name: trimmedName });
}

function deletePatient(id) {
  postAction('delete', { id });
}

function servePatient(id) {
  postAction('serve', { id });
}

function finishPatient(id) {
  postAction('finish', { id });
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

  if (document.getElementById('consultation-history')) {
    renderConsultationHistory();
  }
}

function initAdminPage() {
  const patientForm = document.getElementById('patient-form');
  const patientNameInput = document.getElementById('patient-name');
  const serveNextButton = document.getElementById('serve-next-btn');
  const resetButton = document.getElementById('reset-btn');

  if (patientForm && patientNameInput) {
    patientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addPatient(patientNameInput.value);
      patientForm.reset();
    });
  }

  if (serveNextButton) {
    serveNextButton.addEventListener('click', serveNextPatient);
  }

  if (resetButton) {
    resetButton.addEventListener('click', resetQueue);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    if (action === 'edit') {
      editPatient(id);
    } else if (action === 'delete') {
      deletePatient(id);
    } else if (action === 'serve') {
      servePatient(id);
    } else if (action === 'finish') {
      finishPatient(id);
    }
  });
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
    logoutButton.addEventListener('click', () => {
      setAdminAuthenticated(false);
      setAdminView(false);
      showAdminLoginError('');
      if (usernameInput) {
        usernameInput.focus();
      }
    });
  }

  setAdminView(isAdminAuthenticated());
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeSync();

  if (document.getElementById('patient-list')) {
    initAdminPage();
  }

  if (document.getElementById('admin-login-form')) {
    initAdminAuth();
  }

  if (isAdminAuthenticated() && document.getElementById('patient-list')) {
    fetchState();
    setInterval(fetchState, 1000);
  }
});
