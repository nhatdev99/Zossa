# Rosala: Upgrade Plan

Last updated: 2026-11-14

Goal: ship a polished, fully offline shift tracking and salary app for Vietnamese workers (iOS first), with accurate 2026 tax and insurance estimates, and a path to the App Store.

Effort scale: **S** = under half a day, **M** = 1 to 2 days, **L** = several days.
Status: `[ ]` todo, `[~]` in progress, `[x]` done.

---

## Current state (baseline)

Done in earlier work:

- [x] Dynamic shift types (custom name, rates, overtime, allowance, night, off/holiday), with migration from the old 4 fixed shifts
- [x] Fully offline: Firebase, login and cloud sync removed
- [x] Splash screen and first-run setup wizard (4 steps)
- [x] Offline backup and restore (JSON text, no cloud)
- [x] Vietnamese PIT (2026 brackets) and BHXH/BHYT/BHTN, dependants, night and overtime premium exemption, 18 unit tests
- [x] Tax and insurance settings screen, salary breakdown
- [x] Year comparison charts (View based), CSV export by month or year, local reminders
- [x] Rosala theme palette as default
- [x] Package.json for Expo SDK 57, README, AGENTS.md

Known gaps:

- UI was never run on a device (no network in the build environment)
- Package versions for SDK 57 are partly estimated
- Screen layouts for Attendance, Logs and Salary still follow the old design, only recolored
- Several small inconsistencies between first-run setup and the salary settings screen (see Phase 1)

---

## Phase 1: Fixes before release

Target: 3 to 4 days. Do these first, they block everything else.

| ID | Task | Effort | Acceptance criteria |
| --- | --- | --- | --- |
| 1.1 | **Device verification.** Run on an iPhone: fresh setup, open with legacy data, attendance, CSV month and year, backup and restore, reminders (set a time a few minutes ahead). | M | Checklist in `docs/manual-test.md` fully ticked, bugs filed |
| 1.2 | **Overtime rate follows base rate** in manual mode. Editing the hourly rate updates the overtime rate via the multiplier unless the user edited it by hand. | S | Unit test on helper, behavior visible in settings screen |
| 1.3 | **Show multipliers (x1,3 night, x2 off/holiday)** in monthly mode instead of scaled salaries. Migrate configs already created by setup. | S | Net pay unchanged for existing configs (test), UI shows factor |
| 1.4 | **Full reset** also clears reminder settings, scheduled notifications and last-backup marker. | S | Test with mocks, README erasure text updated |
| 1.5 | **Setup completeness.** Add allowance to the setup shift step. Add "Run setup again" in Profile, prefilled, keeping attendance. | S | Attendance preserved after re-run |
| 1.6 | **Lock Expo SDK.** Run `npx expo install --fix` and `npx expo-doctor`, pin versions, check Expo Go support for SDK 57 (consider SDK 58). | M | Doctor clean, app starts on device |
| 1.7 | **Normalize UI strings** to correct Vietnamese with diacritics in older screens. | S | No unaccented UI text left |
| 1.8 | **Fill README placeholders** (security email, maintainer, license) and add `LICENSE`. | S | Placeholders replaced with real values |

## Phase 2: UI and usability

Target: 4 to 6 days.

| ID | Task | Effort | Acceptance criteria |
| --- | --- | --- | --- |
| 2.1 | **Rebuild Attendance, Logs and Salary screens** to match the design canvas. Design the missing screens first (Logs, shift settings, backup). | L | Side by side with canvas, behavior unchanged |
| 2.2 | **Be Vietnam Pro font** with system fallback. | S | Font loads, no layout shift on splash |
| 2.3 | **Edit and delete attendance entries**, daily notes, search in Logs. | M | CRUD works, salary updates immediately |
| 2.4 | **Smart reminders**: skip check-in reminder when already checked in today. | S | Reschedules on check in and check out |

## Phase 3: Deeper payroll logic

Target: 5 to 8 days. Every legal rule needs a cited source and tests.

| ID | Task | Effort | Acceptance criteria |
| --- | --- | --- | --- |
| 3.1 | **Exempt allowances** (for example meal allowance up to the legal limit). | M | Per-shift flag and amount, tests with source |
| 3.2 | **Annual overtime cap tracking** in addition to the monthly cap. | M | Cap value from current labor law, tests |
| 3.3 | **Contracts under 3 months** (10% withholding) and non-resident mode. | M | Mode switch in tax settings, tests |
| 3.4 | **Multiple pay profiles** (several jobs or family members). | L | Migration from single config to profiles tested before UI work |
| 3.5 | **Legal review routine**: `docs/legal-review.md` with a checklist and last review date, repeated each year or when a new decree appears. | S | Document exists, first review dated |

## Phase 4: Quality and release

Target: 5 to 7 days.

| ID | Task | Effort | Acceptance criteria |
| --- | --- | --- | --- |
| 4.1 | **Tests**: backup and restore (valid, invalid, legacy), reminder scheduling (mocked), screen smoke tests. | M | `npm test` green, coverage on services |
| 4.2 | **Accessibility pass**: labels and roles, large text, contrast in light and dark. | M | VoiceOver walkthrough of main flows |
| 4.3 | **Export payslip as image or PDF** using on-device libraries only. | M | Share sheet opens with a readable file |
| 4.4 | **App Store preparation**: Apple Developer account, screenshots, `PRIVACY.md`, description. | M | Store listing ready, no secrets in repo |
| 4.5 | **English UI** with a small i18n layer. | M | All strings extracted, Vietnamese stays default |

---

## Suggested order and timeline

| Week | Focus |
| --- | --- |
| 1 | Phase 1 (all tasks), start 2.2 |
| 2 | Phase 2 (2.1, 2.3, 2.4) |
| 3 | Phase 3 (3.1, 3.2, 3.5), then 4.1 |
| 4 | 4.2, 4.3, then 4.4 for release |
| Later | 3.3, 3.4, 4.5 |

If you plan multiple profiles (3.4) or English (4.5), do them early, before many users have stored data, because both change data structures or every string.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tax and insurance rules change | Wrong estimates | Task 3.5 review routine, rules selected by month, source cited in tests and commits |
| Sources disagree on overtime and night pay exemption | Over or under estimated tax | Keep behind the `exemptPremium` switch, verify against the official decree text before release |
| Expo SDK version drift (SDK 58 is out) | Build or Expo Go mismatch | Task 1.6, decide the SDK before Phase 2 |
| Data stored only on device | Data lost with the phone | Backup reminders and clear backup screen, consider periodic "export a backup" prompt |
| Persisted data shape changes | Corrupted user data | Versioned migrations with tests, never rename storage keys |
| UI never tested on device | Hidden crashes | Task 1.1 first, manual checklist |
| Apple Developer account cost (99 USD per year) | Blocks App Store release | Validate with TestFlight or sideload users first, buy the account when ready |

## Definition of done (per task)

- `npm test` and `npx tsc --noEmit` pass
- No new network access or tracking, privacy docs still true
- Persisted data unchanged or migrated and tested
- No legal constant changed without a cited source
- README, AGENTS.md and this plan updated
- Report states what was verified and what was not
