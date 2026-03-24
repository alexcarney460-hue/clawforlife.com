# OpenClaw Phones — Brand Kit

## Brand Identity
- **Name:** OpenClaw Phones
- **Entity:** TerpTech LLC
- **Tagline:** "Your AI Army. In Your Pocket."
- **Mascot:** Red lobster with headphones (represents grip, intelligence, connectivity)

## Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Claw Red | #D42B2B | 212, 43, 43 | Primary brand, CTAs, highlights |
| Dark Red | #A51C1C | 165, 28, 28 | Hover states, accents |
| Bright Red | #FF4444 | 255, 68, 68 | Terminal text, emphasis |
| Red Glow | rgba(212,43,43,0.3) | — | Shadows, glows |

### Neutral Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Black | #0a0a0c | 10, 10, 12 | Background |
| Dark Surface | #121215 | 18, 18, 21 | Cards, panels |
| Charcoal | #1a1a1f | 26, 26, 31 | Secondary surfaces |
| White | #FFFFFF | 255, 255, 255 | Headings, primary text |
| Light Gray | #E0E0E0 | 224, 224, 224 | Body text |
| Muted | rgba(255,255,255,0.5) | — | Secondary text |
| Subtle | rgba(255,255,255,0.3) | — | Tertiary text, labels |

## Typography
- **Primary Font:** JetBrains Mono (monospace)
- **Weights:** 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Fallback Stack:** "Fira Code", monospace
- **Heading Scale:** 7xl (hero) → 4xl (section) → 3xl (subsection) → lg (card)
- **Body Size:** sm-base (14-16px)

## Logo Usage
- **File:** logo.png (lobster with headphones)
- **Minimum size:** 32px height
- **Clear space:** Minimum 8px padding on all sides
- **Backgrounds:** Use on dark (#0a0a0c to #1a1a1f) backgrounds only
- **Never:** Stretch, rotate, add effects, place on busy backgrounds

## UI Patterns
- **Border radius:** xl (12px) for cards, 2xl (16px) for panels, lg (8px) for buttons
- **Card style:** bg-[#121215] with border border-white/5, hover:border-[#D42B2B]/20
- **Glow effect:** box-shadow 0 0 20-40px rgba(212,43,43,0.3)
- **Gradient borders:** from-[#D42B2B] via-[#A51C1C] to-transparent (1px wrapper)
- **Glass nav:** bg-[#0a0a0c]/80 backdrop-blur-xl

## Button Styles
- **Primary:** bg-[#D42B2B] text-white → hover:bg-[#A51C1C] + red glow shadow
- **Secondary:** border border-white/10 text-white/70 → hover:border-[#D42B2B]/50 hover:text-[#D42B2B]
- **Text:** Uppercase, tracking-wider, font-semibold, text-sm

## Animation Guidelines
- **Page entrance:** Fade up (opacity 0→1, y 30→0), 0.5-0.8s duration
- **Scroll reveal:** whileInView with staggered delays (0.1s per item)
- **Hover:** Color transitions 300ms, scale kept subtle
- **Scanline:** 4px red gradient line sweeping vertically, 8s loop, 30% opacity
- **3D Phone:** Gentle float + slow y-rotation oscillation

## Voice & Tone
- **Direct.** Lead with action, not explanation.
- **Technical but accessible.** Use terminal aesthetics but explain in plain English.
- **Confident.** "Your AI army" not "an AI tool that might help"
- **No fluff.** Every word earns its place.
