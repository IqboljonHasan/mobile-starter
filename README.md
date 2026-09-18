# Kirciq

A personal income and expense tracker. Built on React Native (Expo) with
expo-router, NativeWind 5 semantic color tokens, a light/dark/system theme
switcher and an app-wide text-scale setting.

Everything is stored on the device with AsyncStorage — there is no account, no
server and no network call anywhere in the app.

## Run it

```bash
bun install
bun start
```

Then `a` for Android, `i` for iOS. A native build is needed for
`react-native-pager-view` and `react-native-reanimated` — they aren't in Expo
Go:

```bash
bun run android
# or
bun run ios
```

## What's in it

- **Home** — a month at a time: net, income and expense totals, the split
  between them, a ranked breakdown by category, and the latest entries.
- **Income** / **Expense** — that side of the ledger, grouped by day with a
  per-day total, filterable by category, month by month.
- **Entry form** — amount + unit, category, subcategory, description, date
  (today by default). Reached from the tab's **Add** button or the dashboard's
  quick actions; opening an existing entry edits or deletes it.
- **Categories** — create, edit and delete categories and their subcategories,
  each with a color and an icon.
- **Settings** — default unit, theme, text size, and erase-all-data.

## Layout

```
app/
  _layout.tsx            root Stack + providers (theme, font size, ledger)
  transaction.tsx        create / edit / delete one entry
  categories.tsx         category + subcategory manager
  settings.tsx           default unit, theme, text size, erase data
  (tabs)/
    _layout.tsx          PagerView + custom bottom tab bar
    index.tsx            Home (dashboard)
    income.tsx           Income list
    expense.tsx          Expense list
components/
  TransactionListScreen.tsx  the body both list tabs share
  TransactionRow.tsx     one line of the ledger
  CategoryBreakdown.tsx  ranked bars, one per category
  CategoryAvatar.tsx     a category's icon in its own color
  MonthSwitcher.tsx      prev / next month control
  TabHeader.tsx          shared top bar, raises a shadow on scroll
  ui/                    the component library (import from "@/components/ui")
contexts/
  LedgerContext.tsx      categories + transactions + persistence
  ThemeContext.tsx       persisted light/dark/system preference
  FontSizeContext.tsx    persisted text scale
  TabNavigationContext.tsx   jump to a sibling tab from a screen
  TabScrollShadowContext.tsx per-screen scroll state for header/tab-bar shadows
hooks/
  useTheme.ts            isDark, tc (runtime colors), mode, setMode
  useFont.ts             tf — font sizes scaled by the user's setting
lib/
  types.ts               Category, Subcategory, Transaction
  ledger.ts              pure selectors — totals, breakdowns, grouping
  money.ts               units, formatting, parsing
  date.ts                calendar-day helpers and the month grid
  categoryColors.ts      the validated category palette
  seed.ts                the categories a fresh install starts with
  theme.ts               runtime color values mirroring global.css
  storage.ts             AsyncStorage wrapper (preferences + JSON)
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

Use classes wherever a `className` is accepted:

```tsx
<View className="bg-card border border-border rounded-2xl">
  <Text className="text-foreground">Title</Text>
  <Text className="text-muted-foreground">Subtitle</Text>
</View>
```

Use `tc` only for props that can't take a class — icon colors,
`placeholderTextColor`, `shadowColor`, navigator options:

```tsx
const { tc } = useTheme();
<Ionicons name="add" size={20} color={tc.primary} />
```

Available surfaces/text: `background`, `card`, `muted`, `foreground`,
`secondary-foreground`, `muted-foreground`, `border`, `input`, `disabled`,
`placeholder`, `primary`, `primary-highlight`, `primary-fg`, `success`,
`danger`, `warning`. Income wears `success`, expense wears `danger`, everywhere.

> NativeWind 5 preview + Tailwind v4 can silently fail to compile opacity
> modifiers on core colors (`bg-black/50`). Use inline `rgba()` for those.
> Custom hex tokens like `bg-danger/15` are fine.

## Text size

Don't use Tailwind's `text-base` / `text-lg` for anything the user should be
able to scale — those are fixed. Read sizes from `useFont()` instead:

```tsx
const { tf } = useFont();
<Text className="text-foreground font-semibold" style={{ fontSize: tf.lg }}>
  Heading
</Text>
```

Keys: `xs`, `sm`, `base`, `lg`, `xl`, `xxl`, `xxxl`. Every component in
`components/ui` already does this, so the Settings control reaches all of them.

## Adding a tab

1. Add `app/(tabs)/reports.tsx` exporting a default component.
2. Add an entry to `TABS` in `app/(tabs)/_layout.tsx`, and add the key to
   `TabKey` in `contexts/TabNavigationContext.tsx`.
3. Call `useTabScrollShadow("reports")` on the screen's scroll view and spread
   the result onto it, so the header and tab bar get their shadows.

Tabs render through a `PagerView`, not a tab navigator — they're swipeable and
all stay mounted, keeping scroll position across switches. Because the pager
owns which tab is showing, `router.push` cannot reach a sibling tab; use
`useTabNavigation().goToTab("income")` instead. Pushing a new screen *over* the
tabs (like `app/transaction.tsx`) is normal routing.

## Adding a component

Put it in `components/ui/`, export it from `components/ui/index.ts`, and read
colors from `useTheme()` and sizes from `useFont()`. App-specific pieces that
know about transactions or categories live one level up, in `components/`.
