const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Finest-grained possible live duplicate-id check: monkey-patches setAttribute AND every DOM
// insertion method (appendChild, insertBefore, replaceChild) so EVERY SINGLE synchronous DOM
// mutation during a real PDF export is checked for a live id collision the INSTANT it happens -
// not just at coarse intervals. If Chrome's Issues panel is catching something this app's earlier,
// coarser monitors missed, this should catch it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {}, measureText: () => ({ width: 10 }), drawImage() {} }; };
  dom.window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };
  // jsdom has no real layout engine - every element's getBoundingClientRect() is 0x0 by default,
  // which makes the real captureChunksIntoPdf bail out immediately ("no content pages") before ever
  // reaching the interesting per-section clone loop. Give every element a plausible non-zero size so
  // the real pagination/splitting logic actually runs, the same way it would against a real, rendered
  // page - this is what lets this test actually exercise the code path the live bug report is about.
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: 380, height: 120, top: 0, left: 0, right: 380, bottom: 120, x: 0, y: 0 };
  };
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return 120; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 380; } });
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };

  // Mock html2pdf / jsPDF exactly enough to exercise the REAL captureChunksIntoPdf loop, including
  // the actual `.set().from(secContainer).toCanvas().then(function(){ resolve(this.prop.canvas) })`
  // call shape used in app.js - real html2pdf.js's Worker invokes each .then callback with `this`
  // bound to the worker instance (which carries `.prop.canvas`), NOT a native Promise's `this`, so
  // this mock replicates that exact calling convention rather than using a plain native Promise.
  const fakeCanvas = { width: 800, height: 1200, toDataURL: () => 'data:image/png;base64,AAAA', getContext: () => ({ drawImage(){} }) };
  function JsPdfMock() {
    return {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage() {}, addPage() {}, setFont(){}, setFontSize(){}, setTextColor(){}, setDrawColor(){}, setFillColor(){}, setLineWidth(){}, line(){}, lines(){}, text(){}, save(){}, splitTextToSize: (t) => [t],
      getNumberOfPages: () => 1, setPage(){}, link(){}, movePage(){}, deletePage(){}, output: () => new Uint8Array([1,2,3]),
    };
  }
  function html2pdfMock() {
    const worker = { prop: {} };
    worker.set = function () { return worker; };
    worker.from = function () { worker.prop.canvas = fakeCanvas; worker.prop.pdf = JsPdfMock(); return worker; };
    worker.toCanvas = function () {
      return {
        then: function (fn) { fn.call(worker); return this; },
        catch: function () { return this; },
      };
    };
    worker.toPdf = function () {
      return {
        then: function (fn) { fn.call(worker); return this; },
        catch: function () { return this; },
      };
    };
    return worker;
  }

  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL,
    html2pdf: html2pdfMock,
    jspdf: { jsPDF: JsPdfMock },
    alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const { dom, sandbox } = freshSandbox();
const win = dom.window;
const doc = win.document;

// --- Rich profile, exercising every id-bearing block this app renders, matching earlier rounds ---
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '伟', chineseLastName: '黄', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '91234567', vehicles: [{ number: 'SBA1234A', shared: true }, { number: 'SJH5678B', shared: false }], fsDir: 'North' },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female', mobileNumber: '98765432' },
  businessPartner: { englishFirstName: 'Ben', englishLastName: 'Lim', birthdate: '1980-01-01', birthtime: '08:00', gender: 'male' },
  children: [{ englishFirstName: 'Amy', englishLastName: 'Wong', birthdate: '2010-05-01', birthtime: '12:00', gender: 'female' }],
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [{ houseNumber: '10', streetName: 'Somewhere Ave', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '123456', constructionYear: '' }] } },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);
vm.runInContext(`go('chart')`, sandbox);

// --- Monkey-patch every DOM mutation entry point to check id-uniqueness synchronously, on EVERY call ---
let violations = [];
let mutationCount = 0;
function checkDuplicatesNow(label) {
  mutationCount++;
  const idMap = new Map();
  const all = doc.querySelectorAll('[id]');
  for (const el of all) {
    const id = el.id;
    if (!id) continue;
    idMap.set(id, (idMap.get(id) || 0) + 1);
  }
  for (const [id, count] of idMap) {
    if (count > 1) {
      violations.push({ label, id, count, mutationCount });
    }
  }
}

const origSetAttribute = win.Element.prototype.setAttribute;
win.Element.prototype.setAttribute = function (name, value) {
  const result = origSetAttribute.call(this, name, value);
  if (name === 'id' && this.isConnected) checkDuplicatesNow('setAttribute(id) while connected');
  return result;
};

const origAppendChild = win.Node.prototype.appendChild;
win.Node.prototype.appendChild = function (child) {
  const result = origAppendChild.call(this, child);
  if (this === doc.body || (this.isConnected)) checkDuplicatesNow('appendChild');
  return result;
};

const origInsertBefore = win.Node.prototype.insertBefore;
win.Node.prototype.insertBefore = function (child, ref) {
  const result = origInsertBefore.call(this, child, ref);
  if (this.isConnected) checkDuplicatesNow('insertBefore');
  return result;
};

// innerHTML setter is what container.innerHTML = html actually uses internally in jsdom - patch via
// the property descriptor on Element.prototype (works for HTMLDivElement etc via inheritance).
const innerHTMLDesc = Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML');
Object.defineProperty(win.Element.prototype, 'innerHTML', {
  get: innerHTMLDesc.get,
  set: function (html) {
    innerHTMLDesc.set.call(this, html);
    if (this.isConnected) checkDuplicatesNow('innerHTML= while connected');
  },
  configurable: true,
});

(async () => {
  console.log('Running exportProfileToPdfInner("i") with fine-grained live monitoring...');
  try {
    await vm.runInContext(`exportProfileToPdfInner('i')`, sandbox);
  } catch (e) {
    console.log('Export threw (may be expected given mocks):', e.message);
  }
  console.log(`\nTotal DOM mutations checked: ${mutationCount}`);
  console.log(`Live duplicate-id violations found: ${violations.length}`);
  if (violations.length) {
    console.log('First 20 violations:');
    violations.slice(0, 20).forEach(v => console.log(`  [${v.label}] id="${v.id}" appears ${v.count}x at mutation #${v.mutationCount}`));
    process.exitCode = 1;
  } else {
    console.log('CLEAN: no live duplicate ids detected at ANY point during the export, at full synchronous granularity.');
  }

  // Now run a SECOND export in the same session, exactly as Roy did (generate PDF, then generate
  // "another" PDF without reloading), to see if the SECOND run behaves differently from the first.
  violations = [];
  mutationCount = 0;
  console.log('\nRunning exportProfileToPdfInner("i") a SECOND time in the same session...');
  try {
    await vm.runInContext(`exportProfileToPdfInner('i')`, sandbox);
  } catch (e) {
    console.log('Second export threw:', e.message);
  }
  console.log(`Second run - mutations checked: ${mutationCount}, violations: ${violations.length}`);
  if (violations.length) {
    violations.slice(0, 20).forEach(v => console.log(`  [${v.label}] id="${v.id}" appears ${v.count}x at mutation #${v.mutationCount}`));
    process.exitCode = 1;
  } else {
    console.log('CLEAN on second run too.');
  }

  // Final state check: anything left over in the live document after both exports?
  const finalIdMap = new Map();
  doc.querySelectorAll('[id]').forEach(el => finalIdMap.set(el.id, (finalIdMap.get(el.id) || 0) + 1));
  const finalDupes = [...finalIdMap.entries()].filter(([, c]) => c > 1);
  console.log(`\nFinal live-document state after both exports: ${finalDupes.length} duplicate id(s) remaining.`);
  if (finalDupes.length) { finalDupes.forEach(([id, c]) => console.log(`  id="${id}" x${c}`)); process.exitCode = 1; }
})();
