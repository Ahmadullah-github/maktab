---
type: "query"
date: "2026-07-22T10:04:50.024537+00:00"
question: "As, this system will be provided for schools and of course every school has its own name, and logo(picture in png,jpg or else...) So the system must accept this layout and structure. How we have to accept the school as required and logo as optionl(for optional using simple school icon). what do you think of this:: packages/web/src/components/layout, packages/web/src/features/school-settings ==================== Do not code, just analyze my requirest..  and also what do you think what other data should accept as metada from users??"
contributor: "graphify"
outcome: "useful"
source_nodes: ["MainLayout", "SchoolSettingsPage", "SchoolConfig", "useSchoolSettings", "Header", "Sidebar"]
---

# Q: As, this system will be provided for schools and of course every school has its own name, and logo(picture in png,jpg or else...) So the system must accept this layout and structure. How we have to accept the school as required and logo as optionl(for optional using simple school icon). what do you think of this:: packages/web/src/components/layout, packages/web/src/features/school-settings ==================== Do not code, just analyze my requirest..  and also what do you think what other data should accept as metada from users??

## Answer

Expanded from original query via vocab: [school, settings, layout, image, icon, name, config, configuration, language, locale, timezone, academic]. The current separation is directionally correct: school-settings should own editing, validation, API calls, and logo upload; layout should only consume a canonical school profile and render a shared SchoolBrand. Current schoolName is not required because web accepts empty, maps it to null, API accepts nullable, and SchoolConfig stores nullable. Require trimmed nonempty name at web and API boundaries, route incomplete installations to initial setup, then migrate persistence to non-null. Logo stays nullable, stored as an asset reference rather than image bytes, with School icon fallback. If one server can host many schools, use a School entity/profile and make SchoolConfig one-to-one; never trust a client-selected schoolId. Suggested MVP metadata: official name, optional short/localized names and logo, school code, address, phone/email/website, timezone and language, academic year/term, and principal name only if reports use it.

## Outcome

- Signal: useful

## Source Nodes

- MainLayout
- SchoolSettingsPage
- SchoolConfig
- useSchoolSettings
- Header
- Sidebar