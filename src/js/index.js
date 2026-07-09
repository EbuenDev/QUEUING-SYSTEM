(function () {
  function renderPatientBoard() {
    const currentServing = document.getElementById('current-serving');
    const currentServingHeading = document.getElementById('current-serving-heading');
    const currentServingName = document.getElementById('current-serving-name');
    const nextPatient = document.getElementById('next-patient');
    const waitingList = document.getElementById('waiting-list');
    const queueCount = document.getElementById('queue-count');
    const spotlightCard = document.querySelector('.spotlight');

    const servingPatient = QueueApp.getCurrentServingPatient();
    const waitingPatients = QueueApp.getWaitingPatients();
    const nextPatientEntry = waitingPatients[0] || null;
    const hasPatients = QueueApp.getState().patients.length > 0;

    currentServingHeading.hidden = !servingPatient;
    spotlightCard.classList.toggle('is-serving', Boolean(servingPatient));

    if (servingPatient) {
      currentServing.textContent = `#${servingPatient.queueNumber} - ${servingPatient.name}`;
      currentServingName.textContent = 'is being consulted';
    } else if (hasPatients) {
      currentServing.textContent = 'Wait for the Doctors Doorbell';
      currentServingName.textContent = 'A patient is waiting to be called.';
    } else {
      currentServing.textContent = 'Waiting for the first patient';
      currentServingName.textContent = 'No patient is being served yet.';
    }

    nextPatient.textContent = nextPatientEntry
      ? `#${nextPatientEntry.queueNumber} - ${nextPatientEntry.name}`
      : 'No queue yet';
    queueCount.textContent = `${waitingPatients.length} patients`;

    if (waitingPatients.length === 0) {
      waitingList.innerHTML = '<li class="empty-state">The waiting list is empty.</li>';
      return;
    }

    waitingList.innerHTML = waitingPatients
      .map((patient) => {
        const patientType = patient.type || 'regular';
        return `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} - ${QueueApp.escapeHtml(patient.name)}</strong>
              <small>Waiting for service</small>
            </div>
            <div class="badge-group">
              <span class="badge waiting">Waiting</span>
              <span class="badge type-${QueueApp.escapeHtml(patientType)}">${QueueApp.getPatientTypeLabel(patientType)}</span>
            </div>
          </li>
        `;
      })
      .join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    QueueApp.onRender(renderPatientBoard);
    QueueApp.initQueuePage();
  });
})();
