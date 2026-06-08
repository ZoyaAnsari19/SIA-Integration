# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T16:14:42
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **95**
- Passed: **7**
- Satisfactory score: **7.37%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 48 | 2 | 4.17% |
| admin | 47 | 5 | 10.64% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 0 | 0.0% |
| concept | 16 | 3 | 18.75% |
| income | 2 | 0 | 0.0% |
| income_compound | 10 | 0 | 0.0% |
| kyc_aggregate | 2 | 0 | 0.0% |
| leaderboard | 1 | 0 | 0.0% |
| levels | 2 | 0 | 0.0% |
| network | 4 | 0 | 0.0% |
| packages | 7 | 0 | 0.0% |
| profile | 5 | 1 | 20.0% |
| purchases | 1 | 0 | 0.0% |
| system | 5 | 1 | 20.0% |
| system_stats | 5 | 2 | 40.0% |
| team | 3 | 0 | 0.0% |
| team_metrics | 2 | 0 | 0.0% |
| user_lookup | 8 | 0 | 0.0% |
| wallet | 5 | 0 | 0.0% |
| withdrawal_aggregate | 2 | 0 | 0.0% |
| withdrawal_counts | 1 | 0 | 0.0% |
| withdrawal_date | 2 | 0 | 0.0% |
| withdrawal_eligible | 2 | 0 | 0.0% |
| withdrawal_projection | 1 | 0 | 0.0% |
| withdrawals | 7 | 0 | 0.0% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `12598`
- db_truth: `SIA00299|RAHUL PARWATKAR`

**Reply:**

```
Aapka SIA ID `SIA00299` hai aur registered naam `RAHUL PARWATKAR` hai.
```

### USER U02 — `FAIL` (profile)

**Q:** What is my registered email and phone number?

- expected_any: `['rahulparwatkar1983@gmail.com', '8605099465']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `12520`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Mujhe aapke registered email aur phone number ki jaankari system mein nahi mili.

Lekin, aapki profile ke mutabik:
*   **SIA ID:** SIA00299
*   **Naam:** RAHUL PARWATKAR
*   **Role:** STUDENT
*   **KYC Status:** approved
*   **Withdrawal Blocked:** nahi
*   **Disqualified:** nahi

Agar aapko email ya phone number update karwana hai, toh support se contact kar sakte hain.
```

### USER U03 — `FAIL` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `8898`
- db_truth: `approved`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U04 — `FAIL` (profile)

**Q:** What is my account status — active or blocked?

- expected_any: `['active']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `801`
- db_truth: `active`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U05 — `FAIL` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `608`
- db_truth: `92`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U06 — `FAIL` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `836`
- db_truth: `46208.31`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U07 — `FAIL` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `801`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U08 — `FAIL` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `604`
- db_truth: `14850.25`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U09 — `FAIL` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `576`
- db_truth: `26579.82`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U10 — `FAIL` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `['4']`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `556`
- db_truth: `4`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U11 — `FAIL` (packages)

**Q:** List the names of all packages I have ever purchased.

- expected_any: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `592`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U12 — `FAIL` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `739`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U13 — `FAIL` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `635`
- db_truth: `30000.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U14 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `565`
- db_truth: `33`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U15 — `FAIL` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `584`
- db_truth: `0`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U16 — `FAIL` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['32']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `700`
- db_truth: `33`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U17 — `FAIL` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['192', '193', '194']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `565`
- db_truth: `326090.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U18 — `FAIL` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `615`
- db_truth: `204567.31`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U19 — `FAIL` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `640`
- db_truth: `56714`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U20 — `FAIL` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `622`
- db_truth: `28`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U21 — `FAIL` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `584`
- db_truth: `1893`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U22 — `FAIL` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `577`
- db_truth: `5`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U23 — `FAIL` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `[]`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `12064`
- db_truth: `991`

**Reply:**

```
Aapke liye total **77 pending commission entries** hain.
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `9784`
- db_truth: `13`

**Reply:**

```
SIA platform par total **13 packages** available hain.
```

### USER U25 — `FAIL` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6439`
- db_truth: `15000.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U26 — `FAIL` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `1021`
- db_truth: `7500.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U27 — `FAIL` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `607`
- db_truth: `10`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U28 — `FAIL` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `623`
- db_truth: `King`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U29 — `FAIL` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `706`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U30 — `FAIL` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `578`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U31 — `FAIL` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `555`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U32 — `FAIL` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `593`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U33 — `FAIL` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `621`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U34 — `FAIL` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `615`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U35 — `FAIL` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `588`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U36 — `FAIL` (income_compound)

**Q:** Mere 7500 wala English Speaking-III (package id 2) me pichhle 5 dino kitna SELF + GLOBAL income aaya hai?

- expected_any: `['197.50', '197.5', '197']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `570`
- db_truth: `197.50`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U37 — `FAIL` (income_compound)

**Q:** Pichhle 5 dino me mera total SELF + GLOBAL income kitna hai across all packages?

- expected_any: `['752.70', '752.7', '752']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `633`
- db_truth: `752.70`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U38 — `FAIL` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets allowed hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `808`
- db_truth: `logic_check`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U39 — `FAIL` (withdrawal_eligible)

**Q:** Agle withdrawal date pe main exactly kitna amount apply / withdraw kar sakta hu?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `642`
- db_truth: `46208.31`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U40 — `FAIL` (withdrawal_counts)

**Q:** Mere ab tak kitne withdrawal requests approved aur kitne rejected hue hain?

- expected_any: `['33', 'approved']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `651`
- db_truth: `approved=33`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U41 — `FAIL` (network)

**Q:** Mera total downline network kitna bada hai (sab depths milake)?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `601`
- db_truth: `1893`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U42 — `FAIL` (network)

**Q:** Mere kitne direct referrals hain (level-1 wale)?

- expected_any: `['28']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `686`
- db_truth: `28`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U43 — `FAIL` (income_compound)

**Q:** Pichhle 30 dino me total MONTHLY recurring income kitna mila hai?

- expected_any: `['30312', '30,312']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `599`
- db_truth: `30312.92`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U44 — `FAIL` (income_compound)

**Q:** Pichhle 30 dino me total SPOT income kitni aayi?

- expected_any: `['29118', '29,118']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `707`
- db_truth: `29118.75`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U45 — `FAIL` (income_compound)

**Q:** Mere 2500 wale package (English Speaking Basic-I, package id 1) se ab tak total kitni income aayi hai (lifetime)?

- expected_any: `['7244', '7,244']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `621`
- db_truth: `7244.95`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U46 — `FAIL` (income_compound)

**Q:** Pichhle 7 din ka mera net income (saare types ka sum) kitna hai?

- expected_any: `['5275', '5,275']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `607`
- db_truth: `5275.79`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U47 — `FAIL` (income_compound)

**Q:** Is mahine (April 2026) ki MONTHLY recurring income kitni mili hai abhi tak?

- expected_any: `['25588', '25,588']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `667`
- db_truth: `25588.85`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### USER U48 — `FAIL` (income_compound)

**Q:** English Speaking-III (package id 2) ka mera SPOT income lifetime kitna mila hai?

- expected_any: `['8887', '8,887']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `594`
- db_truth: `8887.50`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `10690`
- db_truth: `2807`

**Reply:**

```
Right now, SIA platform par total **2,807 users** registered hain.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `8753`
- db_truth: `2803`

**Reply:**

```
System mein **2,803 active users** hain.
```

### ADMIN A03 — `FAIL` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `6004`
- db_truth: `1285`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A04 — `FAIL` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `818`
- db_truth: `13`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A05 — `FAIL` (system_stats)

**Q:** How many levels are defined in the level master table?

- expected_any: `['10']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `843`
- db_truth: `10`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A06 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests are sitting in the pending bucket right now?

- expected_any: `['0', 'no', 'none']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `582`
- db_truth: `0`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A07 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests have been approved across the platform till date?

- expected_any: `['5052', '5,052']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `608`
- db_truth: `5052`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A08 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests have been rejected so far?

- expected_any: `['73']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `632`
- db_truth: `73`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A09 — `FAIL` (purchases)

**Q:** How many package purchases (rows in purchases) exist in the database?

- expected_any: `['2838', '2,838']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `670`
- db_truth: `2838`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A10 — `FAIL` (commissions)

**Q:** How many pending commission entries are sitting in the system in total?

- expected_any: `['13636', '13,636']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `614`
- db_truth: `13636`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A11 — `FAIL` (wallet)

**Q:** How many wallet transaction rows exist across all users (rough magnitude is fine)?

- expected_any: `['893336', '893,336', '893']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `614`
- db_truth: `893336`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A12 — `FAIL` (user_lookup)

**Q:** Pull profile details for SIA00299 — name, email, phone, status.

- expected_any: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `766`
- db_truth: `SIA00299|RAHUL PARWATKAR|rahulparwatkar1983@gmail.com|8605099465|active`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A13 — `FAIL` (user_lookup)

**Q:** What is the KYC status of user SIA00299?

- expected_any: `['approved']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `576`
- db_truth: `approved`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A14 — `FAIL` (user_lookup)

**Q:** How many direct referrals does SIA00299 have?

- expected_any: `['28']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `580`
- db_truth: `28`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A15 — `FAIL` (user_lookup)

**Q:** What is the total downline size of SIA00299 (excluding the user himself)?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `652`
- db_truth: `1893`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A16 — `FAIL` (user_lookup)

**Q:** What is the main wallet balance of SIA00299?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `675`
- db_truth: `46208.31`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A17 — `FAIL` (user_lookup)

**Q:** How many package purchases has SIA00299 made?

- expected_any: `['4']`
- matched: `['4']`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `745`
- db_truth: `4`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A18 — `FAIL` (user_lookup)

**Q:** How many withdrawal requests has SIA00299 raised in total?

- expected_any: `['33']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `605`
- db_truth: `33`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A19 — `FAIL` (user_lookup)

**Q:** Has SIA00299 paid for the Graphic Designing & Video Editing package, and what is its status?

- expected_any: `['pending']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `586`
- db_truth: `pending`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A20 — `FAIL` (packages)

**Q:** Which package is the highest priced on SIA and what is its price?

- expected_any: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `656`
- db_truth: `Cyber Security & Online Safety-III|2300000.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A21 — `FAIL` (packages)

**Q:** Which package is the cheapest on SIA and what is its price?

- expected_any: `['English Speaking Basic', '2500', '2,500']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `698`
- db_truth: `English Speaking Basic -I|2500.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A22 — `FAIL` (packages)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `624`
- db_truth: `15000.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A23 — `FAIL` (levels)

**Q:** What is the title of level 0 and level 9 in the level master?

- expected_any: `['Field Worker', 'King']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `704`
- db_truth: `0:Field Worker, 9:King`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A24 — `FAIL` (levels)

**Q:** List the titles for levels 1 through 4 in the SIA MLM level master.

- expected_any: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `585`
- db_truth: `Company Representative, Company City Manager, Company Area Manager, Company District Manager`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A25 — `FAIL` (team_metrics)

**Q:** Who currently has the highest number of direct referrals on the platform — give their SIA ID and count?

- expected_any: `['SIA00111', '45']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `594`
- db_truth: `SIA00111|45`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A26 — `FAIL` (team_metrics)

**Q:** How big is SIA00111's downline (descendants count, excluding self)?

- expected_any: `[]`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `597`
- db_truth: `2325`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A27 — `FAIL` (concept)

**Q:** Explain what a pending commission row in the database represents and when it gets cleared.

- expected_any: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `569`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A28 — `FAIL` (concept)

**Q:** Walk me through the lifecycle of a withdrawal request from creation to approval/rejection.

- expected_any: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `630`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A29 — `FAIL` (concept)

**Q:** What is the difference between purchases and pending_commissions tables in this system?

- expected_any: `['purchase', 'package', 'commission', 'pending', 'level']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `550`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A30 — `PASS` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `['closure', 'ancestor', 'descendant', 'depth']`
- tool_calls: `[]`
- elapsed_ms: `8288`
- db_truth: `concept`

**Reply:**

```
The `user_tree_paths` table is a **closure table** that stores the downline and upline hierarchy for every user in SIA MLM.

Each row in `user_tree_paths` means:
- `ancestor_id`: The ID of the upline user.
- `descendant_id`: The ID of the downline user.
- `depth`: The number of levels separating the ancestor from the descendant.
    - `depth = 0`: The row represents the user themselves (e.g., `(user_id, user_id, 0)`).
    - `depth = 1`: The ancestor is the direct sponsor of the descendant.
    - `depth > 1`: The ancestor is an indirect upline (grand-sponsor, great-grand-sponsor, etc.) of the descendant.

This structure allows for efficient lookup of all uplines up to a certain depth, or all downlines.
```

### ADMIN A31 — `PASS` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `['spot', 'team royalty', 'balance']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `13084`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein har user ke liye chaar tarah ke wallet hote hain:

*   **Total Balance:** Yeh aapke sabhi wallets ka total hota hai, sirf information ke liye.
*   **Spot Balance (`spot_balance`):** Isme aapki saari `SPOT` commissions credit hoti hain. Isme se withdrawal `spot` type ka hota hai. Har `SPOT` credit par 10-din ka hold lagta hai, jiske baad hi aap use nikaal sakte hain.
*   **Other Balance (`other_balance`):** Isme `SELF` income, `GLOBAL_HELPING` income, aur `ADMIN_OPS` ke credits aate hain. Fees aur P2P debits bhi isme se hoti hain. Isme se withdrawal `wallet` type ka hota hai. `SELF` aur `GLOBAL_HELPING` income par reinvestment ke case mein 90, 150 ya 180 din ka lock lag sakta hai.
*   **Team Royalty Balance (`team_royalty_balance`):** Isme saari `MONTHLY` commissions cre …
```

### ADMIN A32 — `PASS` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `['disqualified', 'commission', 'income']`
- tool_calls: `[]`
- elapsed_ms: `6759`
- db_truth: `concept`

**Reply:**

```
`is_disqualified=true` ka matlab hai ki user ko system se disqualified kar diya gaya hai. Ye tab hota hai jab koi user 21 din ya usse zyada time tak inactive rehta hai, matlab unke paas koi active package nahi hota (saare packages 2x income tak pahunch gaye hote hain).

Disqualified hone ke baad:
- Commissions unke through flow nahi karti.
- Unki old downline unki khud ki eligibility ke liye count nahi hoti.
- Wo fir bhi team tree mein rehte hain, par unhe renew/upgrade karna hota hai taaki wo fir se earn kar sakein.

Aap `explainSystemConcept` tool call use karke is baare mein aur jaan sakte hain.
```

### ADMIN A33 — `FAIL` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `5696`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A34 — `FAIL` (concept)

**Q:** Explain what the legacy_activation_history and legacy_spot_history tables are used for.

- expected_any: `['legacy', 'history', 'old', 'spot', 'activation']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `777`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A35 — `FAIL` (concept)

**Q:** Can an admin manually adjust a user's wallet, and if yes, where is that recorded?

- expected_any: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `797`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A36 — `FAIL` (leaderboard)

**Q:** Top 3 referrers kaun hain — kis user ke sabse zyada direct referrals hain?

- expected_any: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `675`
- db_truth: `SIA00111=45,SIA01430=35,SIA01699=33`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A37 — `FAIL` (kyc_aggregate)

**Q:** Total approved KYC users kitne hain abhi system me?

- expected_any: `['1285', '1,285']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `582`
- db_truth: `1285`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A38 — `FAIL` (kyc_aggregate)

**Q:** Total pending KYC users kitne hain?

- expected_any: `['1473', '1,473']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `672`
- db_truth: `1473`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A39 — `FAIL` (withdrawal_aggregate)

**Q:** Pichhle 30 dino me kitne approved withdrawal requests pass hue aur unka total amount kya hai?

- expected_any: `['937', '5761985', '5,761,985']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `911`
- db_truth: `937|5761985.62`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A40 — `FAIL` (withdrawal_projection)

**Q:** Admin POV: agle withdrawal date par mere paas approximately kitni amount ki withdrawal demand aa sakti hai (upper bound)?

- expected_any: `['7571367', '7,571,367', '7571']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `561`
- db_truth: `7571367.03`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A41 — `FAIL` (withdrawal_eligible)

**Q:** User SIA00299 ki agle withdrawal date pe eligible withdrawal amount kya hai?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `597`
- db_truth: `46208.31`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A42 — `FAIL` (network)

**Q:** User SIA00299 ka total downline network size kitna hai?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `514`
- db_truth: `1893`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A43 — `FAIL` (network)

**Q:** User SIA00299 ke total kitne direct referrals hain?

- expected_any: `['28']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `568`
- db_truth: `28`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A44 — `FAIL` (income_compound)

**Q:** User SIA00111 ka 7500 wale English Speaking-III package se SELF income lifetime kitna mila hai?

- expected_any: `['180', '180.00']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `585`
- db_truth: `180.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A45 — `FAIL` (withdrawal_aggregate)

**Q:** Globally rejected withdrawal requests kitne hain aur unka total amount kya hai?

- expected_any: `['73', '510544', '510,544']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `518`
- db_truth: `73|510544.00`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A46 — `FAIL` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets opened hote hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `460`
- db_truth: `logic_check`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A47 — `FAIL` (income_compound)

**Q:** User SIA00299 ka pichhle 30 dino me sirf MONTHLY recurring income type ka kitna paisa credit hua?

- expected_any: `['30312', '30,312']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `574`
- db_truth: `30312.92`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```
