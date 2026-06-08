# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T19:02:05
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **35**
- Passed: **24**
- Satisfactory score: **68.57%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 17 | 16 | 94.12% |
| admin | 18 | 8 | 44.44% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| boundary_admin | 1 | 1 | 100.0% |
| boundary_explain | 1 | 1 | 100.0% |
| combined_spot | 1 | 1 | 100.0% |
| compare_combined | 1 | 1 | 100.0% |
| compare_legacy_vs_ledger | 1 | 1 | 100.0% |
| data_source_truth | 1 | 1 | 100.0% |
| explain_purchase_mismatch | 1 | 1 | 100.0% |
| incorrect_expiry_complaint | 1 | 1 | 100.0% |
| investigation_workflow | 1 | 1 | 100.0% |
| ledger_empty | 1 | 1 | 100.0% |
| ledger_window | 1 | 0 | 0.0% |
| legacy_activation | 1 | 1 | 100.0% |
| legacy_by_level | 1 | 1 | 100.0% |
| legacy_concept | 1 | 1 | 100.0% |
| legacy_count | 1 | 1 | 100.0% |
| legacy_spot_global_sum | 1 | 0 | 0.0% |
| legacy_total | 1 | 1 | 100.0% |
| migration_context | 1 | 1 | 100.0% |
| migration_design | 1 | 1 | 100.0% |
| mismatch_lookup | 1 | 0 | 0.0% |
| missing_commission | 1 | 1 | 100.0% |
| missing_commission_admin | 1 | 1 | 100.0% |
| no_ledger_user | 1 | 1 | 100.0% |
| package_expiry | 1 | 1 | 100.0% |
| platform_legacy_act | 1 | 0 | 0.0% |
| platform_legacy_distinct | 1 | 0 | 0.0% |
| platform_legacy_total | 1 | 0 | 0.0% |
| purchase_mismatch | 1 | 1 | 100.0% |
| top_legacy_user | 1 | 0 | 0.0% |
| user_combined | 1 | 0 | 0.0% |
| user_legacy_by_level | 1 | 1 | 100.0% |
| user_legacy_count | 1 | 0 | 0.0% |
| user_legacy_lookup | 1 | 0 | 0.0% |
| user_lookup_legacy | 1 | 0 | 0.0% |
| wallet_mismatch | 1 | 1 | 100.0% |

## Per-scenario detail

### USER LU01 — `PASS` (legacy_total)

**Q:** Mere legacy SPOT history mein total kitna income hua tha (purane system se)?

- expected_any: `['46181', '46,181', '46181.25']`
- matched: `['46181', '46,181', '46181.25']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `4925`
- db_truth: `46181.25`

**Reply:**

```
Aapke purane system (legacy) ke records ke mutabiq, aapki total SPOT income **₹46,181.25** thi.

Iska breakup neeche diya gaya hai:
- **Direct Income:** ₹5,800
- **Level 1 Income:** ₹40,381.25
```

### USER LU02 — `PASS` (legacy_count)

**Q:** Old (legacy) system mein meri kitni SPOT history rows hain?

- expected_any: `['93']`
- matched: `['93']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2439`
- db_truth: `93`

**Reply:**

```
Old (legacy) system mein aapki total 93 SPOT history rows hain.
```

### USER LU03 — `PASS` (migration_context)

**Q:** When did the migration happen and which type of data was migrated as snapshot vs not migrated?

- expected_any: `['18', 'Dec', 'snapshot', 'balance', 'ledger']`
- matched: `['18', 'snapshot', 'balance', 'ledger']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `4059`
- db_truth: `2025-12-18`

**Reply:**

```
The migration happened on **2025-12-18**.

*   **Migrated as Snapshot:** Wallet balances (Total: 46208.31) and active package states were captured as a state-based snapshot. This includes a Spot balance of 14850.25 and a Team Royalty balance of 26579.82.
*   **Not Migrated (Historical):** The complete historical ledger was not migrated. Legacy records, such as the 46181.25 in pre-migration SPOT earnings, are maintained separately for reference and are not part of the active ledger computation.
```

### USER LU04 — `PASS` (compare_legacy_vs_ledger)

**Q:** Mera legacy spot income vs ledger spot income ka comparison batao — gap kitna hai?

- expected_any: `['46,181', '46181', '82,856', '82856']`
- matched: `['46,181', '46181', '82,856', '82856']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `3795`
- db_truth: `legacy=46181.25|ledger=82856.25`

**Reply:**

```
Aapka legacy aur ledger spot income ka comparison niche diya gaya hai:

*   **Legacy Spot Income:** 46,181.25
*   **Ledger Spot Income:** 82,856.25
*   **Gap (Antar):** 36,675.00

Aapka Ledger Spot Income legacy se 36,675.00 zyada hai, kyunki ledger mein migration ke baad ki saari nayi earnings shamil hain.
```

### USER LU05 — `PASS` (legacy_by_level)

**Q:** Purane system mein mera SPOT income kis level se kitna mila tha (Direct vs Level 1)?

- expected_any: `['Direct', '5800', 'Level 1', '40381', '40,381']`
- matched: `['Direct', 'Level 1']`
- tool_calls: `['getUserLevelProgress', 'diagnoseMissingCommission']`
- elapsed_ms: `5514`
- db_truth: `<db_error: ERROR:  column "data" does not exist
LINE 1: select string_agg(coalesce(data->>'income_lvl','') || '=' ||...
                                   ^>`

**Reply:**

```
Aapka total SPOT income data ye hai:

*   **Direct (Level 1):** Aapko apne direct referrals se total **4,000.00** mile hain (7 entries).
*   **Total SPOT Income:** Aapka kul SPOT income **82,856.25** hai (162 entries).

Iska matlab hai ki baaki ka **78,856.25** aapko Level 2 aur usse neeche ke team levels se mila hai.
```

### USER LU06 — `FAIL` (ledger_window)

**Q:** Mere new system ke ledger entries kab se shuru hue hain (earliest credited_at)?

- expected_any: `['2025-12-18']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext']`
- elapsed_ms: `8595`
- db_truth: `2025-12-18 00:00:00+00`

**Reply:**

```
Aapke new system ke ledger entries **18-Dec-2025** se shuru hue hain.

Yeh wahi date hai jab system legacy platform se migrate hokar naye PostgreSQL system par shift hua tha. Isliye current ledger mein entries isi date se start hoti hain.

Aapke records ki summary:
*   **Earliest Ledger Entry:** 18-Dec-2025
*   **Total Ledger Entries:** 56,695
*   **Legacy Data:** Aapke 93 SPOT rows aur 1 activation row legacy tables mein bhi available hain, jo migration se pehle ke hain.
```

### USER LU07 — `PASS` (purchase_mismatch)

**Q:** Mera ek purchase 2x tak pahunch gaya hai but ledger entries usse kam dikhati hain — kyu? Kya legacy income bhi count hota hai?

- expected_any: `['legacy', 'migration', 'ledger', 'snapshot', 'before', 'purana']`
- matched: `['legacy', 'migration', 'ledger']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `6332`
- db_truth: `concept_migration`

**Reply:**

```
Aapka ledger balance isliye kam dikh raha hai kyunki ledger mein sirf migration date (18-12-2025) ke baad ki entries hain. Ji haan, legacy income 2x limit mein bilkul count hoti hai.

Aapka total income do hisson mein hai:
1. **Legacy Spot Income:** 46181.25 (Ye purane system ka record hai).
2. **Ledger Spot Income:** 82856.25 (Ye migration ke baad ki kamayi hai).

Chunki system 2x limit ke liye dono ko count karta hai, isliye aapka limit jaldi hit ho gaya hai, bhale hi ledger mein sirf naya data dikh raha ho.
```

### USER LU08 — `PASS` (wallet_mismatch)

**Q:** Mera wallet balance ledger ke total se zyada lag raha hai — kyu? Migration ke karan koi snapshot hai kya?

- expected_any: `['snapshot', 'migration', 'balance', 'legacy', 'boundary']`
- matched: `['snapshot', 'migration', 'balance', 'legacy']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `7334`
- db_truth: `concept_wallet_snapshot`

**Reply:**

```
Haan, aapka observation bilkul sahi hai. Migration ke wajah se hi aapko ye farak dikh raha hai.

System 2025-12-18 ko migrate hua tha, aur aapka wallet balance ek **snapshot** ke taur par laya gaya hai. Aapka ledger poora historical record nahi hai; isme zyada tar migration ke baad ki transactions hi hain.

Yahan kuch zaroori details hain:
- **Migration Snapshot Balance:** 46208.31 (Isme Spot balance 14850.25 aur Team Royalty 26579.82 shamil tha).
- **Legacy Spot Total:** 46181.25 (Ye aapka purana record hai jo naye ledger calculation mein count nahi hota, isliye ledger ka total kam lag sakta hai).
- **Migration Date:** 2025-12-18.

In short, aapka balance sahi hai, bas purana data snapshot ke roop mein migrate kiya gaya tha jo ledger ke total mein directly nahi dikhta.
```

### USER LU09 — `PASS` (missing_commission)

**Q:** I think I did not receive my old direct/spot commission for some users — please check legacy data and explain.

- expected_any: `['legacy', 'spot', 'ledger', 'before', 'migration', 'old']`
- matched: `['legacy', 'spot', 'ledger', 'migration']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot', 'diagnoseMissingCommission']`
- elapsed_ms: `9809`
- db_truth: `concept_legacy_commission`

**Reply:**

```
Based on the legacy records, your total pre-migration Spot Commission was **46,181.25** (comprising 5,800 in Direct and 40,381.25 in Level 1 commissions).

This amount was accounted for in your wallet snapshot during the system migration on **2025-12-18**. Because these are legacy records, they are maintained for your reference but do not appear as individual entries in your new active ledger. Your current ledger shows an additional **82,856.25** earned after the migration.

Your account is active and KYC is approved. Any new commissions currently in the "pending" state will credit to your ledger as soon as the system's eligibility rules are met.
```

### USER LU10 — `PASS` (package_expiry)

**Q:** Mera ek package expire ho gaya — par maine ledger mein 2x tak income nahi dekha. Kya ye legacy income ki wajah se hai?

- expected_any: `['legacy', '2x', 'income', 'ledger', 'migration', 'snapshot']`
- matched: `['legacy', '2x', 'income', 'ledger', 'migration']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot', 'diagnoseMissingCommission']`
- elapsed_ms: `6184`
- db_truth: `concept_expiry_legacy`

**Reply:**

```
Ji haan, aapka package legacy income ki wajah se hi expire hua hai. Ledger mein sirf migration (18 Dec 2025) ke baad ki transactions dikhti hain, lekin system aapki total 2x limit calculate karne ke liye purani earnings ko bhi count karta hai.

Aapka data ye hai:
- **Legacy Spot Income:** 46,181.25 (Ye migration se pehle ki income hai jo ledger mein nahi dikhegi).
- **Ledger Spot Income:** 82,856.25 (Ye migration ke baad ki income hai).

Kyuki aapki total income (Legacy + Ledger) package ki limit ko cross kar gayi hai, isliye wo expire show ho raha hai.
```

### USER LU11 — `PASS` (incorrect_expiry_complaint)

**Q:** I feel my package expired wrongly — only the new ledger shows the income. Can you reconstruct the total income using legacy + new system?

- expected_any: `['legacy', 'ledger', 'combined', 'before', 'migration', 'total']`
- matched: `['legacy', 'ledger', 'combined', 'migration', 'total']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `11591`
- db_truth: `concept_total_income`

**Reply:**

```
To reconstruct your total income, we combine the earnings from the old system (Legacy) and the current ledger:

1.  **Legacy Spot Income (Pre-migration):** 46,181.25
2.  **New Ledger Spot Income:** 82,856.25
3.  **Total Combined Spot Income:** 129,037.50

The new ledger only shows transactions from December 18, 2025, onwards. However, your legacy earnings of 46,181.25 were imported and are counted toward your package's total income limit. This combined total is what triggered the package expiry.
```

### USER LU12 — `PASS` (ledger_empty)

**Q:** Mere account mein activity bahut kam dikh rahi hai. Kya purane system ki bhi history hai mere paas?

- expected_any: `['93', 'legacy', 'old', 'import']`
- matched: `['legacy']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary']`
- elapsed_ms: `14046`
- db_truth: `93`

**Reply:**

```
Haan, aapke paas purane system ki history bilkul available hai. Humara system **18-Dec-2025** ko naye platform par migrate hua tha, isliye naye ledger mein zyadaatar activity us date ke baad ki hi dikhegi.

Aapka purana (legacy) data system mein save hai:

*   **Legacy SPOT Income:** Aapne purane system mein total **₹46,181.25** earn kiye thhe (Jan 2025 se Dec 2025 tak).
*   **Income Breakdown:**
    *   **Direct Income:** ₹5,800 (26 rows)
    *   **Level 1 Income:** ₹40,381.25 (67 rows)
*   **Legacy Activations:** Aapki 1 purani activation record bhi migration ke waqt snapshot ke roop mein li gayi thi.

Abhi aapke wallet mein total balance **₹46,208.31** hai, jisme purane system ka snapshot aur migration ke baad ki earnings dono shamil hain. Agar aapko koi specific purani transaction chec …
```

### USER LU13 — `PASS` (legacy_activation)

**Q:** Mere legacy activation history mein kitni entries hain?

- expected_any: `['1']`
- matched: `['1']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2547`
- db_truth: `1`

**Reply:**

```
Aapke legacy activation history mein total **1 entry** hai.
```

### USER LU14 — `PASS` (combined_spot)

**Q:** Mera total SPOT income — legacy + new ledger — combined kitna hai approximately?

- expected_any: `['129', '129,037', '129037', '1,29,037']`
- matched: `['129', '129,037', '129037', '1,29,037']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2591`
- db_truth: `129037.50`

**Reply:**

```
Aapka total SPOT income (Legacy + New Ledger) mila kar **1,29,037.50** hai.

Iska breakdown is tarah hai:
- **Legacy SPOT Income:** 46,181.25
- **New Ledger SPOT Income:** 82,856.25
```

### USER LU15 — `PASS` (boundary_explain)

**Q:** Why does my new ledger start only from 18 December 2025?

- expected_any: `['18', 'December', 'Dec', 'migration', 'boundary', 'legacy']`
- matched: `['18', 'December', 'Dec', 'migration', 'legacy']`
- tool_calls: `[]`
- elapsed_ms: `5412`
- db_truth: `concept_boundary`

**Reply:**

```
SIA system 18 December 2025 ko ek legacy platform se naye PostgreSQL system par migrate hua tha. Is migration se judi kuch zaroori baatein ye hain:

*   **State-based Migration:** Migration ke waqt aapke wallet balances, package status aur team hierarchy ka snapshot liya gaya tha.
*   **Ledger Activity:** Kyonki ye ek full historical migration nahi tha, isliye purane system ki har ek commission transaction naye ledger me transfer nahi ki gayi. 
*   **New Record:** Naya ledger sirf 18-Dec-2025 ke baad ki activity aur post-migration updates ko hi reflect karta hai.

Agar aapko isse pehle ka data dekhna hai, toh aap apne dashboard par **Legacy/Old Data** section check kar sakte hain ya main tool use karke aapke liye summarize kar sakta hoon.
```

### USER LU16 — `PASS` (data_source_truth)

**Q:** Legacy data aur new ledger mein se konsa data financial truth ke liye source-of-truth hai?

- expected_any: `['new', 'ledger', 'current', 'legacy', 'reference', 'read-only']`
- matched: `['new', 'ledger', 'legacy']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `6083`
- db_truth: `concept_truth`

**Reply:**

```
Financial truth ke liye dono data ka combination zaroori hai kyunki ledger mein pura historical record nahi hai.

1. **Legacy Data:** Yeh 2025-12-18 se pehle ka snapshot hai. Pre-migration earnings (jaise Legacy SPOT total: 46,181.25) isi data se explain hoti hain.
2. **New Ledger:** Yeh sirf migration date (2025-12-18) ke baad ki transactions dikhata hai.
3. **Wallet Snapshot:** Aapka total migrated balance 46,208.31 hai, jo snapshot ke basis par set kiya gaya tha.

Short mein: Purana hisab Legacy data se aur naya activity Ledger se verify karein.
```

### USER LU17 — `PASS` (compare_combined)

**Q:** Total combined SPOT income ka calculation karke batao — legacy ka kitna, ledger ka kitna, total kitna?

- expected_any: `['46,181', '82,856', '129', '129,037']`
- matched: `['46,181', '82,856', '129', '129,037']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `3212`
- db_truth: `legacy=46181.25|ledger=82856.25|total=129037.50`

**Reply:**

```
Aapka total combined SPOT income ka calculation niche diya gaya hai:

*   **Legacy SPOT Income:** 46,181.25
*   **Ledger SPOT Income:** 82,856.25
*   **Total Combined SPOT Income:** 1,29,037.50
```

### ADMIN LA01 — `FAIL` (platform_legacy_total)

**Q:** Platform-wide me legacy SPOT history rows kitni hain aur unka total amount kya hai?

- expected_any: `['2882', '2,882', '2631643', '2,631,643', '26,31,643']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2480`
- db_truth: `2882|2631643.75`

**Reply:**

```
Legacy SPOT history mein total 0 rows hain aur unka total amount 0 hai.
```

### ADMIN LA02 — `FAIL` (platform_legacy_distinct)

**Q:** How many distinct users have any legacy SPOT history rows in our system?

- expected_any: `['411']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `8008`
- db_truth: `411`

**Reply:**

```
Based on the system data for User 1897, there are **0** legacy SPOT history rows. The provided tool results only cover User 1897, showing a `legacy_spot_rows` count of 0 and a total legacy amount of 0. I do not have the global aggregate count for all distinct users across the entire system.
```

### ADMIN LA03 — `FAIL` (platform_legacy_act)

**Q:** How many distinct users have legacy activation history rows?

- expected_any: `['1315', '1,315']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `12739`
- db_truth: `1315`

**Reply:**

```
Based on the data provided for User 1897, there are **0** legacy activation history rows. I do not have the information required to provide a global count of all distinct users across the database.
```

### ADMIN LA04 — `FAIL` (user_legacy_lookup)

**Q:** User SIA00299 ka legacy SPOT total kitna hai aur ledger SPOT kitna hai?

- expected_any: `['46,181', '46181', '82,856', '82856']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2054`
- db_truth: `legacy=46181.25|ledger=82856.25`

**Reply:**

```
User SIA00299 ka legacy SPOT total 0 hai aur ledger SPOT total bhi 0 hai.
```

### ADMIN LA05 — `FAIL` (top_legacy_user)

**Q:** Top legacy SPOT earner kaun hai aur kitna amount hai unka?

- expected_any: `['SIA00334', '133', '1,33,250', '133250']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `6358`
- db_truth: `SIA00334|133250`

**Reply:**

```
Data ke mutabik, legacy SPOT earnings mein User ID 1897 ka total amount **0** hai. Mere paas filhaal sabhi users ki ranking ya global top earner ki list nahi hai, sirf is specific user ka migration data available hai jisme amount 0 dikha raha hai.
```

### ADMIN LA06 — `FAIL` (mismatch_lookup)

**Q:** User SIA00386 ki legacy SPOT vs ledger SPOT compare karke mismatch ka size batao.

- expected_any: `['130000', '130,000', '1,30,000', '5000', '5,000']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2529`
- db_truth: `legacy=130000|ledger=5000`

**Reply:**

```
User SIA00386 ke liye, Legacy SPOT total **0** hai aur Ledger SPOT total bhi **0** hai. Dono values matching hain, isliye ismein koi mismatch nahi hai (mismatch size: **0**).
```

### ADMIN LA07 — `PASS` (no_ledger_user)

**Q:** User SIA00870 ka kya legacy SPOT history hai but new ledger SPOT zero hai? Verify and explain.

- expected_any: `['30,337', '30337', '0']`
- matched: `['0']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `4671`
- db_truth: `legacy=30337.5|ledger=0`

**Reply:**

```
SIA00870 ke records ke mutabiq, aapka Legacy SPOT history aur New Ledger SPOT dono hi zero hain.

Tool data verify karne par ye pata chala hai:
1. **Legacy SPOT:** Purane Excel data mein aapka total SPOT amount 0 hai.
2. **New Ledger SPOT:** Migration ke baad naye ledger mein bhi koi SPOT entry nahi hai (Total: 0).
3. **Wallet Snapshot:** Aapka current spot_balance bhi 0.00 show kar raha hai.

Iska matlab hai ki na to migration se pehle koi earning record thi aur na hi migration ke baad koi naye transactions hue hain.
```

### ADMIN LA08 — `PASS` (boundary_admin)

**Q:** What is the migration cut-off date in our system and how does that affect the new ledger?

- expected_any: `['18', 'Dec', '2025', 'boundary', 'migration', 'snapshot']`
- matched: `['18', '2025', 'boundary', 'migration', 'snapshot']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `4197`
- db_truth: `2025-12-18`

**Reply:**

```
The migration cut-off date (boundary date) in our system is **2025-12-18**.

This affects the new ledger in the following ways:
1. **Partial Record:** The ledger is not a complete historical record; it primarily represents activity that happened **after** the migration.
2. **Snapshot Migration:** Your pre-migration status, including wallet balances and active packages, was migrated as a snapshot rather than individual transactions.
3. **Legacy Data:** Any historical data from the old system (like legacy SPOT history) is read-only and used for reference. It is **not** part of the active ledger computation.

Currently, your migrated wallet snapshot balance is **0.00**.
```

### ADMIN LA09 — `FAIL` (user_legacy_count)

**Q:** User SIA00299 ke legacy SPOT history me kitni rows imported hain?

- expected_any: `['93']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2593`
- db_truth: `93`

**Reply:**

```
User SIA00299 ke legacy SPOT history me total 0 rows imported hain.
```

### ADMIN LA10 — `PASS` (legacy_concept)

**Q:** Briefly explain what legacy_spot_history and legacy_activation_history tables are used for, and whether they are part of active financial computation.

- expected_any: `['legacy', 'import', 'Excel', 'read-only', 'reference', 'spot', 'activation']`
- matched: `['legacy', 'import', 'Excel', 'read-only', 'reference', 'spot', 'activation']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `3497`
- db_truth: `concept_legacy_tables`

**Reply:**

```
The `legacy_spot_history` and `legacy_activation_history` tables store historical data imported from the old system (Excel records). They provide a read-only record of earnings and package activations that occurred before the migration date (2025-12-18).

These tables are **not** part of the active financial computation. Current wallet balances were migrated as a snapshot, and the new ledger only tracks post-migration activity. These legacy tables are used only for reference and to address queries about pre-migration earnings.
```

### ADMIN LA11 — `PASS` (user_legacy_by_level)

**Q:** User SIA00299 ka legacy SPOT income by level batao — Direct vs Level 1 vs others.

- expected_any: `['Direct', '5800', '5,800', '40381', '40,381', 'Level 1']`
- matched: `['Direct', 'Level 1']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2623`
- db_truth: `Direct=5800|Level 1=40381.25`

**Reply:**

```
User SIA00299 ka koi legacy SPOT income record nahi mila hai. 

Records ke mutabik:
- **Total Legacy SPOT Income:** 0
- **Direct/Level 1/Others:** Sabhi levels par income **0** hai.

Aapka legacy history aur current spot balance dono zero show kar rahe hain.
```

### ADMIN LA12 — `PASS` (explain_purchase_mismatch)

**Q:** User SIA00299 ka purchase id 1540 (₹7500 package) ka 2x income tracker vs ledger entries explain karo aur legacy context bhi do.

- expected_any: `['7500', '7,500', '4808', '4,808', 'legacy', 'ledger', 'migration']`
- matched: `['7500', '7,500', 'legacy', 'ledger', 'migration']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `6189`
- db_truth: `amount=7500|income=4808.96|legacy_spot=46181.25`

**Reply:**

```
User SIA00299 (ID: 1897) ke ₹7500 package (ID 1540) ka status aur legacy context neeche diya gaya hai:

**1. Legacy Context:**
SIA ka migration **state-based snapshot** ke zariye hua tha (Boundary Date: 2025-12-18). Iska matlab hai ki ledger mein poori purani history nahi hai; sirf migration ke waqt ka final balance aur uske baad ki activities dikhti hain.

**2. Income Tracker vs Ledger:**
*   **Ledger Entries:** Aapke records mein filhal **0** ledger entries hain. Ledger sirf post-migration activity dikhata hai.
*   **Legacy Spot Summary:** Purane Excel data ke hisaab se bhi legacy spot earnings **₹0** show ho rahi hain.
*   **Wallet Snapshot:** Aapka current wallet balance, spot balance, aur team royalty balance sabhi **₹0.00** par hain (Updated: 2025-12-12).

**Conclusion:** 
Agar 2x tr …
```

### ADMIN LA13 — `PASS` (investigation_workflow)

**Q:** Bataiye step-by-step ki agar user complain kare ki uska balance galat hai, toh legacy + ledger ka use karke kaise investigate karenge?

- expected_any: `['legacy', 'ledger', 'balance', 'snapshot', 'audit', 'wallet']`
- matched: `['legacy', 'ledger', 'balance', 'snapshot', 'wallet']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `7231`
- db_truth: `concept_investigation`

**Reply:**

```
Agar user balance galat hone ki complaint kare, toh legacy aur ledger data ka use karke aise investigate karein:

1. **Migration Context Check Karein:** Sabse pehle user ki migration date dekhein. User 1897 ke liye **migration_boundary_date 2025-12-18** hai. Yaad rakhein ki ledger sirf migration ke baad ki transactions dikhata hai.
2. **Wallet Snapshot Dekhein:** Check karein ki migration ke waqt snapshot balance kitna tha. Is user ka **wallet snapshot balance 0.00** aur **spot_balance 0.00** tha (updated at 2025-12-12).
3. **Legacy Spot Summary:** Purane Excel data (Legacy) ko check karein. User 1897 ka **total legacy spot amount 0** hai. Agar yahan koi amount hota, toh wo purani earnings ko justify karta jo ledger mein nahi dikhti.
4. **Ledger vs Legacy Comparison:** Dono ko compare kare …
```

### ADMIN LA14 — `FAIL` (user_lookup_legacy)

**Q:** User SIA00558 ke legacy SPOT total + ledger SPOT total batao.

- expected_any: `['105', '1,05,225', '105225', '30,187', '30187']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2256`
- db_truth: `legacy=105225|ledger=30187.5`

**Reply:**

```
User SIA00558 ka legacy SPOT total 0 hai aur ledger SPOT total bhi 0 hai.
```

### ADMIN LA15 — `PASS` (missing_commission_admin)

**Q:** User SIA00299 says 'I did not get level-1 SPOT commission' — admin POV se diagnose karke explain karo, aur legacy context bhi do.

- expected_any: `['legacy', 'spot', 'level', 'ledger', 'before', 'migration', 'diagnose']`
- matched: `['legacy', 'spot', 'level', 'ledger', 'migration']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot', 'diagnoseMissingCommission']`
- elapsed_ms: `7076`
- db_truth: `concept_diagnose_legacy`

**Reply:**

```
SIA00299 ke account diagnosis ka summary yeh hai:

**Problem:** Aapki Level-1 SPOT commissions (total **687.50**) "Pending" state mein hain, ledger mein credit nahi hui hain.

**Main Blockers:**
1. **KYC Pending:** Aapka KYC status abhi 'pending' hai. Jab tak KYC approve nahi hoti, commissions wallet mein credit nahi hongi.
2. **No Active Package:** Filhaal aapke paas koi active package nahi hai, jo commission eligibility ke liye zaroori hai.

**Data Details:**
*   **Pending Amount:** Level-1 se total 5 entries pending hain (Jaise 187.50, 62.50, 187.50, etc.).
*   **Recent Activations:** Downline user SIA02000 ne Level-1 par multiple purchases ki hain (e.g., 2500, 15000, 7500 amounts ki), par blockers ki wajah se aapka commission release nahi hua.

**Legacy Context:**
Aapka migration **18  …
```

### ADMIN LA16 — `FAIL` (legacy_spot_global_sum)

**Q:** What is the total amount of legacy SPOT income imported into the system across all users?

- expected_any: `['2631643', '2,631,643', '26,31,643']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `4177`
- db_truth: `2631643.75`

**Reply:**

```
The total amount of legacy SPOT income imported into the system is 0.
```

### ADMIN LA17 — `FAIL` (user_combined)

**Q:** User SIA00299 ka combined (legacy + ledger) SPOT total kitna hota hai?

- expected_any: `['129037', '129,037', '1,29,037']`
- matched: `[]`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2428`
- db_truth: `129037.50`

**Reply:**

```
User SIA00299 ka combined (legacy + ledger) SPOT total 0 hai. Dono legacy aur ledger accounts mein SPOT amount 0 dikha raha hai.
```

### ADMIN LA18 — `PASS` (migration_design)

**Q:** Migration approach state-based tha ya full ledger migration tha? Explain in 2-3 sentences.

- expected_any: `['state', 'snapshot', 'ledger', 'not', 'full', 'migration']`
- matched: `['state', 'snapshot', 'ledger', 'full', 'migration']`
- tool_calls: `['getUserMigrationContext', 'getUserLegacySpotSummary', 'compareLegacySpotVsLedgerSpot']`
- elapsed_ms: `2986`
- db_truth: `concept_state_based`

**Reply:**

```
Migration approach **state-based** tha, jisme wallet balances aur active package state ka snapshot migrate kiya gaya tha. Ye full ledger migration nahi tha, isliye current ledger mein sirf migration ke baad ki activity dikhayi degi, pura historical record nahi.
```
