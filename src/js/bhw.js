(function () {
  function renderBhwQueue(state) {
    const patientList = document.getElementById('bhw-patient-list');
    const countLabel = document.getElementById('bhw-count');

    // Use prioritized queue if available, otherwise fall back to all patients
    const displayPatients = state.prioritizedQueue || state.patients;
    const waitingCount = displayPatients.length;

    countLabel.textContent = `${waitingCount} patient${waitingCount !== 1 ? 's' : ''}`;

    if (waitingCount === 0) {
      patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
      return;
    }

    patientList.innerHTML = displayPatients
      .map(
        (patient) => {
          const position = patient.position || waitingCount;
          return `
            <li class="queue-item">
              <div>
                <strong>#${position} - ${QueueApp.escapeHtml(patient.name)}</strong>
                <small class="queue-number">(Queue No. ${patient.queueNumber})</small>
                ${QueueApp.patientBadges(patient)}
              </div>
            </li>
          `;
        },
      )
      .join('');
  }

  function initBhwForm() {
    const addForm = document.getElementById('bhw-add-form');
    const addNameInput = document.getElementById('bhw-patient-name');

    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const type = addForm.querySelector('input[name="patient-type"]:checked')?.value || 'regular';
      QueueApp.addPatient(addNameInput.value, type);
      addForm.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    QueueApp.onRender(renderBhwQueue);
    initBhwForm();
    QueueApp.initQueuePage();
  });
})();
