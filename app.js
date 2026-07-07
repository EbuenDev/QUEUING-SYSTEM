let state = {
  patients: [],
  nextQueueNumber: 1,
};

async function fetchState() {
  try {
    const response = await fetch('backend/api.php');
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
    });

    const data = await response.json();
    if (data?.success && data.state) {
      state = data.state;
      render();
    }
  } catch (error) {
    console.error('Unable to update queue state', error);
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
  const currentServingName = document.getElementById('current-serving-name');
  const nextPatient = document.getElementById('next-patient');
  const waitingList = document.getElementById('waiting-list');
  const queueCount = document.getElementById('queue-count');

  const servingPatient = getCurrentServingPatient();
  const nextPatientEntry = getWaitingPatients()[0] || null;

  if (servingPatient) {
    currentServing.textContent = `#${servingPatient.queueNumber}`;
    currentServingName.textContent = `${servingPatient.name} is being helped now.`;
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

function renderAdminQueue() {
  const patientList = document.getElementById('patient-list');
  const adminCount = document.getElementById('admin-count');

  adminCount.textContent = `${state.patients.length} patients`;

  if (state.patients.length === 0) {
    patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
    return;
  }

  patientList.innerHTML = state.patients
    .map(
      (patient) => `
        <li class="queue-item">
          <div>
            <strong>#${patient.queueNumber} — ${patient.name}</strong>
            <span class="badge ${patient.status}">${patient.status}</span>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" data-action="edit" data-id="${patient.id}">Edit</button>
            <button class="btn btn-primary" data-action="serve" data-id="${patient.id}">Serve</button>
            <button class="btn btn-danger" data-action="delete" data-id="${patient.id}">Delete</button>
          </div>
        </li>
      `,
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
}

function initAdminPage() {
  const patientForm = document.getElementById('patient-form');
  const patientNameInput = document.getElementById('patient-name');
  const serveNextButton = document.getElementById('serve-next-btn');
  const resetButton = document.getElementById('reset-btn');

  patientForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addPatient(patientNameInput.value);
    patientForm.reset();
  });

  serveNextButton.addEventListener('click', serveNextPatient);
  resetButton.addEventListener('click', resetQueue);

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
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('patient-list')) {
    initAdminPage();
  }

  fetchState();
  setInterval(fetchState, 3000);
});
