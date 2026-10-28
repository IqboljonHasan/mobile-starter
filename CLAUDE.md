# CLAUDE.md

Guidance for AI coding agents working in this repository. The [README](README.md) describes the product for people; this file covers how to work on the code safely.

## Project overview

**Taqsim** is an offline-first personal finance tracker for Android and iOS, built with Expo (SDK 57), React Native 0.86, expo-router, NativeWind 5 and `@gorhom/bottom-sheet`. It is built around envelope budgeting: income is split across wallets ("hamyon") by percentage, and each expense is paid from one wallet. It also tracks debts, family members and per-category spending.

- All data lives on the device in AsyncStorage. There is no backend. The only network call is the optional Telegram backup.
- **All user-facing copy is Uzbek, in Latin script.** New strings must match the existing tone and terminology (Kirim = income, Chiqim = expense, Hamyon = wallet, Qarz = debt, Taqsimlanmagan = unallocated pool, Hamyonsiz = no wallet).
- Code, identifiers and comments are in English.

## Role and standards

Work as a **senior software engineer** and a **senior UI/UX designer** on this product. You own the outcome: code that is correct and maintainable, and an interface that feels like part of the rest of the app. The standards below are the bar for every change.

### As a senior software engineer

- **Understand before changing.** Read the surrounding code, the relevant `lib/` module and the [domain invariants](#domain-invariants) before editing.
- **Fix root causes.** Fix the cause of a bug, not the symptom. If the cause can't be confirmed, say so, list what was ruled out, and state what would settle it.
- **Keep changes focused.** Solve what was asked, without drive-by rewrites. Refactor only when the change needs it, and say that you did.
- **Put logic where it belongs.** Calculations are pure functions in `lib/`, state lives in contexts, and components render and wire them together.
- **Type strictly.** Do not use `any`, non-null assertions or `@ts-ignore` to quiet the checker. Model legacy and optional data in the types, and normalise it on load.
- **Design for real data:**
  - several currency units at once;
  - masked amounts;
  - empty and very long ledgers;
  - records saved before a field existed;
  - old entries that point to a wallet, category or member that has since been deleted.
- **Mind performance.** Derive lists with `useMemo` and correct dependencies, and keep long lists virtualised (`SectionList`, `BottomSheetSectionList`). Avoid nested scans over all transactions when a `Map` lookup will do.
- **Verify, then report honestly.** Run the type check and lint, and exercise changed `lib/` logic with a quick script. State plainly what was not verified, for example "not run on a device".
- **Document intent.** Doc comments explain why code exists and what it must preserve, not what each line does.

### As a senior UI/UX designer

- **Consistency first.** Build from the existing system: `ScreenHeader`, `HeaderMenu`, `BottomBar`, `Card`, `ListRow`, `Chip`, `Select`, `BottomSheet`, `EmptyState`, the `tc` / `tf` tokens, `RADIUS`, and the 18px screen gutter. A new pattern needs a reason.
- **Design every state:**
  - loading;
  - empty, with an `EmptyState` that says what to do next;
  - filtered to nothing;
  - error;
  - long text;
  - very large amounts.
- **Thumb-first layout.** Primary actions are pinned to the bottom (`BottomBar`), and secondary actions go in the ⋮ menu. The most frequent tasks, adding a Kirim or a Chiqim, stay one tap from Home.
- **Touch safety.** Interactive elements need a touch target of at least 44×44 (use `hitSlop` where the visual is smaller). Navigation and save actions are guarded against double taps with `useGuardedPress`.
- **Accessibility:**
  - every interactive element has an `accessibilityRole`, an Uzbek `accessibilityLabel`, and an `accessibilityState` where it applies;
  - colour is never the only signal, so pair it with an icon or text;
  - layouts survive the large text-scale setting without clipping.
- **Privacy by default.** Any figure derived from income or a balance respects the "hide amounts" setting (`hideIncome`, `maskAmount`).
- **Trust.** Destructive actions confirm with `Alert.alert` and state the consequence. Prefer recorded, reversible actions (a transfer, a payment) over silent overrides.
- **Copy.** Short, plain Uzbek (Latin) in the app's own terms. A button says what it does ("Hamyonga o'tkazish"); an empty state says what to do next.
- **Motion.** Subtle and purposeful, driven by Reanimated, and never blocking input. Follow platform conventions: Android back closes an open sheet before leaving the screen.
- **Check before calling UI done:** light and dark themes, normal and large text, short and long lists. If no device is available, say that the UI was not visually checked.

## Commands

The package manager is **bun** (`bun.lock`; EAS builds pin bun 1.4.2).

| Task | Command |
| --- | --- |
| Install dependencies | `bun install` |
| Start the dev server | `bun start` |
| Run on a device or emulator | `bun run android` / `bun run ios` |
| Type-check | `npx tsc --noEmit` |
| Lint | `bun run lint` (or `npx eslint <files>`) |
| Regenerate native projects | `bun run prebuild --clean` |
| Local release APK | `bun run release` |
| EAS builds | `bun run build:android` (preview APK), `build:android:test`, `build:android:prod`, `build:prod` |

### Verifying changes

- There is **no automated test suite**. Every change must pass `npx tsc --noEmit` and ESLint with no errors or warnings.
- Pure logic in `lib/` can be checked with a throwaway script run by bun, which resolves the `@/` alias. Write the script at the repo root, run `bun run ./check.ts`, then delete it.
- The **web target does not bundle**: Metro fails on the `expo-sqlite` web worker that the backup code imports. Do not rely on `expo start --web` to check UI. UI changes can only be confirmed on a device or emulator, so say so when one isn't available.
- Expo Go is not supported. Reanimated and the natively linked Manrope font need a development build.

## Architecture

### Navigation (`app/`)

- There is **no tab bar**. `app/index.tsx` (Home) is the only root screen; every other route is pushed over it as a sheet-styled stack screen.
- **Kirim va chiqimlar is not a route.** It is Home's bottom panel pulled up: `components/LedgerSheet.tsx`, a `@gorhom/bottom-sheet` with two snap points. Its `animatedPosition` moves Home's content 1:1, and Home has no scroll of its own.
- Every pushed screen uses `components/ScreenHeader.tsx` as the stack `header`. A screen sets only `title` and `headerRight` through `<Stack.Screen options>`.
- Secondary actions go in a ⋮ `HeaderMenu` passed as `headerRight`. Primary actions are pinned to the bottom with `components/BottomBar.tsx`.
- Scrolling content under a `BottomBar` must reserve bottom padding past the bar and its fade. `app/debts.tsx` measures this at runtime; reuse that pattern instead of hard-coding a number.

### State (`contexts/`)

- `LedgerContext.tsx` holds all domain data: categories, transactions, wallets, transfers, contacts, debts, templates and members. It loads once on mount, normalises legacy records, and persists on change.
- `PreferencesContext.tsx` holds small persisted preferences. Each gets its own state, a `getSetting` on mount and a `setSetting` in its setter.
- `ThemeContext.tsx` and `FontSizeContext.tsx` hold the theme and the text-scale setting. Read them through `useTheme()` (`tc` colour tokens, `isDark`) and `useFont()` (`tf` scaled font sizes).
- `TelegramBackupContext.tsx` handles the Telegram backup.

### Domain logic (`lib/`)

`lib/` is pure TypeScript: no React and no storage access. Screens call it on the arrays the context provides. Put new calculations here, not in components.

| Module | Responsibility |
| --- | --- |
| `types.ts` | All domain types |
| `ledger.ts` | Filtering and aggregation (`inMonth`, `ofType`, `sum`, `excludeDebts`, `countedForStats`, …) |
| `wallets.ts` | Envelope budgeting: splits, balances, the unallocated pool, the Hamyonsiz balance |
| `debts.ts` | Debt read-side logic, direction metadata, the debt ↔ transaction mapping |
| `stats.ts` | Breakdowns and series behind the Tahlil screen |
| `money.ts` | Units, parsing, `formatAmount` / `maskAmount` / `formatCompact` |
| `seed.ts` | Starter categories and wallets, `DEBT_CATEGORY_IDS` |
| `storage.ts` | AsyncStorage wrapper; every key is prefixed `starter:` |
| `backup.ts`, `backupDb.ts`, `backupFile.ts`, `backupTask.ts` | Versioned SQLite backup, export and the background task |

### UI kit (`components/ui/`)

Reuse what exists (`Button`, `Chip`, `Select`, `BottomSheet`, `ListRow`, `Toggle`, `NumberPad`, `PickerField`, `EmptyState`, …) before adding a component. Exports go through `components/ui/index.ts`.

## Conventions

- **Always import `Text` / `TextInput` from `@/components/ui/Text`**, never from `react-native`. The wrapper applies Manrope.
- Style with NativeWind classes and the semantic tokens from `useTheme()`. Size text with `tf.*` so the text-scale setting applies. Prefer theme tokens over raw hex colours; the exceptions are deliberate fixed colours, such as the white text on Home's sky.
- Money amounts are entered with the in-app `NumberPad`, not the system keyboard. Forms use `AmountCard` / `AmountField`.
- **Never sum amounts across currency units.** Every total is either scoped to one unit or broken down by unit (`UnitTotal`).
- Formatting: tabs for indentation, double quotes, trailing commas. Match the surrounding file.
- Comments are full sentences that explain *why*. Exported functions and non-obvious state get a doc comment in the existing voice. Match the comment density of the file you are editing.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`). Do not commit, push or open PRs unless asked.

## Domain invariants

These rules come from explicit product decisions. Do not change them silently. If a task seems to require breaking one, ask first.

### Wallets (`lib/wallets.ts`)

1. **Allocations are snapshotted** onto each income transaction (`Transaction.allocations`). Changing a wallet's percentage must not rewrite history. Only the explicit "redistribute history" action (`redistribute()`) does that.
2. **A split always sums exactly to the amount divided.** `splitAmount` works in whole minor units with largest-remainder rounding. Re-verify conservation if you touch it.
3. **Balances are all-time and per unit.** They never reset monthly and are never summed across currencies.
4. Whatever the percentages leave unclaimed goes to the virtual **unallocated pool** (`UNALLOCATED_ID`, "Taqsimlanmagan"). It is a real, spendable balance.
5. **Hamyonsiz** (`UNASSIGNED_ID`, `unassignedBalance`) is money no wallet ever held: unsplit income without a wallet, minus expenses without a wallet. It appears on the Wallets screen, can be the *source* of a transfer, and is not part of Home's total balance.
6. **A category pays from exactly one wallet.** `Category.walletIds` is capped at one element. The expense form derives the wallet from the category and does not let the user change it.
7. **A short wallet blocks the expense.** The fix is a recorded transfer from another wallet, not a warning. Unmapped categories draw from no wallet and are never blocked; this is deliberate.

### Debts (`lib/debts.ts`)

1. **Every debt movement writes a real `Transaction`**, linked by `Transaction.debtId`:

   | Movement | Side | Category |
   | --- | --- | --- |
   | Borrow | income | `cat_debts` |
   | Repay | expense | `cat_loans-out` |
   | Lend | expense | `cat_debs-out` |
   | Collect | income | `cat_loans` |

2. A debt's principal (`Debt.amount`) never shrinks. Payments live in `Debt.payments`, and `remainingAmount()` clamps at zero.
3. **Debt-owned transactions are read-only** in the transaction form. They are edited only through their debt.
4. Debt entries on both sides name one wallet and are never split, so a borrow-then-repay round trip leaves the wallet where it started. If you touch `allocationFor` or `redistribute`, re-verify that round trip.
5. Debt categories are matched **by id** through `DEBT_CATEGORY_IDS`, never by name.

### Stats

- Debt categories are excluded from income and expense totals by default. The `includeDebtsInStats` setting brings them back.
- With debts excluded, **money lent and not yet collected still counts as an expense**, in the month it was lent, shrinking as collections arrive. The `uncollectedLoansAsExpense` setting is on by default.
- Every income or expense total on Home, the ledger panel and Tahlil must go through `countedForStats()` in `lib/ledger.ts`. Do not filter debts by hand.

### Family members

- A transaction's `memberId` applies to **expenses only**; income always carries `null`.
- Deleting a member leaves their expenses in place. They then read as shared ("Umumiy").

## Persistence and backup

- Storage keys live in `lib/storage.ts` and are prefixed `starter:`. Load-time normalisation in `LedgerContext` handles records saved before a field existed. Extend it when you add a field, rather than guarding every call site.
- A backup is **only** an SQLite `.db` file (`BACKUP_VERSION = 5`). It is exported through the system share sheet or the Telegram bot.
- **A new persisted field needs three changes:**
  1. the type in `lib/types.ts`;
  2. a column in `lib/backupDb.ts`;
  3. parsing and validation in `lib/backup.ts`.

  Bump `BACKUP_VERSION` when the shape changes, and keep older versions importable.

## Production releases

Do this **every time a production build is made** (`build:android:prod`, `build:ios:prod`, `build:prod`, or `release`), before the build starts.

1. **Create the release note file** `docs/releases/v_<version>.md`, where `<version>` is `expo.version` in `app.json` (for example `docs/releases/v_0.1.2.md`). Copy [docs/releases/TEMPLATE.md](docs/releases/TEMPLATE.md). If that version already has a file because it shipped before, ask whether to bump `expo.version` first. Do not overwrite a shipped note.
2. **Write "What's new"** for the Play Console inside a single `<en-US>` block: **Uzbek first, then English**, separated by a blank line.
   - Describe user-visible changes only, using plain language and the app's own terms (Kirim, Chiqim, Hamyon, Qarz).
   - Build the list from the commits since the previous release note, or since the last version bump: `git log --oneline <last-release-commit>..HEAD`.
   - Play Console accepts at most **500 characters** between the tags, so keep both languages short and lead with the most important change.
3. **Review privacy** against [docs/privacy-policy.html](docs/privacy-policy.html), and record the outcome in the note's *Privacy* section. A change needs action if the release:
   - adds a permission;
   - collects or stores a new kind of personal data;
   - makes a new network call;
   - changes what leaves the device (backup, Telegram, sharing).

   When it does, update the policy (and its date) in the same change, and flag that the Play Console *Data safety* form may need updating. When it doesn't, write "No change" explicitly.
4. Record the build in the note: `versionCode` / `buildNumber`, EAS profile, and date.
5. Show the maintainer the note before the build is started.

## Native and platform notes

- Changes to `app.json` plugins or to fonts require `bun run prebuild --clean` and a native rebuild.
- Contacts use `expo-contacts/legacy`, because SDK 57 moved whole-address-book access there.
- `expo-notifications` is loaded through a guarded `require` in `lib/debtReminders.ts`, so a build without the native module still runs.
- The root layout pads the bottom safe-area inset, so screens should not add `insets.bottom` again.

## Working with the maintainer

- When a request is genuinely ambiguous (which categories count, which side of a debt, which month), ask short, targeted multiple-choice questions before implementing.
- When two behaviours are both legitimate and a switch is cheap, prefer adding a persisted Settings toggle, with the requested behaviour as the default, over choosing one permanently.
- Replies to the maintainer are in Uzbek. Code, comments and this file stay in English.
