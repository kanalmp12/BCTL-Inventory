---
name: BCTL Inventory
description: Reliable equipment checkout and tracking system for BUCA Talent
colors:
  primary: "#1363eb"
  secondary: "#187295"
  accent: "#966304"
  success: "#15833c"
  warning: "#b05207"
  destructive: "#c52020"
  neutral-bg: "#f7f9fa"
  neutral-fg: "#12161a"
  border: "#dbe0e6"
  muted: "#f1f3f5"
  muted-fg: "#617285"
typography:
  display:
    fontFamily: "var(--font-noto-thai), var(--font-inter), sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "var(--font-noto-thai), var(--font-inter), sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-noto-thai), var(--font-inter), sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: BCTL Inventory

## 1. Overview

**Creative North Star: "The Operational Cabin"**

The BCTL Inventory visual system prioritizes clarity, low cognitive load, and high functional reliability. Designed for BUCA Talent staff and students managing physical media equipment, the interface serves physical, focused operations. Spacing is rhythmic, density is high to support reading tabular logs, and visual distractions are minimized.

This system rejects cluttered dashboards with overwhelming metrics, distracting flashy gradients, and excessive nested cards. The tool disappears into the task.

**Key Characteristics:**
- High-density information presentation with clean borders.
- Structured, predictable layout hierarchy (desktop top bar and side navigation).
- State-rich semantic vocabulary (hover, active, warning, success) using solid background tints.

## 2. Colors

The color system is restrained, using Bangkok University brand-tinted neutrals with focused primary actions and state indicator accents.

### Primary
- **Bangkok University Blue** (#1a5fb4): The canonical brand color. Note: The current codebase uses a cobalt blue (#1363eb) which is a P1 brand mismatch. All future adjustments should align primary actions to #1a5fb4.

### Secondary
- **Slate Teal** (#187295): Used for secondary operations such as CSV export, supporting action links, and secondary category badges.

### Accent
- **Amber Gold** (#966304): Used for low-stock warning indicators, pending reviews, and administrative attention tags.

### Neutral
- **Cabin Background** (#f7f9fa): Ambient canvas color for the layout.
- **Card Background** (#ffffff): Clean solid background for containers.
- **Cabinet Border** (#dbe0e6): Defined border gray for dividers, grid items, and tables.
- **Cabin Text** (#12161a): High contrast body text.
- **Muted Text** (#617285): Secondary labels and supporting details.

### Named Rules
**The Rarity Rule.** The primary accent is used on <=10% of any given screen. Saturated colors represent interactive capability or state changes only, not decoration.

**The Muted State Rule.** Non-interactive elements and background highlights must utilize transparent tints (success/10, destructive/10) to preserve visual calm.

## 3. Typography

**Display Font:** Noto Sans Thai (with Inter, sans-serif fallbacks)
**Body Font:** Noto Sans Thai (with Inter, sans-serif fallbacks)
**Label/Mono Font:** Noto Sans Thai (with Inter, sans-serif fallbacks)

**Character:** Clean, highly readable geometric sans-serif stack supporting clear Thai glyphs and English numerals, optimized for dpi consistency.

### Hierarchy
- **Display** (800, 30px, 1.25): Used for page titles and main headers.
- **Headline** (700, 20px, 1.3): Used for tab section titles and key modal headers.
- **Title** (700, 16px, 1.4): Used for item names, card headings, and table column titles.
- **Body** (500, 14px, 1.5): Used for descriptions, inputs, list items, and general reading. Max line length is 65-75ch for prose.
- **Label** (700, 12px, normal): Used for tags, metadata details, status indicators, and button text.

### Named Rules
**The Numeric Clarity Rule.** Tabular numbers, quantities, and item codes must align clearly with their text headers, using consistent font weights and sizes to facilitate rapid scanning.

## 4. Elevation

The system is flat by default, conveying hierarchy and depth through clean gray borders (#dbe0e6 / var(--border)) and contrasting neutral backgrounds instead of heavy drop shadows.

### Shadow Vocabulary
- **Active Focus Glow** (`box-shadow: 0 0 0 2px hsl(var(--ring))`): Used for keyboard focus rings and active button inputs.
- **Interactive Hover** (`box-shadow: 0 4px 12px rgba(0,0,0,0.05)`): Subtle ambient shadow applied only during active click/drag states.

### Named Rules
**The Flat-by-Default Rule.** All layouts, cards, and tables are flat at rest. Drop shadows are prohibited for static decoration.

## 5. Components

All components provide distinct visual feedback for default, hover, focus, and active states.

### Buttons
- **Shape:** Rounded medium (8px / `rounded-xl`).
- **Primary:** Bangkok University Blue background, white text, `px-4 py-2.5` padding.
- **Hover / Focus:** Transitions to darker blue on hover, shows primary focus ring on keyboard focus.

### Chips
- **Style:** Compact pill layout, transparent background tint matching status (e.g. success/10), thin border.
- **State:** Active tags use bold text with 70% opacity borders.

### Cards / Containers
- **Corner Style:** Large rounded (16px / `rounded-2xl`).
- **Background:** Solid Card Background (#ffffff).
- **Shadow Strategy:** Flat border at rest.
- **Border:** Thin border divider (1px border-border).
- **Internal Padding:** Large layout padding (24px / `p-6`).

### Inputs / Fields
- **Style:** Flat white background, thin border (1px border-input), medium rounded (8px / `rounded-xl`).
- **Focus:** Primary ring outline (2px primary) with transparent border.

### Navigation
- **Style:** Sidebar-focused layout on desktop, collapsing to top-bar hamburger on mobile. Active tab receives primary background tint and text highlight.

### Onboarding & Identity Verification Wizard
- **Style:** Compact modal card layout (`max-w-lg rounded-2xl shadow-2xl border`) with dynamic progression steps.
- **Verification Flow:** Step 1 requires university email (@bumail.net) and phone number. Matches against Supabase roster server-side to prevent client-side RLS blocking and normalizes phone number formats dynamically.
- **Registration Flow:** Pre-fills verified credentials, showing a multi-step form (Personal, Education, Avatar) only if the profile is not found.

## 6. Do's and Don't's

### Do:
- **Do** align tables and lists to consistent typographic columns with 1px border dividers.
- **Do** use semantic transparent background colors (e.g. bg-success/10 text-success) to mark status indicators.
- **Do** ensure all clickable items have a visible focus ring (`focus-ring`) for accessibility.
- **Do** maintain a consistent 8px/16px rounding system throughout the interface.
- **Do** perform verification checks via the secure `/api/auth/check-student` server endpoint to avoid client RLS blocks.
- **Do** pre-fill verified inputs (email, phone) in registration forms to reduce user friction.

### Don't:
- **Don't** use cluttered dashboard layouts with overwhelming metrics or distracting flashy gradients.
- **Don't** use excessive nested cards; nested cards are prohibited.
- **Don't** use side-stripe borders (e.g. border-left > 1px as a colored stripe on cards, alerts, or list items).
- **Don't** use gradient text (e.g. background-clip: text combined with a gradient background).
- **Don't** use glassmorphism decoratively.
- **Don't** redirect to registration if the email already exists in the system but the phone number is incorrect.
- **Don't** run database lookups directly from client-side handlers on RLS-protected tables.
