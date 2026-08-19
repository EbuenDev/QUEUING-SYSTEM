const test = require('node:test');
const assert = require('node:assert/strict');
const {
  call,
  createDom,
  seed,
} = require('./test-helper');

test('render dispatches only to renderers with matching containers', async () => {
  const { dom } = createDom('<ul id="waiting-list"></ul>');
  await new Promise((resolve) => setImmediate(resolve));
  dom.window.eval(`
    window.__rendererCalls = [];
    renderAdminQueue = () => window.__rendererCalls.push('admin');
    renderPatientBoard = () => window.__rendererCalls.push('patient');
    renderDoctorQueue = () => window.__rendererCalls.push('doctor');
    renderBhwQueue = () => window.__rendererCalls.push('bhw');
    renderConsultationHistory = () => window.__rendererCalls.push('history');
  `);

  call(dom, 'render()');

  assert.deepEqual([...dom.window.__rendererCalls], ['patient']);
  dom.window.close();
});

test('empty renderers display empty-state messages and counts', () => {
  const { dom } = createDom(`
    <ul id="waiting-list"></ul>
    <span id="queue-count"></span>
    <div id="current-serving"></div>
    <div id="current-serving-name"></div>
    <div id="next-patient"></div>
    <ul id="patient-list"></ul>
    <span id="admin-count"></span>
    <ul id="doctor-patient-list"></ul>
    <span id="doctor-patient-count"></span>
    <div id="doctor-current-patient"></div>
    <div id="doctor-next-patient"></div>
    <ul id="bhw-patient-list"></ul>
    <span id="bhw-count"></span>
    <ul id="consultation-history"></ul>
    <span id="history-count"></span>
  `);
  seed(dom, { patients: [], consultationHistory: [] });

  call(dom, `
    renderPatientBoard();
    renderAdminQueue();
    renderDoctorQueue();
    renderBhwQueue();
    renderConsultationHistory();
  `);

  assert.match(
    dom.window.document.getElementById('waiting-list').innerHTML,
    /waiting list is empty/,
  );
  assert.match(
    dom.window.document.getElementById('patient-list').innerHTML,
    /No patients/,
  );
  assert.match(
    dom.window.document.getElementById('doctor-patient-list').innerHTML,
    /No patients/,
  );
  assert.match(
    dom.window.document.getElementById('bhw-patient-list').innerHTML,
    /No patients/,
  );
  assert.match(
    dom.window.document.getElementById('consultation-history').innerHTML,
    /No consultation history/,
  );
  assert.equal(dom.window.document.getElementById('queue-count').textContent, '0 patients');
  assert.equal(dom.window.document.getElementById('admin-count').textContent, '0 patients');
  assert.equal(dom.window.document.getElementById('doctor-patient-count').textContent, '0 patients in queue');
  assert.equal(dom.window.document.getElementById('bhw-count').textContent, '0 patients');
  assert.equal(dom.window.document.getElementById('history-count').textContent, '0 entries');

  dom.window.close();
});

test('renderPatientBoard shows serving, next, waiting data, and count', () => {
  const { dom } = createDom(`
    <div id="current-serving"></div>
    <div id="current-serving-heading"></div>
    <div id="current-serving-name"></div>
    <div id="next-patient"></div>
    <ul id="waiting-list"></ul>
    <span id="queue-count"></span>
  `);
  seed(dom, {
    patients: [
      {
        id: 'serving',
        name: 'Serving Patient',
        queueNumber: 1,
        status: 'serving',
        type: 'regular',
      },
      {
        id: 'waiting',
        name: 'Waiting Patient',
        queueNumber: 2,
        status: 'waiting',
        type: 'pwd',
      },
    ],
    consultationHistory: [],
  });

  call(dom, 'renderPatientBoard()');

  assert.equal(dom.window.document.getElementById('current-serving').textContent, '#1');
  assert.equal(dom.window.document.getElementById('current-serving-name').textContent, 'Serving Patient');
  assert.equal(dom.window.document.getElementById('next-patient').textContent, '#2 — Waiting Patient');
  assert.equal(dom.window.document.getElementById('queue-count').textContent, '1 patients');
  assert.match(dom.window.document.getElementById('waiting-list').innerHTML, /Waiting Patient/);
  assert.match(dom.window.document.getElementById('waiting-list').innerHTML, /PWD/);

  dom.window.close();
});

test('renderAdminQueue shows queue number and patient badges', () => {
  const { dom } = createDom(`
    <ul id="patient-list"></ul>
    <span id="admin-count"></span>
  `);
  seed(dom, {
    patients: [
      {
        id: 'p1',
        name: 'Admin Patient',
        queueNumber: 7,
        status: 'waiting',
        patientStatus: 'emergency',
        philHealthStatus: 'registered',
        philHealthId: 'PH1',
      },
    ],
    consultationHistory: [],
  });

  call(dom, 'renderAdminQueue()');

  const markup = dom.window.document.getElementById('patient-list').innerHTML;
  assert.match(markup, /#7 — Admin Patient/);
  assert.match(markup, /emergency/);
  assert.match(markup, /Emergency/);
  assert.match(markup, /registered/);
  assert.equal(dom.window.document.getElementById('admin-count').textContent, '1 patients');

  dom.window.close();
});

test('renderDoctorQueue shows current and next patient text', () => {
  const { dom } = createDom(`
    <ul id="doctor-patient-list"></ul>
    <span id="doctor-patient-count"></span>
    <div id="doctor-current-patient"></div>
    <div id="doctor-next-patient"></div>
  `);
  seed(dom, {
    patients: [
      {
        id: 'serving',
        name: 'Current Doctor Patient',
        queueNumber: 3,
        status: 'serving',
        patientStatus: 'senior',
      },
      {
        id: 'waiting',
        name: 'Next Doctor Patient',
        queueNumber: 4,
        status: 'waiting',
        patientStatus: 'regular',
      },
    ],
    consultationHistory: [],
  });

  call(dom, 'renderDoctorQueue()');

  assert.match(
    dom.window.document.getElementById('doctor-current-patient').innerHTML,
    /Current Doctor Patient/,
  );
  assert.match(
    dom.window.document.getElementById('doctor-next-patient').innerHTML,
    /Next Doctor Patient/,
  );
  assert.equal(
    dom.window.document.getElementById('doctor-patient-count').textContent,
    '2 patients in queue',
  );

  dom.window.close();
});

test('renderBhwQueue shows patient count and row data', () => {
  const { dom } = createDom(`
    <ul id="bhw-patient-list"></ul>
    <span id="bhw-count"></span>
  `);
  seed(dom, {
    patients: [
      {
        id: 'p1',
        name: 'BHW Patient',
        queueNumber: 5,
        status: 'waiting',
        type: 'senior',
      },
    ],
    consultationHistory: [],
  });

  call(dom, 'renderBhwQueue()');

  assert.equal(dom.window.document.getElementById('bhw-count').textContent, '1 patients');
  assert.match(dom.window.document.getElementById('bhw-patient-list').innerHTML, /#5 — BHW Patient/);
  assert.match(dom.window.document.getElementById('bhw-patient-list').innerHTML, /Senior/);

  dom.window.close();
});

test('renderConsultationHistory shows history fields', () => {
  const { dom } = createDom(`
    <ul id="consultation-history"></ul>
    <span id="history-count"></span>
  `);
  seed(dom, {
    patients: [],
    consultationHistory: [
      {
        id: 'h1',
        name: 'History Patient',
        queueNumber: 6,
        finishedAt: '2024-01-02 03:04:05',
        philHealthId: 'PH6',
        icdCode: 'J00',
        consultationDetails: 'History notes',
      },
    ],
  });

  call(dom, 'renderConsultationHistory()');

  const markup = dom.window.document.getElementById('consultation-history').innerHTML;
  assert.match(markup, /#6 — History Patient/);
  assert.match(markup, /PH6/);
  assert.match(markup, /J00/);
  assert.match(markup, /History notes/);
  assert.equal(dom.window.document.getElementById('history-count').textContent, '1 entries');

  dom.window.close();
});

test('renderers preserve the existing unescaped-name behavior', () => {
  const { dom } = createDom(`
    <ul id="patient-list"></ul>
    <span id="admin-count"></span>
    <ul id="consultation-history"></ul>
    <span id="history-count"></span>
  `);
  seed(dom, {
    patients: [
      {
        id: 'p1',
        name: '<script>alert(1)</script>',
        queueNumber: 1,
        status: 'waiting',
      },
    ],
    consultationHistory: [
      {
        id: 'h1',
        name: '<script>alert(2)</script>',
        queueNumber: 2,
      },
    ],
  });

  call(dom, 'renderAdminQueue(); renderConsultationHistory()');

  assert.match(
    dom.window.document.getElementById('patient-list').innerHTML,
    /<script>alert\(1\)<\/script>/,
  );
  assert.match(
    dom.window.document.getElementById('consultation-history').innerHTML,
    /<script>alert\(2\)<\/script>/,
  );

  dom.window.close();
});
