(function () {
  function renderDoctorQueue(state) {
    const patientList = document.getElementById('doctor-patient-list');
    const adminCount = document.getElementById('admin-count');

    // Use prioritized queue if available, otherwise fall back to all patients
    const displayPatients = state.prioritizedQueue || state.patients;
    const waitingCount = displayPatients.length;

    adminCount.textContent = `${waitingCount} patient${waitingCount !== 1 ? 's' : ''}`;

    if (waitingCount === 0) {
      patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
      return;
    }

    patientList.innerHTML = displayPatients
      .map((patient) => {
        const isCurrentPatient = patient.status === 'serving';
        const position = patient.position || waitingCount;
        return `
          <li class="queue-item">
            <div>
              <strong>#${position} - ${QueueApp.escapeHtml(patient.name)}</strong>
              <small class="queue-number">(Queue No. ${patient.queueNumber})</small>
              ${QueueApp.patientBadges(patient, { showPatientNumber: true, showRegistrationStatus: true })}
            </div>
            <div class="actions">
              <button class="btn btn-primary" data-doctor-action="${isCurrentPatient ? 'finish' : 'serve'}" data-id="${QueueApp.escapeHtml(patient.id)}">
                ${isCurrentPatient ? 'Done' : 'Serve'}
              </button>
            </div>
          </li>
        `;
      })
      .join('');
  }

  function renderConsultationHistory(state) {
    const historyList = document.getElementById('consultation-history');
    const historyCount = document.getElementById('history-count');
    const entries = state.consultationHistory || [];

    historyCount.textContent = `${entries.length} entries`;

    if (entries.length === 0) {
      historyList.innerHTML = '<li class="empty-state">No consultation history yet.</li>';
      return;
    }

    historyList.innerHTML = entries
      .slice()
      .reverse()
      .map((entry) => {
        const patientNumberBadge = entry.patientNumber
          ? `<span class="badge type-regular">No. ${QueueApp.escapeHtml(entry.patientNumber)}</span>`
          : '';

        return `
          <li class="queue-item">
            <div>
              <strong>#${entry.queueNumber} - ${QueueApp.escapeHtml(entry.name)}</strong>
              <small>${QueueApp.escapeHtml(entry.finishedAt || 'Completed')}</small>
            </div>
            <div class="badge-group">
              ${patientNumberBadge}
              <span class="badge serving">Completed</span>
            </div>
          </li>
        `;
      })
      .join('');
  }

  function initDoctorActions() {
    const serveNextButton = document.getElementById('doctor-serve-next-btn');

    serveNextButton.addEventListener('click', QueueApp.serveNextPatient);

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-doctor-action]');
      if (!button) {
        return;
      }

      const { doctorAction, id } = button.dataset;
      if (doctorAction === 'serve') {
        QueueApp.servePatient(id);
      } else if (doctorAction === 'finish') {
        QueueApp.finishPatient(id);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    QueueApp.onRender(renderDoctorQueue);
    QueueApp.onRender(renderConsultationHistory);
    initDoctorActions();
    QueueApp.initQueuePage();
  });
})();
