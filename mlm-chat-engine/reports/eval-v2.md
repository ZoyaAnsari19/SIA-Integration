# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T16:06:58
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **95**
- Passed: **39**
- Satisfactory score: **41.05%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 48 | 36 | 75.0% |
| admin | 47 | 3 | 6.38% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 0 | 0.0% |
| concept | 16 | 7 | 43.75% |
| income | 2 | 0 | 0.0% |
| income_compound | 10 | 6 | 60.0% |
| kyc_aggregate | 2 | 0 | 0.0% |
| leaderboard | 1 | 0 | 0.0% |
| levels | 2 | 0 | 0.0% |
| network | 4 | 2 | 50.0% |
| packages | 7 | 2 | 28.57% |
| profile | 5 | 4 | 80.0% |
| purchases | 1 | 0 | 0.0% |
| system | 5 | 5 | 100.0% |
| system_stats | 5 | 3 | 60.0% |
| team | 3 | 3 | 100.0% |
| team_metrics | 2 | 0 | 0.0% |
| user_lookup | 8 | 0 | 0.0% |
| wallet | 5 | 2 | 40.0% |
| withdrawal_aggregate | 2 | 0 | 0.0% |
| withdrawal_counts | 1 | 1 | 100.0% |
| withdrawal_date | 2 | 1 | 50.0% |
| withdrawal_eligible | 2 | 1 | 50.0% |
| withdrawal_projection | 1 | 0 | 0.0% |
| withdrawals | 7 | 2 | 28.57% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `9817`
- db_truth: `SIA00299|RAHUL PARWATKAR`

**Reply:**

```
Your SIA ID is **SIA00299** and your registered name is **RAHUL PARWATKAR**.
```

### USER U02 — `FAIL` (profile)

**Q:** What is my registered email and phone number?

- expected_any: `['rahulparwatkar1983@gmail.com', '8605099465']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `15751`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Hello Rahul! I checked your profile (SIA ID: SIA00299), but your registered email and phone number are not currently visible in the data provided to me. 

To view your exact registered contact details, please check the **Profile** section directly in your user dashboard. Let me know if you need help with anything else, like your wallet balances or packages!
```

### USER U03 — `PASS` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `['approved']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `8783`
- db_truth: `approved`

**Reply:**

```
Your current KYC status is **approved**.
```

### USER U04 — `PASS` (profile)

**Q:** What is my account status — active or blocked?

- expected_any: `['active']`
- matched: `['active']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `11553`
- db_truth: `active`

**Reply:**

```
Your account is completely **active**. 

Additionally, your withdrawals are **not blocked**, you are not disqualified, and your KYC status is **approved**. Your account is in good standing!
```

### USER U05 — `PASS` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `['92']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `9882`
- db_truth: `92`

**Reply:**

```
Your sponsor / referrer user ID is **92**.
```

### USER U06 — `FAIL` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `9804`
- db_truth: `46208.31`

**Reply:**

```
Your main wallet balance right now is **₹4,778.24**.
```

### USER U07 — `FAIL` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `10789`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Here are your current wallet balances:

* **Total Balance:** ₹46,208.31
* **Main/Other Wallet:** ₹4,778.24
* **Spot Wallet:** ₹14,850.25
* **Team Royalty Wallet:** ₹26,579.82

*(Note: In the SIA system, "Main" and "Other" refer to the same wallet bucket).*
```

### USER U08 — `PASS` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `['14,850']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `10611`
- db_truth: `14850.25`

**Reply:**

```
Your spot wallet balance is ₹14,850.25.
```

### USER U09 — `PASS` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `['26,579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `14771`
- db_truth: `26579.82`

**Reply:**

```
Your team royalty wallet balance is **₹26,579.82**.
```

### USER U10 — `FAIL` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `17642`
- db_truth: `4`

**Reply:**

```
Based on your current profile data, you have **1 active package**:

* **Package:** Share Market Learning
* **Amount:** ₹30,000
* **Purchased On:** 27th Feb 2026

*(Note: If you purchased any other packages previously that have already reached their 2x income limit, they are marked as expired. Currently, this is your only active course.)*
```

### USER U11 — `PASS` (packages)

**Q:** List the names of all packages I have ever purchased.

- expected_any: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- matched: `['Share Market']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `17198`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
Based on your profile, your currently active package is:

* **Share Market Learning** (₹30,000.00)

*(Note: Your profile summary currently only displays active packages. Let me know if you want me to check your transaction history for older, expired packages!)*
```

### USER U12 — `FAIL` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `[]`
- tool_calls: `[]`
- elapsed_ms: `17854`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
I currently don't have the tool to fetch your pending package purchase requests (activation requests) directly through the chat. 

You can view any pending packages directly in the **Purchase Requests** or **Activation History** section of your SIA user dashboard. 

Would you like me to check your currently active or expired packages instead?
```

### USER U13 — `PASS` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `['30,000']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `12938`
- db_truth: `30000.00`

**Reply:**

```
The price of your **Share Market Learning** package is **₹30,000.00**.
```

### USER U14 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `11630`
- db_truth: `33`

**Reply:**

```
You have raised a total of **33 withdrawal requests**. 

Here is the breakdown of your requests:
* **Approved:** 33 
* **Total Amount:** ₹3,26,090.00

All of your withdrawal requests have been successfully approved! Let me know if you need details on any specific transaction.
```

### USER U15 — `PASS` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `['0', 'no', 'do not have any']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `11451`
- db_truth: `0`

**Reply:**

```
You currently do not have any pending withdrawal requests. 

All your 33 previous withdrawal requests (totaling **₹3,26,090.00**) have already been approved!
```

### USER U16 — `FAIL` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['32']`
- matched: `[]`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `10070`
- db_truth: `33`

**Reply:**

```
You have **33** approved withdrawal requests so far, with a total amount of **₹3,26,090.00**.
```

### USER U17 — `FAIL` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['192', '193', '194']`
- matched: `[]`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `14572`
- db_truth: `326090.00`

**Reply:**

```
The total approved withdrawal amount across all your requests is **₹3,26,090.00** (from a total of 33 approved requests).
```

### USER U18 — `FAIL` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `[]`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `18870`
- db_truth: `204567.31`

**Reply:**

```
You have received a total credit of **₹2,04,467.31** in your wallet so far. 

Here is the breakdown of your total income by type:
* **Monthly (Team Royalty):** ₹1,12,327.78
* **Spot Income:** ₹82,856.25
* **Global Helping:** ₹6,075.98
* **Self Income:** ₹3,207.30
```

### USER U19 — `FAIL` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `[]`
- tool_calls: `['getUserTransactions']`
- elapsed_ms: `15240`
- db_truth: `56714`

**Reply:**

```
Currently, there is **1** wallet transaction recorded against your account based on the latest data. 

It is a recent monthly commission (income) credit of **₹8.33**.
```

### USER U20 — `PASS` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `11420`
- db_truth: `28`

**Reply:**

```
You currently have **28 direct referrals** (direct legs).
```

### USER U21 — `PASS` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `12373`
- db_truth: `1893`

**Reply:**

```
Your total downline size across all levels is **1,893** members. 

Here is a quick breakdown of your team size across the first few levels:
* **Level 1 (Directs):** 28
* **Level 2:** 73
* **Level 3:** 188
* **Level 4:** 345
* **Level 5:** 288

*(Note: Your network extends all the way down to 15 levels!)*
```

### USER U22 — `PASS` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `['5']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `13425`
- db_truth: `5`

**Reply:**

```
Your upline chain is **5 levels deep**, meaning there are 5 ancestors directly above you in the network. 

(As a bonus, your own team is doing great—you have a total downline of 1,893 members!)
```

### USER U23 — `FAIL` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `[]`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `42298`
- db_truth: `991`

**Reply:**

```
You currently have exactly 200 pending commission entries recorded for you as the receiver.
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `18754`
- db_truth: `13`

**Reply:**

```
The SIA platform offers a total of **13 packages**. 

Currently, **10 packages are active** and available for purchase, while **3 are inactive**. The prices for these packages range from ₹2,500 up to ₹23,00,000.
```

### USER U25 — `PASS` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `[]`
- elapsed_ms: `8925`
- db_truth: `15000.00`

**Reply:**

```
The price of the **Digital Marketing** package is **₹15,000**. 

(Note: There is also an inactive "Digital Marketing-II" package priced at ₹25,000).
```

### USER U26 — `PASS` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `['23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `12023`
- db_truth: `7500.00`

**Reply:**

```
The price of the highest tier package on SIA is **₹23,00,000** (Cyber Security & Online Safety-III).
```

### USER U27 — `PASS` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `[]`
- elapsed_ms: `10286`
- db_truth: `10`

**Reply:**

```
There are exactly **10 levels** (from Level 0 to Level 9) configured in the SIA MLM system:

* **Level 0:** Field Worker (Direct)
* **Level 1:** Company Representative
* **Level 2:** Company City Manager
* **Level 3:** Company Area Manager
* **Level 4:** Company District Manager
* **Level 5:** Division Manager
* **Level 6:** Regional Manager
* **Level 7:** State Manager
* **Level 8:** National Manager
* **Level 9:** King

Level 0 is your direct sponsor/referral level, and Levels 1 through 9 are your upline/downline chain.
```

### USER U28 — `PASS` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `['King']`
- tool_calls: `[]`
- elapsed_ms: `4913`
- db_truth: `King`

**Reply:**

```
The title of the highest level in SIA MLM (Level 9) is **King**.
```

### USER U29 — `PASS` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `['upline', 'downline', 'sponsor']`
- tool_calls: `[]`
- elapsed_ms: `10406`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, your network is structured as a 9-level deep tree. Here is the difference between your upline and downline:

**Downline (The users below you)**
*   **Direct Downline (Level 1):** The people you personally invite and sponsor.
*   **Indirect Downline (Levels 2–9):** The users invited by your direct team, and their teams below them. 
*   **Why it matters:** When anyone in your downline (up to 9 levels deep) purchases or upgrades a package, you earn **SPOT** (one-time) and **MONTHLY** (recurring) commissions, provided you meet the active course and level eligibility requirements.

**Upline (The users above you)**
*   **Direct Upline (Sponsor / Level 0 from your perspective):** The person whose referral ID you used to register.
*   **Indirect Upline (Levels 1–9 from your  …
```

### USER U30 — `PASS` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `['main', 'spot', 'team royalty', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `10168`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, every user has **four types of wallets** (sub-balances). Here is what each one represents:

*   **Main Wallet (`other_balance`)**
    *   **What it holds:** Your daily `SELF` income and `GLOBAL_HELPING` income.
    *   **Usage:** Used for "wallet" type withdrawals and P2P transfers. All system fees (except KYC) are deducted from here. 
    *   **Special rule:** If you reinvest, credits may have a 90, 150, or 180-day reinvestment lock.

*   **Spot Wallet (`spot_balance`)**
    *   **What it holds:** Your `SPOT` commissions (the one-time 5% direct commission and level-based upline commissions earned when your team buys packages).
    *   **Usage:** Used for "spot" type withdrawals. Your ₹50 KYC fee is also deducted from here.
    *   **Special rule:** Every new SPOT cr …
```

### USER U31 — `PASS` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `['direct', 'commission', 'package', 'level']`
- tool_calls: `[]`
- elapsed_ms: `8299`
- db_truth: `concept`

**Reply:**

```
Direct commission in SIA MLM is earned by the direct sponsor (Level 0) when their direct downline buys a package. It consists of two parts:

* **Direct SPOT (One-time):** You receive **5%** of the package amount instantly at the time of purchase. *Condition: You must have an active course to receive this.*
* **Direct MONTHLY (Recurring):** You receive a daily prorated royalty of **0.5%** (for packages up to ₹3 Lakh) or **1.0%** (for packages ₹5 Lakh and above) per month. *Condition: Both you and your downline member must remain active to receive this daily credit.*

**A quick tip:** The 50% commission reduction that usually applies to reinvestments does **not** apply to Level 0. You will always get the full direct commission percentage when your direct downline renews or reinvests!
```

### USER U32 — `PASS` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- tool_calls: `[]`
- elapsed_ms: `11547`
- db_truth: `concept`

**Reply:**

```
Here is the step-by-step flow when you raise a withdrawal request in the SIA MLM system:

* **1. Pre-Checks & Submission:** You submit a withdrawal request for a specific wallet (Main, Spot, or Team Royalty). To do this, your **KYC must be approved**, you must provide your Transaction PIN, and you must request on valid dates:
  * **10th & 20th:** SPOT wallet only.
  * **30th (or 28th in Feb):** ALL wallets.
  * *Time Window:* 10:00 AM to 5:00 PM IST.
* **2. Validation:** The system checks your available balance (excluding 10-day Spot holds or reinvestment locks) and ensures your amount fits within your allowed withdrawal caps. 
* **3. Pending Status:** Your request is saved as **Pending**. At this stage, no money is deducted from your wallet yet. *(Note: You can only have one pending reque …
```

### USER U33 — `PASS` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `['p2p', 'transfer', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `9616`
- db_truth: `concept`

**Reply:**

```
A P2P (Peer-to-Peer) transfer in SIA MLM allows you to send money directly to another user. 

Here are the key details about how it works:
* **Wallet Used:** P2P transfers exclusively use the **Main wallet** (`other_balance`). You cannot transfer funds from your SPOT or Team Royalty wallets. The receiver also receives the funds in their Main wallet.
* **Tax Deduction:** A 3% transfer tax applies. This is deducted from the sender's balance on top of the transfer amount (e.g., sending ₹100 will deduct ₹103 from your wallet, and the receiver gets the full ₹100).
* **Limits:** The minimum transfer amount is ₹100, and the maximum is ₹9,999.96 per transaction.
* **Requirements:** Both you (the sender) and the receiver must have an **approved KYC status**, and you will need your transaction PIN t …
```

### USER U34 — `PASS` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `['kyc', 'approved', 'withdraw']`
- tool_calls: `[]`
- elapsed_ms: `7540`
- db_truth: `concept`

**Reply:**

```
KYC (Know Your Customer) is a necessary step to verify your identity and bank details for secure transactions. 

Here is what happens if your KYC is **not approved**:
* **No Withdrawals:** You cannot withdraw your earnings (Spot, Main, or Team Royalty) to your bank account or UPI.
* **No P2P Transfers:** You cannot send funds to or receive funds from other users' wallets. 

You will still be able to log in, purchase packages, and earn your daily and team commissions, but you must have an **approved KYC** to cash out your money!
```

### USER U35 — `PASS` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `['level', 'business', 'team', 'requirement', 'leg']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `27312`
- db_truth: `concept`

**Reply:**

```
To increase your level in the SIA MLM hierarchy, you need to grow your downline team and meet specific business requirements. Progression depends on building active direct referrals (legs) and generating a target amount of total team business. 

Here is the complete breakdown of all 10 levels and what is required to achieve them:

| Level | Title | Required Legs | Min. Business / Leg | Total Team Business | Reward |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | Field Worker | None | None | None | - |
| **1** | Company Representative | 4 | ₹7,500 | ₹2,15,000 | T-shirt and Diary |
| **2** | Company City Manager | 4 | ₹3,75,000 | ₹15,00,000 | 5G Mobile |
| **3** | Company Area Manager | 3 | ₹25,00,000 | ₹75,00,000 | Laptop |
| **4** | Company District Manager | 3 | ₹77,62,000 | ₹2,32, …
```

### USER U36 — `PASS` (income_compound)

**Q:** Mere 7500 wala English Speaking-III (package id 2) me pichhle 5 dino kitna SELF + GLOBAL income aaya hai?

- expected_any: `['197.50', '197.5', '197']`
- matched: `['197.50', '197.5', '197']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `13777`
- db_truth: `197.50`

**Reply:**

```
Aapke ₹7,500 wale English Speaking-III package me pichhle 5 dino me total **₹197.50** ka income aaya hai. 

Yaha detail breakdown hai:
* **SELF Income:** ₹37.50
* **GLOBAL Income:** ₹160.00
```

### USER U37 — `PASS` (income_compound)

**Q:** Pichhle 5 dino me mera total SELF + GLOBAL income kitna hai across all packages?

- expected_any: `['752.70', '752.7', '752']`
- matched: `['752.70', '752.7', '752']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `11152`
- db_truth: `752.70`

**Reply:**

```
Pichhle 5 dino me aapka total SELF aur GLOBAL income **₹752.70** hai. 

Yaha detail breakdown hai:
* **SELF Income:** ₹237.50
* **GLOBAL Income:** ₹515.20

Agar aapko kisi specific package ka detail chahiye, toh aap pooch sakte hai!
```

### USER U38 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets allowed hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `10523`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30th April 2026** ko hai (aaj se 5 din baad).

Us din aapke **sabhi wallets** se withdrawal allowed honge:
- SPOT Wallet
- Main (Other) Wallet
- Team Royalty Wallet

*(Note: Mahine ki 10th aur 20th ko sirf SPOT wallet allowed hota hai, lekin 30th ko saare wallets open hote hain).*
```

### USER U39 — `PASS` (withdrawal_eligible)

**Q:** Agle withdrawal date pe main exactly kitna amount apply / withdraw kar sakta hu?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `14202`
- db_truth: `46208.31`

**Reply:**

```
Aapka agla withdrawal date **30 April 2026** (5 din baad) hai. 30 tareekh ko aapke sabhi wallets (Spot, Main, aur Team Royalty) open rahenge. 

Aap total **₹46,208.31** tak withdraw kar sakte hain. 

**Aapke eligible wallets ka breakdown:**
* **Spot Wallet:** ₹14,850.25
* **Main (Other) Wallet:** ₹4,778.24
* **Team Royalty:** ₹26,579.82

**Kuch zaroori baatein:**
* Withdrawal window subah **10:00 baje se shaam 5:00 baje (IST)** tak hi open rahegi.
* Ye ek estimate hai, final withdrawal ke time par ₹30 processing fee aur aapke current package ka Spot/Team Royalty limit (cap) apply hoga.
```

### USER U40 — `PASS` (withdrawal_counts)

**Q:** Mere ab tak kitne withdrawal requests approved aur kitne rejected hue hain?

- expected_any: `['33', 'approved']`
- matched: `['33', 'approved']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `10965`
- db_truth: `approved=33`

**Reply:**

```
Aapke ab tak ke withdrawal requests ka status yeh hai:

* ✅ **Approved:** 33 (Total amount: ₹3,26,090.00)
* ❌ **Rejected:** 0

Aapke sabhi requests successfully approve ho chuke hain! Agar aapko koi aur detail chahiye toh bataiye.
```

### USER U41 — `PASS` (network)

**Q:** Mera total downline network kitna bada hai (sab depths milake)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `17129`
- db_truth: `1893`

**Reply:**

```
Aapka total downline network **1,893** members ka hai (sab depths milake)! 🚀

Yahan aapke top levels ka breakdown hai:
• **Depth 1 (Direct Referrals):** 28 members
• **Depth 2:** 73 members
• **Depth 3:** 188 members
• **Depth 4:** 345 members

Aapka network total **15 levels** deep tak faila hua hai. Agar aapko baaki sabhi levels ki details bhi chahiye, toh aap bata sakte hain!
```

### USER U42 — `PASS` (network)

**Q:** Mere kitne direct referrals hain (level-1 wale)?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `10960`
- db_truth: `28`

**Reply:**

```
Aapke total **28 direct referrals** (Level-1) hain!
```

### USER U43 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total MONTHLY recurring income kitna mila hai?

- expected_any: `['30312', '30,312']`
- matched: `['30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `10693`
- db_truth: `30312.92`

**Reply:**

```
Pichhle 30 dino me aapko total **₹30,312.92** ka MONTHLY recurring income mila hai.
```

### USER U44 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total SPOT income kitni aayi?

- expected_any: `['29118', '29,118']`
- matched: `['29,118']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `10755`
- db_truth: `29118.75`

**Reply:**

```
Pichhle 30 dino me aapki total SPOT income **₹29,118.75** aayi hai. Yeh amount total 31 transactions ke through aapke wallet me credit hua hai.
```

### USER U45 — `FAIL` (income_compound)

**Q:** Mere 2500 wale package (English Speaking Basic-I, package id 1) se ab tak total kitni income aayi hai (lifetime)?

- expected_any: `['7244', '7,244']`
- matched: `[]`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `13019`
- db_truth: `7244.95`

**Reply:**

```
Aapke ₹2,500 wale package (English Speaking Basic-I) se ab tak total **₹7,359.89** ki income aayi hai.

**Income Breakdown:**
* **SPOT Income:** ₹2,193.75
* **MONTHLY Income:** ₹5,166.14
```

### USER U46 — `PASS` (income_compound)

**Q:** Pichhle 7 din ka mera net income (saare types ka sum) kitna hai?

- expected_any: `['5275', '5,275']`
- matched: `['5,275']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `12922`
- db_truth: `5275.79`

**Reply:**

```
Aapka pichhle 7 din ka total net income **₹5,275.79** hai. 

Yaha aapke income ka breakdown (saare types ka) diya gaya hai:
* **Self Income:** ₹332.50
* **Global Helping:** ₹713.60
* **Spot Income:** ₹643.75
* **Monthly Royalty:** ₹7,610.94
* **Fee Deduction:** -₹4,025.00

Agar aapko kisi specific deduction ya commission ke baare me janna hai, toh zaroor batayein!
```

### USER U47 — `FAIL` (income_compound)

**Q:** Is mahine (April 2026) ki MONTHLY recurring income kitni mili hai abhi tak?

- expected_any: `['25588', '25,588']`
- matched: `[]`
- error: `llm_failed`
- tool_calls: `[]`
- elapsed_ms: `5529`
- db_truth: `25588.85`

**Reply:**

```
(no reply text)
```

### USER U48 — `PASS` (income_compound)

**Q:** English Speaking-III (package id 2) ka mera SPOT income lifetime kitna mila hai?

- expected_any: `['8887', '8,887']`
- matched: `['8,887']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `9691`
- db_truth: `8887.50`

**Reply:**

```
Aapko English Speaking-III (Package ID 2) se lifetime SPOT income total **₹8,887.50** mila hai. Yeh income aapko total 58 transactions ke through receive hui hai.
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `8959`
- db_truth: `2807`

**Reply:**

```
There are currently **2,807** total users registered on the SIA platform. Out of these, **2,803** are active users.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `9398`
- db_truth: `2803`

**Reply:**

```
There are currently 2,803 active users in the system (out of 2,807 total registered users).
```

### ADMIN A03 — `PASS` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `['1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `10620`
- db_truth: `1285`

**Reply:**

```
There are currently **1,285 users** with an approved KYC status in the system (out of a total of 2,807 users). 

Here is the breakdown of all KYC statuses:
* **Approved:** 1,285
* **Pending:** 1,473
* **Submitted:** 5
* **Rejected:** 44
```

### ADMIN A04 — `FAIL` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `4263`
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
- elapsed_ms: `593`
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
- elapsed_ms: `547`
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
- elapsed_ms: `725`
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
- elapsed_ms: `832`
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
- elapsed_ms: `538`
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
- elapsed_ms: `587`
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
- elapsed_ms: `587`
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
- elapsed_ms: `486`
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
- elapsed_ms: `606`
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
- elapsed_ms: `458`
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
- elapsed_ms: `516`
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
- elapsed_ms: `526`
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
- elapsed_ms: `540`
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
- elapsed_ms: `475`
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
- elapsed_ms: `438`
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
- elapsed_ms: `527`
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
- elapsed_ms: `501`
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
- elapsed_ms: `502`
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
- elapsed_ms: `272`
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
- elapsed_ms: `306`
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
- elapsed_ms: `223`
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
- elapsed_ms: `568`
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
- elapsed_ms: `288`
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
- elapsed_ms: `700`
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
- elapsed_ms: `518`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A30 — `FAIL` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `247`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A31 — `FAIL` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `289`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A32 — `FAIL` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `454`
- db_truth: `concept`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```

### ADMIN A33 — `FAIL` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `[]`
- error: `gemini_quota_exhausted`
- tool_calls: `[]`
- elapsed_ms: `243`
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
- elapsed_ms: `292`
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
- elapsed_ms: `380`
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
- elapsed_ms: `257`
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
- elapsed_ms: `257`
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
- elapsed_ms: `351`
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
- elapsed_ms: `502`
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
- elapsed_ms: `382`
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
- elapsed_ms: `241`
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
- elapsed_ms: `391`
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
- elapsed_ms: `275`
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
- elapsed_ms: `300`
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
- elapsed_ms: `230`
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
- elapsed_ms: `232`
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
- elapsed_ms: `360`
- db_truth: `30312.92`

**Reply:**

```
Gemini quota exhausted (429). Enable billing / increase quota for this API key, or switch to a different key/model.
```
