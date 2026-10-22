import { Lexicons } from '@atproto/lexicon';
import { schemas } from './generated/lexicons.mjs';

export const lexicons = new Lexicons(schemas);

// Keep Gleam/Hono's session, CSRF, rate limits and domain checks around the
// generated contract. Only the HTTP serialization boundary lives in JS.
export function registerXrpc(app, nsid, handler) {
  const def = lexicons.getDefOrThrow(nsid, ['query', 'procedure']);
  const method = def.type === 'query' ? 'get' : 'post';
  app[method](`/xrpc/${nsid}`, async ctx => {
    let values;
    try {
      if (method === 'get') {
        const url = new URL(ctx.req.url);
        for (const key of url.searchParams.keys()) {
          if (url.searchParams.getAll(key).length !== 1) throw new Error('Duplicate parameter');
        }
        values = Object.fromEntries(url.searchParams);
        lexicons.assertValidXrpcParams(nsid, values);
      } else {
        if (ctx.req.header('content-type')?.split(';')[0].trim() !== 'application/json') {
          return ctx.json({ error: 'InvalidRequest', message: 'Expected application/json.' }, 415);
        }
        values = await ctx.req.json();
        lexicons.assertValidXrpcInput(nsid, values);
      }
    } catch {
      return ctx.json({ error: 'InvalidRequest', message: 'Request does not match the endpoint lexicon.' }, 400);
    }
    ctx.set('xrpcValues', values);
    const response = await handler(ctx);
    if (response.ok) {
      lexicons.assertValidXrpcOutput(nsid, await response.clone().json());
    }
    return response;
  });
}

export const xrpcParameter = (ctx, name) => ctx.get('xrpcValues')?.[name];
