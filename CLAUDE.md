# AGENTS.md

Instructions for AI coding agents working on **Rosala**: an offline shift time tracker and salary calculator (Expo / React Native, TypeScript). Read this file fully before changing anything. It is the source of truth for rules, commands, architecture and the upgrade backlog.

If this file and the code disagree, trust the code, then fix this file in the same change.

---

## 1. Hard rules (never break)

1. **Stay offline.** No network requests, no accounts, no analytics, no crash reporters, no ads, no remote config, no cloud sync. Do not add Firebase or any SDK that phones home. If a task seems to need it, stop and ask a human.
2. **No personal data leaves the device** except through a file the user explicitly exports or shares (CSV, JSON backup).
3. **Never edit legal constants from memory.** Tax, insurance, deductions and caps live in `src/utils/salaryCalculator.ts`. Change them only after verifying against a current official or reputable source (see section 6), and cite the source in the commit message and in the test.
4. **Never weaken a test to make it pass.** If a test fails, fix the code, or prove with a source that the expectation is wrong.
5. **Never break persisted data.** Users have real data in AsyncStorage. Any change to a persisted shape needs a versioned `migrate` and a test (section 5).
6. **Do not add dependencies without need.** Prefer plain React Native views and existing libraries. Any new dependency must be Expo SDK compatible (`npx expo install <pkg>`), maintained, and justified in the commit message.
7. **Keep the privacy statement true.** README section "Privacy and data protection" and the in-app Policy screen must match the real behaviour. Update them when behaviour changes.
8. **Do not run destructive git commands** (force push, history rewrite) and do not delete user data files.

When unsure, make the smallest safe change and leave a `TODO(agent): question` note instead of guessing.

## 2. Commands

```bash
npm install --legacy-peer-deps      # install
npx expo install --fix              # align Expo packages to the SDK
npx expo start                      # run the app
npm test                            # unit tests (ts-jest, node environment)
npx tsc --noEmit                    # type check (run after npm install)
npx expo-doctor                     # project health
```

A change is not done until `npm test` and `npx tsc --noEmit` both pass.

Tests cover pure logic only (`src/utils/__tests__`). There are no screen tests yet. If you cannot run the app (no device, no network), say so in your report and do not claim UI behaviour was verified.

## 3. Architecture

```
src/
  components/   charts.tsx (BarChart, GroupedBars, StackedBar: plain View based, no chart lib)
  hooks/        useAppTheme
  navigation/   AppNavigator.tsx
  screens/      one file per screen
  services/     dataBackup.ts, csvExport.ts, reminders.ts
  store/        useSalaryStore, useProfileStore, useThemeStore, useReminderStore
  utils/        salaryCalculator.ts, csv.ts, theme.ts, __tests__/
```

**Boot flow** (`AppNavigator.tsx`): Splash until all persisted stores are hydrated (minimum about 900 ms) -> `SetupScreen` if `profile.onboarded` is false -> `MainTabs`. Reminders are re-applied on every launch after hydration.

**Navigation**: bottom tabs (Attendance, Logs, Salary, Profile), each with its own stack. `TaxSettings` and `Export` are registered in both the Salary and Profile stacks. `Notifications` is registered in the Attendance and Profile stacks. Screen names must be unique per navigator.

**State** (Zustand + `persist` + AsyncStorage):

| Store | Storage key | Version | Holds |
| --- | --- | --- | --- |
| useSalaryStore | `salary-storage` | 1 | `config`, `attendance` |
| useProfileStore | `profile-storage` | 1 | `profile`, `onboarded` |
| useThemeStore | `theme-storage` | n/a | theme mode and palette (default `rosala`) |
| useReminderStore | `reminder-storage` | n/a | reminder settings |

**Config shape** (`SalaryConfig`): `shifts: Record<id, ShiftConfig>`, `shiftOrder: string[]`, `taxRate` (flat percent), optional `tax: TaxSettings`. Shifts are user defined; ids are strings (legacy ids: `day`, `night`, `offDay`, `offNight`). A missing shift must never crash: use `getShift`, `getShiftName`, `getShiftColor` (they fall back safely; a deleted shift is worth 0 and shows "Ca đã xoá").

**Calculation entry points** (all in `salaryCalculator.ts`):
`resolveShiftRates`, `calculateDailySalary`, `calculateMonthlySalary`, `normalizeConfig`, `getTaxSettings`, `getLegalParams`, `calcProgressiveTax`. Screens must call these and never re-implement formulas.

**Backup / reset**: `services/dataBackup.ts` (`createBackupJson`, `restoreFromBackupJson`, `resetAllData`). **CSV**: `utils/csv.ts` builds text, `services/csvExport.ts` writes the file and opens the share sheet.

## 4. Code conventions

- TypeScript strict. No new `any` unless unavoidable; prefer types from `salaryCalculator.ts`.
- Business logic goes in `src/utils` as pure functions with tests. Screens only render and call stores or utils.
- Styling: use `useAppTheme()` colors; never hard-code colors in screens (shift colors come from `ShiftConfig.color`).
- UI language is **Vietnamese with full diacritics**. Money format: `toLocaleString('vi-VN')` plus the `₫` sign. Code, comments and commit messages are in English.
- Typographic quotes and apostrophes in user-visible text where applicable.
- Small commits using Conventional Commits (`fix:`, `feat:`, `refactor:`, `test:`, `docs:`, `chore:`).

## 5. Persistence and migration rules

- Changing the shape of anything persisted requires: bump the store `version`, write `migrate`, keep old data readable, add a test that feeds a legacy blob and checks the result.
- Existing example: `normalizeConfig` converts the legacy 4-shift config (`day`, `night`, `offDay`, `offNight`) into the dynamic shape, and `useProfileStore` migrates v0 to v1 by setting `onboarded: true` so old users skip setup.
- Backups restored by `restoreFromBackupJson` run through the same `rehydrate` and `migrate` path. Old backups must keep working.
- Never rename a storage key.

## 6. Domain rules (Vietnam, verified November 2026)

Applies to resident employees with an employment contract of 3 months or more. Estimates only.

| Item | Value |
| --- | --- |
| PIT brackets from 2026 | 5% to 10 M; 10% to 30 M; 20% to 60 M; 30% to 100 M; 35% above (monthly taxable income, VND) |
| Deductions from 2026 | 15,500,000 personal; 6,200,000 per dependant |
| Before 2026 | 7 brackets (5/10/15/20/25/30/35%), deductions 11,000,000 and 4,400,000 |
| Employee insurance | BHXH 8% + BHYT 1.5% + BHTN 1% |
| BHXH/BHYT cap | 20 x base salary: 46.8 M until 2026-06, 50.6 M from 2026-07 |
| BHTN cap | 20 x regional minimum wage (2026: 5.31 / 4.73 / 4.14 / 3.70 M for regions 1 to 4) |
| Premium exemption | Only the part above normal daytime hourly pay, for night shifts, day-off/holiday shifts and overtime. Overtime exemption capped (default 40 h/month). Allowances are not exempt in the current model. |

Known uncertainty: sources disagree on whether night/overtime pay is exempt in full or only the premium. The code follows the premium-only reading (Decree 253/2026/ND-CP, article 26 clause 3, as quoted by the Ministry of Finance portal). Keep it behind the `exemptPremium` switch.

**Procedure when a rule may have changed**: search for the latest official text (Ministry of Finance, Government portals, thuvienphapluat or major accounting firms as secondary), compare at least two sources, update constants in `getLegalParams` / brackets, keep old months on old rules (rules are selected by month `YYYY-MM`), add tests with worked examples from the source, update this table and the README table.

## 7. Task protocol for autonomous work

For each task:

1. Read the task, the files it names and the related tests.
2. Write or extend a **failing test** first when the change is in `src/utils` or `src/services`.
3. Implement the smallest change that satisfies the acceptance criteria.
4. Run `npm test` and `npx tsc --noEmit`. Fix until green.
5. Update docs touched by the change (this file's backlog status, README, in-app Policy text if privacy-relevant).
6. Commit with a Conventional Commit message. One task, one commit (or a short series).
7. Report: what changed, tests added, what was **not** verified (for example "UI not run on a device").

**Stop and ask a human** when: the task needs a new network capability, touches legal constants without a source, changes a persisted shape in a way that cannot be migrated, needs a paid account or signing keys, or acceptance criteria conflict with a hard rule.

## 8. Upgrade backlog

Status: `[ ]` todo, `[x]` done. Work top to bottom inside a phase. Mark items done here when finished.

### Phase 1: fixes before release

- [ ] **P1-1 Device verification.** Cannot be done by an agent without a device. Produce a manual test checklist in `docs/manual-test.md` covering: fresh setup, opening with legacy data, attendance, CSV month and year, backup and restore, reminders.
- [ ] **P1-2 Overtime rate follows base rate (manual mode).** When the user edits `baseRate` in `SalaryConfigScreen` in manual mode, `overtimeRate` should update using `overtimeMultiplier` unless the user edited the overtime rate by hand. *Accept:* unit test on a helper in `utils`; screen uses it.
- [ ] **P1-3 Show multipliers for night and off shifts in monthly mode.** `SetupScreen` stores `baseSalary` scaled by 1.3 (night) and 2 (off/holiday). Store a `rateFactor` on the shift (or equivalent) and show "x1,3" / "x2" in `SalaryConfigScreen` instead of a scaled salary. Add a migration for configs already created by setup. *Accept:* net pay unchanged for existing configs (test), UI shows the factor.
- [ ] **P1-4 Full reset.** `resetAllData` must also clear `reminder-storage`, cancel scheduled notifications (`Notifications.cancelAllScheduledNotificationsAsync`) and the `last-manual-backup-at` key. *Accept:* test with mocked AsyncStorage/notifications; README erasure text updated.
- [ ] **P1-5 Setup completeness.** Add an allowance field to the shift step of `SetupScreen`, and add "Run setup again" in the Profile menu that re-opens the wizard prefilled from current config without deleting attendance. *Accept:* attendance preserved (test on the helper that builds the config).
- [ ] **P1-6 Lock SDK 57.** Run `npx expo install --fix` and `npx expo-doctor`, resolve all warnings, pin exact versions, confirm `expo-file-system` and `expo-notifications` APIs still match `services/csvExport.ts` and `services/reminders.ts`. If the App Store Expo Go does not open SDK 57, document it in README and consider SDK 58.
- [ ] **P1-7 Normalize UI strings.** Several older screens contain Vietnamese without diacritics (for example "Cai dat", "Thue va bao hiem", "Sao luu", "Giao dien"). Replace every user-visible string with correct Vietnamese. *Accept:* `grep` finds no unaccented UI strings; no logic changes.
- [ ] **P1-8 README placeholders.** Fill contact, security email and license only with values given by a human. Do not invent them.

### Phase 2: UI and usability

- [ ] **P2-1 Rebuild Attendance, Logs, Salary screens to match the design canvas** (ivory background, deep green primary, rounded cards, bottom tab bar). Keep behaviour identical; reuse theme tokens.
- [ ] **P2-2 Be Vietnam Pro font** via `expo-font` with a system fallback.
- [ ] **P2-3 Edit and delete attendance entries, daily notes, search in Logs.**
- [ ] **P2-4 Smart reminders.** Skip the check-in reminder if the user is already checked in today (reschedule on check in and check out).

### Phase 3: deeper payroll logic

- [ ] **P3-1 Exempt allowances** (for example meal allowance up to the legal limit) as a per-shift flag and amount, with tests and a cited source.
- [ ] **P3-2 Annual overtime cap tracking** in addition to the monthly cap (limit from current labor law; verify the source first).
- [ ] **P3-3 Contracts under 3 months** (10% withholding) and non-resident mode, with sources.
- [ ] **P3-4 Multiple pay profiles** (several jobs or family members). Requires a migration from the single `config` + `attendance` to profiles. Design the migration and tests before writing UI.
- [ ] **P3-5 Annual review job.** Add `docs/legal-review.md` with the checklist from section 6 and the date of the last review.

### Phase 4: quality and release

- [ ] **P4-1 Tests** for `dataBackup` (valid, invalid and legacy backups), `reminders` scheduling calls (mock `expo-notifications`), and screen smoke tests with `@testing-library/react-native` (the dependency is already installed; switch the Jest preset for those tests to `jest-expo`).
- [ ] **P4-2 Accessibility pass.** Add `accessibilityLabel` and roles to all touchable elements, check large text, check contrast in light and dark themes.
- [ ] **P4-3 Export payslip as image or PDF** using only on-device libraries.
- [ ] **P4-4 App Store preparation docs.** `PRIVACY.md`, store description, screenshot list. No signing keys in the repo.
- [ ] **P4-5 English UI** via a small i18n layer (all strings extracted first, Vietnamese stays default).

## 9. Self-check before finishing any task

- [ ] `npm test` and `npx tsc --noEmit` are green.
- [ ] No new network access, no new tracking, privacy docs still true.
- [ ] Persisted shapes either unchanged or migrated and tested.
- [ ] No legal constant changed without a cited source.
- [ ] Docs and this backlog updated.
- [ ] Final report lists what was verified and what was not.
