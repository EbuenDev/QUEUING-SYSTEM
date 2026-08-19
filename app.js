let state = {
  patients: [],
  nextQueueNumber: 1,
  consultationHistory: [],
};

let updateChannel = null;

const API_ENDPOINT = 'backend/api.php';

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
  setElementHidden('login-card', isAuthenticated);
  setElementHidden('admin-panel', !isAuthenticated);
  setElementHidden('logout-btn', !isAuthenticated);
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
        applyState(event.data.state);
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
          applyState(payload.state);
        }
      } catch (error) {
        console.warn('Unable to sync queue state from storage', error);
      }
    }

    fetchState();
  });
}

//This function replaces the local state with the given one and repaints every widget on the page.
function applyState(nextState) {
  state = nextState;
  render();
}

//This function performs a request against the backend API. Passing a body turns the request into a JSON POST.
async function requestApi(body = null) {
  const options = { cache: 'no-store' };

  if (body) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_ENDPOINT, options);
  const data = await response.json();
  return { response, data };
}

//This function fetches the current state of the queue from the backend API and updates the local state accordingly. It also handles any errors that may occur during the fetch operation.
async function fetchState() {
  try {
    const { data } = await requestApi();
    if (data?.success && data.state) {
      applyState(data.state);
    }
  } catch (error) {
    console.error('Unable to load queue state', error);
  }
}

//This function sends a POST request to the backend API with the specified action and payload. It updates the local state based on the response and handles any errors that may occur during the request.
async function postAction(action, payload = {}) {
  try {
    const { response, data } = await requestApi({ action, ...payload });

    //This is to handle the case where the user is not authenticated
    if (response.status === 401) {
      setAdminAuthenticated(false);
      setAdminView(false);
      return;
    }

    //this is to ensure that the state is updated after any action is performed, and the UI reflects the latest state.
    if (data?.success && data.state) {
      applyState(data.state);
      broadcastState(data.state);
      await fetchState();
    }
  } catch (error) {
    console.error('Unable to update queue state', error);
  }
}

// this function authenticates the admin against the backend API.
async function loginAdmin(username, password) {
  try {
    const { response, data } = await requestApi({ action: 'login', username, password });
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

  const waitingPatients = getWaitingPatients();
  queueCount.textContent = `${waitingPatients.length} patients`;

  if (waitingPatients.length === 0) {
    waitingList.innerHTML = renderEmptyState(EMPTY_STATE_MESSAGES.waitingList);
    return;
  }

  waitingList.innerHTML = waitingPatients
    .map((patient) => renderQueueItem([
      renderPatientDetails(patient, { notes: ['Waiting for service'] }),
      renderBadgeGroup([renderStatusBadge('waiting'), renderTypeBadge(patient)]),
    ]))
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
    historyList.innerHTML = renderEmptyState(EMPTY_STATE_MESSAGES.history);
    return;
  }

  historyList.innerHTML = getHistoryEntriesNewestFirst()
    .map((entry) => renderQueueItem([
      renderPatientDetails(entry, {
        notes: [
          entry.finishedAt || 'Completed',
          `PH ID: ${entry.philHealthId || 'N/A'}`,
          `ICD: ${entry.icdCode || 'N/A'}`,
          `Consultation: ${entry.consultationDetails || 'No notes recorded'}`,
        ],
      }),
      renderActions([
        renderActionButton('Edit', {
          variant: 'btn-secondary',
          attribute: 'data-action',
          action: 'edit-history',
          id: entry.id || '',
        }),
      ]),
    ]))
    .join('');
}

function openHistoryEditModal(id) {
  const entry = state.consultationHistory.find((item) => (item.id || '') === id);
  if (!entry) {
    return;
  }

  setElementValue('edit-history-id', entry.id || '');
  setElementValue('edit-history-icd-code', entry.icdCode || '');
  setElementValue('edit-history-consultation', entry.consultationDetails || '');
  setElementHidden('edit-history-modal', false);
}

function closeHistoryEditModal() {
  setElementHidden('edit-history-modal', true);
}

function getHistoryEntriesNewestFirst() {
  return state.consultationHistory?.slice().reverse() || [];
}

function printConsultationHistory() {
  const historyEntries = getHistoryEntriesNewestFirst();
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
    : `<tr><td colspan="5">${EMPTY_STATE_MESSAGES.history}</td></tr>`;

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
  const isAdminPage = Boolean(document.getElementById('patient-form'));

  if (!patientList || !adminCount) {
    return;
  }

  adminCount.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = renderEmptyState(EMPTY_STATE_MESSAGES.patients);
    return;
  }

  patientList.innerHTML = state.patients
    .map((patient) => renderQueueItem([
      renderPatientDetails(patient, {
        badges: [renderStatusBadge(patient.status), renderTypeBadge(patient), renderPhilHealthBadge(patient)],
        showPhilHealthId: true,
      }),
      renderActions(isAdminPage ? [
        renderQueueActionButton(patient, 'data-action', 'edit'),
        renderQueueActionButton(patient, 'data-action', 'serve'),
        renderQueueActionButton(patient, 'data-action', 'skip'),
        renderQueueActionButton(patient, 'data-action', 'delete'),
      ] : []),
    ]))
    .join('');
}

// Buttons that act on a queue item. The admin page listens on data-action, the
// doctor page on data-doctor-action, but the markup is otherwise identical.
function renderQueueActionButton(patient, attribute, action) {
  const isCurrentPatient = patient.status === 'serving';
  const buttonsByAction = {
    edit: { label: 'Edit', variant: 'btn-secondary', action: 'edit' },
    serve: {
      label: isCurrentPatient ? 'Done' : 'Serve',
      variant: 'btn-primary',
      action: isCurrentPatient ? 'finish' : 'serve',
    },
    skip: { label: 'Skip', variant: 'btn-warning', action: 'skip' },
    recall: { label: 'Recall', variant: 'btn-secondary', action: 'recall' },
    delete: { label: 'Delete', variant: 'btn-danger', action: 'delete' },
  };

  const button = buttonsByAction[action];
  return renderActionButton(button.label, {
    variant: button.variant,
    attribute,
    action: button.action,
    id: patient.id,
  });
}

function renderDoctorQueue() {
  const patientList = document.getElementById('doctor-patient-list');
  const patientCountLabel = document.getElementById('doctor-patient-count');
  const currentPatientCard = document.getElementById('doctor-current-patient');
  const nextPatientCard = document.getElementById('doctor-next-patient');

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

  if (currentPatientCard) {
    if (servingPatient) {
      currentPatientCard.innerHTML = `
        <div class="doctor-current-patient-details">
          ${renderPatientHeading(servingPatient)}
          ${renderBadgeGroup([renderStatusBadge('serving'), renderTypeBadge(servingPatient)])}
          <small>Queue #${servingPatient.queueNumber}</small>
          ${renderPhilHealthId(servingPatient)}
        </div>
        <div class="doctor-note-fields">
          <label class="field-label" for="doctor-icd-code">ICD Code</label>
          <input id="doctor-icd-code" type="text" placeholder="ICD code" value="${draftIcdCode || servingPatient.icdCode || ''}" />
          <label class="field-label" for="doctor-consultation-note">Consultation Details</label>
          <textarea id="doctor-consultation-note" rows="4" placeholder="Enter consultation details for this patient">${draftConsultationDetails || servingPatient.consultationDetails || ''}</textarea>
        </div>
      `;
    } else {
      currentPatientCard.innerHTML = `
        <div class="doctor-current-patient-details">
          <strong>No patient is being served yet.</strong>
          ${renderBadgeGroup([renderStatusBadge('waiting')])}
          <small>Queue # — Full Name</small>
          <small>PH ID: N/A</small>
        </div>
        <div class="doctor-note-fields">
          <label class="field-label" for="doctor-icd-code">ICD Code</label>
          <input id="doctor-icd-code" type="text" placeholder="ICD code" value="${draftIcdCode}" disabled />
          <label class="field-label" for="doctor-consultation-note">Consultation Details</label>
          <textarea id="doctor-consultation-note" rows="4" placeholder="Enter consultation details for this patient" disabled>${draftConsultationDetails}</textarea>
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
        ${renderPatientHeading(nextPatient)}
        ${renderBadgeGroup([renderStatusBadge('waiting'), renderTypeBadge(nextPatient)])}
        ${renderPhilHealthId(nextPatient)}
      `;
    } else {
      nextPatientCard.innerHTML = `
        <strong>No queue yet.</strong>
        <small>Awaiting the next patient.</small>
      `;
    }
  }

  if (state.patients.length === 0) {
    patientList.innerHTML = renderEmptyState(EMPTY_STATE_MESSAGES.patients);
    return;
  }

  patientList.innerHTML = state.patients
    .map((patient) => renderQueueItem([
      renderPatientDetails(patient, {
        badges: [renderStatusBadge(patient.status), renderTypeBadge(patient)],
        showPhilHealthId: true,
      }),
      renderActions([
        renderQueueActionButton(patient, 'data-doctor-action', 'serve'),
        renderQueueActionButton(patient, 'data-doctor-action', 'skip'),
        renderQueueActionButton(patient, 'data-doctor-action', 'recall'),
      ]),
    ]))
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
    patientList.innerHTML = renderEmptyState(EMPTY_STATE_MESSAGES.patients);
    return;
  }

  patientList.innerHTML = state.patients
    .map((patient) => renderQueueItem([
      renderPatientDetails(patient, {
        badges: [renderStatusBadge(patient.status), renderTypeBadge(patient)],
      }),
    ]))
    .join('');
}

//This function trims and defaults the patient fields shared by the add and edit flows.
function normalizePatientFields(fields) {
  return {
    name: (fields.name || '').trim(),
    philHealthId: (fields.philHealthId || '').trim(),
    patientStatus: fields.patientStatus || 'regular',
    philHealthStatus: fields.philHealthStatus || 'no-philhealth',
  };
}

function addPatient(fields) {
  const patient = normalizePatientFields(fields);
  if (!patient.name) {
    return;
  }

  postAction('add', patient);
}

function editPatient(id, fields) {
  const patient = normalizePatientFields(fields);
  if (!patient.name) {
    return;
  }

  postAction('edit', { id, ...patient });
}

//Reads the patient fields of a form. The edit modal uses the same ids behind an "edit-" prefix.
function readPatientFields(prefix = '') {
  return {
    name: getElementValue(`${prefix}patient-name`),
    philHealthId: getElementValue(`${prefix}patient-philhealth-id`),
    patientStatus: getElementValue(`${prefix}patient-status`) || 'regular',
    philHealthStatus: getElementValue(`${prefix}philhealth-status`) || 'no-philhealth',
  };
}

function deletePatient(id) {
  postAction('delete', { id });
}

function servePatient(id) {
  postAction('serve', { id });
}

function finishPatient(id) {
  const consultationNoteInput = document.getElementById('doctor-consultation-note');
  const icdCodeInput = document.getElementById('doctor-icd-code');
  const consultationDetails = consultationNoteInput?.value || '';
  const icdCode = icdCodeInput?.value || '';

  if (consultationNoteInput) {
    consultationNoteInput.value = '';
  }

  if (icdCodeInput) {
    icdCodeInput.value = '';
  }

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
  if (hasElement('patient-list')) {
    renderAdminQueue();
  }

  if (hasElement('waiting-list')) {
    renderPatientBoard();
  }

  if (hasElement('doctor-patient-list')) {
    renderDoctorQueue();
  }

  if (hasElement('bhw-patient-list')) {
    renderBhwQueue();
  }

  if (hasElement('consultation-history')) {
    renderConsultationHistory();
  }
}

//The consultation history modal lives on both the admin and the doctor page.
function initHistoryEditForm() {
  const historyEditForm = document.getElementById('edit-history-form');
  const cancelHistoryEditButton = document.getElementById('cancel-history-edit-btn');

  if (historyEditForm) {
    historyEditForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const historyId = getElementValue('edit-history-id');
      if (!historyId) {
        return;
      }

      postAction('edit-history', {
        id: historyId,
        icdCode: getElementValue('edit-history-icd-code'),
        consultationDetails: getElementValue('edit-history-consultation'),
      });
      closeHistoryEditModal();
    });
  }

  if (cancelHistoryEditButton) {
    cancelHistoryEditButton.addEventListener('click', closeHistoryEditModal);
  }
}

function openPatientEditModal(patient) {
  setElementValue('edit-patient-id', patient.id);
  setElementValue('edit-patient-name', patient.name || '');
  setElementValue('edit-patient-philhealth-id', patient.philHealthId || '');
  setElementValue('edit-patient-status', getPatientType(patient));
  setElementValue('edit-philhealth-status', patient.philHealthStatus || 'no-philhealth');
  setElementHidden('edit-patient-modal', false);
}

//Runs the queue action requested by a clicked button, whichever page it lives on.
function handleQueueAction(action, id) {
  const handlers = {
    'edit-history': openHistoryEditModal,
    delete: deletePatient,
    serve: servePatient,
    finish: finishPatient,
    skip: skipPatient,
    recall: recallPatient,
  };

  handlers[action]?.(id);
}

function bindClickHandler(id, handler) {
  document.getElementById(id)?.addEventListener('click', handler);
}

function initAdminPage() {
  const patientForm = document.getElementById('patient-form');
  const editPatientForm = document.getElementById('edit-patient-form');

  if (patientForm) {
    patientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addPatient(readPatientFields());
      patientForm.reset();
    });
  }

  if (editPatientForm) {
    editPatientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const id = getElementValue('edit-patient-id');
      if (!id) {
        return;
      }

      editPatient(id, readPatientFields('edit-'));
      setElementHidden('edit-patient-modal', true);
    });
  }

  bindClickHandler('cancel-edit-btn', () => setElementHidden('edit-patient-modal', true));
  bindClickHandler('print-consultation-btn', printConsultationHistory);
  bindClickHandler('serve-next-btn', serveNextPatient);
  bindClickHandler('reset-btn', resetQueue);
  initHistoryEditForm();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    if (action === 'edit') {
      const patient = state.patients.find((item) => item.id === id);
      if (patient) {
        openPatientEditModal(patient);
      }
      return;
    }

    handleQueueAction(action, id);
  });
}

function initBhwPage() {
  const addForm = document.getElementById('bhw-add-form');
  const addNameInput = document.getElementById('bhw-patient-name');

  if (addForm && addNameInput) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addPatient({
        name: addNameInput.value,
        patientStatus: addForm.querySelector('input[name="patient-type"]:checked')?.value || 'regular',
      });
      addForm.reset();
    });
  }
}

//Wires a doctor toolbar button to an action applied to the patient being served.
function bindServingPatientAction(buttonId, action) {
  bindClickHandler(buttonId, () => {
    const currentServing = getCurrentServingPatient();
    if (currentServing) {
      handleQueueAction(action, currentServing.id);
    }
  });
}

function initDoctorPage() {
  bindClickHandler('doctor-serve-next-btn', serveNextPatient);
  bindServingPatientAction('doctor-recall-btn', 'recall');
  bindServingPatientAction('doctor-skip-btn', 'skip');
  bindServingPatientAction('doctor-finish-btn', 'finish');
  initHistoryEditForm();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button?.dataset.action === 'edit-history') {
      openHistoryEditModal(button.dataset.id);
    }

    const doctorButton = event.target.closest('button[data-doctor-action]');
    if (doctorButton) {
      handleQueueAction(doctorButton.dataset.doctorAction, doctorButton.dataset.id);
    }
  });
}

function updateLiveClock() {
  const liveClock = document.getElementById('live-clock');
  if (!liveClock) {
    return;
  }

  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const meridiem = now.getHours() >= 12 ? 'PM' : 'AM';
  liveClock.textContent = `${hours}:${minutes}:${seconds} ${meridiem}`;
}

function initAdminAuth() {
  const loginForm = document.getElementById('admin-login-form');
  const usernameInput = document.getElementById('admin-username');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAdminLoginError('');

      const username = getElementValue('admin-username').trim();
      const isAuthenticated = await loginAdmin(username, getElementValue('admin-password'));

      if (!isAuthenticated) {
        showAdminLoginError('Invalid username or password.');
      } else {
        loginForm.reset();
      }
    });
  }

  bindClickHandler('logout-btn', () => {
    setAdminAuthenticated(false);
    setAdminView(false);
    showAdminLoginError('');
    usernameInput?.focus();
  });

  setAdminView(isAdminAuthenticated());
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeSync();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  if (hasElement('patient-list')) {
    initAdminPage();
  }

  if (hasElement('admin-login-form')) {
    initAdminAuth();
  }

  if (hasElement('bhw-add-form')) {
    initBhwPage();
  }

  if (hasElement('doctor-patient-list')) {
    initDoctorPage();
  }

  const needsQueueSync = [
    'patient-list',
    'waiting-list',
    'doctor-patient-list',
    'consultation-history',
    'bhw-patient-list',
  ].some(hasElement);

  if (needsQueueSync) {
    fetchState();
    setInterval(fetchState, 1000);
  }
});
