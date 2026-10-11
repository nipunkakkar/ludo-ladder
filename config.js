// Public connection settings only. Never put private credentials in this file.
window.LUDO_LADDER_CONFIG = {
  peerOptions: { debug: 0 },
  async connectionOptions() {
    // Public demo relay settings advertised by Open Relay for static-auth clients:
    // https://www.metered.ca/tools/openrelay/#static-auth
    // This is a provider-published shared secret, not a private account credential.
    const username = String(Math.floor(Date.now() / 1000) + 3600) + ':ludo-ladder';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('openrelayprojectsecret'), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username));
    const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return {
      ...this.peerOptions,
      config: { iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: ['turn:staticauth.openrelay.metered.ca:80', 'turn:staticauth.openrelay.metered.ca:443?transport=tcp', 'turns:staticauth.openrelay.metered.ca:443?transport=tcp'], username, credential }
      ] }
    };
  },
  roomPrefix: 'ludo-ladder-nk-v1-'
};
