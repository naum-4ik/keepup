# Changelog

## [1.2.0](https://github.com/naum-4ik/keepup/compare/v1.1.1...v1.2.0) (2026-10-08)


### Features

* **obs:** product dashboard, infra limits, production deploy markers ([ae97c3f](https://github.com/naum-4ik/keepup/commit/ae97c3f0b6bbaf9bafc166cfc5d507237ee3d0dc))
* **obs:** product dashboard, infra limits, production deploy markers ([ddeac53](https://github.com/naum-4ik/keepup/commit/ddeac532b72ebbe60ad2f0833a233b2968984dba))
* **obs:** the infra dashboard as code, and no false week_overview errors ([f9e635f](https://github.com/naum-4ik/keepup/commit/f9e635f989030c068aa55d654b4fd225696b56da))
* **obs:** the infra dashboard as code, and no false week_overview errors ([6f6bf48](https://github.com/naum-4ik/keepup/commit/6f6bf48c8a7a337d810a0b9269e58995cfa9841c))


### Bug Fixes

* a child with a blank name gets a clean invalid_name error ([463754f](https://github.com/naum-4ik/keepup/commit/463754ff18a310685b53d680b7bc9d385bb6d3ce))
* a decided approval reads its outcome in the Inbox and counts as read ([0cd78f8](https://github.com/naum-4ik/keepup/commit/0cd78f8c5fe74fc9ddfadcbdc1dff6e8569ff625))
* **a11y:** the member options control is a button with aria-expanded ([14846b9](https://github.com/naum-4ik/keepup/commit/14846b91702a9b6250ca660f8948a1b21bb2593b))
* **db:** Export my data lists the habits of the person's groups ([9f6b35b](https://github.com/naum-4ik/keepup/commit/9f6b35b6a553a6605d78c758fa3afe49f39c14f8))
* demo Recaps show the seeded weeks, and a public robots.txt ([c096800](https://github.com/naum-4ik/keepup/commit/c096800ebcea5aaeac8b1ea4a56512edd5252143))
* demo recaps show the seeded weeks; demo seed dated at p_now ([fbc0c2d](https://github.com/naum-4ik/keepup/commit/fbc0c2d88b02ae6970538ad1d94edd613b9be0d8))
* findings from the production test — export, name suggestion, decided approvals, member menu ([9a70d8e](https://github.com/naum-4ik/keepup/commit/9a70d8ec24963efd24cb498dfd22b01420cee70d))
* kid cards — a big empty circle and readable count dots ([0f84e74](https://github.com/naum-4ik/keepup/commit/0f84e7477fc654daf3fc2f5c6a1f738d63ad9500))
* kid cards — a big empty circle and readable count dots ([8f66fd2](https://github.com/naum-4ik/keepup/commit/8f66fd2aabc6060ad8f0196146f0211aa721d008))
* robots.txt is public and keeps crawlers to the public pages ([8a1fd46](https://github.com/naum-4ik/keepup/commit/8a1fd46f3cc0f0c463cba3493a96abcb7a553132))
* smaller rough edges in Settings, sign-in and the demo ([337c298](https://github.com/naum-4ik/keepup/commit/337c2989b6ee79b9c89ac4728a5cd97fee9b9292))
* smaller rough edges in Settings, sign-in and the demo ([c161f03](https://github.com/naum-4ik/keepup/commit/c161f031d4e47b0f70caf93df25583da3edd8e25))
* the onboarding name suggestion drops an email's +tag ([4a7d47e](https://github.com/naum-4ik/keepup/commit/4a7d47ec2dbc383777e95d32ff580d3cbd2f155f))

## [1.1.1](https://github.com/naum-4ik/keepup/compare/v1.1.0...v1.1.1) (2026-10-08)


### Bug Fixes

* share cards point to keepuphabits, not the old address ([68b448d](https://github.com/naum-4ik/keepup/commit/68b448dde810d4dc870daed24d0b8009fa89fb4c))
* share cards point to keepuphabits, not the old address; README for v1.1 ([b19583f](https://github.com/naum-4ik/keepup/commit/b19583f9520c693ad14ae90a4eff61ebbe429246))

## [1.1.0](https://github.com/naum-4ik/keepup/compare/v1.0.0...v1.1.0) (2026-10-08)


### Features

* tell people Keepup moved, how to install it, and a README for v1.0.0 ([#185](https://github.com/naum-4ik/keepup/issues/185)) ([862ea6e](https://github.com/naum-4ik/keepup/commit/862ea6ed3cd93ec1dccc9d8cedea25f884c80d14))

## [1.0.0](https://github.com/naum-4ik/keepup/compare/v0.6.1...v1.0.0) (2026-10-08)


### Features

* **db:** demo mode — a seeded demo account, kept apart, deleted after 24 hours ([#159](https://github.com/naum-4ik/keepup/issues/159)) ([9ab600d](https://github.com/naum-4ik/keepup/commit/9ab600d098cf486b18bfe91e6a3d876074da7515))
* export my data and delete account ([#156](https://github.com/naum-4ik/keepup/issues/156)) ([8a7ffc7](https://github.com/naum-4ik/keepup/commit/8a7ffc7f96d6b8a0ac5e8120acc2a65121fcc86c))
* **obs:** check-in events in Grafana (Loki), linked to their traces ([#161](https://github.com/naum-4ik/keepup/issues/161)) ([c5b3c00](https://github.com/naum-4ik/keepup/commit/c5b3c00fcb0907defab66f473665442d8fe61f71))
* **obs:** every server error is an ERROR event in Grafana, and its trace turns red ([#165](https://github.com/naum-4ik/keepup/issues/165)) ([30e3f45](https://github.com/naum-4ik/keepup/commit/30e3f45524db98d8c734919fba21215581e7ace4))
* **obs:** product events for every action in the catalogue ([#167](https://github.com/naum-4ik/keepup/issues/167)) ([cbb19b7](https://github.com/naum-4ik/keepup/commit/cbb19b7ccf717222e7d3dff63e1b4ae3686decbb))
* **obs:** server traces to Grafana Cloud, with user and habit, secrets redacted ([#157](https://github.com/naum-4ik/keepup/issues/157)) ([5d169a6](https://github.com/naum-4ik/keepup/commit/5d169a64bea05fc67280527d57304d40da20bfde))
* **obs:** the browser reports to Grafana Faro: screens, JS errors, Web Vitals ([#171](https://github.com/naum-4ik/keepup/issues/171)) ([8b4faa0](https://github.com/naum-4ik/keepup/commit/8b4faa0daad4264b1e42d3f36c33244f779eaf00))
* one-screen landing: Get started, Sign in, and a Try the demo link ([#162](https://github.com/naum-4ik/keepup/issues/162)) ([9868d04](https://github.com/naum-4ik/keepup/commit/9868d0499dc848588116aff7d20433d8e18ce1b3))
* privacy policy page ([#169](https://github.com/naum-4ik/keepup/issues/169)) ([5734beb](https://github.com/naum-4ik/keepup/commit/5734bebb9d39d94fe8e5851873dbb597a960f2d5))
* reset a forgotten password by email, and email confirmation ready ([#163](https://github.com/naum-4ik/keepup/issues/163)) ([755a47a](https://github.com/naum-4ik/keepup/commit/755a47ae4582da43b2df03e9b54aa945ecce6a1c))
* try the demo, and the demo banner ([#160](https://github.com/naum-4ik/keepup/issues/160)) ([1dd8227](https://github.com/naum-4ik/keepup/commit/1dd822749fa7a539e2ad4bf671a7ef1177f04232))


### Bug Fixes

* a session for a deleted account signs out instead of erroring ([#180](https://github.com/naum-4ik/keepup/issues/180)) ([b3a1ff2](https://github.com/naum-4ik/keepup/commit/b3a1ff275beb086c90f17b7d178b903332c3b976))
* a sign-in that failed at Google doesn't blame the link ([#179](https://github.com/naum-4ik/keepup/issues/179)) ([65c45ed](https://github.com/naum-4ik/keepup/commit/65c45ed697522967dc2d8b3602ca081ff9a62e38))
* archive any habit, not only ones with check-ins ([#168](https://github.com/naum-4ik/keepup/issues/168)) ([a05a632](https://github.com/naum-4ik/keepup/commit/a05a632e2b3936e86b704fa294219a37164fe5fa))
* delete account and demo cleanup also remove the sign-in history ([#170](https://github.com/naum-4ik/keepup/issues/170)) ([7e84ece](https://github.com/naum-4ik/keepup/commit/7e84ece23be85ff6d8eb8e1a3fbd6b8dd8c6cedb))
* Forgot password? sends the reset email at once ([#166](https://github.com/naum-4ik/keepup/issues/166)) ([2162207](https://github.com/naum-4ik/keepup/commit/21622079ab8616a6184cc15ea78f85ed5c509571))
* **obs:** span names by kind of call, not ids (span metrics cardinality) ([#177](https://github.com/naum-4ik/keepup/issues/177)) ([40b22eb](https://github.com/naum-4ik/keepup/commit/40b22eb5f603f8316d13964169622728d0b841d7))
* the garden picture scrolls under the tab bar, not over it ([#154](https://github.com/naum-4ik/keepup/issues/154)) ([56287d6](https://github.com/naum-4ik/keepup/commit/56287d6e6f4a33c307c656434502f67c53161515))

## [0.6.1](https://github.com/naum-4ik/keepup/compare/v0.6.0...v0.6.1) (2026-10-07)


### Bug Fixes

* post-M5 follow-ups — reset my data, faster finalize, offline and Progress fixes ([#151](https://github.com/naum-4ik/keepup/issues/151)) ([dffe8d0](https://github.com/naum-4ik/keepup/commit/dffe8d02172050ac52dfea1b00f4b3a327707c39))

## [0.6.0](https://github.com/naum-4ik/keepup/compare/v0.5.0...v0.6.0) (2026-10-06)


### Features

* a big reveal on every done tap in the kid view ([#126](https://github.com/naum-4ik/keepup/issues/126)) ([44ea9e2](https://github.com/naum-4ik/keepup/commit/44ea9e2445c918ab207a133f945e46f10b2a9ace))
* achievements, the level-up and badge moment, Celebrations setting (M5 PR 9) ([#140](https://github.com/naum-4ik/keepup/issues/140)) ([e1d67bd](https://github.com/naum-4ik/keepup/commit/e1d67bd65f284be8da63e696dc25599a7e8744a9))
* an XP ring around your avatar in the Profile tab ([#135](https://github.com/naum-4ik/keepup/issues/135)) ([05c9a3b](https://github.com/naum-4ik/keepup/commit/05c9a3b9d5518d19d0edd4f8247b4f1ade980550))
* **db:** badges (M5 PR 8) ([#139](https://github.com/naum-4ik/keepup/issues/139)) ([3914a13](https://github.com/naum-4ik/keepup/commit/3914a13e1cd382dd67dc676c9bff5020a5645361))
* **db:** rest days (M5 PR 10) ([#141](https://github.com/naum-4ik/keepup/issues/141)) ([6d953c1](https://github.com/naum-4ik/keepup/commit/6d953c1309997796272bbdf01b526ee2a7248275))
* **db:** streak milestones (M5 PR 7) ([#136](https://github.com/naum-4ik/keepup/issues/136)) ([5e1dd4b](https://github.com/naum-4ik/keepup/commit/5e1dd4b7f9426de5e0bd28e92516d20b2585ac97))
* **db:** weekly and monthly recaps (M5 PR 11) ([#143](https://github.com/naum-4ik/keepup/issues/143)) ([cdded00](https://github.com/naum-4ik/keepup/commit/cdded00f713d3b7cde3a975efb4a7830c2252c75))
* **db:** XP ledger and levels (M5 PR 2) ([#129](https://github.com/naum-4ik/keepup/issues/129)) ([d1c2989](https://github.com/naum-4ik/keepup/commit/d1c2989f240106fc5c2645148b3e4e04346e616f))
* link previews when Keepup is shared ([#147](https://github.com/naum-4ik/keepup/issues/147)) ([80504bb](https://github.com/naum-4ik/keepup/commit/80504bb7e354c68356d1e641ecb91290268003ce))
* M5 copy, push text and labels (M5 PR 1) ([#127](https://github.com/naum-4ik/keepup/issues/127)) ([e11255f](https://github.com/naum-4ik/keepup/commit/e11255fa78db86af8ea40815a6e198be28af309a))
* Progress → Recaps (M5 PR 12) ([#144](https://github.com/naum-4ik/keepup/issues/144)) ([d13bef8](https://github.com/naum-4ik/keepup/commit/d13bef86269e50b7747e9713b4cc97d3a992f42c))
* streak-scaled XP, clearer achievements, self-hosted font, deploy retry ([#145](https://github.com/naum-4ik/keepup/issues/145)) ([71a2b97](https://github.com/naum-4ik/keepup/commit/71a2b97d145718d736eff3ce67b9121859b98a5f))
* XP on the check-in, level on the avatar and on Profile (M5 PR 6) ([#134](https://github.com/naum-4ik/keepup/issues/134)) ([68f7fdc](https://github.com/naum-4ik/keepup/commit/68f7fdc2ef60a364b549a5ac48156d14628422d7))


### Bug Fixes

* a parent can open, archive and delete a child's habit ([#128](https://github.com/naum-4ik/keepup/issues/128)) ([ffc8fa4](https://github.com/naum-4ik/keepup/commit/ffc8fa419c1bb2cf64bdcc44c7d10ec14d285bcb))
* **db:** avatars for invites and the Inbox, kid export and goals, invite race (M5 PR 3) ([#130](https://github.com/naum-4ik/keepup/issues/130)) ([f1f7e0b](https://github.com/naum-4ik/keepup/commit/f1f7e0bba1667fc467960e718099c62e5d836673))
* **db:** Progress → Calendar counts group habits you take part in ([#133](https://github.com/naum-4ik/keepup/issues/133)) ([a04fba9](https://github.com/naum-4ik/keepup/commit/a04fba94b1e87d7aa4f0d8a94d7fd12854bd196b))
* M4 follow-ups, and no group cards on Today ([#123](https://github.com/naum-4ik/keepup/issues/123)) ([206394f](https://github.com/naum-4ik/keepup/commit/206394f07c93f9b7ee31e76358405ae830cc5d7c))
* M5 final review — streak badges on late upgrades, own-part badges, quiet late notes ([#148](https://github.com/naum-4ik/keepup/issues/148)) ([68b0244](https://github.com/naum-4ik/keepup/commit/68b0244aef75eee2dca83ecc2f6ae52bf365366f))
* polish Inbox, Profile, navigation and CI; This week counts group habits (M5 PR 5) ([#132](https://github.com/naum-4ik/keepup/issues/132)) ([bb79e48](https://github.com/naum-4ik/keepup/commit/bb79e48e1a01fa9909b929f2e98ca4e1beb9c8cc))
* polish Today, the habit page, forms and groups (M5 PR 4) ([#131](https://github.com/naum-4ik/keepup/issues/131)) ([da0b7e0](https://github.com/naum-4ik/keepup/commit/da0b7e0c753d9ea43dfa15bf952061750706b5a8))
* the kid view's big reveal on every star ([#138](https://github.com/naum-4ik/keepup/issues/138)) ([40fab4b](https://github.com/naum-4ik/keepup/commit/40fab4bb0656356c5c45696aa7e6fac227fa165f))

## [0.5.0](https://github.com/naum-4ik/keepup/compare/v0.4.0...v0.5.0) (2026-10-04)


### Features

* 7-day habits, and M3 polish from the reviews ([#102](https://github.com/naum-4ik/keepup/issues/102)) ([359884a](https://github.com/naum-4ik/keepup/commit/359884ab214d3060f437e52c01e9d409bc6b0799))
* **db:** notification prefs, mute and push subscriptions ([#107](https://github.com/naum-4ik/keepup/issues/107)) ([935d1c0](https://github.com/naum-4ik/keepup/commit/935d1c05b79275f1be2286aaa69edfb448e0168a))
* **db:** offline-safe check-ins (M4 PR 9) ([#117](https://github.com/naum-4ik/keepup/issues/117)) ([dbe664a](https://github.com/naum-4ik/keepup/commit/dbe664a7203f5cc61cbe2abe9bca2d55f5ce142d))
* **db:** reminder scheduler (M4 PR 6) ([#113](https://github.com/naum-4ik/keepup/issues/113)) ([4ea261f](https://github.com/naum-4ik/keepup/commit/4ea261fc49cbd5d178e7dfa699ee9cab1691f2bc))
* every tap grows the kid scene, with sounds, wiggles and a dance ([#116](https://github.com/naum-4ik/keepup/issues/116)) ([98c7396](https://github.com/naum-4ik/keepup/commit/98c7396ad10c520f8a2422c3d4241a60bae90089))
* group pushes and delivery per category (M4 PR 8) ([#115](https://github.com/naum-4ik/keepup/issues/115)) ([a768077](https://github.com/naum-4ik/keepup/commit/a768077b928660eefa04b4fee3add89cd909c148))
* installable app (manifest) ([#106](https://github.com/naum-4ik/keepup/issues/106)) ([5f3a29f](https://github.com/naum-4ik/keepup/commit/5f3a29f0dca571ea9c84b56f3ecebcda9d292231))
* kid view keeps the picture in sight, done habits sink, calm idle motion ([#118](https://github.com/naum-4ik/keepup/issues/118)) ([de07399](https://github.com/naum-4ik/keepup/commit/de0739991b0ddf0d890508726b7359333e656c60))
* notification copy for pushes (M4 PR 3) ([#108](https://github.com/naum-4ik/keepup/issues/108)) ([da6fb81](https://github.com/naum-4ik/keepup/commit/da6fb81f8e6810d6c4875b62cb91fa90a393644d))
* offline check-ins (M4 PR 10) ([#119](https://github.com/naum-4ik/keepup/issues/119)) ([bbabbfe](https://github.com/naum-4ik/keepup/commit/bbabbfed4c1b66c2f486e26a45e79c3c02edb5a9))
* remind me at… (M4 PR 7) ([#114](https://github.com/naum-4ik/keepup/issues/114)) ([ea810e2](https://github.com/naum-4ik/keepup/commit/ea810e23c40b8e24a94c88099c9417dfcd91215c))
* service worker and push delivery (M4 PR 4) ([#110](https://github.com/naum-4ik/keepup/issues/110)) ([9034ebb](https://github.com/naum-4ik/keepup/commit/9034ebbf59dea4c43ff1f80d40ae6734be12a863))
* turn on reminders flow (M4 PR 5) ([#112](https://github.com/naum-4ik/keepup/issues/112)) ([f116f04](https://github.com/naum-4ik/keepup/commit/f116f04dfbc5f3ed4896c190385cb92df73b64a7))


### Bug Fixes

* **db:** guard push subscription saves (M4 PR 4a) ([#109](https://github.com/naum-4ik/keepup/issues/109)) ([4460ddc](https://github.com/naum-4ik/keepup/commit/4460ddc366f6b4747a0c29de47a043f7764be262))
* **db:** hardening from the M3 reviews; Open the group for every member ([#103](https://github.com/naum-4ik/keepup/issues/103)) ([42cd5c0](https://github.com/naum-4ik/keepup/commit/42cd5c053d5e2dc78cd4455ca7c74476b2d9034f))
* last M3 gaps from the spec audit, and two flaky tests ([#104](https://github.com/naum-4ik/keepup/issues/104)) ([1fe80f0](https://github.com/naum-4ik/keepup/commit/1fe80f0dae66142d64322a4e714dcbd688239269))
* M4 final review — quiet kid moments, honest streak-back, safe sign-out ([#121](https://github.com/naum-4ik/keepup/issues/121)) ([555e7ff](https://github.com/naum-4ik/keepup/commit/555e7ff2301a9cdee12c39e0ace82b51ac7a371a))

## [0.4.0](https://github.com/naum-4ik/keepup/compare/v0.3.0...v0.4.0) (2026-10-01)


### Features

* a fuller kid scene and a clear tap target ([#96](https://github.com/naum-4ik/keepup/issues/96)) ([eb68251](https://github.com/naum-4ik/keepup/commit/eb6825123afe54fb6bc5850167e9f14dd67a0d12))
* a shorter Add a child form ([#95](https://github.com/naum-4ik/keepup/issues/95)) ([1a8b571](https://github.com/naum-4ik/keepup/commit/1a8b57135fc3edcf1b3f83e17335b2d222de3694))
* a Today card that shows how the day is going ([#76](https://github.com/naum-4ik/keepup/issues/76)) ([d0559f6](https://github.com/naum-4ik/keepup/commit/d0559f682283389c6646827442e8458580be51c9))
* app icon and Create account on the landing page ([#64](https://github.com/naum-4ik/keepup/issues/64)) ([cfb21a3](https://github.com/naum-4ik/keepup/commit/cfb21a3a39ec4e36f2d05ede545663c541f18c0a))
* bigger header wordmark, and a README refresh with new screenshots ([#92](https://github.com/naum-4ik/keepup/issues/92)) ([e10a6f3](https://github.com/naum-4ik/keepup/commit/e10a6f368c050525af424d102d2f6d36f823aecb))
* colour tokens and warmer dark mode ([#97](https://github.com/naum-4ik/keepup/issues/97)) ([d0cb142](https://github.com/naum-4ik/keepup/commit/d0cb1422e4b9de6e34536c2a37ab426936c56c33))
* **db:** calendar_cells for the Progress calendar ([#88](https://github.com/naum-4ik/keepup/issues/88)) ([a6749f0](https://github.com/naum-4ik/keepup/commit/a6749f07ce46855a3622745634d2cdcfd3545323))
* **db:** child profiles, kid habits and treat goals ([#60](https://github.com/naum-4ik/keepup/issues/60)) ([3674528](https://github.com/naum-4ik/keepup/commit/3674528808b2333f05873993daf4af821e974dc1))
* **db:** group avatars ([#71](https://github.com/naum-4ik/keepup/issues/71)) ([923591e](https://github.com/naum-4ik/keepup/commit/923591e8ef7012e624ed3e4ca45ee6d81f6ca736))
* **db:** group habits, approvals and member pauses ([#57](https://github.com/naum-4ik/keepup/issues/57)) ([fa7b4ba](https://github.com/naum-4ik/keepup/commit/fa7b4ba3f9544635d115c1cb0f964f33be1b8759))
* **db:** groups, members and invite links ([#54](https://github.com/naum-4ik/keepup/issues/54)) ([a82bc3a](https://github.com/naum-4ik/keepup/commit/a82bc3ad806cc6a818c96dd9397eb345ff26c248))
* **db:** habits with an end date ([#82](https://github.com/naum-4ik/keepup/issues/82)) ([1c83276](https://github.com/naum-4ik/keepup/commit/1c83276d6578ec6bc2bf8c26f311e0d953014441))
* **db:** in-app feed, nudges and cheers ([#62](https://github.com/naum-4ik/keepup/issues/62)) ([e81fcf1](https://github.com/naum-4ik/keepup/commit/e81fcf112aab3e09d4da31e545fc6176baceeed5))
* **db:** kid themes ([#80](https://github.com/naum-4ik/keepup/issues/80)) ([b6aa8a1](https://github.com/naum-4ik/keepup/commit/b6aa8a1ed7d0c3a1b04a56c72624969a1e082b15))
* **db:** kids' stars and garden, group celebrations ([#63](https://github.com/naum-4ik/keepup/issues/63)) ([f276902](https://github.com/naum-4ik/keepup/commit/f276902afaaa1c3988f30f208120acf8a6953d79))
* **db:** reset a child's profile ([#78](https://github.com/naum-4ik/keepup/issues/78)) ([90977b2](https://github.com/naum-4ik/keepup/commit/90977b21554fad7a879be75e1f037a820ab48f0f))
* **db:** restore_habit for archived habits ([#93](https://github.com/naum-4ik/keepup/issues/93)) ([6c93051](https://github.com/naum-4ik/keepup/commit/6c93051b2f22c37c35240da02ccc914c71528262))
* design polish from the UI/UX review ([#90](https://github.com/naum-4ik/keepup/issues/90)) ([e604f9b](https://github.com/naum-4ik/keepup/commit/e604f9b8939e6fc3ecc89701a11c775d605d765c))
* family celebrations and gentle Today cards ([#74](https://github.com/naum-4ik/keepup/issues/74)) ([27a8d1b](https://github.com/naum-4ik/keepup/commit/27a8d1bcc3c1944ca273df2d51cf314b7ea1b880))
* friendlier time zone picker with current times and (i) hints ([#55](https://github.com/naum-4ik/keepup/issues/55)) ([53750cd](https://github.com/naum-4ik/keepup/commit/53750cdffd74af2ff62df3d014be548fab772da6))
* group avatars, and change your avatar from Profile ([#72](https://github.com/naum-4ik/keepup/issues/72)) ([399c9dd](https://github.com/naum-4ik/keepup/commit/399c9dddf3b7c035d7787de2c4857b92776df5d6))
* group habits on Today and the habit page ([#68](https://github.com/naum-4ik/keepup/issues/68)) ([2e7d2eb](https://github.com/naum-4ik/keepup/commit/2e7d2ebf407b42b0df394ba17f1d1c7120243469))
* Groups tab, invite links and avatars ([#66](https://github.com/naum-4ik/keepup/issues/66)) ([8eaccca](https://github.com/naum-4ik/keepup/commit/8eaccca42961ca277303e0b63087aee8deaa7739))
* Inbox with approvals, nudges and cheers ([#70](https://github.com/naum-4ik/keepup/issues/70)) ([856d2fa](https://github.com/naum-4ik/keepup/commit/856d2fac64850e0b7c0459caef8bd03a1e56091d))
* invite landing and invited-user onboarding ([#67](https://github.com/naum-4ik/keepup/issues/67)) ([b1a3d80](https://github.com/naum-4ik/keepup/commit/b1a3d804dbfa46c78a457423c9c4ba3f8854750d))
* kid themes, what grows in the kid view ([#81](https://github.com/naum-4ik/keepup/issues/81)) ([227c56e](https://github.com/naum-4ik/keepup/commit/227c56e8f0d90755bb1eff02dbbaa0ef6ec7ad8a))
* kids: profiles, "Me + Mary", the kid view ([#73](https://github.com/naum-4ik/keepup/issues/73)) ([905eb0e](https://github.com/naum-4ik/keepup/commit/905eb0e34473b827f1e1a5ec122062699f2db435))
* one Get started button on the landing page, full width ([#65](https://github.com/naum-4ik/keepup/issues/65)) ([4806780](https://github.com/naum-4ik/keepup/commit/480678050ce677d6a761e542c2401e4c7c9c58ef))
* pick the time zone by the time it is now ([#58](https://github.com/naum-4ik/keepup/issues/58)) ([0a9f5c2](https://github.com/naum-4ik/keepup/commit/0a9f5c200d6d657f7ece67f083f026f44f306dc9))
* Progress calendar, month by month, tap any day ([#89](https://github.com/naum-4ik/keepup/issues/89)) ([c96e874](https://github.com/naum-4ik/keepup/commit/c96e87411d8662a79d47436067ea3462b4c91613))
* reset a child's profile from the danger zone ([#83](https://github.com/naum-4ik/keepup/issues/83)) ([229b81c](https://github.com/naum-4ik/keepup/commit/229b81c4e3a524ffdbca643a447e83a44b5e106f))
* Restore an archived habit, from Progress or its page ([#98](https://github.com/naum-4ik/keepup/issues/98)) ([65a4d6f](https://github.com/naum-4ik/keepup/commit/65a4d6f5914c8b2ba04148d7983b5df9f0776994))
* say when the garden starts over, and a new-week card ([#86](https://github.com/naum-4ik/keepup/issues/86)) ([f34408c](https://github.com/naum-4ik/keepup/commit/f34408cba6c42f1a2c7c1032fbdead03ea87b659))
* set an end when creating a habit; Day 12 of 30 ([#84](https://github.com/naum-4ik/keepup/issues/84)) ([78351cc](https://github.com/naum-4ik/keepup/commit/78351cc9d8bf4e8a70bab00b3ed50fd08acc616e))
* sign up with email and password ([#61](https://github.com/naum-4ik/keepup/issues/61)) ([c141bb9](https://github.com/naum-4ik/keepup/commit/c141bb9227c12c5e9b678005c9e7df1767020bc6))
* tap a day in Progress; treat ideas; more kid habits in a dialog ([#75](https://github.com/naum-4ik/keepup/issues/75)) ([c325157](https://github.com/naum-4ik/keepup/commit/c325157b21e2d058033c0340765a5e2d10057cdf))
* the finish card, Keep going / Finish, and Finished with Start again ([#85](https://github.com/naum-4ik/keepup/issues/85)) ([6086ebc](https://github.com/naum-4ik/keepup/commit/6086ebcc04f29cdb22831fe2a10e53409ac75b3a))
* the kid view shows the next garden picture ([#77](https://github.com/naum-4ik/keepup/issues/77)) ([75f48fc](https://github.com/naum-4ik/keepup/commit/75f48fc654e6abbc0899fefbfb54a34f51de3aef))
* What's new written for people, not developers ([#94](https://github.com/naum-4ik/keepup/issues/94)) ([d8ee291](https://github.com/naum-4ik/keepup/commit/d8ee291435300d07d959d327d4ff9bd7b44cd9cd))


### Bug Fixes

* a bigger star path in the kid view, with the count written out ([#79](https://github.com/naum-4ik/keepup/issues/79)) ([8cb24ae](https://github.com/naum-4ik/keepup/commit/8cb24aed06789f555af89084f4effe67c51407a9))
* M3 final review — privacy guard, fair last period, kids and time zones ([#100](https://github.com/naum-4ik/keepup/issues/100)) ([258d7e1](https://github.com/naum-4ik/keepup/commit/258d7e1325789beb4880f55ef7cb0c73abf4fc64))
* push backups with a deploy key instead of a token ([#56](https://github.com/naum-4ik/keepup/issues/56)) ([03a5454](https://github.com/naum-4ik/keepup/commit/03a5454b52f0acafc3b68aaf4ac5fe7fb53aa331))
* QA findings (forms keep input, long names, dialog focus, …) ([#91](https://github.com/naum-4ik/keepup/issues/91)) ([4731554](https://github.com/naum-4ik/keepup/commit/4731554950fe0b67acea44c70cf7e672e94dcaf9))
* say clearly that the emoji picker's own field wants an emoji ([#51](https://github.com/naum-4ik/keepup/issues/51)) ([a6346fb](https://github.com/naum-4ik/keepup/commit/a6346fb47a38180e7494be68c8f3ae83925a94e4))
* Together habits for groups only; Brush teeth and wake up before 07:00 ([#69](https://github.com/naum-4ik/keepup/issues/69)) ([2f470bd](https://github.com/naum-4ik/keepup/commit/2f470bda95cfd2b69481fc3500d23a8ad04d7856))

## [0.3.0](https://github.com/naum-4ik/keepup/compare/v0.2.0...v0.3.0) (2026-09-29)


### Features

* check in on habits from Today ([#35](https://github.com/naum-4ik/keepup/issues/35)) ([a9b137f](https://github.com/naum-4ik/keepup/commit/a9b137fe50e317b12ff09f1940f84341c02e1acd))
* check in on habits with rules enforced in the database ([#27](https://github.com/naum-4ik/keepup/issues/27)) ([6b9ea35](https://github.com/naum-4ik/keepup/commit/6b9ea35eb32bdd2ac64840c74e10114efc643321))
* choose whether weeks start on Sunday or Monday ([#33](https://github.com/naum-4ik/keepup/issues/33)) ([84f0031](https://github.com/naum-4ik/keepup/commit/84f00317f53f1ec04faaa075faf25b70b5251737))
* create habits from templates or from scratch ([#31](https://github.com/naum-4ik/keepup/issues/31)) ([960482b](https://github.com/naum-4ik/keepup/commit/960482bda54e28c9f0282665fdb1154d88654c8c))
* finalize periods and compute streaks live ([#28](https://github.com/naum-4ik/keepup/issues/28)) ([5c2646f](https://github.com/naum-4ik/keepup/commit/5c2646fe9547ab66fa6fe800d859ef1417de50f4))
* habit page with history, undo, pause, edit and archive ([#37](https://github.com/naum-4ik/keepup/issues/37)) ([932dabb](https://github.com/naum-4ik/keepup/commit/932dabb82a19e89c53202a0cb52a98ff34c45ae9))
* habits table with start dates and owner-only access ([#25](https://github.com/naum-4ik/keepup/issues/25)) ([11ab5e5](https://github.com/naum-4ik/keepup/commit/11ab5e54b8232b521888dd7d859df91abf2a3362))
* Keepup sprout app icon ([#30](https://github.com/naum-4ik/keepup/issues/30)) ([c770886](https://github.com/naum-4ik/keepup/commit/c770886ef986479078b7aa67562aa493c561c1c4))
* new-habit menu v2: an emoji per habit, Work & money, six templates per tab ([#48](https://github.com/naum-4ik/keepup/issues/48)) ([39446d0](https://github.com/naum-4ik/keepup/commit/39446d0134e3e99aec471b96d6052d96452072d4))
* new-habit screen: category grid, shorter Popular, centered add dialog ([#34](https://github.com/naum-4ik/keepup/issues/34)) ([0808355](https://github.com/naum-4ik/keepup/commit/080835508cec4e26e14553ebe320f365ddb1973f))
* onboarding v2: about you, pick your first habits, one-time tip ([#41](https://github.com/naum-4ik/keepup/issues/41)) ([fb9ea26](https://github.com/naum-4ik/keepup/commit/fb9ea26470d6e92afbdaf49a18a0e7a5702d1b15))
* pause habits without breaking streaks ([#26](https://github.com/naum-4ik/keepup/issues/26)) ([f92a80d](https://github.com/naum-4ik/keepup/commit/f92a80d4febccadca13bea7c59100cb310068f4f))
* period math, week start and API lockdown for habits ([#24](https://github.com/naum-4ik/keepup/issues/24)) ([b641bc9](https://github.com/naum-4ik/keepup/commit/b641bc9ae1ac9b918d7641200eda8d82fa38a9a8))
* progress page and a balanced bottom nav ([#39](https://github.com/naum-4ik/keepup/issues/39)) ([ec35cb8](https://github.com/naum-4ik/keepup/commit/ec35cb832081afe0da6300e544a0ed338d3150a0))
* sign in with Face ID (passkeys) ([#42](https://github.com/naum-4ik/keepup/issues/42)) ([1ef7cc9](https://github.com/naum-4ik/keepup/commit/1ef7cc9afc8782d0bec42f0c8c092915193b3885))
* Today lists habits to do first, then Done, then Later ([#36](https://github.com/naum-4ik/keepup/issues/36)) ([2064e02](https://github.com/naum-4ik/keepup/commit/2064e0268cfb0fc7db988d30dd2b23d3f72a8924))
* use the app icon's sprout in the Today empty state ([#32](https://github.com/naum-4ik/keepup/issues/32)) ([b59bb63](https://github.com/naum-4ik/keepup/commit/b59bb63c246a3c097b2b394a4613aaf56bd2bd80))
* UX polish: hover states, habit page order, clear save feedback ([#38](https://github.com/naum-4ik/keepup/issues/38)) ([65f9b38](https://github.com/naum-4ik/keepup/commit/65f9b3898443f3b564be31a64ec39208ebb249e3))
* weekly overview on Today and Progress ([#45](https://github.com/naum-4ik/keepup/issues/45)) ([e82fba1](https://github.com/naum-4ik/keepup/commit/e82fba1a2c16c1adbba7dca7ebd13743df204bc4))


### Bug Fixes

* drop the extra sign-in heading ([#22](https://github.com/naum-4ik/keepup/issues/22)) ([c95e273](https://github.com/naum-4ik/keepup/commit/c95e273dcfed4800a4cad07651e7f1105e748a56))
* pauses block only paused days; more security tests; UX fixes ([#43](https://github.com/naum-4ik/keepup/issues/43)) ([a6925e4](https://github.com/naum-4ik/keepup/commit/a6925e4091a45277ff42013156e798c51f19277c))
* weekly overview shows from day one and counts today's habits ([#47](https://github.com/naum-4ik/keepup/issues/47)) ([ed48f8e](https://github.com/naum-4ik/keepup/commit/ed48f8eca150f59026f9f298aa1f090f75b01daf))


### Reverts

* remove Face ID sign-in (passkeys) ([#44](https://github.com/naum-4ik/keepup/issues/44)) ([50db567](https://github.com/naum-4ik/keepup/commit/50db567097dbb8ae3acd5a1c6c7a39b97852a4b4))

## [0.2.0](https://github.com/naum-4ik/keepup/compare/v0.1.0...v0.2.0) (2026-09-29)


### Features

* center and polish the sign-in page ([#21](https://github.com/naum-4ik/keepup/issues/21)) ([6e9fe82](https://github.com/naum-4ik/keepup/commit/6e9fe82e520e6f5e10cc96140ba299de88218854))
* move sign out to the profile page ([#19](https://github.com/naum-4ik/keepup/issues/19)) ([803a57e](https://github.com/naum-4ik/keepup/commit/803a57e208b2e85968e61554f2770f9ffca71c6f))
* show the Google logo on the Google sign-in button ([#20](https://github.com/naum-4ik/keepup/issues/20)) ([0b33e87](https://github.com/naum-4ik/keepup/commit/0b33e87f6690d83ff5da1cb795e2e06b1d849168))


### Bug Fixes

* harden the M1 foundation before habits ([#17](https://github.com/naum-4ik/keepup/issues/17)) ([c132503](https://github.com/naum-4ik/keepup/commit/c1325032ac56f24adf7e3c7e35fa39ddd91a5b66))

## 0.1.0 (2026-09-28)


### Features

* add profiles table with signup trigger and RLS ([#4](https://github.com/naum-4ik/keepup/issues/4)) ([4254992](https://github.com/naum-4ik/keepup/commit/4254992a71546c533644a127c6ce74a440c72c02))
* apply the soft, warm Keepup design ([#8](https://github.com/naum-4ik/keepup/issues/8)) ([236f6c6](https://github.com/naum-4ik/keepup/commit/236f6c65aefeb5c2e90b2adc3c6f6e22c4d5dade))
* onboarding, profile settings and app shell ([#6](https://github.com/naum-4ik/keepup/issues/6)) ([9b77b96](https://github.com/naum-4ik/keepup/commit/9b77b96eabb3bbace2fe7a7072d53ede3a3ba16a))
* sign in with magic link or Google ([#5](https://github.com/naum-4ik/keepup/issues/5)) ([ec760ea](https://github.com/naum-4ik/keepup/commit/ec760eab9309ae95e78902a55652ca2d35f8f550))


### Bug Fixes

* explain failed sign-in links instead of dropping users on the home page ([#16](https://github.com/naum-4ik/keepup/issues/16)) ([f75ea84](https://github.com/naum-4ik/keepup/commit/f75ea84c9ff7ac8d87a5ae75c9ed31e37ae29255))
