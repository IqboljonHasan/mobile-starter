# Taqsim

A personal income and expense tracker. Built on React Native (Expo) with
expo-router, NativeWind 5 semantic color tokens, a light/dark/system theme
switcher and an app-wide text-scale setting.

Everything is stored on the device with AsyncStorage — there is no account and
no server. The one network call is the optional Telegram backup, which sends
the ledger to a bot and chat the user sets up themselves.

## Run it

```bash
bun install
bun start
```

Then `a` for Android, `i` for iOS. A native build is needed for
`react-native-reanimated` and for the Manrope font, which is linked natively —
neither is in Expo Go. After pulling a change to `app.json`'s plugins, rebuild
the native projects first:

```bash
bun run prebuild --clean
bun run android
# or
bun run ios
```

## What's in it

There is one home screen; everything else is a sheet pushed over it.

- **Home** — the total balance with this month's net under it, a row of
  wallet tiles, the debts either way, and a link to the report. The month sits
  in a panel at the bottom with its income, its spending and the two add
  buttons; swiping the panel up opens the month's entries. Every figure is a
  way in — a wallet tile opens the entries narrowed to that wallet.
- **Kirim va chiqimlar** — both sides of the ledger in one list, a month at a
  time, grouped by day with a per-day net. Two tiles total the month and filter
  to one side; chips narrow it to a wallet (counting only the share that wallet
  received). The ⋮ menu searches the month and filters by category.
- **Qarzlar** — what is owed either way, grouped into overdue, open and
  settled, filterable by direction and state. The ⋮ menu searches by person or
  note and opens **Eslatmalar**: local notifications before a due date.
- **Hisobot** (Stats) — one month or year at a time: the summary, a 12-month
  chart, and a breakdown by category or subcategory.
- **Entry and debt forms** — amount with pay method and unit, category and
  subcategory, quick picks (saved templates and pinned subcategories), the
  wallet (or the income's split), note and date; a debt adds the person —
  picked with their Do'st/Qarindosh tag and where things stand with them — a
  due date with one-tap terms, and a reminder. The ⋮ menu saves the form as a
  template, sends a debt's note to the other person, or clears the form.
- **Wallets**, **Categories**, **Contacts**, **Settings**, **Telegram backup**.

## Layout

```
index.ts                 entry: expo-router + the background backup task
app/
  _layout.tsx            root Stack + providers; every screen gets ScreenHeader
  index.tsx              Home
  entries.tsx            Kirim va chiqimlar — the month's ledger
  debts.tsx              Qarzlar
  transaction.tsx        create / edit / delete one entry
  debt.tsx               create / edit / settle one debt
  stats.tsx              Hisobot
  wallets.tsx            wallets, their shares, transfers
  categories.tsx         category + subcategory manager
  contacts.tsx           the people debts are with
  settings.tsx           look, distribution, privacy, data
  telegram.tsx           Telegram backup: bot token, chat ID, send now
components/
  ScreenHeader.tsx       the navy strip + rounded sheet top every screen wears
  HomeSky.tsx            the home screen's gradient backdrop
  SplashOverlay.tsx      the splash, redrawn in React for as long as it loads
  AmountCard.tsx         a form's amount, pay method and unit
  BottomBar.tsx          actions pinned to the bottom of a sheet
  TransactionRow.tsx     one line of the ledger
  DebtRow.tsx            one debt
  ContactPicker.tsx      the person a debt is with: search, tags, add, import
  RemindersSheet.tsx     debt reminder settings and what's lined up
  TemplateSheet.tsx      names the entry form as a template
  SearchBar.tsx          the search field a list opens from its menu
  WalletIcon.tsx         a wallet's tile — the one thing drawn in colour
  CategoryAvatar.tsx     a category's icon tile
  MonthSwitcher.tsx      prev / next month control
  ui/                    the component library (import from "@/components/ui")
contexts/
  LedgerContext.tsx      categories, transactions, wallets, debts + persistence
  TelegramBackupContext.tsx  Telegram settings + the foreground daily check
  ThemeContext.tsx       persisted light/dark/system preference
  FontSizeContext.tsx    persisted text scale
  PreferencesContext.tsx hide income, debts in stats, split income, reminders
hooks/
  useTheme.ts            isDark, tc (runtime colors), mode, setMode
  useFont.ts             tf — font sizes scaled by the user's setting
  useDebtReminders.ts    keeps scheduled reminders in step with the debts
lib/
  types.ts               Category, Transaction, Wallet, Debt, …
  ledger.ts              pure selectors — totals, breakdowns, grouping
  wallets.ts             splits, balances, redistribution
  debts.ts               debt status, totals, ledger entries, share text
  debtReminders.ts       scheduling debt reminders (expo-notifications)
  search.ts              forgiving text matching for the search fields
  money.ts               units, formatting, parsing
  date.ts                calendar-day helpers and the month grid
  categoryColors.ts      the validated category palette
  seed.ts                the categories a fresh install starts with
  theme.ts               runtime color values mirroring global.css
  storage.ts             AsyncStorage wrapper (preferences + JSON)
  backup.ts              backup format: JSON writer, validation, restore
  backupFile.ts          save / pick a backup file (JSON or .db)
  backupDb.ts            the ledger as an SQLite .db, and back
  telegramBackup.ts      Telegram settings, sending, the daily rule
  backupTask.ts          background task that sends the daily backup
assets/fonts/            Manrope 400–800, linked natively by app.json
assets/*.svg             the logo and the app-icon mark, as drawn
assets/images/           PNGs rendered from those SVGs: app icons (iOS light /
                         dark / tinted, Android adaptive + monochrome) and the
                         splash wordmark for light and dark
global.css               Tailwind theme + semantic tokens (light & dark)
```

## Data

`LedgerContext` holds the whole ledger in memory and mirrors it to
AsyncStorage under `starter:categories`, `starter:transactions` and
`starter:default_unit`. Screens read the arrays off `useLedger()` and derive
what they need with the pure helpers in `lib/ledger.ts` — there is no query
layer, because at this size there doesn't need to be one.

```tsx
const { transactions, categories, addTransaction } = useLedger();
const thisMonth = inMonth(transactions, currentMonthKey());
```

Three rules the data layer keeps, all of them load-bearing:

- **A transaction's amount is always positive.** The sign lives in `type`
  (`"income" | "expense"`), so a mis-signed amount can't exist.
- **Amounts are never summed across units.** There is no exchange rate in the
  app, so `so'm + $` is a number that means nothing. Every total is either
  scoped to one unit or returned per unit (`sumByUnit`). The dashboard picks one
  unit and offers a chooser only when the month actually holds more than one.
- **Dates are local calendar days (`"YYYY-MM-DD"`), never timestamps.** An entry
  belongs to the day the user picked and must not slide when the device changes
  timezone. `lib/date.ts` builds Dates from local parts for that reason — don't
  reintroduce `new Date(isoString)`.

Deleting a category does **not** delete the entries filed under it: money that
moved stays recorded, and those entries read as "Uncategorized" until they're
re-filed. Deleting a subcategory clears that field on its entries and leaves the
parent category in place.

## Telegram backup

Settings → **Telegram orqali** takes a bot token (from @BotFather) and a chat
ID, then sends the ledger to that chat as an SQLite `.db` file: once a day on
its own, and on demand from the same screen or the Settings row. Saving the
settings sends a backup straight away, so a wrong token or chat shows up
immediately. **Fayldan tiklash** restores a `.db` the same way it restores a
JSON file, and runs it through the same validation.

"Daily" means once per local calendar day, and it's enforced from two places
because neither is reliable alone:

- **Background** — `lib/backupTask.ts` registers an `expo-background-task` that
  wakes every few hours (the OS decides exactly when; iOS is especially
  sparing) and sends only if today's backup is still owed. It runs without the
  React tree, so it reads the ledger straight from AsyncStorage. It's imported
  from `index.ts`, not from a route, because no route loads when Android starts
  the app headless to run it.
- **Foreground** — `TelegramBackupContext` runs the same check whenever the app
  comes to the front.

A failed attempt isn't retried for 30 minutes. The `.db` has one table per
list (`categories`, `transactions`, `wallets`, …) plus `meta`. Nested lists
(subcategories, allocations, payments) are stored as JSON columns in their
parent's row.

## Category colors

A category stores a palette *key* (`"blue"`), not a hex value, and
`lib/categoryColors.ts` resolves it to a step chosen for the light or the dark
surface. The eight hues and their order aren't cosmetic: they were validated as
a categorical set — lightness band, chroma floor, colorblind separation between
adjacent slots, and contrast against both surfaces. Adding a ninth hue or
re-ordering them invalidates that, so past eight categories a hue is reused —
which is safe, because a category is also identified by its name and its icon.

The breakdown bars follow the same rule: every bar is directly labelled with its
category and amount, so color is never the only thing carrying identity.

## Theming

Colors are defined once in `global.css` as semantic tokens and mirrored in
`lib/theme.ts` for runtime use. **Keep the two in sync.**

The design system, in short:

- Every screen is a **white sheet with rounded top corners over a navy
  backdrop** (`ScreenHeader` draws it as the stack's header, so a screen only
  sets its `title` and `headerRight`). Home is the one exception: its own sky.
- A screen's less frequent actions sit behind a ⋮ `HeaderMenu`: a white card
  dropped under the button, a hairline before anything destructive, which is
  drawn red.
- On the sheet, related things sit on **quiet grey groups** (`bg-card`, 20px
  corners, no border or shadow). Anything inside a group that needs its own
  surface uses `bg-background`, which reads as white on the grey.
- **Ink** (`primary`) marks what is picked or pressed: solid buttons, chips that
  are on, switches that are on. In dark mode it turns over to a light fill with
  dark text, so put `tc.primaryFg` — never `"#fff"` — on a `primary` fill.
- **Green and red are for money moving** — income and expense, owed to you and
  owed by you — and otherwise colour belongs to the **wallets** (`WalletIcon`).
  Categories and people are drawn neutral in the lists.
- Buttons are pills; fields are 52px grey panels with 16px corners and a focus
  ring (`tc.focus`); labels over them are `FieldLabel`.

Use classes wherever a `className` is accepted:

```tsx
<View className="bg-card rounded-[20px] p-4">
  <Text className="text-foreground font-bold">Title</Text>
  <Text className="text-muted-foreground font-semibold">Subtitle</Text>
</View>
```

Use `tc` only for props that can't take a class — icon colors,
`placeholderTextColor`, `shadowColor`, navigator options:

```tsx
const { tc } = useTheme();
<Ionicons name="add" size={20} color={tc.foreground} />
```

Available tokens: `background`, `card`, `muted`, `foreground`,
`secondary-foreground`, `muted-foreground`, `border`, `input`, `disabled`,
`placeholder`, `primary`, `primary-fg`, `primary-highlight`, `brand`,
`success` / `success-soft`, `danger` / `danger-soft`, `warning` /
`warning-soft`. The home screen's sky and frosted panels have their own
palette, `homePalette()` in `lib/theme.ts`.

> NativeWind 5 preview + Tailwind v4 can silently fail to compile opacity
> modifiers on core colors (`bg-black/50`). Use inline `rgba()` for those.
> Custom hex tokens like `bg-danger/15` are fine.

## Text size and font

Import `Text` and `TextInput` from `@/components/ui/Text`, not from
`react-native`: they are the same components with Manrope laid under the given
style. The font's five weights are linked natively through the `expo-font`
plugin in `app.json`, so `font-bold` / `fontWeight` picks the matching file —
which also means a font change needs a native rebuild (`bun run prebuild`).

Don't use Tailwind's `text-base` / `text-lg` for anything the user should be
able to scale — those are fixed. Read sizes from `useFont()` instead:

```tsx
const { tf } = useFont();
<Text className="text-foreground font-bold" style={{ fontSize: tf.lg }}>
  Heading
</Text>
```

Keys: `xs`, `sm`, `base`, `lg`, `xl`, `xxl`, `xxxl`. Every component in
`components/ui` already does this, so the Settings control reaches all of them.

## Adding a screen

Drop a file in `app/`, give it a title in the `Stack` in `app/_layout.tsx`, and
push it with `router.push` (the `useSafeRouter` one, which ignores a doubled
tap). It gets the sheet header for free; put a screen's extra actions in a
`HeaderMenu` as its `headerRight`, and pin its main buttons to the bottom with
`BottomBar`.

## Adding a component

Put it in `components/ui/`, export it from `components/ui/index.ts`, and read
colors from `useTheme()` and sizes from `useFont()`. App-specific pieces that
know about transactions or categories live one level up, in `components/`.
