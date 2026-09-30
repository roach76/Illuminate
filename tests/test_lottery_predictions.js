const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');

function buildSandbox() {
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    localStorage, console, navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    alert: () => {}, document: { createElement: () => ({ style: {}, appendChild(){}, querySelectorAll: () => [] }) },
    html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}; } }),
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  return { sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

const { sandbox, run } = buildSandbox();
run(`lang='en'; function bt(en,zh){return lang==='zh'&&zh?zh:en;}`);

const roy = { birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', englishFirstName: 'Roy', englishLastName: 'Wong', birthLocation: 'Singapore' };
const bobby = { birthdate: '1965-06-27', birthtime: '05:28', gender: 'male', englishFirstName: 'Bobby', englishLastName: 'Neo', birthLocation: 'Singapore' };
const tina = { birthdate: '1976-04-25', birthtime: '10:21', gender: 'female', englishFirstName: 'Tina', englishLastName: 'Seah', birthLocation: 'Singapore' };

sandbox.pRoy = run(`getProfileData(${JSON.stringify(roy)})`);
sandbox.pBobby = run(`getProfileData(${JSON.stringify(bobby)})`);
sandbox.pTina = run(`getProfileData(${JSON.stringify(tina)})`);

console.log('Roy life=', sandbox.pRoy.life, 'hexNo=', sandbox.pRoy.hexNo, 'dayStemIdx=', sandbox.pRoy.bazi.dayStemIdx);
console.log('Bobby life=', sandbox.pBobby.life, 'hexNo=', sandbox.pBobby.hexNo, 'dayStemIdx=', sandbox.pBobby.bazi.dayStemIdx);
console.log('Tina life=', sandbox.pTina.life, 'hexNo=', sandbox.pTina.hexNo, 'dayStemIdx=', sandbox.pTina.bazi.dayStemIdx);

// Build sample historical draws for the frequency model
run(`
  var sampleDraws4D = [
    { isoDate: '2026-09-02', winning: ['4125','8603','3798','0253','1002','1967','2104','2182','2362','2809','3598','3983','3997','0616','1119','3761','4997','6485','6934','7885','7999','8043','9283'] },
    { isoDate: '2026-08-30', winning: ['9238','8594','0379','1482','1739','2854','3412','4808','6214','6622','7241','7627','8578','0608','0733','2203','4510','4656','5505','6756','8849','9828','9868'] },
    { isoDate: '2026-08-29', winning: ['0363','4694','2691','0277','0457','0583','0640','3223','3230','6453','6512','7302','7755','1024','1343','2957','6639','7014','7136','7480','9483','9537','9679'] }
  ];
  var sampleDrawsToto = [
    { isoDate: '2026-09-03', winning: [29,33,39,42,43,44], additional: 49 },
    { isoDate: '2026-08-31', winning: [7,26,33,39,41,46], additional: 11 },
    { isoDate: '2026-08-27', winning: [8,9,14,17,35,40], additional: 18 }
  ];
  var model4D = buildFourDFrequencyModel(sampleDraws4D);
  var modelToto = buildTotoFrequencyModel(sampleDrawsToto);
`);

const dayKey = 20260907;
const tier = 'Auspicious';

function test4D(pName) {
  const sets1 = run(`generate4DSetsFromModel(${pName}, ${dayKey}, '${tier}', model4D, 0)`);
  const sets2 = run(`generate4DSetsFromModel(${pName}, ${dayKey}, '${tier}', model4D, 0)`);
  console.log(pName, '4D run1:', sets1, 'run2:', sets2, 'deterministic:', JSON.stringify(sets1)===JSON.stringify(sets2));
}
function testToto(pName) {
  const sets1 = run(`generateTotoSetsFromModel(${pName}, ${dayKey}, '${tier}', modelToto, 0)`);
  const sets2 = run(`generateTotoSetsFromModel(${pName}, ${dayKey}, '${tier}', modelToto, 0)`);
  console.log(pName, 'TOTO run1:', JSON.stringify(sets1), 'run2:', JSON.stringify(sets2), 'deterministic:', JSON.stringify(sets1)===JSON.stringify(sets2));
}

test4D('pRoy'); test4D('pBobby'); test4D('pTina');
testToto('pRoy'); testToto('pBobby'); testToto('pTina');

// Test different tiers change output
const sA = run(`generate4DSetsFromModel(pRoy, ${dayKey}, 'Extremely Auspicious', model4D, 0)`);
const sB = run(`generate4DSetsFromModel(pRoy, ${dayKey}, 'Extremely Inauspicious', model4D, 0)`);
console.log('Roy tier=ExtAus:', sA, 'tier=ExtInaus:', sB, 'differ:', JSON.stringify(sA)!==JSON.stringify(sB));

// Test different dayKey changes output
const sC = run(`generate4DSetsFromModel(pRoy, 20260910, '${tier}', model4D, 0)`);
console.log('Roy dayKey=0907:', sA, 'dayKey=0910:', sC, 'differ:', JSON.stringify(sA)!==JSON.stringify(sC));

// TOTO range check - ensure all numbers 1-49, no 4D-style digits
const totoSets = run(`generateTotoSetsFromModel(pRoy, ${dayKey}, '${tier}', modelToto, 0)`);
let allInRange = totoSets.every(set => set.every(n => n>=1 && n<=49));
let allUnique = totoSets.every(set => new Set(set).size === set.length);
let correctSize = totoSets.every(set => set.length === 7);
console.log('TOTO sets:', JSON.stringify(totoSets), 'allInRange:', allInRange, 'allUnique:', allUnique, 'size7:', correctSize);

// 4D range/format check
const fourDSets = run(`generate4DSetsFromModel(pRoy, ${dayKey}, '${tier}', model4D, 0)`);
let all4Digit = fourDSets.every(s => /^\d{4}$/.test(s));
console.log('4D sets:', fourDSets, 'all4Digit:', all4Digit);
