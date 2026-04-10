---
name: FAQ embedded in Profile Help
overview: Show the hardcoded FAQ accordion when the user taps Resources > Help, using React Native core only—no new Expo route, no `faq.tsx`, and no changes to the profile list beyond wiring Help.
todos:
  - id: help-faq-ui
    content: Add FAQ accordion UI (hardcoded `faqs` from FAQ_SCREEN.md) triggered by Help—prefer Modal + DrillDownHeader-style chrome, or inline block in profile if product prefers zero overlay
  - id: profile-wire-help
    content: In profile.tsx, handle key === 'help' to open FAQ (setModalVisible / expand); remove showComingSoon for help
  - id: no-route
    content: Do not add faq.tsx, Stack.Screen faq, or router.push('/faq')
---

# FAQ content on Profile > Help (no new screen route)

## What changed from the earlier plan

- **Do not** add [`mobile/app/faq.tsx`](mobile/app/faq.tsx), **`Stack.Screen` for `faq`**, or **`router.push('/faq')`**.
- **Do not** add a separate Resources row (e.g. "Help & FAQ") or reorder rows for FAQ—the existing **Help** row is the entry point.
- **Do** implement the same behaviour and copy as [`FAQ_SCREEN.md`](file:///Users/brendinduplessis/Desktop/FAQ_SCREEN.md): eight hardcoded FAQs, single-open accordion, chevron, `LayoutAnimation` / `Animated`, RN core only (no accordion libraries).

## UX approach

Tapping **Profile → Resources → Help** opens the FAQ experience **without** registering a new stack screen:

- **Recommended:** [`Modal`](https://reactnative.dev/docs/modal) (`animationType="slide"`, full-screen or large sheet) containing:
  - Back/close control (top left) to dismiss
  - Title: **Help & FAQ**, subtitle: **Answers to common questions**
  - `ScrollView` with the accordion list (styles per spec: 15/14px, weights, padding, dividers)

This keeps the Profile list unchanged, avoids a new route, and gives enough space for eight items.

- **Alternative** (only if you want zero overlay): render the same accordion **inline** inside the Profile `ScrollView` (e.g. state `helpExpanded` toggled from Help row). Heavier layout; use if Modal is unacceptable.

## Implementation notes

- **Where to put code:** Either colocate in [`mobile/app/(tabs)/profile.tsx`](mobile/app/(tabs)/profile.tsx) or extract a presentational component such as [`mobile/components/HelpFaqModal.tsx`](mobile/components/HelpFaqModal.tsx) that receives `visible` and `onClose`—still **not** an Expo Router screen.
- **`handleSettingsItemPress`:** `if (key === 'help') { ... open modal / set state; return; }` — do **not** call `showComingSoon()` for `help`.
- **Icons:** `@expo/vector-icons/Ionicons` for chevron matches the rest of the app; not an accordion library.
- **Android:** enable layout animation once if using `LayoutAnimation`.

## Verification

- Help row still labelled **Help**; tap shows FAQ content (modal or inline per chosen UX).
- No new routes; no `faq` file under `app/`.
- All eight items collapsed initially; single-open accordion; chevron and animation per spec.
