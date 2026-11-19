// Genera el HTML inicial de una página con dc-runtime.js (lo usa tools/build.py)
//   node tools/prerender.js assets/js/page-es.js          -> HTML inicial
//   node tools/prerender.js assets/js/page-es.js --faqs   -> preguntas frecuentes en JSON
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DCRuntime = require(path.join(__dirname, '../assets/js/dc-runtime.js'));
const ctx = vm.createContext({ DCRuntime, console });
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
const page = vm.runInContext('DC_PAGE', ctx);

if (process.argv[3] === '--faqs') {
  const props = {};
  Object.keys(page.props).forEach((k) => { if (k[0] !== '$' && 'default' in page.props[k]) props[k] = page.props[k].default; });
  const comp = new page.Component(props);
  comp.props = props;
  const faqs = (comp.renderVals().faqs || []).map((f) => ({ q: f.q, a: f.a }));
  process.stdout.write(JSON.stringify(faqs));
} else {
  process.stdout.write(DCRuntime.prerender(page));
}
