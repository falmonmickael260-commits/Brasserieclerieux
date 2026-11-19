import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from './dist/server/index.js';

const dataDirectory = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || './data';
mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(join(dataDirectory, 'brasserie.sqlite'));
database.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS migrations (filename TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS push_keys (id INTEGER PRIMARY KEY, public TEXT, private TEXT);
`);

const migrations = new URL('./drizzle/', import.meta.url);
const applied = database.prepare('SELECT 1 FROM migrations WHERE filename = ?');
const record = database.prepare('INSERT INTO migrations VALUES (?)');
for (const filename of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
  database.exec('BEGIN IMMEDIATE');
  try {
    if (!applied.get(filename)) {
      database.exec(readFileSync(new URL(filename, migrations), 'utf8'));
      record.run(filename);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const loadKeys = database.prepare('SELECT public, private FROM push_keys WHERE id = 1');
if (!loadKeys.get()) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const { x, y } = publicKey.export({ format: 'jwk' });
  const publicBytes = Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]);
  database.prepare('INSERT OR IGNORE INTO push_keys VALUES (1, ?, ?)').run(
    publicBytes.toString('base64url'),
    JSON.stringify(privateKey.export({ format: 'jwk' })),
  );
}
const keys = loadKeys.get();

// Adapt the database calls used by the existing Worker to local SQLite.
const env = {
  ADMIN_SECRET: process.env.ADMIN_SECRET,
  VAPID_PUBLIC: keys.public,
  VAPID_PRIVATE: keys.private,
  DB: {
    prepare(sql) {
      const statement = database.prepare(sql);
      const query = (...parameters) => ({
        bind: query,
        first: () => statement.get(...parameters) ?? null,
        all: () => ({ results: statement.all(...parameters) }),
        run: () => ({ meta: statement.run(...parameters) }),
      });
      return query();
    },
  },
};

const server = createServer(async (incoming, outgoing) => {
  try {
    const scheme = incoming.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const url = new URL(`${scheme}://${incoming.headers.host}${incoming.url}`);
    if (url.pathname === '/health') {
      database.prepare('SELECT 1').get();
      outgoing.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    // Railway runs the scheduler internally. This route belongs to the hosted Worker.
    if (url.pathname === '/api/tick') {
      outgoing.writeHead(404).end();
      return;
    }

    const requestOptions = { method: incoming.method, headers: incoming.headers };
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
      const chunks = [];
      let length = 0;
      for await (const chunk of incoming.iterator({ destroyOnReturn: false })) {
        length += chunk.length;
        if (length > 1024 * 1024) {
          outgoing.writeHead(413, { Connection: 'close' }).end();
          return;
        }
        chunks.push(chunk);
      }
      requestOptions.body = Buffer.concat(chunks);
    }

    const response = await worker.fetch(new Request(url, requestOptions), env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(incoming.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('HTTP request failed', error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
});

let activeTick;
function publishScheduledMenu() {
  activeTick ??= worker.scheduled(null, env)
    .catch(error => console.error('Scheduled menu failed', error))
    .finally(() => { activeTick = undefined; });
}

server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('Brasserie server listening on port', server.address().port);
  publishScheduledMenu();
});
const timer = setInterval(publishScheduledMenu, 60_000).unref();
process.once('SIGTERM', () => {
  clearInterval(timer);
  server.close(async () => {
    await activeTick;
    database.close();
  });
});
