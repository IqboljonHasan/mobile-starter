# Mobile Starter

React Native (Expo) starter template: expo-router, NativeWind 5 with semantic
color tokens, a light/dark/system theme switcher, and an app-wide text-scale
setting, wired through a small UI kit and three example tabs.

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

## Layout

```
app/
  _layout.tsx            root Stack + providers (theme, font size)
  details.tsx            pushed stack route, reads route params
  (tabs)/
    _layout.tsx          PagerView + custom bottom tab bar
    index.tsx            Home
    components.tsx       Live gallery of every UI component
    settings.tsx         Theme mode + text size
components/
  TabHeader.tsx          Shared top bar, raises a shadow on scroll
  ui/                    The component library (import from "@/components/ui")
contexts/
  ThemeContext.tsx       Persisted light/dark/system preference
  FontSizeContext.tsx    Persisted text scale
  TabNavigationContext.tsx   Jump to a sibling tab from a screen
  TabScrollShadowContext.tsx Per-screen scroll state for header/tab-bar shadows
hooks/
  useTheme.ts            isDark, tc (runtime colors), mode, setMode
  useFont.ts             tf — font sizes scaled by the user's setting
lib/
  theme.ts               Runtime color values mirroring global.css
  storage.ts             AsyncStorage wrapper for preferences
global.css               Tailwind theme + semantic tokens (light & dark)
```

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
`danger`, `warning`.

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
`useTabNavigation().goToTab("components")` instead. Pushing a new screen *over*
the tabs (like `app/details.tsx`) is normal routing.

## Adding a component

Put it in `components/ui/`, export it from `components/ui/index.ts`, and read
colors from `useTheme()` and sizes from `useFont()`. Then add a live example to
the Components tab so it stays discoverable.
