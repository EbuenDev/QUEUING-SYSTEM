(function () {
  function setAdminView(isAuthenticated) {
    const loginCard = document.getElementById('login-card');
    const adminPanel = document.getElementById('admin-panel');
    const logoutButton = document.getElementById('logout-btn');

    loginCard.hidden = isAuthenticated;
    adminPanel.hidden = !isAuthenticated;
    logoutButton.hidden = !isAuthenticated;
  }

  function showAdminLoginError(message) {
    document.getElementById('login-error').textContent = message;
  }

  function renderAdminQueue(state) {
    const patientList = document.getElementById('patient-list');
    const adminCount = document.getElementById('admin-count');

    adminCount.textContent = `${state.patients.length} patients`;

    if (state.patients.length === 0) {
      patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
      return;
    }

    patientList.innerHTML = state.patients
      .map((patient) => {
        const isCurrentPatient = patient.status === 'serving';
        return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} - ${QueueApp.escapeHtml(patient.name)}</strong>
              ${QueueApp.patientBadges(patient, { showPatientNumber: true })}
            </div>
            <div class="actions">
              <button class="btn btn-secondary" data-action="edit" data-id="${QueueApp.escapeHtml(patient.id)}">Edit</button>
              <button class="btn btn-primary" data-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${QueueApp.escapeHtml(patient.id)}">
                ${isCurrentPatient ? 'Done' : 'Serve'}
              </button>
              <button class="btn btn-danger" data-action="delete" data-id="${QueueApp.escapeHtml(patient.id)}">Delete</button>
            </div>
          </li>
        `;
      })
      .join('');
  }

  function initAdminAuth() {
    const loginForm = document.getElementById('admin-login-form');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const logoutButton = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAdminLoginError('');

      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const isAuthenticated = await QueueApp.loginAdmin(username, password);

      if (!isAuthenticated) {
        showAdminLoginError('Invalid username or password.');
        return;
      }

      QueueApp.setAdminAuthenticated(true);
      setAdminView(true);
      loginForm.reset();
    });

    logoutButton.addEventListener('click', async () => {
      await QueueApp.logoutAdmin();
      setAdminView(false);
      showAdminLoginError('');
      usernameInput.focus();
    });

    window.addEventListener('queue:unauthorized', () => {
      QueueApp.setAdminAuthenticated(false);
      setAdminView(false);
      showAdminLoginError('Your admin session expired. Please log in again.');
    });

    setAdminView(QueueApp.isAdminAuthenticated());
  }

  function initAdminActions() {
    const patientForm = document.getElementById('patient-form');
    const patientNameInput = document.getElementById('patient-name');
    const patientNumberInput = document.getElementById('patient-number');
    const serveNextButton = document.getElementById('serve-next-btn');
    const resetButton = document.getElementById('reset-btn');

    patientNumberInput.addEventListener('input', () => {
      patientNumberInput.value = QueueApp.cleanPatientNumber(patientNumberInput.value);
    });

    patientForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const type = patientForm.querySelector('input[name="admin-patient-type"]:checked')?.value || 'regular';
      QueueApp.addPatient(patientNameInput.value, type, patientNumberInput.value);
      patientForm.reset();
    });

    serveNextButton.addEventListener('click', QueueApp.serveNextPatient);
    resetButton.addEventListener('click', QueueApp.resetQueue);

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const { action, id } = button.dataset;
      const patient = QueueApp.getState().patients.find((item) => item.id === id);

      if (action === 'edit') {
        if (!patient) {
          return;
        }

        const nextName = window.prompt('Update patient name', patient.name);
        if (nextName !== null) {
          QueueApp.editPatient(id, nextName, patient.type || 'regular', patient.patientNumber || '');
        }
      } else if (action === 'delete') {
        QueueApp.deletePatient(id);
      } else if (action === 'serve') {
        QueueApp.servePatient(id);
      } else if (action === 'finish') {
        QueueApp.finishPatient(id);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    QueueApp.onRender(renderAdminQueue);
    initAdminAuth();
    initAdminActions();
    QueueApp.initQueuePage();
  });
})();
