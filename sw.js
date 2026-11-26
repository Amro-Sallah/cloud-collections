const KVP = new Promise(res => { const r = indexedDB.open('cc_sw', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
const kvGet = k => KVP.then(db => db && new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }));
const kvSet = (k, v) => KVP.then(db => db && new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }));
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response('<h3 style="font-family:sans-serif;padding:40px">You are offline — CLOUD Collections needs internet.</h3>', { headers: { 'Content-Type': 'text/html' } })));
});
const when = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
async function onPush() {
  let shown = false;
  try {
    const cfg = await kvGet('cfg');
    if (cfg) {
      const since = (await kvGet('since')) || Date.now() - 15 * 60000;
      const res = await fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'pushFeed', endpoint: cfg.endpoint, key: cfg.key, since: since }) });
      const j = await res.json();
      if (j.ok) {
        await kvSet('since', j.data.now);
        const it = j.data.items || [];
        const one = x => ({ title: (x.user || 'Sheet') + ' edited ' + (x.style || ('row ' + x.row)), body: x.column + ': ' + (x.old ? x.old + ' → ' : '') + (x.nw || '(empty)') + '\n' + x.cname + ' / ' + x.tab + ' · ' + when(x.t) });
        const list = it.length > 4 ? [{ title: it.length + ' new edits — ' + [...new Set(it.map(x => x.user))].join(', '), body: it.slice(0, 4).map(x => (x.style || 'row ' + x.row) + ': ' + x.column + ' → ' + x.nw).join('\n') + '\n' + when(it[0].t) }] : it.slice().reverse().map(one);
        for (const n of list) { await self.registration.showNotification(n.title, { body: n.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'cc' + Date.now() + Math.random() }); shown = true; }
      }
    }
  } catch (e) {}
  if (!shown) await self.registration.showNotification('CLOUD Collections', { body: 'New edits in the collection plan — open the app to see them', icon: 'icon-192.png', tag: 'cc-generic' });
}
self.addEventListener('push', e => e.waitUntil(onPush()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
