# Changelog

## [0.2.0](https://github.com/dmanto/ble-faker/compare/ble-faker-v0.1.0...ble-faker-v0.2.0) (2026-03-01)


### Features

* add DeviceStore model and state engine ([34ddcd5](https://github.com/dmanto/ble-faker/commit/34ddcd585e323554dc87114acdf01336ebbadff5))
* add GATT labels table and default device code ([0a5a231](https://github.com/dmanto/ble-faker/commit/0a5a231a65d9250557c4b85284f3606a53140484))
* add npx CLI entry point, update architecture docs ([773a4de](https://github.com/dmanto/ble-faker/commit/773a4de586f667ef99471cb4230e77a80b7f4460))
* add runDeviceLogic sandbox helper with typed DeviceEvent ([6daf9f7](https://github.com/dmanto/ble-faker/commit/6daf9f74b82ffc584949f3151cbb26b27b2e7ef0))
* add runDeviceLogic tests; fix vm sandbox and prototype issues ([f23e110](https://github.com/dmanto/ble-faker/commit/f23e1101ed9bbf028a3eeb9046de11505652375c))
* add server state file, bleMockServer helper, and lifecycle test ([f754745](https://github.com/dmanto/ble-faker/commit/f75474503466ea16738acc0a05fbc516e995de09))
* capture sandbox console output for browser view delivery ([e2118a5](https://github.com/dmanto/ble-faker/commit/e2118a530ba2f584569f186fc378ce31a82f3a39))
* rename to ble-faker, add release pipeline, fix TypeScript config ([9737391](https://github.com/dmanto/ble-faker/commit/97373917535b76c778dfd0bb82502dac196129c3))


### Bug Fixes

* add type casts to state-engine tests to satisfy noUncheckedIndexedAccess ([76ad449](https://github.com/dmanto/ble-faker/commit/76ad44971d50a892166d26fe0858c94d2ed81707))
* clean process tree shutdown on all platforms ([4ce51e6](https://github.com/dmanto/ble-faker/commit/4ce51e6d9f1be6b944f8365de2ce75ecc7e54198))
* clean up state file on crash and Ctrl+C in bin.ts ([d14c474](https://github.com/dmanto/ble-faker/commit/d14c47436736a1d52c137f49109efe55b76c8233))
* increase server start timeout to 30s; run test files sequentially ([c019743](https://github.com/dmanto/ble-faker/commit/c01974355dd3c2aeaac0b61c94fb2ee2bb3f7422))
* re-enable parallel test execution ([ffc8594](https://github.com/dmanto/ble-faker/commit/ffc85942aa3bf972b522c4c9660e87cf12c13cab))
* spawn npx via cmd /c on Windows to avoid EINVAL on .cmd files ([1b85c29](https://github.com/dmanto/ble-faker/commit/1b85c29b42b14cb4301c0f52f73b3adc825f4f0b))
* use non-deprecated googleapis/release-please-action ([0e83e70](https://github.com/dmanto/ble-faker/commit/0e83e70530fe5d135931b55d35dbfa4166765efb))
* use shell:true on Windows instead of cmd /c for npx spawn ([f4cabb7](https://github.com/dmanto/ble-faker/commit/f4cabb7978b1fb033e840c38109b9cc223f7bc6c))


### Performance Improvements

* spawn node bin directly instead of npx to eliminate startup overhead ([8d2346a](https://github.com/dmanto/ble-faker/commit/8d2346a6f2c585957316c479c1e348d5851d8a73))
