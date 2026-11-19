self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('push', event => event.waitUntil(showPush(event.data)));

async function showPush(data) {
  let note;
  try {
    note = data?.json();
  } catch {
    // Older subscriptions receive a signal and fetch the current menu.
  }
  if (!note?.title || typeof note.body !== 'string') {
    note = {
      title: 'Brasserie de l’Herbasse · Menu du jour',
      body: 'Consultez le menu de la brasserie.',
      tag: 'menu-du-jour',
    };
    try {
      const response = await fetch('/api/menu', { cache: 'no-store' });
      const menu = await response.json();
      if (menu?.main) {
        note.body = [menu.main + ' · ' + menu.price + ' €', menu.starter, menu.sweet].filter(Boolean).join('\n');
        note.tag = 'menu-du-jour-' + menu.day;
        note.image = menu.photoPath;
      }
    } catch {
      // The notification still opens the menu if the current menu is unavailable.
    }
  }

  const options = { body: note.body, icon: '/logo.webp', tag: note.tag || note.id };
  if (note.tag) options.renotify = true;
  if (typeof note.image === 'string' && /^\/photo-du-jour\/\d{4}-\d{2}-\d{2}\?v=[a-z0-9-]+$/.test(note.image)) {
    options.image = new URL(note.image, self.location.origin).href;
  }
  await self.registration.showNotification(note.title, options);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/menu'));
});
