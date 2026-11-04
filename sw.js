/* Gran Sabor · sw.js — permite instalar o sistema como aplicativo (PWA).
   Por enquanto não guarda nada offline: sempre busca a versão mais nova.
   O modo offline do caixa (vendas guardadas e enviadas depois) vem com o PDV. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
