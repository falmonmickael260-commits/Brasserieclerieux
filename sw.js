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
      title: 'Menu du jour',
      body: 'Consultez le menu de la brasserie.',
      tag: 'menu-du-jour',
    };
    try {
      const response = await fetch('/api/menu', { cache: 'no-store' });
      const menu = await response.json();
      if (menu?.notification) {
        note = menu.notification;
      } else if (menu?.main) {
        note.title = 'Menu du jour · ' + menu.price + ' €';
        note.body = [menu.starter, menu.main, menu.sweet].filter(Boolean).join(' · ');
        note.tag = 'menu-du-jour-' + menu.day;
        note.image = menu.photoPath;
      }
    } catch {
      // The notification still opens the menu if the current menu is unavailable.
    }
  }

  const options = { body: note.body, tag: note.tag || note.id };
  if (!note.tag?.startsWith('menu-du-jour')) options.icon = '/logo.webp';
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
