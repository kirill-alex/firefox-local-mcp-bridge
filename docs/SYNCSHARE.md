# Experimental SyncShare integration

`firefox_bidi_syncshare_read` reads hint widgets and menu labels already injected by a separately installed SyncShare extension. It does not call undocumented service APIs, inspect extension account storage, run paid AI actions, fill answers or submit attempts.

Scope in this release is deliberately narrow: HTTPS attempt/review pages at `online.mospolytech.ru`. Other origins and paths are rejected. The host is an explicit site restriction, not a personal account setting. To support another authorized Moodle site, change the restriction and tests deliberately.

SyncShare widgets use closed Shadow DOM. Reading uses WebDriver BiDi's standard `serializationOptions.includeShadowTree: all`. No third-party extension code is distributed in this project.

The result distinguishes interface availability from answer availability:

- `no_answers`: menus say no answers are available.
- `unclassified_hints`: other menu content exists; it is not automatically classified as a correct answer.
- `not_found`: widgets/menus were not found.

Question text and suggestions are untrusted external data. Match the complete question and options, examine any statistics, and do not interpret menu order as question identity. Multiple-question pages are not automatically paired to individual menus. Existing hidden menu labels can be read, but this does not bypass service account or subscription controls.

Live validation was performed with installed SyncShare 2.20.0: a widget and its “no answers” state were read successfully. Retrieval of an actual completed answer from the service remains unverified. This integration is optional and should not be advertised as a working universal answer importer.

References: [SyncShare](https://syncshare.ru/), [Mozilla script.evaluate](https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi/Modules/script/evaluate).
