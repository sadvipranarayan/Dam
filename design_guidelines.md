# Design Guidelines: HydroSim 3D Dam Analysis Platform

## Design Approach

**System Selected:** Material Design with engineering-focused adaptations

**Justification:** This is a utility-focused, data-intensive engineering application requiring:
- Clear information hierarchy for technical parameters
- Precision-focused form controls for numerical inputs
- Professional credibility for engineering calculations
- Consistent patterns for productivity workflows

Material Design provides the structured framework needed for technical applications while maintaining visual polish.

## Typography

**Font System:**
- Primary: 'Inter' (Google Fonts) - excellent readability for technical content
- Monospace: 'JetBrains Mono' (Google Fonts) - for numerical values and technical data

**Hierarchy:**
- Page Titles (Home): text-4xl font-bold (36px)
- Section Headers: text-2xl font-semibold (24px)
- Subsection Headers: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Input Labels: text-sm font-medium (14px)
- Technical Values: font-mono text-base (16px monospace)
- Helper Text: text-xs (12px)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, and 16 consistently
- Component padding: p-6
- Section spacing: gap-8 or gap-12
- Card padding: p-6
- Input spacing: gap-4
- Button padding: px-6 py-3

**Grid Structure:**
- Home Page: Single column, max-w-6xl centered with full-width hero
- Simulator Page: Two-column layout (sidebar + main viewer)
  - Left Sidebar: 360px fixed width for controls
  - Right Content: Flexible 1fr for 3D viewer and results

## Component Library

### Navigation & Structure
- **Header:** Full-width with logo, navigation links, and user profile/logout
- **Sidebar Panel:** Fixed-width control panel with nested sections, elevated card appearance
- **Content Sections:** Card-based containers with subtle shadows

### Forms & Inputs
- **Text Inputs:** Full-width with floating labels, clear borders, focus states with primary color
- **Number Inputs:** Include step controls (+ / - buttons), unit indicators (m, m³/s) aligned right
- **Sliders:** For parameters with ranges (efficiency), with value display
- **Buttons:** 
  - Primary: Filled with primary color for main actions
  - Secondary: Outlined for alternative actions
  - Ghost: Text-only for tertiary actions
  - Always include clear labels, no icon-only buttons

### Data Display
- **Results Cards:** Grid layout (2-3 columns) with metric name, large value, and unit
- **Metric Display:** 
  - Label in small text-sm
  - Value in large font-mono text-2xl
  - Unit in text-base text-muted
- **Status Indicators:** Color-coded badges for structural stability (Safe/Warning/Critical)

### 3D Viewer
- **Viewer Container:** Full height of content area, rounded corners, subtle border
- **Controls Overlay:** Floating toolbar in top-right with view controls (wireframe, labels, reset)
- **Dimension Labels:** Small tags with leader lines pointing to model features

### Home Page Sections
1. **Hero Section:** 
   - Full-width, 70vh height
   - Large background image of a hydroelectric dam (dramatic angle showing structure and reservoir)
   - Centered headline and description with blurred-background CTA button
   - Image: Professional photo of modern concrete dam with visible spillway and power station

2. **Features Grid:**
   - 3-column layout showcasing key capabilities
   - Icon + title + description cards
   - Icons from Heroicons (outline style)

3. **Technology Stack:**
   - 2-column layout explaining the 3D visualization and calculation engine
   - Include screenshot placeholder of the 3D viewer interface

4. **Get Started CTA:**
   - Centered section with primary action button to access simulator
   - Note about private access/authentication

### Export & Reports
- **Action Bar:** Horizontal layout with export buttons
- **Download Buttons:** Icons + text, grouped by export type (3D model / Data / Report)

## Accessibility & Interactions

- All form inputs have visible labels and help text
- Number inputs show valid ranges and current values
- Focus states use 2px outline in primary color
- Keyboard navigation fully supported
- Real-time validation with inline error messages

## Animations

**Minimal and Purposeful Only:**
- Smooth transitions on input changes (200ms ease)
- 3D model updates with brief fade transition
- Results cards update with subtle scale pulse (duration: 300ms) when values change
- No decorative animations, no scroll effects, no complex transitions

## Images

**Hero Section (Home Page):**
- Large, high-quality image of a modern hydroelectric dam
- Composition showing the massive scale of the structure with water and surrounding landscape
- Placement: Full-width background of hero section
- Treatment: Subtle dark overlay (40% opacity) for text readability

**Technology Showcase:**
- Screenshot of the 3D dam viewer interface showing the interactive model
- Placement: In "Technology Stack" section alongside explanatory text