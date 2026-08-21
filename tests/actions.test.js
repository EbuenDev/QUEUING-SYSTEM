const test = require('node:test');
const assert = require('node:assert/strict');
const {
  call,
  createDom,
  flush,
  readState,
  response,
} = require('./test-helper');

function capturedRequests(dom) {
  const requests = [];
  dom.window.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return response({ success: false });
  };
  return requests;
}

test('addPatient ignores a blank name', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `addPatient({ name: '   ' })`);
  await flush();

  assert.deepEqual(requests, []);
  dom.window.close();
});

test('addPatient trims fields and forwards the expected payload', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `addPatient({
    name: '  Ana ',
    philHealthId: ' PH1 ',
    patientStatus: 'pwd',
    philHealthStatus: 'registered',
  })`);
  await flush();

  assert.deepEqual(requests[0], {
    action: 'add',
    name: 'Ana',
    philHealthId: 'PH1',
    patientStatus: 'pwd',
    philHealthStatus: 'registered',
  });
  dom.window.close();
});

test('editPatient ignores a blank name', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `editPatient('p1', { name: ' ' })`);
  await flush();

  assert.deepEqual(requests, []);
  dom.window.close();
});

test('editPatient trims fields and forwards the expected payload', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `editPatient('p1', {
    name: '  Bea ',
    philHealthId: ' PH2 ',
    patientStatus: 'senior',
    philHealthStatus: 'registered',
  })`);
  await flush();

  assert.deepEqual(requests[0], {
    action: 'edit',
    id: 'p1',
    name: 'Bea',
    philHealthId: 'PH2',
    patientStatus: 'senior',
    philHealthStatus: 'registered',
  });
  dom.window.close();
});

test('finishPatient reads and clears consultation fields', async () => {
  const { dom } = createDom(`
    <textarea id="doctor-consultation-note"> notes </textarea>
    <input id="doctor-icd-code" value=" J00 " />
  `);
  const requests = capturedRequests(dom);

  call(dom, `finishPatient('p1')`);
  await flush();

  assert.equal(dom.window.document.getElementById('doctor-consultation-note').value, '');
  assert.equal(dom.window.document.getElementById('doctor-icd-code').value, '');
  assert.deepEqual(requests[0], {
    action: 'finish',
    id: 'p1',
    consultationDetails: ' notes ',
    icdCode: ' J00 ',
  });
  dom.window.close();
});

test('deletePatient posts the delete action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `deletePatient('p1')`);
  await flush();

  assert.deepEqual(requests[0], { action: 'delete', id: 'p1' });
  dom.window.close();
});

test('servePatient posts the serve action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `servePatient('p1')`);
  await flush();

  assert.deepEqual(requests[0], { action: 'serve', id: 'p1' });
  dom.window.close();
});

test('skipPatient posts the skip action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `skipPatient('p1')`);
  await flush();

  assert.deepEqual(requests[0], { action: 'skip', id: 'p1' });
  dom.window.close();
});

test('recallPatient posts the recall action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, `recallPatient('p1')`);
  await flush();

  assert.deepEqual(requests[0], { action: 'recall', id: 'p1' });
  dom.window.close();
});

test('serveNextPatient posts the serve-next action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, 'serveNextPatient()');
  await flush();

  assert.deepEqual(requests[0], { action: 'serve-next' });
  dom.window.close();
});

test('resetQueue posts the reset action', async () => {
  const { dom } = createDom();
  const requests = capturedRequests(dom);

  call(dom, 'resetQueue()');
  await flush();

  assert.deepEqual(requests[0], { action: 'reset' });
  dom.window.close();
});

test('postAction clears auth and admin view on a 401 without rendering', async () => {
  const { dom } = createDom(`
    <div id="login-card"></div>
    <div id="admin-panel"></div>
  `);
  dom.window.eval(`
    render = () => {
      window.__renderCount = (window.__renderCount || 0) + 1;
    };
  `);
  call(dom, 'setAdminAuthenticated(true)');
  dom.window.fetch = async () => response({}, 401);

  await call(dom, `postAction('delete', { id: 'p1' })`);

  assert.equal(call(dom, 'isAdminAuthenticated()'), false);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, true);
  assert.equal(dom.window.__renderCount || 0, 0);
  dom.window.close();
});

test('postAction renders success and uses the refreshed state', async () => {
  const { dom } = createDom();
  let requestCount = 0;
  dom.window.eval(`
    render = () => {
      window.__renderCount = (window.__renderCount || 0) + 1;
    };
  `);
  dom.window.fetch = async () => {
    requestCount++;
    if (requestCount === 1) {
      return response({
        success: true,
        state: {
          patients: [{ id: 'action-response' }],
          consultationHistory: [],
        },
      });
    }

    return response({
      success: true,
      state: {
        patients: [{ id: 'refresh-response' }],
        consultationHistory: [],
      },
    });
  };

  await call(dom, `postAction('skip', { id: 'p1' })`);

  assert.equal(dom.window.__renderCount, 2);
  assert.equal(readState(dom).patients[0].id, 'refresh-response');
  assert.equal(requestCount, 2);
  dom.window.close();
});

test('postAction swallows rejected fetches without rendering', async () => {
  const { dom } = createDom();
  dom.window.eval(`
    render = () => {
      window.__renderCount = (window.__renderCount || 0) + 1;
    };
  `);
  dom.window.fetch = async () => {
    throw new Error('offline');
  };

  await assert.doesNotReject(() => call(dom, `postAction('skip', { id: 'p1' })`));

  assert.equal(dom.window.__renderCount || 0, 0);
  dom.window.close();
});
