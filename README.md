# Ludo Ladder

A small, colourful game-night website for **Ludo** and **Snakes & Ladders**. Choose 2, 3 or 4 players, make a room, and share its six-character code or invite link. You can also share one device and take turns locally.

## Play

1. Choose a game and player count, enter your name and select **Create private room**.
2. Friends open the same website, enter their names and the code, and select **Join room**.
3. Guests select **I'm ready**. The host starts when all selected seats are ready.
4. Roll on your turn. In Ludo, a single legal move plays automatically; with multiple choices, choose a highlighted token or its button under the dice. Snakes & Ladders moves your pawn automatically.

The host keeps their tab open: that browser holds the room and validates all rolls and moves. Refreshing or closing the host tab ends the room. Guest seats are reserved during a game; they can reconnect or reload and rejoin from the same tab. A dropped host connection can be restored using **Reconnect** while the original host tab remains open.

## Run locally

Node.js 18 or newer is enough. There is no build step and no installation is needed to play or run the tests: the small browser connection client is vendored.

```sh
npm run dev
```

Open http://127.0.0.1:5062/. Use two tabs or browsers to test an online room. Online play uses the public relay even when the game files are served locally. **Play on this device** works without that connection service.

```sh
npm test
npm run check
```

The 29 automated tests cover game rules, automatic moves and bonus turns, motion routes and captures, audio preferences, room capacity and isolation, ready/start/turn validation, private packet routing, guest removal and reconnection. Actual browser clients have also been checked through the public relay.

## Stack and hosting

- HTML, CSS, vanilla JavaScript and original SVG boards. No framework, remote fonts, player accounts or AI API keys.
- [Itty Sockets](https://ittysockets.com/docs/getting-started) 0.9.3 carries game messages through a free shared WebSocket relay (`wss://itty.ws`). Its browser client and MIT license are included under `vendor/`. No Railway account, deployed game server or API key is needed.
- The host browser owns game state. The relay forwards direct messages between connected clients. Guests send their seat identities and commands directly to the host; the host sends snapshots only to admitted players. Different room codes use different channels.
- This replaces PeerJS/WebRTC: no direct browser connection, STUN or TURN negotiation is needed. The service is external to GitHub Pages and has no availability guarantee. If it is unavailable, one-device play still works. GitHub Pages itself only serves static files; it does not hold room state.
- WebSocket traffic uses TLS. The relay operator is part of the trust model; this is not an end-to-end encrypted game. Room codes are invitations, not passwords. Share them only with intended players. The host is trusted; this is a casual friends game rather than an anti-cheat competitive service.
- Names are remembered in local storage. Rejoin identities are saved in session storage. No analytics or application database is included.
- GitHub Pages serves the repository root directly from `main`. Asset URLs are relative, and `.nojekyll` is included. Changes to `main` automatically deploy to the same URL.

The browser download is about 109 KB before compression. `npm install` is optional and restores the pinned upstream connection client for development. Test and development files are not loaded by the website.

## Sound and movement

Music and game effects are enabled by default, with independent volume sliders and on/off buttons in **Sound settings**. Browsers allow sound after your first click, tap or keypress; preferences are remembered on this device. The mellow background loop is an original eight-bar composition synthesized with Web Audio, with no borrowed recordings or samples. Its audio material is dedicated to CC0. Sound pauses while the tab is hidden.

Tokens hop through each square, glide up ladders and follow snakes down. Captured tokens return to their yards after the moving token arrives. The three-dimensional dice rolls beside the board, and **Table talk & recent moves** can be hidden or shown. Reduced-motion settings skip animated movement.

## Rules used

**Ludo:** a six releases a token. Sixes, captures and reaching home earn another roll; three consecutive sixes end the turn. Coloured start squares and stars are safe. Landing on an unsafe square captures opposing tokens there. Stacks do not block passage. Each token needs an exact roll to finish, and the first player with all four home wins. Two players use opposite colours.

**Snakes & Ladders:** start at zero and follow the numbered zigzag track. Landing at a ladder's foot climbs it; landing on a snake's head slides down. Every roll passes the turn, including a six. Reach 100 exactly to win; an overshoot stays in place.

Rules are also available from the **?** button.

## Files

`rules.js` contains game rules, `room.js` validates room commands, `network.js` connects browser clients, `boards.js` draws the boards, `motion.js` animates tokens, `audio.js` synthesizes music and effects, and `app.js` controls the interface. `config.js` holds the public channel prefix, not a private service credential.

The artwork is original. Ludo King inspired the requested glossy board-game feel; this project is independent and uses none of its branding or assets.
