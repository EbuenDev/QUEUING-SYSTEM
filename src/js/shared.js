(function () {
  const DEFAULT_STATE = {
    patients: [],
    nextQueueNumber: 1,
    consultationHistory: [],
  };

  let state = { ...DEFAULT_STATE };
  let updateChannel = null;
  let syncStarted = false;
  const renderers = new Set();

  function getState() {
    return state;
  }

  function setState(nextState) {
    state = {
      patients: Array.isArray(nextState?.patients) ? nextState.patients : [],
      nextQueueNumber: Math.max(1, Number(nextState?.nextQueueNumber) || 1),
      consultationHistory: Array.isArray(nextState?.consultationHistory)
        ? nextState.consultationHistory
        : [],
    };

    render();
  }

  function onRender(renderer) {
    renderers.add(renderer);
  }

  function render() {
    renderers.forEach((renderer) => renderer(state));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCurrentServingPatient() {
    return state.patients.find((patient) => patient.status === 'serving') || null;
  }

  function getWaitingPatients() {
    return state.patients.filter((patient) => patient.status === 'waiting');
  }

  function getPatientTypeLabel(type) {
    if (type === 'pwd') {
      return 'PWD';
    }

    if (type === 'senior') {
      return 'Senior';
    }

    return 'Regular';
  }

  function patientBadges(patient, options = {}) {
    const patientType = patient.type || 'regular';
    const patientNumberBadge = options.showPatientNumber && patient.patientNumber
      ? `<span class="badge type-regular">No. ${escapeHtml(patient.patientNumber)}</span>`
      : '';

    return `
      <div class="badge-group">
        <span class="badge ${escapeHtml(patient.status)}">${escapeHtml(patient.status)}</span>
        ${patientNumberBadge}
        <span class="badge type-${escapeHtml(patientType)}">${getPatientTypeLabel(patientType)}</span>
      </div>
    `;
  }

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

  function initRealtimeSync() {
    if (syncStarted) {
      return;
    }

    syncStarted = true;

    if (typeof BroadcastChannel !== 'undefined') {
      updateChannel = new BroadcastChannel('queue-system-sync');
      updateChannel.addEventListener('message', (event) => {
        if (event.data?.type === 'queue-state-update' && event.data.state) {
          setState(event.data.state);
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
            setState(payload.state);
          }
        } catch (error) {
          console.warn('Unable to sync queue state from storage', error);
        }
      }

      fetchState();
    });
  }

  async function fetchState() {
    try {
      const response = await fetch('backend/api.php', { cache: 'no-store' });
      const data = await response.json();
      if (data?.success && data.state) {
        setState(data.state);
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
        cache: 'no-store',
      });

      const data = await response.json();

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('queue:unauthorized'));
        return data;
      }

      if (data?.success && data.state) {
        setState(data.state);
        broadcastState(data.state);
        await fetchState();
      }

      return data;
    } catch (error) {
      console.error('Unable to update queue state', error);
      return { success: false, message: 'Unable to update queue state' };
    }
  }

  async function loginAdmin(username, password) {
    try {
      const response = await fetch('backend/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'login', username, password }),
        cache: 'no-store',
      });

      const data = await response.json();
      return response.ok && data?.success;
    } catch (error) {
      console.error('Unable to login as admin', error);
      return false;
    }
  }

  async function logoutAdmin() {
    await postAction('logout');
    setAdminAuthenticated(false);
  }

  function isAdminAuthenticated() {
    try {
      return sessionStorage.getItem('queue-admin-auth') === 'true';
    } catch (error) {
      console.warn('Unable to read admin auth state', error);
      return false;
    }
  }

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

  function cleanPatientNumber(patientNumber) {
    return String(patientNumber || '').replace(/\D/g, '').slice(0, 12);
  }

  function addPatient(name, type = 'regular', patientNumber = '') {
    const trimmedName = name.trim();
    if (trimmedName) {
      postAction('add', { name: trimmedName, type, patientNumber: cleanPatientNumber(patientNumber) });
    }
  }

  function editPatient(id, name, type = 'regular', patientNumber = '') {
    const trimmedName = name.trim();
    if (trimmedName) {
      postAction('edit', { id, name: trimmedName, type, patientNumber: cleanPatientNumber(patientNumber) });
    }
  }

  function deletePatient(id) {
    postAction('delete', { id });
  }

  function servePatient(id) {
    postAction('serve', { id });
  }

  function finishPatient(id) {
    postAction('finish', { id });
  }

  function serveNextPatient() {
    postAction('serve-next');
  }

  function resetQueue() {
    postAction('reset');
  }

  function initQueuePage() {
    initRealtimeSync();
    fetchState();
    setInterval(fetchState, 1000);
  }

  window.QueueApp = {
    addPatient,
    cleanPatientNumber,
    deletePatient,
    editPatient,
    escapeHtml,
    finishPatient,
    getCurrentServingPatient,
    getPatientTypeLabel,
    getState,
    getWaitingPatients,
    initQueuePage,
    isAdminAuthenticated,
    loginAdmin,
    logoutAdmin,
    onRender,
    patientBadges,
    resetQueue,
    serveNextPatient,
    servePatient,
    setAdminAuthenticated,
  };
})();
