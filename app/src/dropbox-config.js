/** Public Dropbox application identifier for CuadernoProfesorado.
 * Production remains disabled; only the dedicated Cloudflare branch alias may
 * exercise the test file. No app secret or user credential belongs here.
 */
export const DROPBOX_CLIENT_ID='o39qi482kibhdv6';
export const DROPBOX_ORIGIN='https://appnotas-docente.pages.dev';
export const DROPBOX_TEST_ORIGIN='https://feature-dropbox-e2ee-sync.appnotas-docente.pages.dev';
export const DROPBOX_TEST_PATH='/pruebas-cuaderno-cifrado.json';
export const DROPBOX_PRODUCTION_PATH='/cuaderno-cifrado.json';
export const DROPBOX_PRODUCTION_ENABLED=false;
export const dropboxConfigured=origin=>origin===DROPBOX_TEST_ORIGIN||
  (DROPBOX_PRODUCTION_ENABLED&&origin===DROPBOX_ORIGIN);
export const isDropboxTest=origin=>origin===DROPBOX_TEST_ORIGIN;
export const dropboxFilePath=origin=>isDropboxTest(origin)?DROPBOX_TEST_PATH:DROPBOX_PRODUCTION_PATH;
export const validDropboxRedirect=uri=>[DROPBOX_ORIGIN+'/',DROPBOX_TEST_ORIGIN+'/'].includes(uri);
