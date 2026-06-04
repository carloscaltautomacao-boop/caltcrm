// Faz tail dos runtime logs do ultimo deployment de producao por N segundos.
// Uso: node scripts/rt-logs.cjs [segundos]
const https = require('https');

const TOKEN = process.env.VTOKEN;
const PROJECT_ID = 'prj_FGGXyXgBgJhJ0kSoqC97rIQNUXB1';
const TEAM_ID = 'team_4UI6KSSfwbTJDyEDKhXCgKvh';
const DURATION = (Number(process.argv[2]) || 60) * 1000;

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on('error', reject);
  });
}

const deadline = Date.now() + DURATION;
const seen = new Set();

function connect(uid) {
  const url = `https://api.vercel.com/v1/projects/${PROJECT_ID}/deployments/${uid}/runtime-logs?teamId=${TEAM_ID}`;
  const req = https.request(url, { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const o = JSON.parse(line);
          const id = o.id || o.requestId + (o.message || '') + (o.timestampInMs || o.t || '');
          if (seen.has(id)) continue;
          seen.add(id);
          const msg = o.message || o.text || JSON.stringify(o);
          process.stdout.write((/DEBUG payload|webhook|sendText|whatsapp/.test(msg) ? '>>> ' : '    ') + msg + '\n');
        } catch { process.stdout.write('    ' + line + '\n'); }
      }
    });
    const reconnect = () => { if (Date.now() < deadline) setTimeout(() => connect(uid), 300); else { console.error('[tail] fim'); process.exit(0); } };
    res.on('end', reconnect);
    res.on('close', reconnect);
  });
  req.on('error', () => { if (Date.now() < deadline) setTimeout(() => connect(uid), 300); else process.exit(0); });
  req.end();
}

async function main() {
  const res = await getJSON(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=1`);
  const dep = res.deployments && res.deployments[0];
  if (!dep) { console.error('sem deployment', res); return; }
  console.error(`[tail] deployment ${dep.uid} (${dep.url}) por ${DURATION / 1000}s, reconectando ao cair`);
  connect(dep.uid);
}
main().catch((e) => console.error(e));
