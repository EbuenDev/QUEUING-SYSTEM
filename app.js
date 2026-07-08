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

//This function updates the visibility of the admin login form, admin panel, and logout button based on the authentication state of the admin user. It ensures that only authenticated users can access the admin functionalities.
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

//This function initializes real-time synchronization of the queue state across multiple browser tabs or windows. It uses the BroadcastChannel API if available, and also listens for changes in localStorage to update the state accordingly.
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
    if (event.key !== 'queue-state-sync' && event.key !== 'queue-state-event') {
      return;
    }

    if (event.key === 'queue-state-sync' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        if (payload?.state) {
          state = payload.state;
          render();
        }
      } catch (error) {
        console.warn('Unable to sync queue state from storage', error);
      }
    }

    fetchState();
  });
}

//This function fetches the current state of the queue from the backend API and updates the local state accordingly. It also handles any errors that may occur during the fetch operation.
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

//This function sends a POST request to the backend API with the specified action and payload. It updates the local state based on the response and handles any errors that may occur during the request.
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
//This is to handle the case where the user is not authenticated
    const data = await response.json();
    if (response.status === 401) {
      setAdminAuthenticated(false);
      setAdminView(false);
      return;
    }

    //this is to ensure that the state is updated after any action is performed, and the UI reflects the latest state.
    if (data?.success && data.state) {
      state = data.state;
      render();
      broadcastState(data.state);
      await fetchState();
    }
  } catch (error) {
    console.error('Unable to update queue state', error);
  }
}

// this function simulates an admin login by checking against hardcoded credentials.
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


//This function renders the patient board, displaying the current serving patient, the next patient in line, and the waiting list. It updates the UI elements based on the current state of the queue.
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
      (patient) => {
        const patientType = patient.type || 'regular';
        return `
        <li class="queue-item">
          <div>
            <strong>#${patient.queueNumber} — ${patient.name}</strong>
            <small>Waiting for service</small>
          </div>
          <div class="badge-group">
            <span class="badge waiting">Waiting</span>
            <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : 'Regular'}</span>
          </div>
        </li>
      `;
      },
    )
    .join('');
}


//This function renders the consultation history, displaying a list of completed consultations along with their queue numbers and names. It updates the UI elements based on the current state of the consultation history.
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

  if (!patientList || !adminCount) {
    return;
  }

  adminCount.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map(
      (patient) => {
        const patientType = patient.type || 'regular';
        const actionButtons = [];

        if (isAdminPage) {
          actionButtons.push(`<button class="btn btn-secondary" data-action="edit" data-id="${patient.id}">Edit</button>`);
          const isCurrentPatient = patient.status === 'serving';
          actionButtons.push(`<button class="btn btn-primary" data-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${patient.id}">${isCurrentPatient ? 'Done' : 'Serve'}</button>`);
          actionButtons.push(`<button class="btn btn-danger" data-action="delete" data-id="${patient.id}">Delete</button>`);
        }

        return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${patient.name}</strong>
              <div class="badge-group">
                <span class="badge ${patient.status}">${patient.status}</span>
                <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : 'Regular'}</span>
              </div>
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
  const adminCount = document.getElementById('admin-count');

  if (!patientList || !adminCount) {
    return;
  }

  adminCount.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map((patient) => {
      const patientType = patient.type || 'regular';
      const isCurrentPatient = patient.status === 'serving';
      return `
      <li class="queue-item">
        <div>
          <strong>#${patient.queueNumber} — ${patient.name}</strong>
          <div class="badge-group">
            <span class="badge ${patient.status}">${patient.status}</span>
            <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : 'Regular'}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-doctor-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${patient.id}">${isCurrentPatient ? 'Done' : 'Serve'}</button>
        </div>
      </li>
    `;
    })
    .join('');
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
          <strong>#${patient.queueNumber} — ${patient.name}</strong>
          <div class="badge-group">
            <span class="badge ${patient.status}">${patient.status}</span>
            <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : 'Regular'}</span>
          </div>
        </div>
      </li>
    `;
    })
    .join('');
}

function addPatient(name, type = 'regular') {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  postAction('add', { name: trimmedName, type });
}

function editPatient(id, name, type = 'regular') {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  postAction('edit', { id, name: trimmedName, type });
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

  if (document.getElementById('doctor-patient-list')) {
    renderDoctorQueue();
  }

  if (document.getElementById('bhw-patient-list')) {
    renderBhwQueue();
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
      const type = patientForm.querySelector('input[name="admin-patient-type"]:checked')?.value || 'regular';
      addPatient(patientNameInput.value, type);
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

      postAction('edit', { id, name: trimmedName, type: patient.type || 'regular' });
    } else if (action === 'delete') {
      deletePatient(id);
    } else if (action === 'serve') {
      servePatient(id);
    } else if (action === 'finish') {
      finishPatient(id);
    }
  });
}

function initBhwPage() {
  const addForm = document.getElementById('bhw-add-form');
  const addNameInput = document.getElementById('bhw-patient-name');

  if (addForm && addNameInput) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const type = addForm.querySelector('input[name="patient-type"]:checked')?.value || 'regular';
      addPatient(addNameInput.value, type);
      addForm.reset();
    });
  }
}

function initDoctorPage() {
  const serveNextButton = document.getElementById('doctor-serve-next-btn');

  if (serveNextButton) {
    serveNextButton.addEventListener('click', serveNextPatient);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-doctor-action]');
    if (!button) {
      return;
    }

    const { doctorAction, id } = button.dataset;
    if (doctorAction === 'serve') {
      servePatient(id);
    } else if (doctorAction === 'finish') {
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

  if (document.getElementById('bhw-add-form')) {
    initBhwPage();
  }

  if (document.getElementById('doctor-patient-list')) {
    initDoctorPage();
  }

  const needsQueueSync = Boolean(
    document.getElementById('patient-list') ||
    document.getElementById('waiting-list') ||
    document.getElementById('doctor-patient-list') ||
    document.getElementById('consultation-history') ||
    document.getElementById('bhw-patient-list')
  );

  if (needsQueueSync) {
    fetchState();
    setInterval(fetchState, 1000);
  }
});
