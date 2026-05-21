# Design System — Newsletter SaaS Platform

Reverse-engineered design specification for consistent UI implementation.

---

## Color Palette

```css
/* Core */
--color-bg-base:        #0A0E27;  /* deep navy — page background */
--color-bg-surface:     #111830;  /* slightly lighter navy — cards, panels */
--color-bg-overlay:     rgba(255, 255, 255, 0.05); /* glassmorphism fill */

/* Accent */
--color-accent-primary: #E91E8C;  /* vibrant magenta — headings, highlights */
--color-accent-blue:    #5B63EB;  /* royal blue — primary CTA button */

/* Text */
--color-text-primary:   #FFFFFF;  /* white — headings, nav links */
--color-text-secondary: #B4B4B4;  /* light gray — subtitles, body copy */
--color-text-muted:     #6B7A99;  /* muted blue-gray — placeholders, captions */

/* Border */
--color-border-default: #2A3858;  /* dark blue-gray — card borders, dividers */
--color-border-accent:  #5B63EB;  /* blue — highlighted card borders */
```

---

## Typography

### Font Stack

```css
font-family: 'Inter', 'Poppins', 'Outfit', sans-serif;
```

Use whichever is loaded. Priority order: Inter → Poppins → Outfit → system sans-serif.

### Scale

| Role             | Size       | Weight | Color                   | Usage                          |
|-----------------|------------|--------|-------------------------|--------------------------------|
| Hero Heading    | 56–72px    | 800    | `#FFFFFF` + `#E91E8C`  | Main page headline             |
| Section Heading | 36–48px    | 700    | `#FFFFFF`               | Section titles                 |
| Sub-heading     | 24–28px    | 700    | `#FFFFFF`               | Card titles, feature names     |
| Body Large      | 18–20px    | 400    | `#B4B4B4`               | Hero subtitle, descriptions    |
| Body Default    | 14–16px    | 400–500| `#B4B4B4`               | General copy                   |
| Label / Caption | 12–13px    | 500    | `#6B7A99`               | Metadata, tags, helper text    |
| Nav Link        | 14–15px    | 500    | `#FFFFFF`               | Navigation items               |

### Accent Text Pattern

Key words in headings (e.g., "NEWSLETTERS") use `--color-accent-primary`:

```html
<h1>
  The best platform for
  <span style="color: #E91E8C;">NEWSLETTERS</span>
</h1>
```

---

## Spacing & Layout

```css
/* Base unit: 4px */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;

/* Container */
--container-max:    1280px;
--container-padding: 0 24px;
```

---

## Border Radius

```css
--radius-sm:   6px;   /* tags, chips */
--radius-md:   10px;  /* buttons, inputs */
--radius-lg:   16px;  /* cards */
--radius-xl:   24px;  /* large panels */
--radius-full: 9999px; /* pill buttons */
```

---

## Buttons

### Primary — Solid Blue

```css
background: #5B63EB;
color: #FFFFFF;
border: none;
border-radius: var(--radius-md);   /* or --radius-full for pill */
padding: 12px 24px;
font-size: 15px;
font-weight: 600;
cursor: pointer;
transition: background 0.2s ease, transform 0.1s ease;

/* Hover */
background: #6E75F0;
transform: translateY(-1px);
```

### Secondary — Outlined

```css
background: transparent;
color: #FFFFFF;
border: 1.5px solid #2A3858;
border-radius: var(--radius-md);
padding: 12px 24px;
font-size: 15px;
font-weight: 600;

/* Hover */
border-color: #5B63EB;
color: #5B63EB;
```

### Tertiary — Text Link

```css
background: transparent;
color: #FFFFFF;
border: none;
padding: 8px 12px;
font-size: 15px;
font-weight: 500;

/* Hover */
color: #E91E8C;
```

### Google / OAuth Button

```css
background: #FFFFFF;
color: #1A1A2E;
border: none;
border-radius: var(--radius-md);
padding: 12px 24px;
font-size: 15px;
font-weight: 600;
display: flex;
align-items: center;
gap: 10px;
/* Include provider logo as inline SVG or img */
```

---

## Navigation Bar

```
Layout:    flex, space-between, vertically centered
Height:    64–72px
Background: #0A0E27 (same as page, no elevation by default)
Border-bottom: 1px solid #2A3858 (subtle separator on scroll)
Padding:   0 32px

Left:   Logo (white SVG/text)
Center: Nav links — Platform ▾  Solutions ▾  Resources ▾  Pricing
Right:  Login (text link)  |  Get a demo (outlined btn)  |  Sign up for free (solid blue btn)
```

Dropdown menus:
```css
background: #111830;
border: 1px solid #2A3858;
border-radius: var(--radius-lg);
box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
padding: 12px 0;
```

---

## Hero Section

```
Layout:    centered, max-width 800px, text-align center
Padding:   120px 24px 80px

Structure:
  [Optional eyebrow badge]
  H1 heading — large, bold, accent word in magenta
  Subtitle — 18–20px, #B4B4B4, max-width 600px
  CTA row — [Google signup btn]  [Email signup btn]
  Hero visual — dashboard mockup with glassmorphism cards below
```

---

## Cards

### Standard Card

```css
background: #111830;
border: 1px solid #2A3858;
border-radius: var(--radius-lg);
padding: 24px;
```

### Glassmorphism Card (Dashboard Mockups)

```css
background: rgba(255, 255, 255, 0.04);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: var(--radius-xl);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
```

### Accent-Border Card (Featured / Highlighted)

```css
border: 1px solid #5B63EB;
/* optionally add a subtle glow */
box-shadow: 0 0 0 1px rgba(91, 99, 235, 0.3), 0 8px 32px rgba(91, 99, 235, 0.15);
```

---

## Form Inputs

```css
background: #111830;
border: 1.5px solid #2A3858;
border-radius: var(--radius-md);
padding: 12px 16px;
color: #FFFFFF;
font-size: 15px;
outline: none;
transition: border-color 0.2s;

/* Focus */
border-color: #5B63EB;
box-shadow: 0 0 0 3px rgba(91, 99, 235, 0.2);

/* Placeholder */
color: #6B7A99;
```

---

## Shadows & Elevation

```css
--shadow-sm:  0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-md:  0 8px 24px rgba(0, 0, 0, 0.4);
--shadow-lg:  0 16px 48px rgba(0, 0, 0, 0.5);
--shadow-glow-blue: 0 0 24px rgba(91, 99, 235, 0.35);
--shadow-glow-pink: 0 0 24px rgba(233, 30, 140, 0.35);
```

---

## Badges & Tags

```css
/* Default */
background: rgba(91, 99, 235, 0.15);
color: #5B63EB;
border: 1px solid rgba(91, 99, 235, 0.3);
border-radius: var(--radius-full);
padding: 4px 12px;
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;

/* Accent / New */
background: rgba(233, 30, 140, 0.15);
color: #E91E8C;
border-color: rgba(233, 30, 140, 0.3);
```

---

## Background Effects

### Radial Gradient Glow (Hero)

```css
background:
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(91, 99, 235, 0.25) 0%, transparent 60%),
  #0A0E27;
```

### Subtle Grid Overlay (Optional)

```css
background-image:
  linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
background-size: 40px 40px;
```

---

## Dividers

```css
border: none;
border-top: 1px solid #2A3858;
```

---

## Motion & Transitions

```css
/* Standard */
transition: all 0.2s ease;

/* Hover lift */
transform: translateY(-2px);
box-shadow: var(--shadow-lg);

/* Entrance animations (use sparingly) */
/* Fade up: opacity 0→1, translateY 16px→0, duration 0.4s ease-out */
```

---

## Iconography

- Style: outlined or duotone, 20–24px default, 16px for inline/compact
- Color: inherits `currentColor` for flexibility; accent icons use `#5B63EB` or `#E91E8C`
- Recommended set: Lucide Icons, Heroicons, or Phosphor Icons

---

## Responsive Breakpoints

```css
--bp-sm:  640px;
--bp-md:  768px;
--bp-lg:  1024px;
--bp-xl:  1280px;
--bp-2xl: 1536px;
```

---

## Quick Reference Cheat Sheet

| Token               | Value       | Use                          |
|--------------------|-------------|------------------------------|
| `bg-base`          | `#0A0E27`   | Page background              |
| `bg-surface`       | `#111830`   | Cards, nav, dropdowns        |
| `accent-pink`      | `#E91E8C`   | Heading highlights           |
| `accent-blue`      | `#5B63EB`   | Primary buttons, borders     |
| `text-primary`     | `#FFFFFF`   | Headings, nav                |
| `text-secondary`   | `#B4B4B4`   | Body, subtitles              |
| `border`           | `#2A3858`   | Card borders, dividers       |
