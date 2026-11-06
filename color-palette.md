# StillSafe color palette

Soft purple and pink, as used in the app (`project/stillsafe/app/globals.css`, `:root` variables).

## Brand

| Swatch | Name | Hex | CSS variable | Used for |
|---|---|---|---|---|
| ![](https://placehold.co/24x24/6D4C91/6D4C91.png) | Primary purple | `#6D4C91` | `--accent` | Buttons, user chat bubbles, links, card headings |
| ![](https://placehold.co/24x24/EFE6F7/EFE6F7.png) | Light purple | `#EFE6F7` | `--accent-soft` | Soft backgrounds, tags, "what if" boxes |
| ![](https://placehold.co/24x24/E9A5C6/E9A5C6.png) | Pink | `#E9A5C6` | `--pink` | Logo, hover and focus highlights (decorative only) |
| ![](https://placehold.co/24x24/FDF1F7/FDF1F7.png) | Light pink | `#FDF1F7` | `--pink-soft` | "Why we ask" boxes, hover fills |

## Neutrals

| Swatch | Name | Hex | CSS variable | Used for |
|---|---|---|---|---|
| ![](https://placehold.co/24x24/FCF8FB/FCF8FB.png) | Background | `#FCF8FB` | `--bg` | Page background (very light pink-white) |
| ![](https://placehold.co/24x24/FFFFFF/FFFFFF.png) | Card | `#FFFFFF` | `--card` | Cards, bot chat bubbles |
| ![](https://placehold.co/24x24/2E2833/2E2833.png) | Text | `#2E2833` | `--ink` | Body text |
| ![](https://placehold.co/24x24/6C6274/6C6274.png) | Secondary text | `#6C6274` | `--muted` | Captions, notes |
| ![](https://placehold.co/24x24/EEE2EC/EEE2EC.png) | Border | `#EEE2EC` | `--line` | Card outlines, dividers |

## Meaning colors (keep for risk and warnings only)

| Swatch | Name | Hex | CSS variable | Used for |
|---|---|---|---|---|
| ![](https://placehold.co/24x24/B0532F/B0532F.png) | Terracotta | `#B0532F` | `--warm` | "Adds to your risk" amounts and dots |
| ![](https://placehold.co/24x24/F6E3DA/F6E3DA.png) | Light terracotta | `#F6E3DA` | `--warm-soft` | "You" box on the estimate card |
| ![](https://placehold.co/24x24/E9B48F/E9B48F.png) | Peach | `#E9B48F` | `--base` | "Average" dots in the 1,000-dot picture |
| ![](https://placehold.co/24x24/A3261B/A3261B.png) | Red | `#A3261B` | `--urgent` | Urgent warnings only |
| ![](https://placehold.co/24x24/FBE9E6/FBE9E6.png) | Light red | `#FBE9E6` | `--urgent-soft` | Urgent banner background |

## Contrast (WCAG)

Normal-size text needs at least 4.5:1; large or bold text (about 18pt+, or 14pt+ bold) needs at least 3:1.

| Combination | Ratio | Text use |
|---|---|---|
| White on primary purple | 6.8:1 | ✅ Any size |
| Text on background | 13.6:1 | ✅ Any size |
| Secondary text on background | 5.5:1 | ✅ Any size |
| Primary purple on background | 6.5:1 | ✅ Any size |
| Primary purple on light purple | 5.6:1 | ✅ Any size |
| Red on white | 7.4:1 | ✅ Any size |
| Terracotta on white | 5.1:1 | ✅ Any size |
| Pink on white | 2.0:1 | ❌ Decoration only, never text |

## Using it in slides

- **Purple and pinks are the brand.** Use primary purple for titles and key shapes, the light purple and light pink for backgrounds and callouts.
- **Keep terracotta and red for risk and warnings,** as the app does, so they keep their meaning.
- **Don't rely on color alone.** Pair colors with labels or words (for example "Adds to risk", "Urgent"), matching the app's accessibility approach.
- **Font:** the app uses the system font (SF Pro on Mac and iPhone). For slides, SF Pro, Inter or any clean sans-serif matches.
