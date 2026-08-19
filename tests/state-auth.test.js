const test = require('node:test');
const assert = require('node:assert/strict');
const {
  call,
  createDom,
  flush,
  readState,
  response,
  seed,
} = require('./test-helper');

test('escapeHtml escapes all HTML-sensitive characters', () => {
  const { dom } = createDom();

  assert.equal(
    call(dom, `escapeHtml('& < > " \\'')`),
    '&amp; &lt; &gt; &quot; &#039;',
  );

  dom.window.close();
});

test('escapeHtml handles null, undefined, and numbers', () => {
  const { dom } = createDom();

  assert.equal(call(dom, 'escapeHtml(null)'), '');
  assert.equal(call(dom, 'escapeHtml(undefined)'), '');
  assert.equal(call(dom, 'escapeHtml(42)'), '42');

  dom.window.close();
});

test('getCurrentServingPatient returns the serving patient', () => {
  const { dom } = createDom();
  seed(dom, {
    patients: [
      { id: 'waiting', status: 'waiting' },
      { id: 'serving', status: 'serving' },
    ],
    consultationHistory: [],
  });

  assert.equal(call(dom, 'getCurrentServingPatient().id'), 'serving');

  dom.window.close();
});

test('getCurrentServingPatient returns null for an empty queue', () => {
  const { dom } = createDom();
  seed(dom, { patients: [], consultationHistory: [] });

  assert.equal(call(dom, 'getCurrentServingPatient()'), null);

  dom.window.close();
});

test('getWaitingPatients returns only waiting patients', () => {
  const { dom } = createDom();
  seed(dom, {
    patients: [
      { id: 'waiting', status: 'waiting' },
      { id: 'serving', status: 'serving' },
      { id: 'skipped', status: 'skipped' },
    ],
    consultationHistory: [],
  });

  assert.deepEqual(
    call(dom, 'getWaitingPatients().map((patient) => patient.id)'),
    ['waiting'],
  );

  dom.window.close();
});

test('getWaitingPatients returns an empty list for an empty queue', () => {
  const { dom } = createDom();
  seed(dom, { patients: [], consultationHistory: [] });

  assert.deepEqual(call(dom, 'getWaitingPatients()'), []);

  dom.window.close();
});

test('admin authentication storage round trips', () => {
  const { dom } = createDom();

  call(dom, 'setAdminAuthenticated(true)');
  assert.equal(call(dom, 'isAdminAuthenticated()'), true);

  call(dom, 'setAdminAuthenticated(false)');
  assert.equal(call(dom, 'isAdminAuthenticated()'), false);

  dom.window.close();
});

test('admin authentication storage failures return false and do not throw', () => {
  const { dom } = createDom();
  dom.window.sessionStorage.getItem = () => {
    throw new Error('blocked');
  };
  dom.window.sessionStorage.setItem = () => {
    throw new Error('blocked');
  };

  assert.equal(call(dom, 'isAdminAuthenticated()'), false);
  assert.doesNotThrow(() => call(dom, 'setAdminAuthenticated(true)'));

  dom.window.close();
});

test('setAdminView toggles available admin elements', () => {
  const { dom } = createDom(`
    <div id="login-card"></div>
    <div id="admin-panel"></div>
    <button id="logout-btn"></button>
  `);

  call(dom, 'setAdminView(true)');
  assert.equal(dom.window.document.getElementById('login-card').hidden, true);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, false);
  assert.equal(dom.window.document.getElementById('logout-btn').hidden, false);

  call(dom, 'setAdminView(false)');
  assert.equal(dom.window.document.getElementById('login-card').hidden, false);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, true);
  assert.equal(dom.window.document.getElementById('logout-btn').hidden, true);

  dom.window.close();
});

test('setAdminView and showAdminLoginError tolerate missing elements', () => {
  const { dom } = createDom();

  assert.doesNotThrow(() => call(dom, 'setAdminView(true)'));
  assert.doesNotThrow(() => call(dom, `showAdminLoginError('error')`));

  dom.window.close();
});

test('showAdminLoginError writes the error message', () => {
  const { dom } = createDom('<p id="login-error"></p>');

  call(dom, `showAdminLoginError('Invalid login')`);

  assert.equal(
    dom.window.document.getElementById('login-error').textContent,
    'Invalid login',
  );

  dom.window.close();
});

test('loginAdmin stores auth, shows the admin view, and resolves true', async () => {
  const { dom } = createDom('<div id="login-card"></div><div id="admin-panel"></div>');
  dom.window.location.reload = () => {};
  dom.window.fetch = async () => response({ success: true });

  const result = await call(dom, `loginAdmin('admin', 'admin123')`);

  assert.equal(result, true);
  assert.equal(call(dom, 'isAdminAuthenticated()'), true);
  assert.equal(dom.window.document.getElementById('admin-panel').hidden, false);

  dom.window.close();
});

test('loginAdmin failure resolves false and leaves auth untouched', async () => {
  const { dom } = createDom();
  dom.window.fetch = async () => response({ success: false }, 401);

  const result = await call(dom, `loginAdmin('admin', 'wrong')`);

  assert.equal(result, false);
  assert.equal(call(dom, 'isAdminAuthenticated()'), false);

  dom.window.close();
});

test('loginAdmin rejected fetch resolves false without throwing', async () => {
  const { dom } = createDom();
  dom.window.fetch = async () => {
    throw new Error('offline');
  };

  await assert.doesNotReject(async () => {
    const result = await call(dom, `loginAdmin('admin', 'admin123')`);
    assert.equal(result, false);
  });

  dom.window.close();
});

test('broadcastState posts to BroadcastChannel and writes both storage keys', () => {
  const { dom, channel } = createDom();
  call(dom, 'initRealtimeSync()');
  const nextState = { patients: [], consultationHistory: [] };

  call(dom, 'broadcastState({ patients: [], consultationHistory: [] })');

  assert.equal(channel().lastMessage.type, 'queue-state-update');
  assert.equal(
    JSON.stringify(channel().lastMessage.state),
    JSON.stringify({
      patients: [],
      consultationHistory: [],
    }),
  );
  assert.notEqual(dom.window.localStorage.getItem('queue-state-sync'), null);
  assert.notEqual(dom.window.localStorage.getItem('queue-state-event'), null);

  dom.window.close();
});

test('broadcastState swallows localStorage failures', () => {
  const { dom } = createDom();
  dom.window.localStorage.setItem = () => {
    throw new Error('blocked');
  };

  assert.doesNotThrow(() => call(dom, 'broadcastState({ patients: [] })'));

  dom.window.close();
});

test('initRealtimeSync replaces state and rerenders valid storage payloads', async () => {
  const { dom } = createDom();
  dom.window.eval(`
    render = () => {
      window.__renderCount = (window.__renderCount || 0) + 1;
    };
  `);
  dom.window.fetch = async () => response({ success: false });
  call(dom, 'initRealtimeSync()');
  const nextState = { patients: [{ id: 'new' }], consultationHistory: [] };

  dom.window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'queue-state-sync',
    newValue: JSON.stringify({ state: nextState }),
  }));
  await flush();

  assert.equal(JSON.stringify(readState(dom)), JSON.stringify(nextState));
  assert.equal(dom.window.__renderCount, 1);

  dom.window.close();
});

test('initRealtimeSync ignores unrelated storage keys', async () => {
  const { dom } = createDom();
  const originalState = readState(dom);
  call(dom, 'initRealtimeSync()');

  dom.window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'unrelated',
    newValue: JSON.stringify({ state: { patients: [{ id: 'new' }] } }),
  }));
  await flush();

  assert.equal(JSON.stringify(readState(dom)), JSON.stringify(originalState));

  dom.window.close();
});

test('initRealtimeSync swallows malformed storage JSON', async () => {
  const { dom } = createDom();
  const originalState = readState(dom);
  call(dom, 'initRealtimeSync()');

  dom.window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'queue-state-sync',
    newValue: '{bad-json',
  }));
  await flush();

  assert.equal(JSON.stringify(readState(dom)), JSON.stringify(originalState));

  dom.window.close();
});

test('fetchState replaces state and rerenders successful responses', async () => {
  const { dom } = createDom();
  dom.window.eval(`
    render = () => {
      window.__renderCount = (window.__renderCount || 0) + 1;
    };
  `);
  const nextState = { patients: [{ id: 'new' }], consultationHistory: [] };
  dom.window.fetch = async () => response({ success: true, state: nextState });

  await call(dom, 'fetchState()');

  assert.deepEqual(readState(dom), nextState);
  assert.equal(dom.window.__renderCount, 1);
  dom.window.close();
});

test('fetchState leaves state unchanged for unsuccessful responses', async () => {
  const { dom } = createDom();
  const originalState = readState(dom);
  dom.window.fetch = async () => response({ success: false });

  await call(dom, 'fetchState()');

  assert.deepEqual(readState(dom), originalState);

  dom.window.close();
});

test('fetchState swallows rejected fetches', async () => {
  const { dom } = createDom();
  dom.window.fetch = async () => {
    throw new Error('offline');
  };

  await assert.doesNotReject(() => call(dom, 'fetchState()'));

  dom.window.close();
});
