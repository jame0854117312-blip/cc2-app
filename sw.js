/* CC2 OSPE Lab — service worker (โครงเดียวกับ CC1 Study Lab)
 * หน้าแอป: ดึงจากเน็ตก่อน (ได้เวอร์ชันล่าสุดเสมอ) ถ้าไม่มีเน็ตใช้ตัวที่เก็บไว้
 * ฟอนต์: เก็บไว้ใช้ออฟไลน์หลังเปิดครั้งแรก
 * Google Apps Script (ตารางคะแนน): ไม่เก็บ ส่งตรงเสมอ */
const VERSION = 'cc2-54f5350fc2';
const FONTS = 'cc2-fonts';
const CORE = ['./', './index.html', './config.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('cc2-') && k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function networkFirst(req, key) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([fetch(req, { cache: 'no-store' }), timeout(4000)]);
    if (res && res.ok) cache.put(key || req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(key || req)) || (await cache.match('./index.html')) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (/(^|\.)script\.google\.com$|googleusercontent\.com$/.test(url.hostname)) return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; })
        .catch(() => hit || Response.error());
      return hit || net;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, './index.html')); return; }
  if (/\/(config\.js|manifest\.webmanifest)$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return res;
  })));
});
