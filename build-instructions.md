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
