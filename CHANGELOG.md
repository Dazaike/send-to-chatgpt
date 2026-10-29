# Changelog

## [v1.1.0] - 2026-10-29

First tagged release; there is no earlier history to diff against.

### Added
- Right-click selected text: "Send text to ChatGPT in a new tab / in a new window". The text is pasted into the prompt box and sent automatically, replacing any saved draft.
- Right-click an image: "Send image to ChatGPT in a new tab / in a new window".
- Right-click the page (not on text or an image): "Screenshot to ChatGPT in a new tab / in a new window". The visible page is frozen and dimmed; draw a free-form loop around the area to send. The area outside the loop is filled white, Esc cancels.
- Address-bar search: type `gpt`, press Space, type a query, press Enter. It follows the mode saved on the options page.
- Options page: choose tab or window for address-bar searches and set the popup window size (default 520x720).
- Popup windows open next to the mouse cursor, kept on-screen across monitors.
- Pixel-art chat-bot icon.

### Notes
- Images over 2 MB are downscaled (max side 2560 px, JPEG) before being handed to ChatGPT.
- The ChatGPT paste step retries (paste, then the hidden file input) until the attachment actually appears, because the prompt box exists before ChatGPT's handlers are ready.
