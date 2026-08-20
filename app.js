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
  });

  // Initial fetch
  fetchState();

  // Set up polling for LAN sync (every 5 seconds)
  // This is necessary for multi-computer sync on LAN
  setInterval(() => {
    // Only fetch if page is visible to reduce unnecessary requests
    if (!document.hidden) {
      fetchState();
    }
  }, 5000); // 5 second polling interval
}

//This function fetches the current state of the queue from the backend API and updates the local state accordingly. It also handles any errors that may occur during the fetch operation.
async function fetchState() {
  try {
    // Use absolute URL based on current location for LAN compatibility
    const apiUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/backend/api_postgres.php';
    const response = await fetch(apiUrl, { cache: 'no-store' });
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
    // Use absolute URL based on current location for LAN compatibility
    const apiUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/backend/api_postgres.php';
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
    // Use absolute URL based on current location for LAN compatibility
    const apiUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/backend/api_postgres.php';
    const response = await fetch(apiUrl, {
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

function getFollowUpPatients() {
  return state.patients.filter((patient) => patient.status === 'follow-up');
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

  // Render follow-up patients
  if (followUpSection) {
    if (followUpPatients.length === 0) {
      followUpSection.hidden = true;
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
              <strong>#${patient.queueNumber} — ${patient.name}</strong>
              <small>${reasonText}</small>
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
            <small>PH ID: ${entry.philHealthId || 'N/A'}</small>
            <small>ICD: ${entry.icdCode || 'N/A'}</small>
            <small>Consultation: ${entry.consultationDetails || 'No notes recorded'}</small>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" type="button" data-action="edit-history" data-id="${entry.id || ''}">Edit</button>
          </div>
        </li>
      `,
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
        <strong>#${currentServing.queueNumber} — ${currentServing.name}</strong>
        <div class="badge-group">
          <span class="badge ${currentServing.status}">${currentServing.status}</span>
          <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span>
          <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
        </div>
        <small>PH ID: ${currentServing.philHealthId || 'N/A'}</small>
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
        <strong>#${nextPatient.queueNumber} — ${nextPatient.name}</strong>
        <div class="badge-group">
          <span class="badge ${nextPatient.status}">${nextPatient.status}</span>
          <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span>
          <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
        </div>
        <small>PH ID: ${nextPatient.philHealthId || 'N/A'}</small>
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
                <strong>#${patient.queueNumber} — ${patient.name}</strong>
                <div class="badge-group">
                  <span class="badge ${patient.status}">${patient.status}</span>
                  <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span>
                  <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
                  <span class="badge followup-reason">${followUpReason}</span>
                </div>
                <small>PH ID: ${patient.philHealthId || 'N/A'}</small>
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
              <strong>#${patient.queueNumber} — ${patient.name}</strong>
              <div class="badge-group">
                <span class="badge ${patient.status}">${patient.status}</span>
                <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span>
                <span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>
              </div>
              <small>PH ID: ${patient.philHealthId || 'N/A'}</small>
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
        <div class="doctor-current-patient-details">
          <strong>#${servingPatient.queueNumber} — ${servingPatient.name}</strong>
          <div class="badge-group">
            <span class="badge serving">Serving</span>
            <span class="badge type-${servingPatient.patientStatus || servingPatient.type || 'regular'}">${(servingPatient.patientStatus || servingPatient.type || 'regular') === 'pwd' ? 'PWD' : (servingPatient.patientStatus || servingPatient.type || 'regular') === 'senior' ? 'Senior' : (servingPatient.patientStatus || servingPatient.type || 'regular') === 'emergency' ? 'Emergency' : 'Regular'}</span>
          </div>
          <small>Queue #${servingPatient.queueNumber}</small>
          <small>PH ID: ${servingPatient.philHealthId || 'N/A'}</small>
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
          <div class="badge-group">
            <span class="badge waiting">Waiting</span>
          </div>
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
        <strong>#${nextPatient.queueNumber} — ${nextPatient.name}</strong>
        <div class="badge-group">
          <span class="badge waiting">Waiting</span>
          <span class="badge type-${nextPatient.patientStatus || nextPatient.type || 'regular'}">${(nextPatient.patientStatus || nextPatient.type || 'regular') === 'pwd' ? 'PWD' : (nextPatient.patientStatus || nextPatient.type || 'regular') === 'senior' ? 'Senior' : (nextPatient.patientStatus || nextPatient.type || 'regular') === 'emergency' ? 'Emergency' : 'Regular'}</span>
        </div>
        <small>PH ID: ${nextPatient.philHealthId || 'N/A'}</small>
      `;
    } else {
      nextPatientCard.innerHTML = `
        <strong>No queue yet.</strong>
        <small>Awaiting the next patient.</small>
      `;
    }
  }

  if (state.patients.length === 0) {
    patientList.innerHTML = '<tr><td class="queue-table-empty" colspan="6">No patients have been added yet.</td></tr>';
    return;
  }

  // Only show non-follow-up patients in main list
  const normalPatients = state.patients.filter((patient) => patient.status !== 'follow-up');
  
  if (normalPatients.length === 0) {
    patientList.innerHTML = '<tr><td class="queue-table-empty" colspan="6">No patients in normal queue.</td></tr>';
  } else {
    patientList.innerHTML = normalPatients
      .map((patient) => {
        const patientType = patient.patientStatus || patient.type || 'regular';
        const isCurrentPatient = patient.status === 'serving';
        return `
        <tr>
          <td class="queue-table-number">#${patient.queueNumber}</td>
          <td class="queue-table-name">${patient.name}</td>
          <td><span class="badge ${patient.status}">${patient.status}</span></td>
          <td><span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span></td>
          <td>${patient.philHealthId || 'N/A'}</td>
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
    if (followUpPatients.length === 0) {
      followUpSection.hidden = true;
    } else {
      followUpSection.hidden = false;
      followUpPatientList.innerHTML = followUpPatients
        .map((patient) => {
          const patientType = patient.patientStatus || patient.type || 'regular';
          const isReady = (patient.followUpStatus || 'none') === 'ready_for_doctor';
          const reasonText = patient.followUpReason || 'Follow-up';
          return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} — ${patient.name}</strong>
              <div class="badge-group">
                <span class="badge follow-up">Follow-up</span>
                <span class="badge type-${patientType}">${patientType === 'pwd' ? 'PWD' : patientType === 'senior' ? 'Senior' : patientType === 'emergency' ? 'Emergency' : 'Regular'}</span>
              </div>
              <small>${reasonText}</small>
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
  // Try admin-specific inputs first, then fall back to doctor inputs
  const adminConsultationNoteInput = document.getElementById('admin-consultation-note');
  const adminIcdCodeInput = document.getElementById('admin-icd-code');
  const doctorConsultationNoteInput = document.getElementById('doctor-consultation-note');
  const doctorIcdCodeInput = document.getElementById('doctor-icd-code');

  const consultationNoteInput = adminConsultationNoteInput || doctorConsultationNoteInput;
  const icdCodeInput = adminIcdCodeInput || doctorIcdCodeInput;

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
  const adminHistoryEditForm = document.getElementById('edit-history-form');
  const adminCancelHistoryEditButton = document.getElementById('cancel-history-edit-btn');
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

  if (adminHistoryEditForm) {
    adminHistoryEditForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const historyId = document.getElementById('edit-history-id')?.value || '';
      const icdCode = document.getElementById('edit-history-icd-code')?.value || '';
      const consultationDetails = document.getElementById('edit-history-consultation')?.value || '';

      if (!historyId) {
        return;
      }

      postAction('edit-history', { id: historyId, icdCode, consultationDetails });
      adminHistoryEditForm.reset();
      closeHistoryEditModal();
    });
  }

  if (adminCancelHistoryEditButton) {
    adminCancelHistoryEditButton.addEventListener('click', closeHistoryEditModal);
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

  // Doctor page uses the same edit-history-form as admin page
  // The event listeners are already set up in initAdminPage
  // Just need to handle the cancel button for doctor page specifically
  const doctorCancelHistoryEditButton = document.getElementById('cancel-history-edit-btn');

  if (doctorCancelHistoryEditButton) {
    doctorCancelHistoryEditButton.addEventListener('click', closeHistoryEditModal);
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
