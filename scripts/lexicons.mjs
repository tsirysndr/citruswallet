import { Lexicons } from '@atproto/lexicon';
import { normalize } from './normalize-lexicon.mjs';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Like Rocksky: PKL is the source, JSON is the transport contract, lex-cli
// generates the typed client. Commit all outputs so deployments need no PKL.
mkdirSync('lexicons', { recursive: true });
const files = readdirSync('pkl/defs').filter(f => f.endsWith('.pkl')).sort();
const docs = files.map(file => {
  const doc = JSON.parse(execFileSync('pkl', ['eval', '-f', 'json', `pkl/defs/${file}`], { encoding: 'utf8' }));
  writeFileSync(`lexicons/${doc.id}.json`, JSON.stringify(doc, null, 2) + '\n');
  return doc;
});
// Validate definitions before invoking lex-cli, which may skip invalid files.
new Lexicons(docs);
execFileSync('node_modules/.bin/lex', ['gen-api', 'web/src/lexicon', '--yes', ...docs.map(d => `lexicons/${d.id}.json`)], { stdio: 'inherit' });
normalize('web/src/lexicon');
mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/lexicons.mjs', '// Generated from pkl/defs. Do not edit.\nexport const schemas = ' + JSON.stringify(docs, null, 2) + ';\n');
const methods = docs.filter(d => ['query', 'procedure'].includes(d.defs.main?.type));
writeFileSync('src/citruswallet/xrpc/methods.gleam', '// Generated from pkl/defs. Do not edit.\n\n' + methods.map(d => {
  const name = d.id.split('.').at(-1).replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  return `pub const ${name} = "${d.id}"\n`;
}).join('\n'));

execFileSync("gleam", ["format", "src/citruswallet/xrpc/methods.gleam"]);
