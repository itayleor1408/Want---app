---
name: penny-design
description: Penny's visual and interaction language (calm, minimal, springy, glassy mobile-first PWA style, Hebrew/English RTL-ready). Use when building a new app or new screens that should feel like Penny: tokens, components, motion rules, RTL rules, performance rules and a starter page.
---

# Penny design language

Use this whenever the goal is "make it feel like Penny". Files next to this one:
- `tokens.css`: the real design tokens (light + dark) and the core component CSS, copied from the app.
- `starter.html`: a single-file page that already has the look (header, hero number, cards, carousel, glass bottom nav, FAB, sheet with collapsible settings groups, info-icon rows, toggles, segmented control).
- The source of truth is always `want3.html` in this repo. If this file and the app disagree, the app wins.

## The feel in one paragraph
Quiet and confident. Lots of air, one huge number as the hero, small calm labels, soft rounded cards on a very light (or near-black) background with a barely visible colour glow behind everything. Everything you touch gives back: it squashes slightly under the finger and springs back. Nothing shouts: one accent (green) and one warning (red). No clutter, no duplicate controls, no walls of text.

## Principles
1. **Minimal first.** Show titles, not paragraphs. An explanation lives behind a small ⓘ that opens with an animation. Remove a control rather than adding a second way to do the same thing.
2. **One hero number per screen**, huge (76px, weight 800, letter-spacing -0.05em), centred, tappable to explain itself.
3. **Cards, not lines.** Rounded squircles with a soft layered shadow in light mode and a hairline inner highlight in dark mode.
4. **Sheets, not pages.** Secondary things open as a centred rounded sheet with a round close button and a "trio" of round buttons (back / action) at the bottom.
5. **Springy but short.** Small things overshoot (`cubic-bezier(.3,1.6,.5,1)`); large surfaces ease (`cubic-bezier(.2,.8,.2,1)`). Durations 0.25 to 0.4s. Never longer than 0.45s for something the user is waiting on.
6. **Immediate feedback.** Press = `scale(.96 to .97)`. Toggle moves first, heavier work (re-render, saving) runs a moment later.
7. **Undo over "are you sure"** for reversible actions (toast with Undo). Use "Are you sure?" only for things that change money or delete data.
8. **Honest empty states** in one line ("Tap − to log a payment").
9. **Both languages from day one.** English and Hebrew (RTL) are both first-class; test both.
10. **Offline-first, single file where possible.** No framework needed for this look; plain HTML/CSS/JS with a service worker.
11. **Steps, not forms.** Before building any window with more than about four fields, stop and ask: what is the minimum the user must answer, and in what order? Put one question group per step (for a task: *What?* with title and category, then *When?* with date, time and length). Make the earliest step enough to finish ("Add now"), put everything advanced behind a "More options" step, and let the user skip. Show a progress indicator and a back button. When editing, show collapsed rows with a one-line summary of the current value and open only the row being changed. Ask of every screen: what is shown by default, what can be revealed on tap, and what can be left out entirely? Choose smart defaults (today, 30 minutes, guessed category) so most fields never need touching.
12. **Long lists and chip rows: show a few, fade, arrow.** Anywhere options or items can grow (categories, places, durations, reminders, lists of tasks, saved things), show only the most relevant few and reveal the rest with a soft fade and a small arrow. Unordered sets (categories, places) show the most recently used first and pin the selected one to the front; ordered scales (durations, reminders, goal hours) keep their natural order and only pull the selected value forward if it would be hidden. Chip rows are one line that fades at the end; vertical lists show about three to eight rows and fade at the bottom. The arrow appears only when there is more to show, and everything must keep working in right-to-left. In code this is `chipRow()`, `vlist()` and `fitRows()` in `tempo/index.html`. Apply this to every new screen by default; it is a house rule, not a one-off.
13. **Anything that scrolls fades at the edge where there is more.** Sideways rows (class `hs`) fade on the side with hidden content; tall sheets scroll inside `.shb` and fade at the top or bottom. Never leave a scrolling area with a hard cut and no hint. Rows of chips that would wrap onto several lines should be one scrolling row instead (class `hrow hs`).
14. **Only show an option when it makes sense given the earlier choices.** If one answer makes another one redundant or meaningless, hide the second. Examples already in the app: duration buttons only when no start and end time is set (the end time defines the duration); Remind me only when there is a time; Travel only when there is a place and a time; Repeat only when there is a date; Go and Fit in never on the same row; the default-reminder rows only when notifications are on. Before shipping a screen, walk through each combination of earlier answers and ask what no longer applies.
15. **A button that can't be used yet is grey and says why.** Never let a tap fail silently or jump back a step. Grey it out (`gate(btn, reason, whyEl, fieldId)`), write the reason in one short line under it ("Write what the task is first"), and if it is tapped anyway shake the reason and focus the missing field.
16. **Creating something inside a flow opens its own pop-up, with a live preview.** For example a new category opens over the task form (`openPop`), shows a big tappable icon (tap to change it), the name, colours, and a preview of exactly how it will look in the app. Don't expand editors inline in the middle of another form.

## Tokens (see tokens.css for all values)
- Light: `--bg #f4f4f6`, card `#fff`, text `#111113`, secondary `#8a8a91`, accent green `#13a068`, red `#ec4a3e`.
- Dark: `--bg #121214`, card `#1c1c20`, text `#f2f2f5`, accent `#3ccf92`, red `#ff6a60`, sheet `#1f1f24`.
- Ambient glow behind the app: three soft radial gradients (green top-left, blue-ish right and bottom-left), 9 to 11% alpha.
- Type: system stack (`-apple-system, "SF Pro Text", Inter, system-ui`), weights 500 / 700 / 800. Headings and numbers use negative letter-spacing (-0.02 to -0.05em). Small caps-style group labels: 12.5px, 800, uppercase, +0.05em, secondary colour.
- Radii: card 26, stat card 22, pill 20, input 16, big button 20 (56px tall), sheet 34, bottom nav 34, round buttons 50%.
- Page side padding 20px, max content width about 488px, safe-area insets respected.
- Icons: 24px grid, stroke 1.9, round caps and joins, `currentColor`. About 100 are in the app (`ICO`/`ICONS` in `want3.html`).

## Components (all in tokens.css / starter.html)
- **Hero number** with odometer-style rolling digits on change.
- **Stat cards** (two side by side): tinted background from the accent via `color-mix`, label small, number big.
- **Pills** (filters): 14px, weight 700, `--fl` background, selected = inverted (text colour as background).
- **Segmented control**: the highlight is positioned and sized from the selected button's real `offsetLeft/offsetWidth`, never from an equal split. That is what keeps it centred in every language.
- **Settings group**: small uppercase title that collapses the group (animated with `grid-template-rows: 1fr to 0fr`), rows of "title + ⓘ + value/toggle"; the ⓘ expands an explanation with the same trick.
- **Toggle**: 51x31, spring knob, accent when on, mirrored in RTL.
- **Bottom nav**: floating glass pill, 3 to 4 items, 11px labels, selected item gets a soft fill and a slightly bigger icon.
- **FAB pair** above the nav: primary (inverted) and secondary (glass).
- **Toast** with Undo, and a **top notification pill** for events.
- **Jar fill / progress**: liquid-like fill that rises with a tiny overshoot; confetti only when a goal is reached.
- **Lists**: soft separators (`--hr`), 54px minimum row height, icon in a round `--fl` chip.
- **Drag to reorder**: lift (scale + shadow), neighbours slide, no re-render while dragging.

## Motion rules
- Easings: `spring = cubic-bezier(.3,1.6,.5,1)` (small controls), `soft-spring = (.3,1.4,.5,1)` (toggles, icons), `ease-out = (.2,.8,.2,1)` (entrances, sheets), `(.22,1,.36,1)` for slides.
- Entrance: `from {opacity:0; transform: translateY(10px)}` over .26 to .38s; stagger siblings by .05s up to 4 items.
- Sheets: scale .94 to 1 plus fade, .4s. Close removes after about .38s.
- Collapse/expand: animate `grid-template-rows` (0fr to 1fr) plus opacity, .4s. Do not animate `height: auto`.
- Never animate blur or backdrop-filter.

## RTL / Hebrew rules
- Use logical properties (`inset-inline-start`, `margin-inline-end`, `text-align: start`). Set `dir` on `<html>`.
- Mirror directional icons (`:root[dir=rtl] .fl { transform: scaleX(-1) }`), flip toggle travel direction.
- Carousels: `scroll-padding-inline` equal to the side padding so the first item lines up with the cards in both directions.
- When the language flips, controls that animate from a previous position must start in their final position (no glide), or they flash.
- Put every user-visible string through one `t()` lookup with an English key and a Hebrew value.

## Performance rules (learned the hard way)
- **No `backdrop-filter` on large or scrolling surfaces.** A 40px blur on a sheet dropped Settings to about 30fps. Sheets get an opaque `--sheet` colour; keep blur only on small fixed elements (bottom nav, toast).
- **Never nest backdrop filters** (blur inside blur).
- Run heavy work after the visual feedback (toggle first, re-render after about 90ms).
- `touch-action: manipulation` on controls; `-webkit-tap-highlight-color: transparent`.
- Measure: Playwright with `Emulation.setCPUThrottlingRate` rate 4, record `requestAnimationFrame` deltas while opening and scrolling a sheet; target p95 about 16.7ms.

## Copy and tone
Short, plain, friendly. Sentence case. Titles are nouns or short verbs ("Back up now", "Reset all data"). Explanations are one sentence, behind ⓘ. Confirmations say exactly what will happen to the data.

## Icons
`starter.html` uses text symbols as placeholders. For real icons copy the `ICO` map and the `ic(name,size)` helper from `want3.html` (about 100 stroke icons on a 24px grid, drawn to match the style). Add new ones as plain `<path>` strokes on the same grid and check them on a contact sheet before using them.

## Using this skill in another project
- Same repo: it is already at `.claude/skills/penny-design/`, so any Claude session in this repo can use it.
- New app: copy the whole `penny-design` folder into that project's `.claude/skills/` (or into `~/.claude/skills/` to have it in every project), then ask for "a new app in the Penny style".

## Checklist for a new app in this style
1. Copy `tokens.css`, start from `starter.html`.
2. Decide the hero number and the 2 stat cards for the home screen.
3. Keep navigation to 3 or 4 tabs; everything else opens as a sheet.
3b. Every sheet or form: apply principle 11. One question group per step, a way to finish early, advanced options hidden.
4. Settings: grouped, collapsible, titles only, ⓘ for explanations, no duplicate controls.
5. Add `t()` with English and Hebrew, set `dir`, test both.
6. Dark mode via the token block (follow system, allow override).
7. Add the offline service worker and a manifest with a simple, bold, single-colour icon.
8. Write Playwright tests: screens render without NaN/undefined, controls fit in both languages, frame pacing under CPU throttle.
