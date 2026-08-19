const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

function response(data, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

function createDom(html = '') {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
  });
  dom.window.fetch = async () => response({ success: true, state: { patients: [], nextQueueNumber: 1, consultationHistory: [] } });
  dom.window.BroadcastChannel = class {
    addEventListener() {}
    postMessage() {}
    close() {}
  };
  dom.window.print = () => {};
  dom.window.console.warn = () => {};
  dom.window.console.error = () => {};
  dom.window.eval(`${appSource}\nwindow.__setState = (nextState) => { state = nextState; };\nwindow.__getState = () => state;`);
  return dom;
}

function seed(dom, nextState) {
  dom.window.__setState(nextState);
}

function call(dom, expression) {
  return dom.window.eval(expression);
}

test('escapeHtml handles special values', () => {
  const dom = createDom();
  assert.equal(call(dom, `escapeHtml('& < > " \\'')`), '&amp; &lt; &gt; &quot; &#039;');
  assert.equal(call(dom, 'escapeHtml(null)'), '');
  assert.equal(call(dom, 'escapeHtml(undefined)'), '');
  assert.equal(call(dom, 'escapeHtml(42)'), '42');
  dom.window.close();
});

test('queue selectors filter statuses and empty state', () => {
  const dom = createDom();
  seed(dom, { patients: [{ id: 'a', status: 'waiting' }, { id: 'b', status: 'serving' }, { id: 'c', status: 'skipped' }], consultationHistory: [] });
  assert.equal(call(dom, 'getCurrentServingPatient().id'), 'b');
  assert.deepEqual(call(dom, 'getWaitingPatients().map((p) => p.id)'), ['a']);
  seed(dom, { patients: [], consultationHistory: [] });
  assert.equal(call(dom, 'getCurrentServingPatient()'), null);
  assert.deepEqual(call(dom, 'getWaitingPatients()'), []);
  dom.window.close();
});

test('admin auth storage round trips and failures are graceful', () => {
  const dom = createDom();
  call(dom, 'setAdminAuthenticated(true)');
  assert.equal(call(dom, 'isAdminAuthenticated()'), true);
  call(dom, 'setAdminAuthenticated(false)');
  assert.equal(call(dom, 'isAdminAuthenticated()'), false);
  dom.window.sessionStorage.getItem = () => { throw new Error('blocked'); };
  dom.window.sessionStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(call(dom, 'isAdminAuthenticated()'), false);
  assert.doesNotThrow(() => call(dom, 'setAdminAuthenticated(true)'));
  dom.window.close();
});

test('admin view and login error tolerate missing elements', () => {
  const dom = createDom('<div id="login-card"></div><div id="admin-panel"></div><button id="logout-btn"></button><p id="login-error"></p>');
  call(dom, 'setAdminView(true)');
  assert.equal(dom.window.document.getElementById('login-card').hidden, true);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, false);
  assert.equal(dom.window.document.getElementById('logout-btn').hidden, false);
  call(dom, 'setAdminView(false)');
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, true);
  call(dom, `showAdminLoginError('bad')`);
  assert.equal(dom.window.document.getElementById('login-error').textContent, 'bad');
  const empty = createDom();
  assert.doesNotThrow(() => call(empty, 'setAdminView(true)'));
  assert.doesNotThrow(() => call(empty, `showAdminLoginError('x')`));
  dom.window.close();
  empty.window.close();
});

test('patient actions normalize fields and post expected payloads', async () => {
  const dom = createDom();
  const requests = [];
  dom.window.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return response({ success: false });
  };
  call(dom, `addPatient({ name: '   ', philHealthId: 'x' })`);
  call(dom, `addPatient({ name: '  Ana ', philHealthId: ' PH ', patientStatus: 'pwd', philHealthStatus: 'registered' })`);
  call(dom, `editPatient('a', { name: '  Bea ', philHealthId: ' P ', patientStatus: 'senior', philHealthStatus: 'no-philhealth' })`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests, [
    { action: 'add', name: 'Ana', philHealthId: 'PH', patientStatus: 'pwd', philHealthStatus: 'registered' },
    { action: 'edit', id: 'a', name: 'Bea', philHealthId: 'P', patientStatus: 'senior', philHealthStatus: 'no-philhealth' },
  ]);
  dom.window.close();
});

test('finish reads and clears notes and action helpers post ids', async () => {
  const dom = createDom('<textarea id="doctor-consultation-note"> notes </textarea><input id="doctor-icd-code" value=" J00 " />');
  const requests = [];
  dom.window.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return response({ success: false });
  };
  call(dom, `finishPatient('a')`);
  call(dom, `deletePatient('b'); servePatient('c'); skipPatient('d'); recallPatient('e'); serveNextPatient(); resetQueue()`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dom.window.document.getElementById('doctor-consultation-note').value, '');
  assert.equal(dom.window.document.getElementById('doctor-icd-code').value, '');
  assert.deepEqual(requests, [
    { action: 'finish', id: 'a', consultationDetails: ' notes ', icdCode: ' J00 ' },
    { action: 'delete', id: 'b' }, { action: 'serve', id: 'c' }, { action: 'skip', id: 'd' },
    { action: 'recall', id: 'e' }, { action: 'serve-next' }, { action: 'reset' },
  ]);
  dom.window.close();
});

test('postAction handles unauthorized, success rerender, and rejected fetch', async () => {
  const dom = createDom('<ul id="patient-list"></ul><span id="admin-count"></span><div id="login-card"></div><div id="admin-panel"></div>');
  let renderCount = 0;
  dom.window.eval('render = () => { window.__renderCount = (window.__renderCount || 0) + 1 }');
  dom.window.fetch = async () => response({}, 401);
  call(dom, 'setAdminAuthenticated(true)');
  await call(dom, `postAction('delete', { id: 'x' })`);
  assert.equal(call(dom, 'isAdminAuthenticated()'), false);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, true);
  seed(dom, { patients: [], consultationHistory: [] });
  let calls = 0;
  dom.window.fetch = async () => {
    calls += 1;
    return response(calls === 1
      ? { success: true, state: { patients: [{ id: 'x' }], consultationHistory: [] } }
      : { success: true, state: { patients: [{ id: 'x' }], consultationHistory: [] } });
  };
  await call(dom, `postAction('skip', { id: 'x' })`);
  assert.equal(dom.window.__getState().patients[0].id, 'x');
  dom.window.fetch = async () => { throw new Error('offline'); };
  await assert.doesNotReject(() => call(dom, `postAction('skip', { id: 'x' })`));
  assert.equal(renderCount, 0);
  dom.window.close();
});

test('render dispatches only to containers that exist', () => {
  const dom = createDom('<ul id="waiting-list"></ul><span id="queue-count"></span><div id="current-serving"></div><div id="current-serving-name"></div><div id="next-patient"></div>');
  seed(dom, { patients: [], consultationHistory: [] });
  assert.doesNotThrow(() => call(dom, 'render()'));
  assert.match(dom.window.document.getElementById('waiting-list').innerHTML, /waiting list is empty/);
  dom.window.close();
});

test('renderers produce their documented empty state and counts', () => {
  const dom = createDom(`
    <ul id="patient-list"></ul><span id="admin-count"></span>
    <ul id="doctor-patient-list"></ul><span id="doctor-patient-count"></span>
    <div id="doctor-current-patient"></div><div id="doctor-next-patient"></div>
    <ul id="bhw-patient-list"></ul><span id="bhw-count"></span>
    <ul id="consultation-history"></ul><span id="history-count"></span>
    <div id="current-serving"></div><div id="current-serving-heading"></div>
    <div id="current-serving-name"></div><div id="next-patient"></div>
    <span id="queue-count"></span><ul id="waiting-list"></ul>
  `);
  seed(dom, { patients: [], consultationHistory: [] });
  call(dom, 'renderAdminQueue(); renderDoctorQueue(); renderBhwQueue(); renderConsultationHistory()');
  assert.match(dom.window.document.getElementById('patient-list').innerHTML, /No patients/);
  assert.match(dom.window.document.getElementById('doctor-patient-list').innerHTML, /No patients/);
  assert.match(dom.window.document.getElementById('bhw-patient-list').innerHTML, /No patients/);
  assert.match(dom.window.document.getElementById('consultation-history').innerHTML, /No consultation history/);
  assert.equal(dom.window.document.getElementById('admin-count').textContent, '0 patients');
  assert.equal(dom.window.document.getElementById('history-count').textContent, '0 entries');
  seed(dom, { patients: [{ id: '1', name: '<script>alert(1)</script>', queueNumber: 1, status: 'waiting', type: 'pwd' }], consultationHistory: [{ id: 'h', name: '<script>x</script>', queueNumber: 2 }] });
  call(dom, 'renderAdminQueue(); renderPatientBoard(); renderDoctorQueue(); renderBhwQueue(); renderConsultationHistory()');
  assert.match(dom.window.document.getElementById('patient-list').innerHTML, /<script>alert\(1\)<\/script>/);
  assert.match(dom.window.document.getElementById('consultation-history').innerHTML, /<script>x<\/script>/);
  dom.window.close();
});
