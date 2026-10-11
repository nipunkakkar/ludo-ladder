# Ludo Ladder

A small, colourful game-night website for **Ludo** and **Snakes & Ladders**. Choose 2, 3 or 4 players, create a room, and share its six-character code or invite link. You can also share one device and take turns locally.

**Preview status:** one-device play has been checked in the browser, and 19 automated tests cover the rules and host/guest messages. Real online room creation works, but two-browser joining timed out in the verification environment. Online multiplayer is a preview and is not yet verified end to end across devices. Use **Play on this device** to try both games reliably.

## Play

1. Choose a game and player count, enter your name, and select **Create private room**.
2. Friends open the same website, enter their names and the code, and select **Join room**.
3. Each guest selects **I'm ready**. The host starts when all selected seats are ready.
4. Roll on your turn. In Ludo, choose a highlighted token or its button underneath the dice. Snakes & Ladders moves your pawn automatically.

The host must keep their tab open. Rooms exist in browser memory: refreshing or closing the host tab ends the room. A disconnected guest can reconnect or reload and rejoin from the same browser tab; their seat is reserved during a game. Codes keep separate games apart but are invitations, not passwords; share them only with your players.

## Run locally

Requires Node.js 18 or newer. There is no build step and no dependency installation is required to play or run the tests.

```sh
npm run dev
```

Open http://127.0.0.1:5062/. For online play, open a second browser tab and join the room. To test on other devices, serve the files through HTTPS. Browser crypto and WebRTC require a secure origin; localhost is accepted for development.

```sh
npm test
npm run check
```

## Stack and hosting

- HTML, CSS, vanilla JavaScript and original SVG board artwork. No framework, remote fonts, image downloads, accounts or API keys.
- PeerJS 1.5.5 is vendored in `vendor/`; its MIT license is included. `npm install` is optional and restores the pinned upstream dependency for development.
- WebRTC carries game messages between browsers. The public PeerJS service helps browsers find each other. The relay configuration uses the [Open Relay provider's documented public static-auth service](https://www.metered.ca/tools/openrelay/#static-auth), with short-lived HMAC credentials and TCP/TLS fallback. Its shared secret is publicly advertised by the provider and is not an account key. PeerJS's discontinued default TURN endpoints are replaced. Both public services and the players' networks affect connectivity; the one-device mode works without them. A dedicated relay or hosted room server would be needed for stronger online reliability.
- The host validates turns, legal moves, room capacity and state versions, and rolls dice using browser cryptographic randomness. The host browser is trusted; this is a casual friends game, not an anti-cheat competitive service.
- Player names are stored locally for convenience. Guest rejoin identities use session storage. No analytics or application database.
- GitHub Pages can serve the repository root directly from `main`. All asset URLs are relative, and `.nojekyll` is included.

The browser app is roughly 172 KB before compression. The test and development files are not loaded by the website.

## Rules used

**Ludo:** a six releases a token. Sixes, captures and reaching home earn another roll; three consecutive sixes end the turn. Coloured start squares and star squares are safe. Landing on an unsafe square captures opposing tokens there. Stacked tokens do not block passage. Each token needs an exact roll to finish, and the first player with all four home wins. Two-player games use opposite colours.

**Snakes & Ladders:** start at zero, follow the numbered zigzag track, climb ladders and slide down snakes. Turns alternate after every roll, including a six. You need an exact roll to reach 100; an overshoot leaves your pawn in place.

Rules are also available from the **?** button in the app.

## Files

`rules.js` contains the game rules, `room.js` validates room commands, `network.js` handles host/guest connections, `boards.js` draws the SVG boards, and `app.js` connects the UI. `config.js` contains public connection settings only; never put a private service credential in a static website.

The artwork is original. Ludo King inspired the requested glossy board-game feel; this project is independent and does not use its branding or assets.
