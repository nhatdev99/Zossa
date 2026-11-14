# Rosala

Offline time tracking and salary calculator for shift workers. Track your shifts, overtime and allowances, and see your estimated net pay after Vietnamese personal income tax (PIT) and mandatory social insurance.

**Everything stays on your device.** There are no accounts, no servers, no analytics and no network requests.

- Platforms: iOS and Android (Expo / React Native)
- Language of the app UI: Vietnamese
- Status: personal project, no warranty (see [Disclaimer](#disclaimer))

---

## Table of contents

1. [Features](#features)
2. [Privacy and data protection (GDPR)](#privacy-and-data-protection-gdpr)
3. [Security](#security)
4. [Accessibility](#accessibility)
5. [Tax and insurance rules implemented](#tax-and-insurance-rules-implemented)
6. [Tech stack](#tech-stack)
7. [Getting started](#getting-started)
8. [Project structure](#project-structure)
9. [Data formats](#data-formats)
10. [Contributing](#contributing)
11. [License](#license)
12. [Disclaimer](#disclaimer)

---

## Features

- **Custom shift types**: define your own shifts (name, hourly rate, overtime rate, allowance, night shift, day off or holiday). Rates can be entered per hour or derived from a monthly salary.
- **Check in / check out** with a live timer, or add a day manually.
- **Salary overview** for any month: gross, social insurance, PIT, net pay and a full breakdown.
- **Vietnamese PIT and social insurance** (BHXH, BHYT, BHTN), including dependants and the exemption of the night and overtime premium. Alternatively use a flat percentage or no deduction.
- **Statistics**: compare all months of a year (net, gross, hours, overtime), gross versus net, and month versus previous month.
- **CSV export** per month (daily detail plus summary) or per year (one row per month). Choose `;` or `,` as separator for Excel compatibility.
- **Reminders**: local notifications for check in, check out and monthly payroll review.
- **Backup and restore** as plain JSON text, without any cloud service.
- **Themes**: light, dark or system, plus several colour palettes.

## Privacy and data protection (GDPR)

Rosala is designed according to *data protection by design and by default* (Article 25 GDPR).

| Topic | Statement |
| --- | --- |
| Personal data collected by the developer | **None.** The app does not send any data to the developer or to any third party. |
| Network access | The app makes no network requests. It works fully offline. |
| Accounts and sign-in | None. |
| Analytics, advertising, tracking, crash reporting | None. No third-party SDKs for these purposes. No cookies. |
| Data stored on the device | Attendance records, shift and pay settings, tax and insurance settings, optional display name and job title, optional avatar reference, theme and reminder settings. |
| Where it is stored | In the app's local storage (AsyncStorage) inside the app sandbox on your device. |
| Special categories of data (Art. 9) | The app does not ask for or process them. |
| Children | The app is not directed at children and has no age-specific features. |

### Permissions

| Permission | Why | Required |
| --- | --- | --- |
| Photo library | Pick an avatar image | Optional |
| Notifications | Local reminders (no push server involved) | Optional |

### Your rights

Because all data lives on your device and under your control:

- **Access and portability (Art. 15, 20)**: export your data at any time as CSV (readable in Excel, Numbers, Google Sheets) or as a JSON backup.
- **Rectification (Art. 16)**: edit any record, setting or profile field inside the app.
- **Erasure (Art. 17)**: use *Backup and restore → Delete all data* to wipe attendance, pay settings and profile. Uninstalling the app removes all remaining local data. Reminder notifications are device schedules: switch them off in *Reminders* or uninstall the app.
- **Data you share yourself**: files you export (CSV, JSON) leave the app only when you choose where to save or send them. From that moment their protection is your responsibility and the responsibility of the app you share them with.

### Controller

The developer does not receive or determine the purposes of processing of your personal data, so no processing by the developer takes place. For questions, see [Contact](#contact).

> This section describes how the software works. It is not legal advice. If you distribute a modified version, re-check it against your own data flows (for example if you add a backend, analytics or crash reporting).

## Security

- Data is stored in the platform sandbox of the app. Rosala does not implement its own encryption at rest; it relies on the operating system's device encryption and lock screen. Enable a device passcode.
- Exported CSV and JSON files are **not encrypted**. Store and share them accordingly.
- The app opens no network connections, which removes the whole class of data-in-transit risks.

### Reporting a vulnerability

Please report security issues privately and do not open a public issue.

- Email: `<security contact email>`
- Please include the app version, platform, steps to reproduce and impact.
- You will get an acknowledgement and a status update. Please allow reasonable time for a fix before public disclosure.

### Supply chain

Dependencies are declared in `package.json`. To generate a Software Bill of Materials (CycloneDX):

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

Run `npm audit` regularly and update dependencies together with Expo SDK upgrades (`npx expo install --fix`).

## Accessibility

The app uses native components and supports system font scaling and light or dark mode. Accessibility labels and screen reader behaviour have **not** been formally audited. Reports and contributions are welcome, see [Contributing](#contributing). Contrast of the default palette is chosen to be readable on both light and dark backgrounds.

## Tax and insurance rules implemented

Rules implemented for Vietnamese resident employees with an employment contract of three months or more. Values below were checked against public sources in **November 2026**. Always verify against official sources before relying on the numbers.

| Item | Value |
| --- | --- |
| PIT brackets from 2026 (monthly taxable income) | 5% up to 10 M, 10% up to 30 M, 20% up to 60 M, 30% up to 100 M, 35% above 100 M VND |
| Personal deduction from 2026 | 15,500,000 VND per month |
| Dependant deduction from 2026 | 6,200,000 VND per dependant per month |
| Months before 2026 | Previous 7 bracket schedule, 11,000,000 and 4,400,000 VND deductions |
| Employee insurance | BHXH 8% + BHYT 1.5% + BHTN 1% = 10.5% |
| BHXH and BHYT salary cap | 20 times the base salary: 46.8 M VND until June 2026, 50.6 M VND from July 2026 |
| BHTN salary cap | 20 times the regional minimum wage |
| Night and overtime premium | Only the part above the normal daytime hourly pay is exempt from PIT; overtime exemption is capped (default 40 hours per month, configurable) |

Not covered: exempt allowances (for example meal allowance), insurance and education deductions, contracts shorter than three months, non-residents, and the annual tax finalisation. Results are **estimates**.

The rules live in `src/utils/salaryCalculator.ts` and are covered by unit tests in `src/utils/__tests__/`.

## Tech stack

- [Expo](https://expo.dev) SDK 57, React Native 0.86, React 19.2
- TypeScript
- React Navigation (bottom tabs and native stack)
- Zustand with AsyncStorage persistence
- `expo-notifications` (local notifications), `expo-file-system` and `expo-sharing` (CSV export), `expo-image-picker` (avatar)
- `date-fns`
- Jest and ts-jest for the calculation logic

## Getting started

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/nhatdev99/Rosala.git
cd Rosala
npm install --legacy-peer-deps
npx expo install --fix      # align Expo packages with the SDK
npx expo start
```

Open the project in a development build or in Expo Go if your Expo Go version supports SDK 57.

```bash
npm test            # unit tests for salary, tax, insurance and CSV logic
npx expo-doctor     # check the project configuration
```

### Building

```bash
npx expo prebuild --platform ios --clean
```

The repository includes a `codemagic.yaml` for an unsigned iOS release build. Signing is up to you.

## Project structure

```
src/
  components/   chart components (plain React Native views)
  hooks/        theme hook
  navigation/   app navigator, splash and onboarding switch
  screens/      app screens (setup, attendance, logs, salary, tax, export, reminders ...)
  services/     backup/restore, CSV sharing, local reminders
  store/        Zustand stores (salary, profile, theme, reminders)
  utils/        salary, tax and insurance calculation, CSV builders, theme
    __tests__/  unit tests
```

## Data formats

**Backup (JSON text).** An object with `app: "rosala"`, a `format` number, `exportedAt` and a `data` map containing the persisted stores. Restoring replaces the current data on the device.

**CSV.** UTF-8 with byte order mark, so Excel reads Vietnamese characters correctly. With `;` as separator the decimal mark is `,`; with `,` as separator it is `.`.

- Month file: `Rosala_YYYY-MM.csv` with one row per day, followed by a summary block.
- Year file: `Rosala_YYYY.csv` with one row per month and a total row.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a feature branch.
2. Keep the app offline and free of tracking: changes that add network access, analytics or accounts need a clear privacy justification and an update of the [privacy section](#privacy-and-data-protection-gdpr).
3. Add or update unit tests for any change in calculation logic.
4. Run `npm test` before opening a pull request.

## License

`<choose a license, for example MIT or Apache-2.0>`

Add a `LICENSE` file at the repository root and use the matching SPDX identifier in `package.json` (`"license": "MIT"`).

## Contact

`<maintainer name>`, `<contact email>`

## Disclaimer

Rosala provides estimates for personal information only. It is not tax, legal or payroll advice. Rules change; always check your payslip and official sources. The software is provided "as is", without warranty of any kind.
