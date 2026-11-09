# WebDriver BiDi operations

Start Firefox with `--remote-debugging-port 9222` after fully closing any existing Firefox process. The native tools do not require the extension. Use `firefox_bidi_status` and `firefox_bidi_contexts` to connect and identify the exact page/frame.

The native prefix is `firefox_bidi_`. Available operations include status, contexts, open, navigate, close, activate, snapshot, evaluate, click, hover, type, key, drag, scroll, screenshot, upload, monitor, events, handle_prompt, pause, disconnect and syncshare_read. Full schemas are in tools.mjs.

Context IDs are strings belonging to a BiDi session; refresh them after reconnecting. Do not treat a URL alone as a unique tab identity. A frame has its own context ID.

Native keyboard/pointer actions do not wait for OS focus. `activate` is optional and bounded to 1.5 seconds. If it returns `confirmed:false`, the outcome is unknown; it may still have selected the tab. Do not repeatedly request activation or claim focus succeeded.

Scroll modes:

| Mode | Behavior |
|---|---|
| `auto` | Dispatch trusted wheel, inspect scroll positions, then use DOM fallback only if no movement was observed and the document is hidden |
| `native` | Trusted wheel only; `moved:false` is possible |
| `dom` | Scroll the nearest scrollable ancestor under x/y with DOM APIs |

The result reports actual `mode` and `moved`. A completed dispatch is not proof that the page scrolled. DOM fallback does not reproduce trusted wheel event behavior. Canvas dragging uses pointer input; ordinary extension dragging uses synthetic HTML5 events instead.

Monitoring is opt-in per context. Up to 500 console/network records are held in memory. Network output is limited to URL, method, request ID, status and errors; headers, cookies and bodies are not returned. Use event cursors to avoid re-reading records. Pause does not disable subscriptions: call monitor with `enabled:false` or disconnect.

Use `firefox_bidi_disconnect` before stopping or updating the server. Firefox supports one active session and may keep it after an unclean disconnect. A new server cannot automatically reclaim an orphaned session without a browser restart. The server ends its own session on normal shutdown; forced process termination can bypass this cleanup.

Limitations: no system/chrome access; JS prompts are not OS dialogs; not every browser shortcut is supported; native mode does not inherit the extension's private-tab filter. No full Chrome DevTools protocol parity, response interception or network-body capture is claimed.

References: [Mozilla Remote Agent](https://firefox-source-docs.mozilla.org/remote/Security.html), [WebDriver BiDi](https://w3c.github.io/webdriver-bidi/).
