const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function response(data, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  };
}

function createDom(html = '') {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});
  const channels = [];
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    virtualConsole,
  });

  dom.window.setInterval = () => 0;
  dom.window.clearInterval = () => {};
  dom.window.fetch = async () => response({
    success: true,
    state: {
      patients: [],
      nextQueueNumber: 1,
      consultationHistory: [],
    },
  });
  dom.window.BroadcastChannel = class {
    constructor() {
      this.listeners = [];
      channels.push(this);
    }

    addEventListener(type, listener) {
      if (type === 'message') {
        this.listeners.push(listener);
      }
    }

    postMessage(message) {
      this.lastMessage = message;
    }

    emit(message) {
      for (const listener of this.listeners) {
        listener({ data: message });
      }
    }
  };
  dom.window.print = () => {};
  dom.window.console.warn = () => {};
  dom.window.console.error = () => {};

  dom.window.eval(`
    ${appSource}
    window.__setState = (nextState) => { state = nextState; };
    window.__getState = () => state;
  `);

  return {
    dom,
    channel: () => channels[0],
  };
}

function seed(dom, nextState) {
  dom.window.__setState(nextState);
}

function readState(dom) {
  return dom.window.__getState();
}

function call(dom, expression) {
  return dom.window.eval(expression);
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = {
  call,
  createDom,
  flush,
  readState,
  response,
  seed,
};
