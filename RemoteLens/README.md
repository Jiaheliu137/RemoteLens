# RemoteLens

Browse the library open in Eagle from a phone or another computer, read-only, over your own private network.

Full documentation: https://github.com/Jiaheliu137/RemoteLens

## What this plugin does on your computer

- **Runs a small web server inside Eagle** while the "Remote access" switch is on. It listens on `127.0.0.1` (port 41800 by default). It is off until you turn it on, and turning it off closes the port.
- **Runs the `tailscale` command** if [Tailscale](https://tailscale.com) is installed: `tailscale status` to read this computer's address, and `tailscale serve` to publish the port inside your own Tailscale network over HTTPS. Nothing is published to the public internet.
- **Calls Eagle's own local API** (`localhost:41595`) to list your libraries and to switch library when you ask for it from the phone.
- **Writes only to `~/.remotelens/`**: a settings file and a cache of downsized preview images. Nothing is written into any library, and no item is ever modified.
- **Connects to no outside server.** Pictures go from this computer straight to your own devices.

Third-party software: Tailscale is needed for access from outside your home network. It is not bundled; install it yourself on the computer and the phone and sign in with the same account. With "Allow local network" the plugin also works on the same Wi-Fi without Tailscale (unencrypted HTTP, for trusted networks only).

Bundled third-party code: `js/vendor/qrcode.js`, QR Code Generator by Kazuhiko Arase, MIT licence (notice kept in the file).

## Testing without Tailscale

1. Open the plugin and turn on **Remote access**.
2. Press **Show** next to "Access token" and copy the token.
3. On the same computer, open `http://127.0.0.1:41800/` in a browser and paste the token. The library open in Eagle appears.
4. To test from a phone on the same Wi-Fi, tick **Allow local network** and scan the QR code that appears.

## Testing with Tailscale

1. Install Tailscale on the computer and on a phone, signed in to the same account.
2. Turn on **Remote access**; the window shows a QR code. Scan it with the phone.

Tested on Windows 11 with Eagle 4. macOS is supported by design (Tailscale is looked up in the usual macOS locations) but has not been tested by the author.
