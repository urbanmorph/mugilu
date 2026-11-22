# Security policy

Please report a security problem privately, not in a public issue: use GitHub's [private vulnerability reporting](https://github.com/urbanmorph/mugilu/security/advisories/new) form for this repository, or email [sathya@urbanmorph.com](mailto:sathya@urbanmorph.com). We answer within 7 days.

mugilu keeps very little that could leak: no accounts or passwords, and, for the opt-in warning alerts only, a browser's push address and the chosen places rounded to about 1 km ([/terms](https://mugilu.live/terms#privacy)). The admin routes take a key in an `Authorization: Bearer` header; secrets live in Cloudflare's encrypted settings, never in the repository.

Only the latest version, the one deployed at [mugilu.live](https://mugilu.live), is supported.
