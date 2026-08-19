// Shared rendering and DOM helpers used by every page of the queuing system.

const PATIENT_TYPE_LABELS = {
  regular: 'Regular',
  pwd: 'PWD',
  senior: 'Senior',
  emergency: 'Emergency',
};

const EMPTY_STATE_MESSAGES = {
  patients: 'No patients have been added yet.',
  waitingList: 'The waiting list is empty.',
  history: 'No consultation history yet.',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasElement(id) {
  return Boolean(document.getElementById(id));
}

function getElementValue(id) {
  return document.getElementById(id)?.value || '';
}

function setElementValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function setElementHidden(id, isHidden) {
  const element = document.getElementById(id);
  if (element) {
    element.hidden = isHidden;
  }
}

function getPatientType(patient) {
  return patient?.patientStatus || patient?.type || 'regular';
}

function getPatientTypeLabel(type) {
  return PATIENT_TYPE_LABELS[type] || PATIENT_TYPE_LABELS.regular;
}

function renderTypeBadge(patient) {
  const type = getPatientType(patient);
  return `<span class="badge type-${type}">${getPatientTypeLabel(type)}</span>`;
}

function renderStatusBadge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

function renderPhilHealthBadge(patient) {
  const philHealthStatus = patient?.philHealthStatus || 'no-philhealth';
  return `<span class="badge philhealth-${philHealthStatus}">${philHealthStatus.replace(/-/g, ' ')}</span>`;
}

function renderPatientHeading(patient) {
  return `<strong>#${patient.queueNumber} — ${patient.name}</strong>`;
}

function renderPhilHealthId(patient) {
  return `<small>PH ID: ${patient?.philHealthId || 'N/A'}</small>`;
}

function renderBadgeGroup(badges) {
  return `<div class="badge-group">${badges.join('')}</div>`;
}

function renderActions(buttons) {
  return `<div class="actions">${buttons.join('')}</div>`;
}

function renderQueueItem(columns) {
  return `<li class="queue-item">${columns.filter(Boolean).join('')}</li>`;
}

function renderEmptyState(message) {
  return `<li class="empty-state">${message}</li>`;
}

// Builds the left-hand column of a queue item: heading, optional badges,
// optional notes and optional PhilHealth ID.
function renderPatientDetails(patient, { badges = [], notes = [], showPhilHealthId = false } = {}) {
  const parts = [renderPatientHeading(patient)];

  notes.forEach((note) => parts.push(`<small>${note}</small>`));

  if (badges.length > 0) {
    parts.push(renderBadgeGroup(badges));
  }

  if (showPhilHealthId) {
    parts.push(renderPhilHealthId(patient));
  }

  return `<div>${parts.join('')}</div>`;
}

function renderActionButton(label, { variant, attribute, action, id }) {
  return `<button class="btn ${variant}" type="button" ${attribute}="${action}" data-id="${id}">${label}</button>`;
}
