# Focus Desk Hub

# PRODUCT SPECIFICATION & UI/UX BLUEPRINT FOR "JOINDESK"

Build a modern, high-conversion, highly polished single-page React web application (using Tailwind CSS, Lucide React icons, and smooth component animations). 

The design aesthetic must strictly emulate top-tier modern software companies like Apple, Google, and Instagram:
- Theme: Bright, clean, and vibrant light mode (soft neutral backgrounds, subtle pastel/vibrant gradients, rounded-2xl cards, soft drop shadows, clean typography). NO dark/hacker green themes.
- Feel: Apple-grade minimalism, smooth micro-interactions, responsive glassmorphism overlays, and intuitive layouts.

---

## 1. MOCK STATE MANAGEMENT (READY FOR BACKEND HOOKUP)
Set up state handlers in the main App layout so the entire app is fully interactive before backend integration:
- `isLoggedIn`: Boolean (default: `false` for previewing landing page, toggleable via Google Login button).
- `currentUser`: Object `{ id, name: "Aayush Mishra", email: "aayush@example.com", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" }`.
- `desks`: Array of mock desk objects containing:
  `{ id, title, description, meetLink, creatorName, creatorAvatar, createdAt }`.
- `searchQuery`: String for filtering desk cards by title or description.
- `selectedDesk`: Desk object selected for the Join Modal.
- `isCreateModalOpen`: Boolean.
- `isJoinModalOpen`: Boolean.

---

## 2. NAVIGATION BAR (`Navbar.jsx`)
- Brand Logo: "JoinDesk" with a subtle modern gradient pill icon next to clean typography.
- Search Bar (Visible when `isLoggedIn === true`):
  - Rounded-full container with a search icon and shortcut key visual `⌘K`.
  - Real-time text filtering on the `desks` state.
- Unauthenticated Actions (`isLoggedIn === false`):
  - "Log In" ghost button.
  - "Continue with Google" primary pill button featuring the official Google colored icon SVG.
- Authenticated Actions (`isLoggedIn === true`):
  - Primary CTA button: `+ Create Desk` (Gradient fill, hover scale effect).
  - User Profile Avatar with dropdown preview showing user name and email.

---

## 3. PAGE 1: LANDING HERO (`LandingSection.jsx`) - (Shown when `isLoggedIn === false`)
- Hero Headline: "Find your focus. Join a desk." (Large, bold, crisp modern typography with subtle gradient text highlights).
- Sub-headline: "Discover virtual desks, connect via Google Meet, and get things done silently alongside the right people."
- Main CTA Button: Large, prominent "Continue with Google" button with Google logo, subtle hover elevation, and click handler setting `isLoggedIn = true`.
- Visual Mockup: A sleek 3D-style abstract visual illustration or floating card mockups showing digital avatars collaborating silently.
- Feature Highlights Section: 3 minimalist pills/cards:
  1. 🎯 "Topic Discovery" - Find focused study/work spaces instantly.
  2. 🔗 "Direct Meet Access" - One-click redirect to Google Meet rooms.
  3. ⏱️ "Fresh Desks" - Automated 3-hour desk lifespan keeps listings active.

---

## 4. PAGE 2: DASHBOARD MAIN (`Dashboard.jsx`) - (Shown when `isLoggedIn === true`)
- Sub-header & Filter Chips:
  - Quick topic filters: "All Desks", "ReactJS", "DSA & Coding", "Mathematics", "Design & Figma", "Research".
- Desk Grid Layout:
  - Responsive 3-column grid (desktop), 2-column (tablet), 1-column (mobile).
- Desk Card Anatomy (`DeskCard.jsx`):
  - Top Bar: Creator Avatar (small circular image) + Creator Name + Relative time badge (e.g., "Created 15m ago").
  - Status Indicator: Soft green pulse dot with text "🟢 Active Desk (3h max)".
  - Title: Bold, prominent text (e.g., "ReactJS Deep Work & Component Refactoring").
  - Description: 2-line truncated summary text.
  - Footer Action: "Join Desk" button that triggers the `JoinDeskModal` with the selected desk data.
- Empty State (`EmptyState.jsx`):
  - Rendered when search results return 0 items or no desks exist.
  - Includes a friendly modern illustration and text: "No active desks right now. Be the first to create one!" with a "+ Create Desk" CTA.

---

## 5. MODAL 1: CREATE DESK POPUP (`CreateDeskModal.jsx`)
- Triggered by clicking "+ Create Desk". Opens over a smooth backdrop blur (`backdrop-blur-md`).
- Title: "Create a Focus Desk"
- Subtitle: "Launch a new room for others to discover and join your Google Meet."
- Form Fields (Only these 3 fields - DO NOT ask for Creator Name or Max Capacity):
  1. **Topic Title (Required)**: Text input with placeholder "e.g., DSA Problem Solving & LeetCode".
  2. **Description (Optional)**: Textarea with placeholder "What are you working on or hoping to achieve?".
  3. **Google Meet Link (Required)**: URL input with link icon, placeholder "https://meet.google.com/abc-defg-hij".
- Notice Callout Box:
  - Soft indigo/blue callout banner with icon: *"ℹ️ Note: This desk stays active for 3 hours to keep the platform fresh and clutter-free. Ensure your Google Meet link is active!"*
- Modal Actions:
  - "Cancel" button (Closes modal).
  - "Launch Desk" primary button (Validates link, prepends new desk to state using current logged-in user avatar/name, and closes modal).

---

## 6. MODAL 2: JOIN DESK POPUP (`JoinDeskModal.jsx`)
- Triggered by clicking "Join Desk" on any Desk Card.
- Content Display:
  - Display Selected Desk Title and full Description.
  - Creator info badge ("Created by [Name]").
- Desk Guidelines / Rules Checkbox:
  - Interactive Checkbox: `[ ] I agree to keep the environment focused, be respectful, and avoid spam/self-promotion.`
- Primary Action Button:
  - "Join via Google Meet" (Prominent green/indigo gradient button).
  - State Constraint: DISABLED until the guidelines checkbox is checked.
  - On Click: Opens the `meetLink` in a new tab (`window.open(meetLink, '_blank')`) and closes modal.

---

## 7. TECHNICAL REQUIREMENTS & POLISH
1. Fully mobile-responsive layout built with Tailwind CSS flex/grid system.
2. Smooth CSS transitions for hover states, buttons, modals, and card elevations.
3. Clean TypeScript / React code structure so components can easily be pushed to GitHub and parsed by Claude for backend API attachment.


like this project - almost same https://id-preview--5dd9bd43-305e-444d-a507-ebb88122773c.lovable.app/

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ca39893d-b6fa-4fa1-bc5f-1f6ffa0a1202).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
