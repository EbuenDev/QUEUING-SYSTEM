(function () {
  function renderBhwQueue(state) {
    const patientList = document.getElementById('bhw-patient-list');
    const countLabel = document.getElementById('bhw-count');

    countLabel.textContent = `${state.patients.length} patients`;

    if (state.patients.length === 0) {
      patientList.innerHTML = '<li class="empty-state">No patients have been added yet.</li>';
      return;
    }

    patientList.innerHTML = state.patients
      .map(
        (patient) => `
          <li class="queue-item">
            <div>
              <strong>#${patient.queueNumber} - ${QueueApp.escapeHtml(patient.name)}</strong>
              ${QueueApp.patientBadges(patient)}
            </div>
          </li>
        `,
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
