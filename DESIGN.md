---
name: คมกริบ บาร์เบอร์ · Komkrip Barber
description: Booking and live queue system for a fictional Thai barbershop.
colors:
  pole-amber: "#ffb22e"
  pole-amber-pale: "#ffe2a6"
  clipper-black: "#111111"
  clipper-charcoal: "#2a2a2a"
  towel-cream: "#f4f1ea"
  towel-cream-deep: "#e9e4d8"
  card-white: "#ffffff"
  stone-grey: "#5f5a50"
  sand-line: "#d9d2c3"
  barber-red: "#d93a2b"
  barber-red-pale: "#fbd9d3"
  done-green: "#1d7a45"
  done-green-pale: "#cdebd7"
typography:
  display:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(36px, 5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  code:
    fontFamily: "Chakra Petch, Prompt, ui-monospace, monospace"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  code-hero:
    fontFamily: "Chakra Petch, Prompt, ui-monospace, monospace"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  xl: "40px"
  lg: "32px"
  md: "24px"
  sm: "16px"
  control: "14px"
  chip: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 56px)"
  wrap: "1440px"
  panel: "28px"
  card: "20px"
  grid-gap: "14px"
  side: "380px"
components:
  button-primary:
    backgroundColor: "{colors.pole-amber}"
    textColor: "{colors.clipper-black}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
    height: "48px"
  button-primary-disabled:
    backgroundColor: "{colors.towel-cream-deep}"
    textColor: "#8a8478"
  button-ghost:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.clipper-black}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.towel-cream}"
  button-danger:
    backgroundColor: "{colors.barber-red}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.clipper-black}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "56px"
  slot:
    backgroundColor: "{colors.card-white}"
    typography: "{typography.code}"
    rounded: "{rounded.control}"
    height: "56px"
  slot-selected:
    backgroundColor: "{colors.pole-amber}"
  choice-card:
    backgroundColor: "{colors.towel-cream}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
  choice-card-selected:
    backgroundColor: "{colors.pole-amber}"
  panel:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel}"
  chip-booked:
    backgroundColor: "{colors.pole-amber-pale}"
    textColor: "#7a4b00"
    rounded: "{rounded.chip}"
    padding: "2px 10px"
  chip-done:
    backgroundColor: "{colors.done-green-pale}"
    textColor: "{colors.done-green}"
    rounded: "{rounded.chip}"
    padding: "2px 10px"
  chip-cancelled:
    backgroundColor: "{colors.barber-red-pale}"
    textColor: "{colors.barber-red}"
    rounded: "{rounded.chip}"
    padding: "2px 10px"
  nav-link-active:
    backgroundColor: "{colors.clipper-black}"
    textColor: "{colors.towel-cream}"
    rounded: "12px"
    padding: "8px 14px"
  admin-nav-active:
    backgroundColor: "{colors.pole-amber}"
    textColor: "{colors.clipper-black}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
---

# Design System: คมกริบ บาร์เบอร์ · Komkrip Barber

## Overview

**Creative North Star: "The Ticket Counter"**

A bold, high-contrast barbershop counter: near-black ink, warm off-white paper, and one barber-pole amber. Everything is a chunky physical object: 2px black outlines, big rounded corners, and hard offset shadows with no blur, so cards and buttons look like printed tickets and cardboard tokens you can press. The booking ends in a literal paper ticket with a perforation, a barcode and a status stamp.

The customer flow is a five-step stepper with large touch targets (48-56px) and a sticky dark summary card; the admin is a dark-sidebar dashboard with a timeline board per barber. Numbers, times and booking codes are set in Chakra Petch, a squared techno face, so they read like a queue display.

Motion is small and tactile: hover lifts 1-2px, press sinks 3px and the hard shadow collapses; the barber pole logo animates its stripes.

**Key Characteristics:**
- Clipper black (#111111) outlines and text, towel cream (#f4f1ea) page, pole amber (#ffb22e) for selection and the main action.
- Hard offset shadows (`0 5px 0` ink) instead of soft blur.
- 2px borders on every interactive card, input and button.
- Chakra Petch for every time, code and count.
- Ticket, stamp and barber-pole motifs.

## Colors

Monochrome ink and paper with one loud amber, plus small red and green status voices.

### Primary
- **Pole Amber** (#ffb22e): primary buttons, selected slot/service/barber, current stepper dot, highlighted headline word, booking code background, focus outline and input focus ring, toast, active admin nav.
- **Pole Amber Pale** (#ffe2a6): "booked" chips and booked appointments on the board.

### Neutral
- **Clipper Black** (#111111): text, all borders, hard shadows, dark cards (summary, first hero fact, KPI dark), admin sidebar, footer, demo strip.
- **Clipper Charcoal** (#2a2a2a): secondary text on light.
- **Towel Cream** (#f4f1ea): page background, choice cards at rest, ghost hover.
- **Towel Cream Deep** (#e9e4d8): disabled and no-show fills, nav hover.
- **Card White** (#ffffff): panels, cards, inputs, slots.
- **Stone Grey** (#5f5a50): muted text. **Sand Line** (#d9d2c3): idle stepper dots and connectors, dashed empty states.

### Status
- **Barber Red** (#d93a2b) / **Barber Red Pale** (#fbd9d3): errors, cancel actions, cancelled chips and stamp.
- **Done Green** (#1d7a45) / **Done Green Pale** (#cdebd7): "free slots" pills, done chips and stamp.

### Named Rules
**The One Pole Rule.** Amber marks exactly what is selected or what to press next. If two things on a screen are amber, one of them is wrong.

**The Ink Outline Rule.** Interactive surfaces carry a 2px Clipper Black border; disabled ones lose it to a lighter or dashed line.

## Typography

**Display Font:** Prompt 600-700
**Body Font:** IBM Plex Sans Thai (with system-ui)
**Label/Mono Font:** Chakra Petch 600-700 with tabular numerals (times, dates, codes, KPIs)

**Character:** A sturdy Thai geometric sans for voice, a readable humanist body face, and a squared display-board face for anything a customer has to read off the queue.

### Hierarchy
- **Display** (700, clamp(36px, 5vw, 64px), 1.22): hero headline with an amber `mark` highlight.
- **Headline** (700, clamp(26px, 3vw, 36px)): step panel titles.
- **Title** (600, 19-20px): card heads, summary title, hero fact titles.
- **Body** (400, 16px, 1.65): general copy; 18px for hero lead.
- **Label** (Prompt 600, 15px): form labels, buttons (16px), chips (13px).
- **Code** (Chakra Petch 600, 19px slots / 28px day numbers / 36px KPI values / 42px booking code at 0.14em tracking).

### Named Rules
**The Display Board Rule.** Any time, date number, booking code or count is Chakra Petch. Thai words never are.

## Layout

Centered wrap `min(1440px, 100% - 2 × clamp(16px, 4vw, 56px))`. The booking page is a two-column grid: flow `minmax(0, 1fr)` plus a 380px sticky summary (gap 28px). Service and barber choices auto-fill at min 300px; slots auto-fill at min 96px; on desktop (≥1025px) the date strip becomes a 7-column grid, below that a horizontally scrolling snap row of 82px day cards. Panels pad 28px, cards 20px, grids gap 10-16px.

Admin: a 248px black sidebar plus main area, a 4-up KPI row, and a board + rail grid. Breakpoints: 1180px (admin to one column, KPIs 2-up), 1024px (booking to one column, summary hidden), 900px, 640px (fixed bottom bar with step info and the primary button).

## Elevation & Depth

No blurred shadows on content. Depth is a hard, flat offset in solid ink, as if cards were cut from card stock and raised. Selection and hover add the offset; pressing removes it.

### Shadow Vocabulary
- **Hard** (`box-shadow: 0 5px 0 #111111`): panels, hero facts, KPIs, hovered/selected choice cards.
- **Hard small** (`box-shadow: 0 3px 0 #111111`): primary buttons, selected slot, current stepper dot, toast, hovered appointment.
- **Amber underline** (`box-shadow: 0 5px 0 #ffb22e` / `0 4px 0`): dark summary card and the selected day.
- **Ticket** (`box-shadow: 0 6px 0 #111111`): the booking ticket.
- **Focus ring** (`box-shadow: 0 0 0 4px #ffb22e`): focused inputs.

### Named Rules
**The Press-Down Rule.** Hover rises 1-2px with the offset; active sinks 3px and the shadow goes to `0 0 0`. Never use a blurred drop shadow on a card.

## Shapes

Big, friendly rounding on heavy outlines. Scale: 40px (footer top corners), 32px (panels, cards, summary), 28px (ticket), 24px (choice cards, hero facts, KPIs, stepper), 20px (day cards), 16px (inputs, alerts), 14px (buttons, slots, toast, admin nav), 12px (top-nav links, icon buttons, appointments), 999px chips, circles for avatars, stepper dots and KPI icons. The ticket uses a dashed perforation with circular notches; stamps are rotated -12deg bordered boxes.

## Components

### Buttons
- **Shape:** gently rounded (14px), 2px ink border; 48px tall (56px large at 16px radius, 38px small at 11px radius).
- **Primary:** Pole Amber fill, ink Prompt 600 16px text, padding 10px 22px, hard-small shadow.
- **Hover / Focus:** rise 1px with `0 4px 0` shadow; active sinks 3px with no shadow. Focus is a 3px amber outline, 2px offset.
- **Disabled:** cream-deep fill, pale border and text, no shadow.
- **Ghost:** white fill, cream on hover; danger ghost uses red text and border. **Danger:** solid red, white text. **Link:** underlined, no border.

### Chips
- **Style:** pill, 1.5px border, Prompt 600 13px, leading 7px dot in current color.
- **State:** booked = amber pale with brown text; done = green pale; no-show = cream deep, grey; cancelled = red pale. Section tag: amber block with 9px radius.

### Cards / Containers
- **Corner Style:** 32px panels and cards, 24px choice cards.
- **Background:** white, or towel cream for choice cards at rest; dark summary card in ink with amber text.
- **Shadow Strategy:** hard offset (see Elevation).
- **Border:** 2px ink.
- **Internal Padding:** 28px panels, 20-24px cards, 16px 18px choice cards (min-height 92px).

### Inputs / Fields
- **Style:** white, 2px ink border, 16px radius, 56px tall, 17px text, Prompt 600 labels above.
- **Focus:** no outline; 4px solid amber ring.
- **Error:** red border and red message below.

### Navigation
- **Top bar:** sticky, translucent cream with 10px blur and a 2px ink bottom border, 72px tall. Prompt 500 16px links with 12px radius; hover cream-deep; current page solid ink with cream text; the admin link is outlined.
- **Admin sidebar:** black, links #e6e1d6 with 14px radius; hover dark grey; current page amber with ink text.
- **Mobile (≤640px):** fixed white bottom bar with a 2px ink top border holding step info and the primary button.

### Stepper
- Five 40px circular dots joined by 3px connectors. Idle: sand outline; open: ink outline; done: ink fill with amber numeral; current: amber fill, hard-small shadow, lifted 2px, bold label.

### Time Slots and Day Cards
- Slots are 56px white tiles in Chakra Petch 19px; selected = amber, lifted with hard-small shadow; taken = dashed border, struck through. Day cards are 82px wide, 20px radius; selected = ink fill with amber date and an amber offset underline; closed days get a faint diagonal hatch.

### Booking Ticket (signature)
- 400px max, 28px radius, ink header strip in Chakra Petch caps, a 42px amber booking code, dashed perforation with notches, barcode stub, and a rotated status stamp (red cancelled, green done). Animates in with a "print" keyframe.

### Barber Pole (brand mark)
- Small vertical pole with ink caps and animated diagonal amber/white/ink stripes (3s linear loop); amber caps on dark surfaces.

## Do's and Don'ts

### Do:
- **Do** outline every interactive card, input and button in 2px Clipper Black (#111111).
- **Do** use hard offset shadows (`0 5px 0` / `0 3px 0` ink) and the press-down interaction.
- **Do** reserve Pole Amber (#ffb22e) for the selected item and the next action.
- **Do** set times, dates, codes and counts in Chakra Petch with tabular numerals.
- **Do** keep touch targets at 48px or more (inputs and slots 56px).

### Don't:
- **Don't** use blurred drop shadows on content cards.
- **Don't** add a second accent hue; red and green are status only.
- **Don't** set Thai words in Chakra Petch.
- **Don't** use `window.alert` or `confirm`; confirm inline.
