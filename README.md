# Ludo Ladder

A small, colourful game-night website for **Ludo** and **Snakes & Ladders**. Choose 2, 3 or 4 players, make a room, and share its six-character code or invite link. You can also share one device and take turns locally.

## Play

1. Choose a game and player count, enter your name and select **Create private room**.
2. Friends open the same website, enter their names and the code, and select **Join room**.
3. The game starts automatically when all selected seats are filled and connected. Joining is the only confirmation needed.
4. Roll on your turn. In Ludo, a single legal move plays automatically; with multiple choices, choose a highlighted token or its button under the dice. Snakes & Ladders moves your pawn automatically.

The selected player count includes the host: a 2-player room has the host and one guest, a 3-player room has two guests, and a 4-player room has three guests. Extra new players are refused once all seats are filled, and only admitted players can reconnect while a game is active. The host keeps their tab open: that browser holds the room and validates all rolls and moves. Refreshing or closing the host tab ends the room. Guest seats are reserved during a game; they can reconnect or reload and rejoin from the same tab. A dropped host connection can be restored using **Reconnect** while the original host tab remains open and the game is active. After a win, the host sends the final result to everyone and closes the live room. Its code stops accepting new joins or former-player reconnects. The final board remains as a read-only result. **New game** creates a fresh room and code; it does not reopen the finished room.

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

The automated tests cover game rules, automatic moves and bonus turns, motion routes and captures, audio preferences, quiet routine moves, highlight milestones and jump timing, room capacity and isolation, automatic room starts and turn validation, private packet routing, guest removal and reconnection, exact 2/3/4-player capacity, final result delivery, expired room codes, four-turn shuffles of every snake head and tail, caught pawns and synchronized relocation. Actual browser clients have also been checked through the public relay.

## Stack and hosting

- HTML, CSS, vanilla JavaScript and original SVG boards. No framework, remote fonts, player accounts or AI API keys.
- [Itty Sockets](https://ittysockets.com/docs/getting-started) 0.9.3 carries game messages through a free shared WebSocket relay (`wss://itty.ws`). Its browser client and MIT license are included under `vendor/`. No Railway account, deployed game server or API key is needed.
- The host browser owns game state. The relay forwards direct messages between connected clients. Guests send their seat identities and commands directly to the host; the host sends snapshots only to admitted players. Different room codes use different channels.
- This replaces PeerJS/WebRTC: no direct browser connection, STUN or TURN negotiation is needed. The service is external to GitHub Pages and has no availability guarantee. If it is unavailable, one-device play still works. GitHub Pages itself only serves static files; it does not hold room state.
- WebSocket traffic uses TLS. The relay operator is part of the trust model; this is not an end-to-end encrypted game. Room codes are invitations, not passwords. Share them only with intended players. The host is trusted; this is a casual friends game rather than an anti-cheat competitive service.
- Names are remembered in local storage. Rejoin identities are saved in session storage. No analytics or application database is included.
- GitHub Pages serves the repository root directly from `main`. Asset URLs are relative, and `.nojekyll` is included. Changes to `main` automatically deploy to the same URL.

The browser download is about 153 KB before compression. `npm install` is optional and restores the pinned upstream connection client for development. Test and development files are not loaded by the website.

## Sound and movement

**Neon Sprint** is the default music. Music and game effects are enabled by default, with independent volume sliders and on/off buttons in **Sound settings**. Browsers allow sound after your first click, tap or keypress; preferences are remembered on this device. Choose among five original Web Audio compositions: Soft Glow (76 BPM), Late Night Café (92 BPM), Sunny Bounce (112 BPM), Neon Sprint (132 BPM) and Final Round (152 BPM). All use synthesis, with no borrowed recordings or samples. The selected music style is remembered independently on each device. Its audio material is dedicated to CC0. Sound pauses while the tab is hidden. New-token releases, captures and token finishes each have a different half-second musical cue, with sample buttons under Sound settings. Snakes & Ladders has its own race-start, rising ladder, descending snake and winning cues. Sound samples change with the selected game. Both games share all five music choices. Every cue respects the game effects slider and mute.

Tokens hop through each square, glide up ladders and follow snakes down. The Snakes & Ladders board uses original shaded, tapered snakes, wooden rails and rungs with brass caps, and contrasting number labels. Drawing and sliding share the same snake centre line. Captured tokens return to their yards after the moving token arrives. The three-dimensional dice rolls beside the board, and **Table talk & recent moves** can be hidden or shown. Reduced-motion settings skip animated movement. Shared geometry centres pawns in their squares and scales stacks to stay inside the cell. Yard slots form a symmetric grid.

Milo, the original illustrated table host, reacts only to big moments with short, varied, name-free jokes and a quicker, slightly higher-pitched voice: Ludo releases, captures, token finishes, the home stretch, close finishes and three consecutive sixes; Snakes & Ladders starts, climbs, slides, the final row, late lead changes, all-snake shuffles, caught pawns and wins. Ordinary rolls, no-move turns, overshoots, routine steps have no spoken commentary. The bubble labels the last big moment. Climb and slide reactions and musical cues start as the pawn enters the ladder or snake, with a brief board glow and character reaction. Optional spoken reactions use an installed local English browser voice when available; text always works. The voice button and game-effects mute both silence spoken reactions. Rejoining or receiving an unchanged snapshot does not replay earlier commentary.

## Rules used

**Ludo:** a six releases a token. Sixes, captures and reaching home earn another roll; three consecutive sixes end the turn. Coloured start squares and stars are safe. Landing on an unsafe square captures opposing tokens there. Stacks do not block passage. Each token needs an exact roll to finish, and the first player with all four home wins. Two players use opposite colours.

**Snakes & Ladders:** start at zero and follow the numbered zigzag track. Landing at a ladder's foot climbs it; landing on a snake's current mouth slides down. After every 4 dice turns across all players, every snake shuffles both its head and tail to new squares within their respective rows. All endpoints actually change. Pawns already on new heads slide to the new tails. Both endpoints avoid other snake endpoints, ladder endpoints and square 100. Everyone receives the same host-selected shuffle. A roll animates first, then all six snakes slither together with smooth easing, connected bodies, a gentle ripple and a warm glow, then caught pawns slide. A sidebar countdown shows how many turns remain before the next shuffle. Every roll passes the turn, including a six. Reach 100 exactly to win; an overshoot stays in place. A winning roll ends the room before any scheduled shift.

Rules are also available from the **?** button.

## Files

`rules.js` contains game rules, `room.js` validates room commands, `network.js` connects browser clients, `boards.js` draws the boards, `geometry.js` shares token placement between drawing and motion, `motion.js` animates tokens, `audio.js` synthesizes music and effects, `commentary.js` derives reactions and handles optional speech, and `app.js` controls the interface. `config.js` holds the public channel prefix, not a private service credential.

The artwork is original. Ludo King inspired the requested glossy board-game feel; this project is independent and uses none of its branding or assets.
