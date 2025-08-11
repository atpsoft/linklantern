Link Lantern browser extension

To build it yourself, look at build-instructions.md

to install it from one of the extension stores, search on them for Link Lantern (by Makani Mason or linklatern.com),
or visit:
[Chrome web store](https://chromewebstore.google.com/detail/link-lantern/ghnfkfeonbjhknfocfoaajlgdbiloimf)
[Firefox browser add-ons](https://addons.mozilla.org/en-US/firefox/addon/link-lantern/)


building for chrome:
./generate_manifest.js chrome
rm extension.zip; zip -vr extension.zip extension/ -x "*.DS_Store"

building for firefox:
./generate_manifest.js firefox
cd extension
# confirm no warnings
web-ext lint
# confirm it works in browser
web-ext run
# build
web-ext build
