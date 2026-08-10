/**
 * vault-auth-stub.js — standalone build.
 *
 * The real auth module is omitted from the public, domain-free deploy.
 * listen.js and music-player.js both guard every call with `window.VaultAuth &&`,
 * so this minimal stub keeps them on the no-auth path: no token, no session,
 * no login modal. Nothing here references the real project or backend.
 */
(function () {
  'use strict';
  window.VaultAuth = {
    getToken:   function () { return null; },
    getEmail:   function () { return null; },
    hasSession: function () { return false; },
    openModal:  function () { /* no-op: no auth in standalone */ },
  };
})();
