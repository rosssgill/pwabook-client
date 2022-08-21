/* eslint-disable prefer-regex-literals */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

clientsClaim();

// Precache all of the assets generated by your build process.
// Their URLs are injected into the manifest variable below.
// This variable must be present somewhere in your service worker file,
precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with your index.html shell.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  // Return false to exempt requests from being fulfilled by index.html.
  ({ request, url }) => {
    // If this isn't a navigation, skip.
    if (request.mode !== 'navigate') {
      return false;
    } // If this is a URL that starts with /_, skip.

    if (url.pathname.startsWith('/_')) {
      return false;
    } // If this looks like a URL for a resource, because it contains // a file extension, skip.

    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    } // Return true to signal that we want to use the handler.

    return true;
  },
  createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`),
);

// An example runtime caching route for requests that aren't handled by the
// precache, in this case same-origin .png requests like those from in public/
registerRoute(
  // Add in any other file extensions or routing criteria as needed.
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      // Ensure that once this runtime cache reaches a maximum size the
      // least-recently used images are removed.
      new ExpirationPlugin({ maxEntries: 50 }),
    ],
  }),
);

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Any other custom service worker logic can go here.
const serverUrl = process.env.REACT_APP_SERVER_URL;

// Dynamically cache posts
registerRoute(
  ({ url }) => `https://${url.host}` === serverUrl,
  new NetworkFirst({
    cacheName: 'posts',
  }),
);

// Background sync POST requests to the server
const bgSyncPluginPost = new BackgroundSyncPlugin('queue-POST', {
  maxRetentionTime: 24 * 60,
});

registerRoute(
  ({ url }) => `https://${url.host}` === serverUrl,
  new NetworkOnly({
    plugins: [bgSyncPluginPost],
  }),
  'POST',
);

// Background sync PATCH requests to the server
const bgSyncPluginPatch = new BackgroundSyncPlugin('queue-PATCH', {
  maxRetentionTime: 24 * 60,
});

registerRoute(
  ({ url }) => `https://${url.host}` === serverUrl,
  new NetworkOnly({
    plugins: [bgSyncPluginPatch],
  }),
  'PATCH',
);

// Background sync DELETE requests to the server
const bgSyncPluginDelete = new BackgroundSyncPlugin('queue-DELETE', {
  maxRetentionTime: 24 * 60,
});

registerRoute(
  ({ url }) => `https://${url.host}` === serverUrl,
  new NetworkOnly({
    plugins: [bgSyncPluginDelete],
  }),
  'DELETE',
);

// Listening for push events
self.addEventListener('push', (event) => {
  console.log('Push notification received', event);

  let data = { title: 'New post!', content: 'A post was made!', openUrl: '/' };
  if (event.data) {
    data = JSON.parse(event.data.text());
  }

  const options = {
    body: data.content,
    data: {
      url: data.openUrl,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
