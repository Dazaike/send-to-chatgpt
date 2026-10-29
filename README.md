# Send to ChatGPT

Chrome (Manifest V3) extension, version 1.1.0. Send selected text, an image, or a free-draw screenshot crop to ChatGPT in one click. No build step, no dependencies.

## Install

1. Download the zip from the latest GitHub Release and unzip it (or clone this repo).
2. Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the folder.
3. Sign in to https://chatgpt.com.

## Use

| Where you right-click | Menu item |
| --- | --- |
| Selected text | Send text to ChatGPT in a new tab / new window |
| An image | Send image to ChatGPT in a new tab / new window |
| The page (no text or image) | Screenshot to ChatGPT in a new tab / new window |

- **Screenshot:** the page freezes; hold the mouse button and draw around the area, release to send. Esc cancels.
- **Address bar:** type `gpt`, press Space, type your query, press Enter. Uses the tab/window mode saved in the options.
- **Options:** set tab or window for address-bar searches and the popup size.

## Limits

- Screenshots capture the visible area only and don't work on `chrome://` pages or the Chrome Web Store.
- `blob:` image URLs can't be fetched.
- Relies on ChatGPT's current page layout; if ChatGPT changes its prompt box or send button, update the selectors in `chatgpt.js`.

See [CHANGELOG.md](CHANGELOG.md).
