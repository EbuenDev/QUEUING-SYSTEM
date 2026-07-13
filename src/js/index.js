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
    const state = QueueApp.getState();
    
    // Use prioritized queue if available, otherwise fall back to waiting patients
    const prioritizedQueue = state.prioritizedQueue || [];
    const waitingPatients = prioritizedQueue;
    const nextPatientEntry = waitingPatients[0] || null;
    const hasPatients = state.patients.length > 0;

    currentServingHeading.hidden = !servingPatient;
    spotlightCard.classList.toggle('is-serving', Boolean(servingPatient));

    if (servingPatient) {
      const servingPosition = servingPatient.position || 1;
      currentServing.textContent = `#${servingPosition} - ${servingPatient.name}`;
      currentServingName.textContent = `(Queue No. ${servingPatient.queueNumber}) is being consulted`;
    } else if (hasPatients) {
      const next = waitingPatients[0];
      const nextPosition = next.position || 1;
      currentServing.textContent = `#${nextPosition} - ${next.name}`;
      currentServingName.textContent = `(Queue No. ${next.queueNumber}) is next in line`;
    } else {
      currentServing.textContent = 'Waiting for the first patient';
      currentServingName.textContent = 'No patient is being served yet.';
    }

    nextPatient.textContent = nextPatientEntry
      ? `#${nextPatientEntry.position || 1} - ${nextPatientEntry.name}`
      : 'No queue yet';
    queueCount.textContent = `${waitingPatients.length} patient${waitingPatients.length !== 1 ? 's' : ''}`;

    if (waitingPatients.length === 0) {
      waitingList.innerHTML = '<li class="empty-state">The waiting list is empty.</li>';
      return;
    }

    waitingList.innerHTML = waitingPatients
      .map((patient) => {
        const patientType = patient.type || 'regular';
        const position = patient.position || waitingPatients.length;
        return `
          <li class="queue-item">
            <div>
              <strong>#${position} - ${QueueApp.escapeHtml(patient.name)}</strong>
              <small class="queue-number">(Queue No. ${patient.queueNumber})</small>
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

  function updateClock() {
    const clockElement = document.getElementById('clock');
    if (!clockElement) return;

    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;

    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');

    clockElement.textContent = `${hours}:${minutesStr}:${secondsStr} ${ampm}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    QueueApp.onRender(renderPatientBoard);
    QueueApp.initQueuePage();
    updateClock();
    setInterval(updateClock, 1000);
  });
})();
