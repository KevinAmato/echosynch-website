# Figma Make prompt — Echo-Synch Slack Directory listing

Copy the entire prompt below into a single Figma Make prompt. It's
designed to produce all 6 slides at once, in one Figma frame, fully
matched to the brand.

---

## PROMPT (copy from here)

Design a 6-slide carousel for the **Echo-Synch** Slack Directory app
listing. Echo-Synch is a Slack-native IT request triage bot — it watches
IT-help channels, AI-categorises requests, tracks per-priority SLAs, and
exposes a web dashboard. The audience for these slides is IT managers and
team leads at small-to-mid companies; tone is **Frictionless, Technical,
Quiet** — never hype-y, no exclamation marks, no emoji in chrome.

### Canvas + format

- 6 separate frames, each **1600 × 800 px** (Slack Directory's exact
  required size).
- Output as PNG-ready frames. Slack accepts PNG or JPG, max 8 MB per
  image.
- Order matters in the carousel — produce the slides in the sequence
  below; slide 1 is the strongest hook.

### Brand tokens (do not deviate)

- **Primary colour:** Echo Indigo `#4F46E5`. The *only* saturated
  colour. Use for eyebrows, the brand wordmark "Synch", primary buttons,
  pill backgrounds (with `#EEF2FF` fill + `#3730A3` text).
- **Indigo support:** `#EEF2FF` (50), `#E0E7FF` (100), `#3730A3` (700).
- **Slate (neutral):** `#0F172A` (headings), `#334155` (body),
  `#64748B` (muted), `#E2E8F0` (borders), `#F8FAFC` (subtle bg),
  `#F1F5F9` (cards).
- **Status:** Emerald `#10B981` (success/SLA met), Amber `#F59E0B`
  (warning), Rose `#E11D48` (breach/critical).
- **Background of every slide:** white (`#FFFFFF`) with one allowed
  gradient — a soft indigo radial glow at the top centre:
  `radial-gradient(ellipse 60% 45% at 50% 0%, rgba(79,70,229,0.10), transparent 70%)`.
  This is the only gradient permitted; do not add any others.

### Typography

- **Inter** (Google Fonts) for everything except eyebrows. Weights:
  400 (body), 500 (UI labels), 700 (callouts), 800 (display titles).
- **JetBrains Mono** for eyebrows, status pills, code-shaped chrome.
- Type scale on each slide:
  - Eyebrow: JetBrains Mono, 14 px, 700, uppercase, letter-spacing
    0.12 em, colour `#4F46E5`.
  - Title: Inter 800, 64 px, letter-spacing -0.025 em, line-height
    1.05, colour `#0F172A`. Title can break across 2-3 lines.
  - Body: Inter 400, 20 px, line-height 1.55, colour `#334155`,
    max-width 520 px.
- **Sentence case** for everything. No ALL CAPS except the eyebrow.

### Layout (every slide uses the same template)

- 80 px outer padding on all sides.
- Two-column grid: copy on the **left** (640 px wide), visual on the
  **right** (~736 px wide). Gap: 64 px.
- **Brand mark** in the top-left corner: 28 × 28 px Echo-Synch SVG
  + the wordmark "Echo-" `#0F172A` and "Synch" `#4F46E5`, both at 18 px,
  weight 800. Position 56 px from top, 80 px from left.
- **Visual area** is a single white card with:
  - Border `1px solid #E2E8F0`
  - Border-radius `16px`
  - Drop shadow `0 20px 60px -20px rgba(15, 23, 42, 0.18)`
- Card fills its column vertically with 0-40 px breathing room top
  and bottom — the visual should feel substantial but not cramped.
- Vertical centring for the copy column.

### Per-slide content

#### Slide 1 — Detect
- **Eyebrow:** `01 · Detect`
- **Title:** "It listens. Quietly." (line break between sentences)
- **Body:** "Every IT request lands in Slack. Echo-Synch sees it
  instantly, suggests an answer from your knowledge base, and prompts
  your team to triage."
- **Visual:** A Slack-channel mock with two messages.
  - Channel header: `# it-help` with macOS window dots.
  - Message 1: avatar (blue, "M"), "Maria · 9:42 AM",
    text: "Need to understand how to change the language settings on my
    dashboard — anyone from IT around?".
  - Message 2: Echo-Synch bot avatar (indigo `#4F46E5`, white
    waveform-bubble icon), "Echo-Synch · APP · just now". Bot reply
    contains: an indigo-bordered callout "🤖 Suggested answer from
    the knowledge base", a question/answer ("How to change language?"
    / "Check the configuration material."), confidence "medium (75%)",
    then 5 buttons in a row: "🔗 Visit link", "👍 Helpful",
    "👎 Not relevant", "✅ Close as resolved", and a primary indigo
    "🏷️ Label this request" button.
  - Card width: 720 px.

#### Slide 2 — Label
- **Eyebrow:** `02 · Label`
- **Title:** "One click to triage."
- **Body:** "Status, priority, assignee, custom labels — picked by AI,
  edited by your IT team in seconds. Right-click any thread to open the
  labeller."
- **Visual:** A Slack-modal mock.
  - Modal header: small indigo tag-icon, title "Label IT request", close
    "×" button right-aligned.
  - Form fields, all with light-gray rounded-rectangle inputs and small
    `(optional)` muted-grey labels:
    1. Status — value "In progress" with caret-down arrow.
    2. Assignee — value "Joaquin Diaz" with caret-down arrow.
    3. Priority — value "High" with caret-down arrow.
    4. Custom label — text input with value "multi-lingual", below it
       hint text: "Free-text tag (e.g. 'printer', 'vpn',
       'needs-vendor'). Leave blank for none."
    5. Notes — empty textarea with placeholder "Write something".
  - Modal footer: white "Cancel" button + dark-green "Save" button
    (Slack-style green `#1A6240`).
  - Card width: 540 px.

#### Slide 3 — Track in Slack
- **Eyebrow:** `03 · Track in Slack`
- **Title:** "Your queue, where you already are." (3 lines)
- **Body:** "App Home shows every open IT request — filter by status or
  assignee, jump straight to the original thread, manage your triage
  roster without leaving Slack."
- **Visual:** Slack App Home tab mock, dark theme (Slack default sidebar
  colour `#1F2937`, white text).
  - Tabs strip: "Home" (active, white bottom-border), "Messages",
    "About".
  - Body content:
    - Title "Echo-Synch · Echo-Synch" in white, 16 px, 700.
    - Sub: "Tier: enterprise · 26 total · Showing all (26)" in
      white-muted.
    - Two action buttons: "🌐 Open dashboard", "👥 Manage triage team"
      (rounded white-on-slate buttons with subtle borders).
    - Filter chip row: "All (26)" (active, emerald `#14532D` bg with
      `#BBF7D0` text), then "Not closed (25)", "Unlabeled (20)",
      "In progress (5)", "Closed (1)" in muted slate.
    - Assignee select: "Assignee: Anyone ▾" (rounded chip).
    - 3 ticket rows separated by faint white-translucent dividers, each
      with: a coloured dot (amber for medium, rose for high, slate for
      unlabeled), status word, priority, optional custom-label code-pill,
      summary line, "Posted by @X · Assignee @Y · View in app · View in
      web" meta line, and "Age: Xh/Xd" right-aligned.
  - Card width: 720 px.

#### Slide 4 — Dashboard
- **Eyebrow:** `04 · Dashboard`
- **Title:** "The full picture."
- **Body:** "Every triaged request, every SLA timer, every assignee.
  Search, filter, sort — and one click back to the original Slack thread."
- **Visual:** Web-app mock (light theme), windowed.
  - Window chrome: macOS dots, URL strip "app.echo-synch.com/threads"
    in JetBrains Mono.
  - 180 px sidebar with Echo-Synch logo + nav: Threads (active, indigo
    background), Analytics, Knowledge base, Triage reference, Team,
    Settings, Billing.
  - Main content:
    - Eyebrow "QUEUE" + title "Threads" (22 px, 800).
    - Sub: "Every IT request ingested from your monitored Slack channels.
      Filter, sort, or jump to the original thread."
    - Search input + "All statuses ▾" + "Columns ▾" + indigo "↻ Refresh"
      button in a row.
    - Table: columns SUMMARY · PRIORITY · STATUS · ASSIGNEE · AGE ·
      SLA · OPEN. Header row in slate-50 background. 4 example rows:
      1. "Printer jam — 3rd floor" · High pill · In progress purple ·
         "JD" · 2h · "⏱ 2h left" amber · App / Web indigo links.
      2. "Multi-lingual setting" · Medium amber · In progress purple ·
         "JD" · 2h · "On track" emerald · App / Web.
      3. "VPN outage — EU office" · High rose · Unlabeled slate · "—" ·
         6h · "SLA missed" rose · App / Web.
      4. "Salesforce SSO login broken" · Medium · Closed emerald · "SA"
         · 1d · "Met" emerald · App / Web.
  - Card width: 760 px.

#### Slide 5 — Teach the AI
- **Eyebrow:** `05 · Teach the AI`
- **Title:** "Your taxonomy. Your answers." (2 lines)
- **Body:** "Curate the knowledge base for in-thread answers, and define
  the labels Echo-Synch's AI uses on every new request — so the bot
  speaks your team's vocabulary, not the model's."
- **Visual:** Two stacked cards (gap 18 px).
  - **Top card — knowledge base entry:** table-header row (slate-50 bg,
    uppercase mono labels: QUESTION · TAGS · USED · HELPFUL · STATE),
    one data row: question "How to change language?" with answer "Check
    config material." underneath, plus a saved-link input
    `https://wiki.example.com/spaces/IT/lang-config` and a "Save link"
    button. Tags: a slate code-pill "Basic Config". Used: 7. Helpful: 1.
    State: emerald "● active" pill.
  - **Bottom card — taxonomy editor:** title "Your taxonomy" + 2
    category rows. Each row shows: a purple category pill (left),
    rename input (center), checkbox `[x]` + "active" label, "Save"
    button, red "Delete" button. Below each row, a description block
    with "Description:" and "Examples:" lines in muted text.
    Examples for "VPN outage": description "Issues with corporate VPN",
    examples "vpn drops", "where is vpn", "can't access resource".
    Examples for "Multi-lingual setting": description "Allow
    multi-language support", examples "change language", "set locale",
    "translate UI".
  - Card stack width: 720 px.

#### Slide 6 — Make it yours
- **Eyebrow:** `06 · Make it yours`
- **Title:** "Your SLAs. Your statuses. Your AI." (3 lines)
- **Body:** "Per-priority SLA windows, custom statuses, custom
  priorities — and on Enterprise, route AI through your own Gemini key
  with BYOM. Every workflow rule, configurable."
- **Visual:** Three stacked customization cards (gap 14 px).
  - **Card 1 — SLA thresholds:** title "SLA thresholds", sub "Hours
    until a thread breaches each deadline." 3-column grid:
    Priority / First response (h) / Resolution (h). 4 rows: Critical
    (rose dot) 1 / 8, High (orange dot) 2 / 24, Medium (amber dot) 8 /
    48, Low (slate dot) 24 / 168. Hours rendered as small mono-font
    chips on slate-50 bg.
  - **Card 2 — Custom statuses:** title "Custom statuses", sub "Rename,
    recolour, or add statuses for your team's workflow. Mark a status
    *terminal* to stop SLA clocks." 3 status rows: "Unlabeled"
    (slate-100 pill), "In progress" (purple pill), "Closed" (emerald
    pill, "terminal" flag). Each row has a rename input + colour swatch
    + mono-font slug ("unlabeled", "in_progress", "closed · terminal").
  - **Card 3 — Custom priorities:** title "Custom priorities", sub
    "Severity is an integer (higher = more urgent). Used for sorting
    and SLA mapping." 3 priority rows: Critical (rose, severity 40),
    High (rose-50 pill, severity 30), Medium (amber, severity 20). Each
    row has a rename input + colour swatch + mono-font "severity X"
    label.
  - Stack width: 720 px.

### Constraints

- **Do not** introduce illustrations, photographs, or 3D objects. The
  brand explicitly forbids them. Visuals are HTML-styled product mocks
  only.
- **Do not** use emoji in titles, eyebrows, or buttons outside of the
  bot-reply context (slide 1) and the action buttons in mocks. Body
  copy and chrome are emoji-free.
- **Do not** add any second saturated colour. Use only Echo Indigo for
  primary, slate for neutral, and the three status colours for
  pills/badges only.
- **Do not** use rounded corners larger than 18 px or smaller than 4 px.
  Cards 16 px, buttons 8-12 px, pills 9999 px, inputs 6-8 px.
- **Do not** use drop shadows other than the specified card shadow.
  Pills and inputs are flat.
- **Slack Directory rules:** screenshots show the actual product
  experience; no marketing copy *inside* the visual area, only in the
  text column. The brand mark in the corner is permitted.

### Naming

- Brand is always written **Echo-Synch** (capital E, capital S, hyphen).
  Never EchoSynch, echosynch, or "Echo Synch".

---

## END OF PROMPT
