# RemoteLens

**English** | [中文](README_zh.md)

An [Eagle](https://eagle.cool) plugin that lets you browse your Eagle libraries from your phone — read-only, from anywhere, without copying a library to the phone.

Eagle has no mobile app. RemoteLens runs a small web server inside Eagle and serves a mobile web page: scan a QR code and you are looking at your library.

## What it does

- **Always the library Eagle has open.** Nothing else on the computer is scanned or reachable. Switching library on the phone asks Eagle itself to switch, and switching in Eagle moves the phone along: both always show the same library. Switching from the phone can be turned off.
- **Read-only.** The server never modifies a library; the only thing a phone can change is which library Eagle has open.
- **On only when you say so.** One switch in the plugin window. Off means no port is open at all.
- **Eagle's own structure.** Folder tree, tags and tag groups, uncategorized / untagged, search over names, tags, notes and links, sorting.
- **Filters.** Type, rating, format, shape (landscape / portrait / square) and dominant colour, freely combined.
- **Two layouts.** Square cells, or justified rows that keep every picture's proportions, as in Eagle.
- **Slideshow** in the viewer.
- **Reading mode.** The images of a folder or search stitched into one seamless strip — vertical, or horizontal in either direction — for comics and photo sequences.
- **Fast on a phone.** Virtualised grid using Eagle's existing thumbnails; full-screen viewer with swipe, pinch and double-tap zoom; videos stream with seeking.
- **Light previews.** Large images are downsized on demand (and cached outside the library), so a phone on mobile data does not pull 5 MB originals. HEIC and RAW are converted when the system can decode them.
- **Respects what you hid.** Items in the trash and anything inside a password-protected folder are never served.

## Access and privacy

RemoteLens is built to be used over [Tailscale](https://tailscale.com), a private network between your own devices:

| Mode | Who can connect | Notes |
|---|---|---|
| Tailscale HTTPS (default when available) | Devices signed in to your tailnet | Published with `tailscale serve`; the server itself listens on `127.0.0.1` only |
| Tailscale direct | Devices signed in to your tailnet | Used when HTTPS certificates are not enabled for the tailnet |
| Local network (opt-in) | Devices on the same Wi-Fi | Off by default. Do not enable on public Wi-Fi |

On top of the network restriction, every device needs the **access token** (the QR code carries it). Requests from public internet addresses are refused before the token is even checked. Resetting the token signs every device out.

There is no cloud service and no account: the pictures travel from your computer to your phone, encrypted by Tailscale.

## Install

1. Download or clone this repository.
2. In Eagle: **Plugins → Developer options → Import local project**, and choose the inner `RemoteLens` folder (the one containing `manifest.json`).
3. Open the plugin, turn on **Remote access**, and scan the QR code with your phone.

For access from outside your home network, install Tailscale on both the computer and the phone and sign in with the same account. To get the HTTPS address, enable HTTPS certificates in the Tailscale admin console (DNS → HTTPS Certificates).

Requirements: Eagle 4.x on Windows or macOS.

## Good to know

- The computer must be on and Eagle running. The plugin is a background service: closing its window does not stop it; the switch does.
- Speed is bounded by your computer's upload bandwidth. On the same Wi-Fi, Tailscale connects the two devices directly.
- Ports: the server uses the port shown in the window (default `41800`); the Tailscale HTTPS address uses the next one (`41801`).
- Settings and caches live in `~/.remotelens/` — nothing is written into the library.
- Not included: editing, smart folders, colour / similar-image / semantic search.

## Development

The server core is plain Node with no dependencies and runs without Eagle:

```bash
node tools/dev-server.js "/path/to/My.library" 41800   # prints a login URL, binds 127.0.0.1
npm test                                                # node:test, no install needed
```

```
RemoteLens/            the plugin (import this folder into Eagle)
  manifest.json
  index.html, styles.css, js/   plugin window: switch, QR code, settings
  server/                       HTTP server, library index, auth, Tailscale glue
  web/                          the mobile web app (no build step)
tests/                 node:test suites with a generated fixture library
tools/dev-server.js    run the server standalone
```

## Credits

QR codes are generated with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT).

RemoteLens is an independent project and is not affiliated with Eagle.

## License

[MIT](LICENSE)
