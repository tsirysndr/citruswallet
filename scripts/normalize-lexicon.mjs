import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

// lex-cli 0.5.x emits unused value imports and assumes that record clients
// include com.atproto.repo.*. The browser uses our API, never the user's PDS:
// keep the generated record types/validators, omit its PDS convenience class.
export function normalize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { normalize(path); continue; }
    if (!path.endsWith('.ts')) continue;
    let source = readFileSync(path, 'utf8');
    if (path.endsWith('/index.ts')) {
      source = source.replace(/export class AddressRecord \{[\s\S]*$/, '')
        .replace(/data\?: AppCitruswallet/g, 'data: AppCitruswallet')
        .replace(/^  address: AddressRecord\n/m, '')
        .replace(/^    this.address = new AddressRecord\(client\)\n/m, '');
    }
    const body = source.replace(/^import .*\n/gm, '').replace(/^export \* as .*\n/gm, '');
    source = source.replace(/^import \{ ([^}]+) \} from ('[^']+')\n/gm, (_, names, module) => {
      const used = names.split(', ').filter(name => new RegExp(`\\b${name}\\b`).test(body));
      const types = new Set(['HeadersMap', 'ValidationResult', 'FetchHandler', 'FetchHandlerOptions', 'LexiconDoc']);
      return used.length ? `import { ${used.map(n => types.has(n) ? 'type ' + n : n).join(', ')} } from ${module}\n` : '';
    });
    source = source.replace(/^import \* as (\w+) from ('[^']+')\n/gm, (line, name) => new RegExp(`\\b${name}\\b`).test(body) ? line : '');
    writeFileSync(path, source);
  }
}
