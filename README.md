# Dragon Radar Firmware

## Files — two separate Arduino sketches, each self-contained
- `target_node/` — `target_node.ino` + `dragon_radar_config.h`
  → flash to each "dragon ball" unit (no display, GPS + radio only)
- `hunter_node/` — `hunter_node.ino` + `dragon_radar_config.h`
  → standalone handheld tracker (GPS + compass + radio + OLED), if you're
    not using the phone-as-radar option below
- `bridge_node/` — `bridge_node.ino` + `dragon_radar_config.h`
  → an alternative to hunter_node: no GPS/compass/OLED on this board at
    all, it just relays LoRa packets to a phone over BLE
- `web_radar/dragon_radar.html` — the phone-side radar UI (Web Bluetooth),
  pairs with `bridge_node`

You only need **either** `hunter_node` (standalone) **or** `bridge_node` +
`web_radar` (phone-based) — not both, unless you want two hunter options.

Each sketch folder has its own copy of `dragon_radar_config.h`. They must
stay identical (packet format, radio settings) — if you change one, copy
the change to the other. This duplication is intentional: Arduino IDE
sketches don't reliably resolve `#include` paths that reach outside their
own folder, so each sketch is fully self-contained and works with a plain
File > Open.

## How to open/build in Arduino IDE
1. **Board support**: File > Preferences > add
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   to Additional Board Manager URLs, then Tools > Board > Boards Manager,
   install "esp32" by Espressif. Select **XIAO_ESP32S3** under
   Tools > Board > esp32.
2. **Libraries**: Sketch > Include Library > Manage Libraries, install:
   - RadioLib (jgromes)
   - TinyGPSPlus (mikalhart)
   - Adafruit SSD1306
   - Adafruit GFX Library
3. **Open the sketch**: File > Open > select `target_node.ino` or
   `hunter_node.ino` directly (not the parent `dragon_radar` folder — open
   each `.ino` as its own sketch). The `dragon_radar_config.h` in the same
   folder will appear as a second tab automatically.
4. For target nodes: edit `MY_NODE_ID` at the top of `target_node.ino`
   before each upload (2, 3, 4... one unique ID per physical unit), then
   flash, unplug, move to the next board.
5. For the hunter: `MY_NODE_ID` stays 1. Only this sketch needs the OLED
   wired up.
6. Select the correct port under Tools > Port, then Upload.

## Setup notes
- Verify `LORA_NSS/DIO1/NRST/BUSY` pins in the config header against your
  specific Wio-SX1262 kit revision (check Seeed's wiki/silkscreen — pin
  numbering has varied slightly between production batches).
- Wire GPS module UART to the pins defined in each `.ino` (`GPS_RX_PIN`/`GPS_TX_PIN`),
  adjust to match your actual wiring.
- On the hunter, wire a momentary push button to `PING_BUTTON_PIN` and GND
  for the active-ping trigger (or just send `p` over Serial to test on the bench).
- OLED (hunter only): standard SSD1306 128x64 over I2C, default XIAO
  ESP32S3 SDA/SCL pins. If your default I2C address isn't `0x3C`, change
  `OLED_ADDR` in hunter_node.ino.

## Still TODO once hardware arrives
- Real compass read in `readCompassHeadingDeg()` (hunter_node.ino) — the
  OLED code just consumes whatever degrees this function returns, so it's
  unaffected by which compass/IMU module you end up buying.
- Magnetic declination constant tuned to your actual CA location
  (varies ~11-13° E across the state — use NOAA's calculator for your spot)
- Optional: real light-sleep on target nodes for battery life (currently
  just a pacing `delay()`, not true low-power sleep)

## Phone-as-radar option (bridge_node + web_radar)

Flash `bridge_node.ino` to one XIAO+SX1262 board — no GPS, compass, or
display needed on it. It listens for LoRa beacons/reports and forwards
each one to a connected phone over BLE as a small JSON string; it also
accepts a `"PING"` command written from the phone and broadcasts it as a
LoRa ping.

**BLE identifiers** (must match between firmware and the web page —
already consistent in both files as shipped, only change if you regenerate them):
- Device name: `DragonRadar-Bridge`
- Service UUID: `7a2e0001-4b8a-4f0f-9a3d-2e6f8c1a9b10`
- Data characteristic (notify, JSON target updates): `7a2e0002-...`
- Control characteristic (write, accepts `"PING"` or `"PING:<id>"`): `7a2e0003-...`

**Hosting `dragon_radar.html`:** Web Bluetooth and geolocation both
require a "secure context" — HTTPS, or `localhost`. Plain `file://` or
plain HTTP won't work on Android Chrome. Easiest options:
- Quick local test: `python3 -m http.server` in the folder, then open
  `http://localhost:8000/dragon_radar.html` in Chrome **on the same
  phone** (a phone can address its own localhost if you run the server
  on the phone via Termux, or otherwise use one of the options below).
- Simplest real option: drop the file on a static host with free HTTPS —
  GitHub Pages, Netlify Drop, Vercel — then open that HTTPS URL in Chrome
  on the S24 Ultra.

**Using the page:**
1. Open the hosted page in Chrome on the S24 Ultra.
2. Tap **Connect Bridge**, pick `DragonRadar-Bridge` from the browser's
   device picker.
3. Grant location permission when prompted (needed for your own GPS fix).
4. The scope displays contacts as they beacon in; tap **Ping** to force
   an immediate report from all targets.
5. If the arrow/blips seem rotated wrong relative to where you're
   actually facing, use the **-5° / +5°** buttons to nudge the compass
   calibration — phone compass axis conventions vary slightly and this
   is a quick manual fix rather than something the page can always
   detect automatically.

## Making it work with no cell service (PWA / offline install)

`web_radar/` now includes everything needed to install the radar as an
offline-capable app instead of just a browser tab:
- `manifest.json` — app name/icon/theme metadata
- `service-worker.js` — caches the whole app on first visit, cache-first from then on
- `icon-192.png` / `icon-512.png` — app icons

**Don't try to save the HTML file locally through Chrome's "Download
page" / offline-reading feature** — that captures a static snapshot with
JavaScript disabled, which is why it'll look like a frozen screenshot
you can't interact with. The PWA route below is the real fix, and stays
on `https://` where Bluetooth/GPS are guaranteed to work.

**Setup (needs your GitHub Pages repo, same one as before):**
1. Upload `index.html`, `manifest.json`, `service-worker.js`,
   `icon-192.png`, and `icon-512.png` all into the **same folder** at the
   root of the repo (same place `index.html` already lives). GitHub
   Pages will pick them up automatically after the usual ~1 minute rebuild.
2. On the S24 Ultra, open your GitHub Pages URL in Chrome once **while
   you have signal**. This lets the service worker install and cache
   everything.
3. Chrome should show an "Install app" / "Add to Home screen" prompt
   (or: ⋮ menu → "Add to Home screen" / "Install app" if it doesn't pop
   up automatically).
4. From then on, launch it from the home-screen icon like any other
   app — it'll load instantly with zero network, indefinitely, even
   after restarting your phone.

**If you ever update the HTML/JS later:** bump `CACHE_NAME` in
`service-worker.js` (e.g. `'dragon-radar-v1'` → `'dragon-radar-v2'`)
before re-uploading — this forces the old cached version to be replaced
next time you have signal, rather than the app silently sticking with
stale code forever.

## Running two phone/bridge hunters at once

`bridge_node.ino` now does double duty: it still relays what it hears
over LoRa to its own phone, but it also takes that phone's GPS fix (a new
`POS:lat,lon` write from the web page) and broadcasts it out over LoRa on
its own node ID, on the same schedule/format as a target. That's what
lets two hunters see each other — to the radio, a bridge's self-beacon is
indistinguishable from a dragon-ball target's beacon.

**Board budget:** you have 8 kits total. Two as bridges + all 7 originally
target-flashed boards would need 9 — one board over. Simplest fix: pick
one of your existing target boards (say, the one currently running ID 2)
and reflash it with `bridge_node.ino` instead. That leaves 2 bridges (IDs
1 and 2) + 6 targets (IDs 3-8), no changes needed on the untouched target
boards.

**Setup:**
1. Flash `bridge_node.ino` to both bridge boards, giving each a unique
   `MY_NODE_ID` (1 and 2). Don't reuse an ID that's still running on a
   target board.
2. Re-upload the updated `index.html` and `service-worker.js` to the same
   GitHub Pages repo (overwrite the existing files) — this version adds
   the position push and visually distinguishes hunter contacts (amber
   diamond marker, "H" prefix) from target contacts (green dot, "#" prefix).
3. In `index.html`, the `HUNTER_IDS` constant near the top of the
   `<script>` block is set to `{1, 2}` by default, matching the two bridge
   IDs above — update it if you pick different IDs. It's purely cosmetic
   (which color/shape a contact draws as), so both phones can share the
   exact same deployed page with no per-phone customization needed.
4. On each phone, open the page (may need one fresh load with signal
   after updating, so both the new service worker and new HTML take over
   from the cached version) and tap **Connect Bridge** — you'll now see
   two distinct entries in the pairing picker, `DragonRadar-Bridge-1` and
   `DragonRadar-Bridge-2`, so it's clear which phone is pairing with which
   board.
5. Each hunter passively self-beacons its position every ~15s (same
   cadence/jitter as targets) and answers pings from either bridge using
   the same staggered-slot scheme targets use — so a ping from either
   phone sweeps everyone: targets and the other hunter alike.

## Standalone hunter firmware (hunter_standalone_node.ino)

A third hunter option alongside `hunter_node.ino` (old SSD1306 prototype)
and `bridge_node.ino` (phone-paired): `hunter_standalone_node/` has its
own GPS, its own BNO055 IMU for heading, its own AHT20/BMP280 for local
altitude, and draws the radar directly on a 240x240 round GC9A01 display
— no phone required.

**Pin assignment** (all of D0-D7 were free — the Wio-SX1262 uses
dedicated GPIO39-42 plus the hardware SPI bus, not the D-numbered pins):

| Pin | Assigned to |
|---|---|
| D0 | Battery voltage sense (ADC) |
| D1 | GC9A01 display CS |
| D2 | GC9A01 display DC |
| D3 | Ping button |
| D4 | I2C SDA (BNO055 + AHT20 + BMP280, shared bus) |
| D5 | I2C SCL |
| D6 | GPS UART TX |
| D7 | GPS UART RX |

Display RST ties to 3.3V (software reset instead of a dedicated pin);
display SCK/MOSI share the same physical SPI bus as the LoRa radio, with
their own CS.

**Deliberately NOT done yet:** this firmware reads the barometer for its
own on-screen altitude display only — it does not transmit altitude over
LoRa. Adding that means extending `DragonPacket` and reflashing the
entire fleet (6 targets + 2 bridges), which hasn't happened, to avoid
breaking the already-working deployment. Revisit once ready to commit to
a coordinated fleet-wide reflash.

Not currently deployed — built ahead of time for bench testing once the
GPS/IMU/barometer/display hardware is in hand.

## Fixing jittery/flashing contacts on screen

If contacts appear to hold a stable position and then briefly "flash" to
a different spot before snapping back, there were two compounding causes,
both now fixed in `index.html`:

- **The 0,0 "no GPS fix yet" placeholder was being plotted as a real,
  thousands-of-km-away position.** That forced the auto-scaling ring
  radius up to a huge value to fit it, which squeezed every genuinely
  nearby contact (your H1/H2 phones) down into a tiny cluster of pixels
  near the center — where a few meters of ordinary GPS noise translates
  into a big, visible jump. Targets still reporting the placeholder now
  show up in the contact list as "Waiting for GPS fix" instead of being
  plotted on the scope at all, and no longer factor into the auto-scale.
  This resolves itself further as real targets start reporting real
  coordinates once their GPS modules are wired up.
- **Raw phone compass readings are noisy frame-to-frame**, and since
  every contact's on-screen angle depends on `bearing - heading`, that
  noise made everything wobble together. Heading is now smoothed with a
  circular low-pass filter (averaged as a unit vector, not raw degrees,
  so it doesn't glitch at the 0°/360° wrap).
- Added a little hysteresis to the auto-scaling itself, so real GPS noise
  hovering right at a zoom-tier boundary later on doesn't cause the whole
  scope to flicker between scales either.

Re-upload the updated `index.html` and `service-worker.js` to pick this
up (same repo, same filenames, overwrite the existing ones).

## Further stability + display tweaks

- **Heading filter overhauled.** The original single-sample low-pass
  filter wasn't enough against real phone magnetometer noise. Heading is
  now a rolling average over the last 8 accepted samples, and any single
  reading that jumps more than 60° from that average is rejected outright
  rather than blended in — unless 3 consecutive readings agree on the new
  direction, which is treated as a genuine fast turn rather than noise.
  Also fixed a real bug: the page was listening to both
  `deviceorientationabsolute` and plain `deviceorientation` and feeding
  both into the same filter, which can disagree and fight each other on
  phones that fire both. Only one source is used now, preferring absolute.
- **North Up toggle** added to the controls row. Off (default) is
  heading-up — the scope rotates with you, matching before. On locks the
  map to true north; contacts stay fixed as you turn, and the "you"
  marker rotates instead to show which way you're facing.
- **Contacts now expire.** `STALE_MS` (45s) still just dims a quiet
  contact; a new `EXPIRE_MS` (3 minutes, edit the constant to taste)
  fully removes it from the list/scope if nothing's been heard from it
  in that long.
- **Removed the decorative rotating sweep line** — it didn't correspond
  to any real event, so it's gone. The pulse-ring animation on each
  contact is unrelated and stays, since that one *is* data-driven — it
  fires exactly when a fresh packet actually arrives for that contact.

## Resize-on-expiry + tilt-linked Vertical Mode

Two more `index.html` additions:

- **Canvas now resizes when a contact expires**, not just on manual list
  collapse/window resize. A contact dropping out of `EXPIRE_MS` shrinks
  the list's natural height (it's capped at a max-height, not fixed), so
  the scope above it needs the same explicit resize call collapsing the
  list manually already triggered.
- **Vertical Mode** (auto-activated by tilt, not tap-to-toggle like North
  Up): holding the phone within 40° of upright (with 5° of hysteresis on
  the way back out, so it doesn't flicker right at the boundary) switches
  the scope to a side-on view — contacts laid out left-to-right by
  relative bearing at a fixed horizon height. It does NOT yet plot real
  elevation angles, since no altitude data flows through the protocol at
  all currently (see the standalone hunter section above) — this is
  scoped specifically to test the tilt-activation mechanism itself. The
  readout row shows current state (`V-Mode: Off` / `On (auto)`) so you
  can confirm the 40° threshold triggers correctly as you tilt.

## US915 legal notes (California)
Config defaults to 915 MHz, 20 dBm conducted, SF9/BW125 — well within FCC
Part 15.247 hobby limits. No mandatory duty-cycle restriction like EU, but
don't exceed 30 dBm EIRP (antenna gain counts toward that total).
