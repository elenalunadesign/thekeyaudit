// Genera el HTML inicial de una página con dc-runtime.js (lo usa tools/build.py)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DCRuntime = require(path.join(__dirname, '../assets/js/dc-runtime.js'));
const ctx = vm.createContext({ DCRuntime, console });
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
process.stdout.write(DCRuntime.prerender(vm.runInContext('DC_PAGE', ctx)));
