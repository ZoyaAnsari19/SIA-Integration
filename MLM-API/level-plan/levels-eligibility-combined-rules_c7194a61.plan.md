---
name: levels-eligibility-combined-rules
overview: Update level eligibility logic so that admin-configured levels can use legs-only, total-business-only, or combined legs-plus-total-business conditions, and ensure Level 1 uses the new combined rule.
todos:
  - id: read-eligibility-code
    content: Review eligibility.compute.ts to fully understand current legs vs total-business logic and where to inject combined rule support.
    status: pending
  - id: design-branching-logic
    content: Define precise branching rules in code for legs-only, total-only, and combined (legs + total) configurations using business_requirement JSON.
    status: pending
  - id: implement-combined-rule
    content: Implement the combined legs + total business eligibility branch in eligibility.compute.ts in a generic way for any level.
    status: pending
  - id: update-level1-config
    content: Adjust Level 1 business_requirement (via seeds and/or admin UI) to use 4 legs, 7,500 min per leg, and 2,15,000 total business.
    status: pending
  - id: test-scenarios
    content: Run through success and failure scenarios for Level 1 and verify existing levels (2–9) behave the same as before.
    status: pending
isProject: false
---

### Goal

Implement a flexible level eligibility system where each level can:

- Use **legs-only** rules (current behaviour),
- Use **total-business-only** rules (current Level 9 style), or
- Use **combined legs + total business** rules (needed for new Level 1 condition),
all driven by the existing `business_requirement` JSON on the `levels` table.

### Key Files to Touch

- **Backend (API):**
  - `[MLM-API/src/modules/commissions/eligibility.compute.ts]` — main level eligibility calculation.
  - `[MLM-API/prisma/schema.prisma]` — for reference of `levels` model and `business_requirement` JSON (no schema change expected).
  - `[MLM-API/scripts/seed-levels.ts]` or `[MLM-API/scripts/seed-levels.sql]` — adjust default Level 1 config if we want seeds to match the new rule.
  - `[MLM-API/src/routes/path-rank.ts]` — reads eligibility and levels for rank/summary; mainly for verifying no behaviour conflicts.
- **Admin UI (for understanding only, no structural changes required):**
  - `[MLM-Admin-ui/src/app/master/levels/page.tsx]` — Level list + Edit Level modal that already exposes `Required Leg Count`, `Required Leg Min Amount`, `Total Business`.

### Implementation Steps

- **Step 1: Confirm current behaviour in code**
  - Open `eligibility.compute.ts` and re-check the existing loop over `levels`:
    - Understand how it computes `volumes` (per-leg business) and `totalTeamBusiness`.
    - Note the current `isTotalBusinessBased` vs `isLegBased` conditions.
    - Verify that for Level 1–8 it uses only `required_leg_count` and `required_leg_min_amount`, and ignores `total_business`.
- **Step 2: Design combined-rule logic (generic, not hard-coded to Level 1)**
  - Define semantics for `business_requirement` fields:
    - `required_leg_count` — minimum number of legs that must meet the per-leg requirement.
    - `required_leg_min_amount` — minimum business required per qualifying leg.
    - `total_business` — minimum required **total team business** across all legs.
  - Define rule precedence:
    - If **all three** are set and positive → use **combined** rule: legs + total business.
    - Else if only `total_business` is positive and leg count/min are zero → **total-only** rule.
    - Else if leg count/min configured → **legs-only** rule.
    - Else → level not eligible (no requirements defined).
- **Step 3: Implement combined-rule branch in `eligibility.compute.ts**`
  - In the eligibility loop per level, after reading `business_requirement`:
    - Compute `directLegCount` (number of direct legs; already implicit from `volumes`).
    - Compute `satisfiedLegsCount = count(legs where volume >= required_leg_min_amount)`.
  - Add a new branch roughly like:
    - If `required_leg_count > 0` AND `required_leg_min_amount > 0` AND `requiredTotalBusiness > 0`:
      - Mark eligible if:
        - `satisfiedLegsCount >= required_leg_count` AND
        - `totalTeamBusiness >= requiredTotalBusiness`.
  - Keep existing `isTotalBusinessBased` and `isLegBased` branches for backwards compatibility when not all three fields are set.
  - Ensure this logic applies to **any level** whose `business_requirement` has all three values set, not just Level 1.
- **Step 4: Configure Level 1 to use combined rule**
  - Update seed configuration to reflect the new Level 1 plan (if you want seeds to match the desired business plan):
    - In `scripts/seed-levels.ts` (and/or `seed-levels.sql`), change Level 1 `business_requirement` to:
      - `required_leg_count: 4`
      - `required_leg_min_amount: 7500`
      - `total_business: 215000`
  - Note: In **production**, the actual values can be set via Admin panel (Master → Levels → Edit Level 1) using the same numbers; the code should honour whatever is currently stored in DB.
- **Step 5: Keep Admin UI unchanged but clarify usage (optional)**
  - No structural UI change is required; the existing three fields already map to the new logic.
  - Optionally (if desired later), adjust the helper text/description in `[MLM-Admin-ui/src/app/master/levels/page.tsx]` to explain that:
    - If all three fields are filled, both per-leg and total business rules will apply.
    - If only some fields are filled, only the corresponding rule type applies.
- **Step 6: Testing strategy (logic-level)**
  - Create or extend tests (or manual scenarios) to cover:
    - **Combined rule success:**
      - 4 direct legs, each ≥ 7,500; total team business ≥ 2,15,000 → Level 1 eligible.
    - **Fails on total only:**
      - 4 legs each ≥ 7,500 but total < 2,15,000 → not eligible.
    - **Fails on leg count:**
      - Only 3 legs meeting ≥ 7,500 (even if total ≥ 2,15,000) → not eligible.
    - **Fails on per-leg minimum:**
      - 4+ legs, but one or more of the first 4 legs have < 7,500 even if total ≥ 2,15,000 → not eligible.
    - **Legacy behaviour preserved:**
      - Level 2–8 where only leg count + leg min are set: behaviour identical to before.
      - Level 9 where only total business is set: behaviour identical to before.
  - Optionally add a small debug/logging helper to print which branch is used for each level while testing locally.
- **Step 7: Deployment and configuration steps**
  - After deploying backend changes:
    - Through Admin panel, set Level 1 `Required Leg Count`, `Required Leg Min Amount`, and `Total Business` to the agreed values (e.g. 4 / 7500 / 215000).
    - For any other level where you want combined rules, fill all three fields accordingly.
  - Verify via:
    - Admin/user view that eligibility and ranks display as expected for test users with controlled team volumes.
    - Spot-check path rank (`/path-rank`) or any API that surfaces eligibility to ensure no regressions.

