# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T16:33:21
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **95**
- Passed: **80**
- Satisfactory score: **84.21%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 48 | 37 | 77.08% |
| admin | 47 | 43 | 91.49% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 1 | 50.0% |
| concept | 16 | 16 | 100.0% |
| income | 2 | 0 | 0.0% |
| income_compound | 10 | 9 | 90.0% |
| kyc_aggregate | 2 | 2 | 100.0% |
| leaderboard | 1 | 1 | 100.0% |
| levels | 2 | 2 | 100.0% |
| network | 4 | 4 | 100.0% |
| packages | 7 | 5 | 71.43% |
| profile | 5 | 4 | 80.0% |
| purchases | 1 | 0 | 0.0% |
| system | 5 | 5 | 100.0% |
| system_stats | 5 | 5 | 100.0% |
| team | 3 | 3 | 100.0% |
| team_metrics | 2 | 2 | 100.0% |
| user_lookup | 8 | 7 | 87.5% |
| wallet | 5 | 2 | 40.0% |
| withdrawal_aggregate | 2 | 2 | 100.0% |
| withdrawal_counts | 1 | 1 | 100.0% |
| withdrawal_date | 2 | 2 | 100.0% |
| withdrawal_eligible | 2 | 2 | 100.0% |
| withdrawal_projection | 1 | 0 | 0.0% |
| withdrawals | 7 | 5 | 71.43% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5679`
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
- elapsed_ms: `12562`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Your registered name is **RAHUL PARWATKAR** (SIA ID: **SIA00299**). 

However, the specific email address and phone number were not returned in the current profile snapshot. You can find these details by visiting the **Profile** or **Account Settings** section in your SIA dashboard.
```

### USER U03 — `PASS` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `['approved']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5191`
- db_truth: `approved`

**Reply:**

```
Aapka current KYC status **approved** hai.
```

### USER U04 — `PASS` (profile)

**Q:** What is my account status — active or blocked?

- expected_any: `['active']`
- matched: `['active']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `6284`
- db_truth: `active`

**Reply:**

```
Aapka account status currently **Active** hai aur koi block nahi laga hai. Details niche di gayi hain:

*   **Account Status:** Active ✅
*   **KYC Status:** Approved
*   **Withdrawal Status:** Not Blocked (Aap withdrawals le sakte hain)
*   **Disqualification:** No
*   **Active Package:** Share Market Learning (Price: ₹30,000.00)

Aapka current total balance **₹46,208.31** hai.
```

### USER U05 — `PASS` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `['92']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5899`
- db_truth: `92`

**Reply:**

```
Your sponsor / referrer user id is **92**.
```

### USER U06 — `FAIL` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `6041`
- db_truth: `46208.31`

**Reply:**

```
Your main wallet (Other Balance) is **₹4,778.24**.
```

### USER U07 — `FAIL` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `6437`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Your wallet balances are as follows:

*   **Total Balance:** ₹46,208.31
*   **Spot Wallet:** ₹14,850.25
*   **Main Wallet (Other):** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82
```

### USER U08 — `PASS` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `['14,850']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `5512`
- db_truth: `14850.25`

**Reply:**

```
Your current **Spot Wallet balance** is **₹14,850.25**.
```

### USER U09 — `PASS` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `['26,579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `6620`
- db_truth: `26579.82`

**Reply:**

```
Your Team Royalty wallet balance is ₹26,579.82.
```

### USER U10 — `PASS` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `22414`
- db_truth: `4`

**Reply:**

```
You have purchased **2 packages** so far, and both are currently active and generating income:

*   **Share Market Learning (₹30,000.00):** Purchased on Feb 27, 2026. It has earned ₹4,474.32 in income so far.
*   **English Speaking-III (₹7,500.00):** (Purchase ID 1540). Although not listed as your primary active package in the summary, your records show you received ₹7.50 (SELF) and ₹32.00 (GLOBAL_HELPING) income from this package today.

Your total wallet balance across all buckets is **₹46,208.31**.
```

### USER U11 — `FAIL` (packages)

**Q:** List the names of all packages I have ever purchased.

- expected_any: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- matched: `[]`
- tool_calls: `['getUserProfile', 'getUserIncome', 'getUserProfile']`
- elapsed_ms: `25714`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
```json
{ "tool_call": { "name": "getUserProfile", "arguments": {} } }
```
```

### USER U12 — `FAIL` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `15095`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
Currently, your profile shows that your **Share Market Learning** package (₹30,000.00) is **Active** and generating income (purchased on Feb 27, 2026). 

There are no package purchases listed with a "pending" status in your active profile summary. If you recently submitted a new purchase request (via manual UTR/Payment Proof), it may still be in the admin approval queue under "Purchase Requests" in your dashboard.
```

### USER U13 — `PASS` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `['30,000']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5405`
- db_truth: `30000.00`

**Reply:**

```
The price of your **Share Market Learning** purchase (SIA00299) was **₹30,000.00**. 

This package was purchased on February 27, 2026.
```

### USER U14 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5277`
- db_truth: `33`

**Reply:**

```
Aapne total **33** withdrawal requests raise kiye hain.

*   **Total Count:** 33
*   **Total Amount:** ₹3,26,090.00
*   **Status:** Aapke saare 33 requests approved ho chuke hain.
```

### USER U15 — `PASS` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `['0', 'no']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6899`
- db_truth: `0`

**Reply:**

```
No, aapke paas abhi koi pending withdrawal request nahi hai. Aapke pichhle sabhi 33 withdrawal requests approved ho chuke hain, jinka total amount ₹3,26,090.00 hai.
```

### USER U16 — `FAIL` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['32']`
- matched: `[]`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6262`
- db_truth: `33`

**Reply:**

```
Aapke total **33 withdrawal requests** approve ho chuke hain, jinki kul raashi (total amount) **₹3,26,090.00** hai.
```

### USER U17 — `FAIL` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['192', '193', '194']`
- matched: `[]`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `23485`
- db_truth: `326090.00`

**Reply:**

```
Your total approved withdrawal amount across all requests is **₹3,26,090.00**.

Here is the breakdown by wallet type for your **33 approved requests**:

*   **Main Wallet (other_balance):** ₹1,74,919.00
*   **SPOT Wallet:** ₹1,04,494.00
*   **Team Royalty Wallet:** ₹46,677.00

All your recent withdrawal requests are currently in "approved" status.
```

### USER U18 — `FAIL` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `[]`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `21568`
- db_truth: `204567.31`

**Reply:**

```
The total net credit amount received in your wallet is **₹1,75,453.12**. Here is the detailed breakdown of your earnings and adjustments:

*   **SELF Income:** ₹3,207.30
*   **GLOBAL_HELPING:** ₹6,075.98
*   **SPOT Commission:** ₹82,856.25
*   **MONTHLY Royalty:** ₹1,12,327.78
*   **ADMIN_OPS (Adjustments):** -₹29,014.19

**Total Gross Earnings (Income only):** ₹2,04,467.31
**Total Net Credit (Including Adjustments):** ₹1,75,453.12
```

### USER U19 — `FAIL` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `[]`
- tool_calls: `['getUserTransactions']`
- elapsed_ms: `11175`
- db_truth: `56714`

**Reply:**

```
Based on your transaction history, there is **1** wallet transaction recorded against your account:

*   **ID:** 911106
*   **Type:** INCOME (MONTHLY)
*   **Amount:** ₹8.33
*   **Date:** April 25, 2026, 06:26 AM IST
```

### USER U20 — `PASS` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `4846`
- db_truth: `28`

**Reply:**

```
You have 28 direct referrals.
```

### USER U21 — `PASS` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `7425`
- db_truth: `1893`

**Reply:**

```
Your total downline size is **1,893** members (excluding yourself).

Here is a summary of your network structure:
* **Direct Referrals (Level 1):** 28 members
* **Indirect Downline:** 1,865 members
* **Total Depth:** 15 levels deep
* **Your Upline Depth:** 5 levels below the root sponsor
```

### USER U22 — `PASS` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `['5']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `8874`
- db_truth: `5`

**Reply:**

```
Your upline chain goes **5 levels deep**, meaning there are 5 ancestors above you in the system.
```

### USER U23 — `FAIL` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `[]`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `11059`
- db_truth: `991`

**Reply:**

```
Aapke account mein total **126 pending commission entries** record ki gayi hain. 

Yeh sabhi entries **SPOT commission** ki hain jo upline levels (Level 4 se Level 8 tak) se judi hain. Inka status "pending" isliye hai kyunki aap abhi un levels ke liye qualified nahi hain (reason: eligibility). 

Kuch pramukh jaankari:
*   **Total Entries:** 126
*   **Commission Type:** SPOT
*   **Levels:** Level 4, 5, 6, 7, aur 8
*   **Reason:** Eligibility qualification pending hai.

Jab aap relevant levels qualify kar lenge, yeh amounts aapke wallet mein credit kar diye jayenge.
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5870`
- db_truth: `13`

**Reply:**

```
The SIA platform offers a total of **13 packages**.

Currently, there are **10 active packages** available for purchase, ranging from ₹2,500 to ₹23,00,000, and **3 inactive packages**.
```

### USER U25 — `PASS` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5364`
- db_truth: `15000.00`

**Reply:**

```
The price of the Digital Marketing package is ₹15,000.00.
```

### USER U26 — `PASS` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `['23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `4518`
- db_truth: `7500.00`

**Reply:**

```
The highest tier package on SIA is **Cyber Security & Online Safety-III**. Its price is **₹23,00,000.00**.

This package offers the highest benefits in the system:
*   **Self ROI:** 7% per month
*   **Global IDs:** 57,000
*   **Direct Monthly Royalty:** 1.0%
```

### USER U27 — `PASS` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `7036`
- db_truth: `10`

**Reply:**

```
System mein total **10 levels** (0 se 9) configured hain. Har level ke titles aur requirements neeche diye gaye hain:

*   **Level 0: Field Worker** (Direct level)
*   **Level 1: Company Representative** (Business: ₹2,15,000 | Reward: T-shirt aur Diary)
*   **Level 2: Company City Manager** (Business: ₹15,00,000 | Reward: 5G Mobile)
*   **Level 3: Company Area Manager** (Business: ₹75,00,000 | Reward: Laptop)
*   **Level 4: Company District Manager** (Business: ₹2.32 Crore | Reward: Motorcycle)
*   **Level 5: Division Manager** (Business: ₹7.61 Crore | Reward: Car)
*   **Level 6: Regional Manager** (Business: ₹26.65 Crore | Reward: Land in Secure City)
*   **Level 7: State Manager** (Business: ₹103.93 Crore | Reward: Flat in Secure City)
*   **Level 8: National Manager** (Business: ₹446.96 …
```

### USER U28 — `PASS` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `['King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `7344`
- db_truth: `King`

**Reply:**

```
SIA MLM mein sabse bada level **Level 9** hai, jiska title **"King"** hai. Is level tak pahunchne ke liye total ₹21,00,00,00,000 (2,100 Crore) ka business requirement hota hai aur iska reward "Freedom" hai.
```

### USER U29 — `PASS` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `['upline', 'downline', 'ancestor', 'sponsor']`
- tool_calls: `[]`
- elapsed_ms: `4800`
- db_truth: `concept`

**Reply:**

```
SIA MLM mein Upline aur Downline ka matlab ye hai:

*   **Upline:** Ye wo log hote hain jo system mein aapke upar aate hain, jaise aapke sponsor, grand-sponsor, aur upar ke 9 levels tak ke ancestors. Jab bhi aap koi package kharidte hain, toh in uplines ko commissions (SPOT aur MONTHLY) milte hain.
*   **Downline:** Ye aapki team hoti hai. Ismein wo sab log aate hain jinhone aapke referral code se join kiya hai (direct) aur unke niche join hone wale users (indirect).

Simple shabdon mein, **Upline** ko aapse commission milta hai, aur **Downline** ke kaam karne par aapko commission milta hai. Ye poora system 9 levels tak track kiya jata hai.
```

### USER U30 — `PASS` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `['main', 'spot', 'team royalty', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `7614`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein basically 4 tarah ke wallet balances hote hain:

*   **Total Balance (₹):** Ye aapke sabhi sub-wallets ka kul jod (sum) hota hai.
*   **SPOT Wallet:** Isme aapki **SPOT commissions** aati hain (jo downline ki har purchase par turant milti hain). Is wallet ke paison par 10-day ka hold hota hai.
*   **Main Wallet (Other Balance):** Isme aapki **SELF income** (ROI) aur **Global Helping** income jama hoti hai.
*   **Team Royalty Wallet:** Isme aapki **MONTHLY** team royalty income aati hai (aapki team ki active purchases par milne wala daily recurring commission).

Har wallet ke liye withdrawal ke alag rules aur dates hote hain. Kya aap apne wallet ka live balance check karna chahenge?
```

### USER U31 — `PASS` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `['direct', 'commission', 'package', 'level']`
- tool_calls: `[]`
- elapsed_ms: `6714`
- db_truth: `concept`

**Reply:**

```
SIA MLM mein direct commission (Level 0) do hisson mein milta hai jab aapka koi direct referral package kharidta hai:

*   **Direct SPOT Commission (One-time):** Yeh purchase amount ka **5%** hota hai jo turant mil jata hai. Iske liye aapka apna course active hona chahiye.
*   **Direct MONTHLY Royalty (Daily):** Yeh ek recurring income hai jo buyer ke active rehne tak milti hai:
    *   ₹3,00,000 tak ke packages par: **0.5%** per month.
    *   ₹5,00,000 aur usse bade packages par: **1.0%** per month.
    *   Yeh amount mahine ke dino ke hisab se daily credit hota hai.

**Zaroori Baatein:**
*   Level 0 par "reinvestment" ka 50% reduction rule apply nahi hota; aapko pura commission milta hai.
*   Agar aapka apna package 2x limit reach kar chuka hai (expired hai), toh aapko direct commission …
```

### USER U32 — `PASS` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `8501`
- db_truth: `concept`

**Reply:**

```
Withdrawal request ka end-to-end flow kuch is tarah hota hai:

1.  **Submission**: Aap apni request submit karte hain jisme Amount, Payment Method, Account Details, Wallet Type aur Transaction PIN enter karna hota hai.
2.  **System Validation**: Request submit karte hi system lagbhag 12 checks karta hai, jaise:
    *   KYC Approved hona chahiye.
    *   Transaction PIN sahi hona chahiye.
    *   Withdrawal blocked nahi hona chahiye.
    *   Usi wallet type ki koi dusri request 'pending' nahi honi chahiye.
    *   Available balance (holds aur N× capping minus karke) check kiya jata hai.
3.  **Pending Status**: Validation pass hone par request **'pending'** status mein create ho jati hai. Is stage par wallet se paise deduct nahi hote.
4.  **Admin Review**: Company admin aapki request ko pane …
```

### USER U33 — `PASS` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `['p2p', 'transfer', 'wallet']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `6333`
- db_truth: `concept`

**Reply:**

```
SIA system mein **P2P (Peer-to-Peer) transfer** ka matlab hai ek user se dusre user ko paise bhejna.

Iske kuch zaroori points niche diye gaye hain:

*   **Wallet:** P2P transfer sirf **Main wallet (`other_balance`)** se hi ho sakta hai. SPOT wallet se P2P transfer allowed nahi hai.
*   **Tax:** Bhejne wale (sender) ke wallet se amount par **3% tax** extra kat-ta hai. Receiver ko pura amount milta hai.
*   **Eligibility:** Sender aur Receiver dono ka **KYC approved** hona chahiye.
*   **Limits:** Aap kam se kam **₹100** aur zyada se zyada **₹9,999.96** bhej sakte hain.
*   **Security:** Transfer karne ke liye aapka **Transaction PIN** hona zaroori hai.
```

### USER U34 — `PASS` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `['kyc', 'verification', 'approved', 'withdraw']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `11295`
- db_truth: `concept`

**Reply:**

```
KYC (Know Your Customer) is a mandatory identity verification process in the SIA MLM system. Here is why it is required and what happens if it is not approved:

**Why KYC is required:**
*   **Withdrawals:** You must have an "Approved" KYC status to raise any withdrawal requests from your wallets to your bank account or UPI.
*   **P2P Transfers:** To receive money from another user via P2P transfer, your KYC must be approved.

**What happens if KYC is not approved:**
*   **No Withdrawals:** You will not be able to withdraw your earnings (Spot, Team Royalty, or Main balance).
*   **P2P Restriction:** You cannot receive funds from other users.
*   **Package Purchases:** You can still purchase, renew, or upgrade packages even if your KYC is not approved. The system allows buying courses/packag …
```

### USER U35 — `PASS` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `['level', 'business', 'team', 'leg']`
- tool_calls: `['getUserLevelProgress', 'getLevelRequirements']`
- elapsed_ms: `13718`
- db_truth: `concept`

**Reply:**

```
SIA MLM mein apna level badhane ke liye aapko primarily teen cheezon par focus karna hota hai: **Direct Legs**, **Minimum Leg Business**, aur **Total Team Business**.

Yahan Level progression ki kuch barikiyaan hain:

*   **Level 1 (Company Representative):** Iske liye aapko kam se kam 4 direct legs chahiye, jisme har leg ka business ₹7,500 se zyada ho, aur aapka total team business ₹2,15,000 hona chahiye.
*   **Level 4 (Company District Manager):** Jaise aapne pucha, is level ke liye aapko 3 legs aisi chahiye jisme har ek ka business ₹77,62,000 ho, aur total team business ₹2,32,86,000 tak pahunchna chahiye. Is level par aapko **2.0% SPOT commission** aur **0.25% Monthly Royalty** milti hai.

**Level badhane ke liye tips:**
*   Naye direct referrals jodein (Direct Legs).
*   Apni team ki m …
```

### USER U36 — `PASS` (income_compound)

**Q:** Mere 7500 wala English Speaking-III (package id 2) me pichhle 5 dino kitna SELF + GLOBAL income aaya hai?

- expected_any: `['197.50', '197.5', '197']`
- matched: `['197.50', '197.5', '197']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6997`
- db_truth: `197.50`

**Reply:**

```
Aapke ₹7,500 wale English Speaking-III package mein pichhle 5 dino ki total SELF aur GLOBAL income ₹197.50 hai.

Iska breakdown niche diya gaya hai:
* **SELF Income:** ₹37.50
* **GLOBAL HELPING Income:** ₹160.00
```

### USER U37 — `PASS` (income_compound)

**Q:** Pichhle 5 dino me mera total SELF + GLOBAL income kitna hai across all packages?

- expected_any: `['752.70', '752.7', '752']`
- matched: `['752.70', '752.7', '752']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6769`
- db_truth: `752.70`

**Reply:**

```
Pichhle 5 dino me aapka total SELF aur GLOBAL income **₹752.70** hai. Iska breakdown niche diya gaya hai:

* **SELF Income:** ₹237.50
* **GLOBAL_HELPING Income:** ₹515.20
```

### USER U38 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets allowed hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `5647`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30 April 2026** hai (5 din baad).

Us din ye wallets allowed hain:
*   **SPOT wallet**
*   **Main (Other) wallet**
*   **Team Royalty wallet**

Rule ke mutabiq, 10 aur 20 tarikh ko sirf SPOT wallet khulta hai, lekin mahine ki aakhri tarikh (30 ya 28 Feb) ko saare wallets se withdrawal liya ja sakta hai.
```

### USER U39 — `PASS` (withdrawal_eligible)

**Q:** Agle withdrawal date pe main exactly kitna amount apply / withdraw kar sakta hu?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `6967`
- db_truth: `46208.31`

**Reply:**

```
Agle withdrawal date pe aap exactly **₹46,208.31** withdraw kar sakte hain.

Details ye hain:
*   **Next Withdrawal Date:** 30 April 2026 (Thursday)
*   **Total Amount:** ₹46,208.31

**Wallet Breakdown:**
*   **Spot Wallet:** ₹14,850.25
*   **Main (Other) Wallet:** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82

**Zaroori Baatein:**
*   Withdrawal window subah **10:00 AM se shaam 5:00 PM IST** tak khuli rahegi.
*   Final amount pe withdrawal fees aur aapka 10x package cap apply hoga.
```

### USER U40 — `PASS` (withdrawal_counts)

**Q:** Mere ab tak kitne withdrawal requests approved aur kitne rejected hue hain?

- expected_any: `['33', 'approved']`
- matched: `['33', 'approved']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6158`
- db_truth: `approved=33`

**Reply:**

```
Aapke ab tak ke withdrawal requests ka status ye raha:

* **Approved**: 33 requests (Total Amount: ₹3,26,090.00)
* **Rejected**: 0 requests

Aapne total 33 requests submit kiye hain aur wo sabhi approve ho chuke hain.
```

### USER U41 — `PASS` (network)

**Q:** Mera total downline network kitna bada hai (sab depths milake)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6006`
- db_truth: `1893`

**Reply:**

```
Aapka total downline network **1,893** members ka hai.

Depth-wise breakdown yahan dekh sakte hain:
* **Total Downline:** 1,893
* **Direct Referrals (Depth 1):** 28
* **Depth 2:** 73
* **Depth 3:** 188
* **Depth 4:** 345
* **Depth 5:** 288
* **Depth 6-10:** 842
* **Depth 11-15:** 129

Aapka apna upline depth 5 hai.
```

### USER U42 — `PASS` (network)

**Q:** Mere kitne direct referrals hain (level-1 wale)?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `4852`
- db_truth: `28`

**Reply:**

```
Aapke total 28 direct referrals (Level-1) hain.
```

### USER U43 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total MONTHLY recurring income kitna mila hai?

- expected_any: `['30312', '30,312']`
- matched: `['30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7216`
- db_truth: `30312.92`

**Reply:**

```
Pichhle 30 dino me aapka total MONTHLY recurring income **₹30,312.92** raha hai. Yeh amount total 13,326 entries se milkar bana hai.
```

### USER U44 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total SPOT income kitni aayi?

- expected_any: `['29118', '29,118']`
- matched: `['29,118']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `5377`
- db_truth: `29118.75`

**Reply:**

```
Pichhle 30 dino me aapki total SPOT income **₹29,118.75** aayi hai (total 31 entries).
```

### USER U45 — `PASS` (income_compound)

**Q:** Mere 2500 wale package (English Speaking Basic-I, package id 1) se ab tak total kitni income aayi hai (lifetime)?

- expected_any: `['7244', '7,244']`
- matched: `['7,244']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7729`
- db_truth: `7244.95`

**Reply:**

```
Aapke **English Speaking Basic-I** package (₹2,500) se ab tak total **₹7,244.95** ki lifetime income aayi hai.

Iska breakdown niche diya gaya hai:
* **SPOT Income:** ₹2,193.75 (43 entries)
* **MONTHLY Royalty:** ₹5,166.14 (22,265 entries)
* **ADMIN OPS (Adjustments):** -₹114.94 (490 entries)
```

### USER U46 — `PASS` (income_compound)

**Q:** Pichhle 7 din ka mera net income (saare types ka sum) kitna hai?

- expected_any: `['5275', '5,275']`
- matched: `['5,275']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `10354`
- db_truth: `5275.79`

**Reply:**

```
Pichhle 7 dino ka aapka total net income **₹5,275.79** hai.

Iska breakdown ye raha:
* **MONTHLY:** ₹7,610.94
* **GLOBAL_HELPING:** ₹713.60
* **SPOT:** ₹643.75
* **SELF:** ₹332.50
* **FEE_DEDUCTION:** -₹4,025.00 (Fees)
```

### USER U47 — `FAIL` (income_compound)

**Q:** Is mahine (April 2026) ki MONTHLY recurring income kitni mili hai abhi tak?

- expected_any: `['25588', '25,588']`
- matched: `[]`
- error: `llm_failed`
- tool_calls: `[]`
- elapsed_ms: `4470`
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
- elapsed_ms: `6356`
- db_truth: `8887.50`

**Reply:**

```
Aapka English Speaking-III (Package ID 2) se lifetime SPOT income **₹8,887.50** hai, jo total 58 entries se aaya hai.
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `6746`
- db_truth: `2807`

**Reply:**

```
SIA platform par abhi total **2,807** users registered hain, jinme se **2,803** users active hain.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `5824`
- db_truth: `2803`

**Reply:**

```
System mein total **2,803 active users** hain (out of 2,807 total users).
```

### ADMIN A03 — `PASS` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `['1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `5269`
- db_truth: `1285`

**Reply:**

```
System mein kul **1,285** users ka KYC status **approved** hai.

Yaha detail breakdown hai:
*   **Approved:** 1,285
*   **Pending:** 1,473
*   **Rejected:** 44
*   **Submitted:** 5
*   **Total Users:** 2,807
```

### ADMIN A04 — `PASS` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `11125`
- db_truth: `13`

**Reply:**

```
There are currently **13 MLM packages** configured in the system:

*   **Active Packages:** 10 (ranging from ₹2,500 to ₹23,00,000)
*   **Inactive Packages:** 3 (English Speaking -II, Digital Marketing-II, and Personality Development + Financial Planning-II)

Here is the list of active packages:

| ID | Package Name | Price (INR) | Monthly ROI | Global IDs |
| :--- | :--- | :--- | :--- | :--- |
| 1 | English Speaking Basic -I | ₹2,500.00 | 2.5% | 55 |
| 2 | English Speaking-III | ₹7,500.00 | 3.0% | 160 |
| 3 | Digital Marketing | ₹15,000.00 | 3.5% | 325 |
| 4 | Share Market Learning | ₹30,000.00 | 4.0% | 625 |
| 5 | Graphic Designing & Video Editing | ₹50,000.00 | 4.5% | 1,100 |
| 6 | Personality Development + Financial Planning | ₹1,00,000.00 | 5.0% | 2,200 |
| 7 | Artificial Intelligence  …
```

### ADMIN A05 — `PASS` (system_stats)

**Q:** How many levels are defined in the level master table?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `8856`
- db_truth: `10`

**Reply:**

```
SIA MLM system mein total **10 levels** (0 se 9 tak) define kiye gaye hain. Har level ke apne specific rewards aur commission percentages hain:

*   **Level 0:** Field Worker (Direct)
*   **Level 1:** Company Representative (T-shirt and Diary)
*   **Level 2:** Company City Manager (5G Mobile)
*   **Level 3:** Company Area Manager (Laptop)
*   **Level 4:** Company District Manager (Motorcycle)
*   **Level 5:** Division Manager (Car)
*   **Level 6:** Regional Manager (Land in Secure City)
*   **Level 7:** State Manager (Flat in Secure City)
*   **Level 8:** National Manager (Company Director)
*   **Level 9:** King (Freedom)
```

### ADMIN A06 — `PASS` (withdrawals)

**Q:** How many withdrawal requests are sitting in the pending bucket right now?

- expected_any: `['0', 'no', 'none']`
- matched: `['0']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `7726`
- db_truth: `0`

**Reply:**

```
Currently, there are **0** pending withdrawal requests in the system. All 5,125 total requests have been processed (5,052 approved and 73 rejected).
```

### ADMIN A07 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been approved across the platform till date?

- expected_any: `['5052', '5,052']`
- matched: `['5,052']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `7079`
- db_truth: `5052`

**Reply:**

```
Till date, there have been a total of **5,052** approved withdrawal requests across the platform, amounting to **₹3,05,34,304.83**.
```

### ADMIN A08 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been rejected so far?

- expected_any: `['73']`
- matched: `['73']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6677`
- db_truth: `73`

**Reply:**

```
Total **73** withdrawal requests have been rejected so far, with a total value of **₹5,10,544.00**.
```

### ADMIN A09 — `FAIL` (purchases)

**Q:** How many package purchases (rows in purchases) exist in the database?

- expected_any: `['2838', '2,838']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `8161`
- db_truth: `2838`

**Reply:**

```
Database mein total **2,141** active package purchases hain.

System stats ki summary niche di gayi hai:
* **Active Purchases:** 2,141
* **Total Users:** 2,807
* **Active Users:** 2,803
* **Total Payouts:** ₹60,85,000.24
```

### ADMIN A10 — `PASS` (commissions)

**Q:** How many pending commission entries are sitting in the system in total?

- expected_any: `['13636', '13,636']`
- matched: `['13,636']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `16693`
- db_truth: `13636`

**Reply:**

```
System mein total **13,636 pending commission entries** hain. Yeh mostly SPOT commissions hain jo uplines ke qualify hone ka wait kar rahi hain.

System ki current live stats yeh hain:
*   **Total Users:** 2,807
*   **Active Users:** 2,803
*   **Active Purchases:** 2,141
*   **Total Payouts:** ₹60,85,000.24
```

### ADMIN A11 — `FAIL` (wallet)

**Q:** How many wallet transaction rows exist across all users (rough magnitude is fine)?

- expected_any: `['893336', '893,336', '893']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `13042`
- db_truth: `893336`

**Reply:**

```
System database records show approximately **8,93,336** wallet transaction rows (linked to **8,94,199** ledger entries) across all users.
```

### ADMIN A12 — `PASS` (user_lookup)

**Q:** Pull profile details for SIA00299 — name, email, phone, status.

- expected_any: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `6043`
- db_truth: `SIA00299|RAHUL PARWATKAR|rahulparwatkar1983@gmail.com|8605099465|active`

**Reply:**

```
SIA00299 (RAHUL PARWATKAR) ki profile details yaha hain:

*   **Name:** RAHUL PARWATKAR
*   **Email/Phone:** (Security reasons ki wajah se exact email/phone profile summary me hide rehte hain, par unka profile system me updated hai).
*   **Status:** active
*   **SIA ID:** SIA00299
*   **KYC Status:** approved
*   **Role:** STUDENT
*   **Disqualified:** No
*   **Withdrawal Blocked:** No

**Wallet Summary:**
*   **Total Balance:** ₹46,208.31
*   **Spot Wallet:** ₹14,850.25
*   **Main Wallet (Other):** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82

**Active Package:**
*   **Package Name:** Share Market Learning (₹30,000.00)
*   **Income Generated:** ₹4,474.32
*   **Purchased At:** 27-Feb-2026
```

### ADMIN A13 — `PASS` (user_lookup)

**Q:** What is the KYC status of user SIA00299?

- expected_any: `['approved']`
- matched: `['approved']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `5954`
- db_truth: `approved`

**Reply:**

```
The KYC status of user **RAHUL PARWATKAR** (SIA00299) is **Approved**.
```

### ADMIN A14 — `PASS` (user_lookup)

**Q:** How many direct referrals does SIA00299 have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `5336`
- db_truth: `28`

**Reply:**

```
User SIA00299 has **28** direct referrals.
```

### ADMIN A15 — `PASS` (user_lookup)

**Q:** What is the total downline size of SIA00299 (excluding the user himself)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `7620`
- db_truth: `1893`

**Reply:**

```
The total downline size of **SIA00299** (excluding the user himself) is **1,893** users.

Here is a quick breakdown of their network:
*   **Total Downline:** 1,893
*   **Direct Referrals (Level 1):** 28
*   **Network Depth:** 15 levels
*   **Upline Depth:** 5 levels (position from the root)
```

### ADMIN A16 — `PASS` (user_lookup)

**Q:** What is the main wallet balance of SIA00299?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `9950`
- db_truth: `46208.31`

**Reply:**

```
The Main Wallet balance for user **SIA00299** (Rahul Parwatkar) is **₹4,778.24**.

Here is his full wallet summary:
*   **Main Wallet:** ₹4,778.24
*   **Spot Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Balance:** ₹46,208.31
```

### ADMIN A17 — `PASS` (user_lookup)

**Q:** How many package purchases has SIA00299 made?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `16811`
- db_truth: `4`

**Reply:**

```
Based on the profile records for **Rahul Parwatkar (SIA00299)**, he has made at least **2 package purchases**:

*   **Active Package:** Share Market Learning (₹30,000.00), Purchase ID 2210, purchased on 27-Feb-2026.
*   **Historical Package:** Purchase ID 1540 (based on recent Self and Global Helping income entries in his ledger).

His current total wallet balance is **₹46,208.31**.
```

### ADMIN A18 — `PASS` (user_lookup)

**Q:** How many withdrawal requests has SIA00299 raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `13940`
- db_truth: `33`

**Reply:**

```
User SIA00299 has raised a total of **33** withdrawal requests.

* **Total Count:** 33
* **Total Amount:** ₹3,26,090.00
* **Status:** All 33 requests are approved.
```

### ADMIN A19 — `FAIL` (user_lookup)

**Q:** Has SIA00299 paid for the Graphic Designing & Video Editing package, and what is its status?

- expected_any: `['pending']`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId', 'getIncomeSummary']`
- elapsed_ms: `16571`
- db_truth: `pending`

**Reply:**

```
Yes, **SIA00299** has paid for the **Graphic Designing & Video Editing** (₹50,000) package. 

The package is currently **Active** and has generated a total income of **₹11,476.10** for the user. Here is the breakdown:

*   **SPOT Income:** ₹5,375.00
*   **MONTHLY Income:** ₹6,101.10

Since the total income (₹11,476.10) is well below the 2x maturity limit of ₹1,00,000.00, the package remains active and continues to generate returns.
```

### ADMIN A20 — `PASS` (packages)

**Q:** Which package is the highest priced on SIA and what is its price?

- expected_any: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- matched: `['Cyber Security & Online Safety-III', '23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `4425`
- db_truth: `Cyber Security & Online Safety-III|2300000.00`

**Reply:**

```
SIA platform par sabse mahanga package **Cyber Security & Online Safety-III** hai, jiski keemat **₹23,00,000.00** hai.
```

### ADMIN A21 — `PASS` (packages)

**Q:** Which package is the cheapest on SIA and what is its price?

- expected_any: `['English Speaking Basic', '2500', '2,500']`
- matched: `['English Speaking Basic', '2,500']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6088`
- db_truth: `English Speaking Basic -I|2500.00`

**Reply:**

```
The cheapest package available on SIA is **English Speaking Basic -I**.

*   **Price:** ₹2,500.00
*   **Status:** Active
*   **Self ROI:** 2.5% per month
*   **Global IDs:** 55
```

### ADMIN A22 — `PASS` (packages)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `7809`
- db_truth: `15000.00`

**Reply:**

```
The price of the **Digital Marketing** package is **₹15,000.00**.
```

### ADMIN A23 — `PASS` (levels)

**Q:** What is the title of level 0 and level 9 in the level master?

- expected_any: `['Field Worker', 'King']`
- matched: `['Field Worker', 'King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `7624`
- db_truth: `0:Field Worker, 9:King`

**Reply:**

```
SIA MLM level master ke hisaab se:

*   **Level 0** ka title **Field Worker** hai.
*   **Level 9** ka title **King** hai.
```

### ADMIN A24 — `PASS` (levels)

**Q:** List the titles for levels 1 through 4 in the SIA MLM level master.

- expected_any: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- matched: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `14612`
- db_truth: `Company Representative, Company City Manager, Company Area Manager, Company District Manager`

**Reply:**

```
SIA MLM system mein levels 1 se 4 ke titles niche diye gaye hain:

*   **Level 1:** Company Representative
*   **Level 2:** Company City Manager
*   **Level 3:** Company Area Manager
*   **Level 4:** Company District Manager
```

### ADMIN A25 — `PASS` (team_metrics)

**Q:** Who currently has the highest number of direct referrals on the platform — give their SIA ID and count?

- expected_any: `['SIA00111', '45']`
- matched: `['SIA00111', '45']`
- tool_calls: `['getTopReferrers']`
- elapsed_ms: `6415`
- db_truth: `SIA00111|45`

**Reply:**

```
Platform par sabse zyada direct referrals **SIA00111** (SHAMUAL SHANKAR GADDEKAR) ke paas hain.

*   **SIA ID:** SIA00111
*   **Direct Referrals:** 45
```

### ADMIN A26 — `PASS` (team_metrics)

**Q:** How big is SIA00111's downline (descendants count, excluding self)?

- expected_any: `[]`
- matched: `[]`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `5654`
- db_truth: `2325`

**Reply:**

```
User SIA00111 has a total downline of **2,325** members (excluding themselves).

Here is the breakdown by depth:
*   **Direct (Level 1):** 45 members
*   **Level 2:** 72 members
*   **Level 3:** 130 members
*   **Level 4:** 235 members
*   **Level 5-16:** 1,843 members

The user is positioned at a depth of 4 from the root of the system.
```

### ADMIN A27 — `PASS` (concept)

**Q:** Explain what a pending commission row in the database represents and when it gets cleared.

- expected_any: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- matched: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `8119`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, a **pending commission** row represents **SPOT income** that you have earned from a downline purchase but are not yet qualified to receive in your wallet.

Here is a breakdown of why they exist and when they get cleared:

### 1. What it represents
When someone in your team (up to Level 9) buys a package, the system checks if you meet the requirements for that specific level (e.g., number of direct legs or total team business). If you haven't met the criteria yet, the commission is stored in the `pending_commissions` table instead of being credited to your SPOT wallet.

### 2. When it gets cleared (Released)
Pending commissions are moved to your active wallet when you satisfy the level requirements. This "release" is triggered in three ways:
*   **Auto-Trigger:** Ever …
```

### ADMIN A28 — `PASS` (concept)

**Q:** Walk me through the lifecycle of a withdrawal request from creation to approval/rejection.

- expected_any: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- matched: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- tool_calls: `[]`
- elapsed_ms: `6577`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein withdrawal request ka lifecycle in stages mein hota hai:

1.  **Creation (Submission):**
    *   User `POST /api/v1/withdraw/requests` endpoint ke through request submit karta hai.
    *   System **12 validation gates** check karta hai, jaise: KYC approved hona chahiye, Transaction PIN correct hona chahiye, account block nahi hona chahiye, aur withdrawal date/time rules (10, 20, 30 tareek aur 10 AM-5 PM IST) match karne chahiye.
    *   Agar validations pass ho jayein, toh `pending` status ke saath ek request create ho jati hai. Is stage par wallet se paise deduct nahi hote.

2.  **Pending State:**
    *   Request `pending` status mein rehti hai jab tak Admin use review na kare.
    *   User sirf `pending` status ke waqt hi apni request cancel kar sakta hai.

3.  **Admi …
```

### ADMIN A29 — `PASS` (concept)

**Q:** What is the difference between purchases and pending_commissions tables in this system?

- expected_any: `['purchase', 'package', 'commission', 'pending', 'level']`
- matched: `['purchase', 'package', 'commission', 'pending', 'level']`
- tool_calls: `[]`
- elapsed_ms: `10775`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein `purchases` aur `pending_commissions` tables ke beech ka mukhya antar niche diya gaya hai:

*   **purchases Table:**
    *   Isme har us transaction ka record hota hai jab koi user package kharidta hai, renew karta hai, ya upgrade karta hai.
    *   Ye table user ki course validity, purchase amount, aur us package se ab tak hui total income (2x rule track karne ke liye) ko store karti hai.
    *   Jab koi purchase `completed` status mein hoti hai, tabhi commission engine trigger hota hai.

*   **pending_commissions Table:**
    *   Ye ek holding area hai un commissions (mukhya roop se SPOT) ke liye jo uplines ne abhi tak qualify nahi kiye hain.
    *   Agar koi downline package kharidta hai lekin uska upline us level ke liye eligible nahi hai, to wo commission is table  …
```

### ADMIN A30 — `PASS` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `['closure', 'ancestor', 'descendant', 'depth']`
- tool_calls: `[]`
- elapsed_ms: `7830`
- db_truth: `concept`

**Reply:**

```
The `user_tree_paths` table is a **closure table** that stores every relationship in the SIA MLM hierarchy. Instead of just pointing to a parent, it pre-computes every link between any two users in a chain.

Each row consists of `(ancestor_id, descendant_id, depth)`. Here is what they mean:

*   **Self-Row (Depth 0):** Every user has a row pointing to themselves `(U, U, 0)`. This allows queries to include the user in their own team statistics easily.
*   **Direct Sponsor (Depth 1):** A row `(Sponsor, User, 1)` represents a direct referral.
*   **Indirect Ancestors (Depth 2–9):** For every person above your sponsor, a row is created linking them to you. For example, your sponsor's sponsor (grand-sponsor) has a row `(Grand-Sponsor, User, 2)`.
*   **Commission Path:** When a package is bought …
```

### ADMIN A31 — `PASS` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `['main', 'spot', 'team royalty', 'balance']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `8612`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein har user ke liye char (4) tarah ke wallet buckets hote hain:

*   **Total Balance:** Yeh aapke sabhi wallets ka kul jod (total) hota hai.
*   **Spot Wallet (`spot_balance`):** Isme aapka direct aur downline se aaya hua SPOT income jama hota hai. Har credit par **10 din ka hold** hota hai, uske baad hi aap ise withdraw kar sakte hain.
*   **Main Wallet (`other_balance`):** Isme aapka SELF ROI aur GLOBAL HELPING income aata hai. Fees aur P2P transfers ka paisa bhi isi se deduct hota hai. Agar aapne reinvestment kiya hai, toh isme **90, 150, ya 180 dino ka lock** lag sakta hai.
*   **Team Royalty Wallet (`team_royalty_balance`):** Isme aapka monthly team royalty income jama hota hai. Yeh wallet aapke **N× package cap** (current multiplier 7×) ke under aata hai.

**Withdraw …
```

### ADMIN A32 — `PASS` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `['disqualified', 'commission', 'income']`
- tool_calls: `[]`
- elapsed_ms: `4828`
- db_truth: `concept`

**Reply:**

```
Jab user ka `is_disqualified` status **true** hota hai, iska matlab hai ki woh system se disqualify ho chuka hai. Iske baare mein kuch zaroori points niche diye gaye hain:

*   **Karan (Reason):** Agar kisi user ke paas **21 din** tak koi bhi active course ya package nahi rehta (saare packages 2x income hit kar chuke hain), toh system use disqualify kar deta hai.
*   **Commission par asar:** Disqualified user ke through commissions flow nahi hote. Unhe na toh koi income aati hai, aur na hi unka purana downline unki level eligibility mein count hota hai.
*   **Pending Commissions:** Jab koi user disqualify hota hai, toh unke saare `pending_commissions` delete kar diye jaate hain.
*   **Team Structure:** User tree mein apni jagah banae rakhta hai, lekin unka status 'disqualified' rehta hai j …
```

### ADMIN A33 — `PASS` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `['scheduled', 'monthly', 'daily', 'job']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `8398`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein background jobs **PgBoss** ke zariye manage kiye jaate hain. System mein niche diye gaye main scheduled jobs chalte hain:

*   **Daily Commission (`daily-commission`)**: Yeh job har roz **06:22 AM IST** (00:52 UTC) par chalta hai. Yeh active purchases ke liye SELF, GLOBAL_HELPING, aur MONTHLY commissions calculate karke credit karta hai.
*   **Eligibility Check (`eligibility-check`)**: Har roz **06:25 AM IST** (00:55 UTC) par chalta hai. Yeh users ki level eligibility recompute karta hai aur qualified users ke liye pending SPOT commissions release karta hai.
*   **DB Backup (`db-backup-bunny`)**: Har roz **05:00 AM IST** (23:30 UTC) par database ka backup lekar Bunny Storage par upload karta hai.
*   **Purchase Commission (`purchase-commission`)**: Yeh event-driven job  …
```

### ADMIN A34 — `PASS` (concept)

**Q:** Explain what the legacy_activation_history and legacy_spot_history tables are used for.

- expected_any: `['legacy', 'history', 'old', 'spot', 'activation']`
- matched: `['legacy', 'history', 'old', 'spot', 'activation']`
- tool_calls: `[]`
- elapsed_ms: `6047`
- db_truth: `concept`

**Reply:**

```
The **legacy_activation_history** and **legacy_spot_history** tables are used to store data imported from the old MLM system (pre-December 2025). They serve as a historical record so that users and admins can view past activities without re-triggering the new commission engine.

*   **legacy_activation_history**: Contains approximately 1,850 records of old-system activations and recharges. It is used for:
    *   Showing "Activation History (Old Data)" in the user dashboard.
    *   Admin reporting on historical user activity.
*   **legacy_spot_history**: Contains approximately 2,882 records of SPOT income credits from the previous system. It is used for:
    *   Displaying historical SPOT earnings to users.
    *   Admin reconciliation against current ledger entries.

Both tables are **re …
```

### ADMIN A35 — `PASS` (concept)

**Q:** Can an admin manually adjust a user's wallet, and if yes, where is that recorded?

- expected_any: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- matched: `['admin', 'adjust', 'wallet', 'ledger']`
- tool_calls: `[]`
- elapsed_ms: `4908`
- db_truth: `concept`

**Reply:**

```
Yes, an admin can manually adjust a user's wallet. This is done through the **Admin Wallet Adjustment** tool in the backoffice.

*   **Adjustment Types:** Admins can add or subtract funds from three specific wallets: `other_balance` (Main), `spot_balance`, or `team_royalty_balance`.
*   **Recording:** Every adjustment is recorded in two places:
    *   **Ledger Entries:** A row is created with the commission type `ADMIN_OPS`. It includes metadata like the target wallet, the reason for the adjustment, and the admin ID.
    *   **Admin Activity Logs:** A separate audit log entry is created to track which admin performed the action, the amount, the target user, and the reason provided.

This ensures a complete audit trail for all manual financial changes.
```

### ADMIN A36 — `PASS` (leaderboard)

**Q:** Top 3 referrers kaun hain — kis user ke sabse zyada direct referrals hain?

- expected_any: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- matched: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- tool_calls: `['getTopReferrers']`
- elapsed_ms: `6843`
- db_truth: `SIA00111=45,SIA01430=35,SIA01699=33`

**Reply:**

```
Top 3 referrers (jinake sabse zyada direct referrals hain) ye hain:

*   **SHAMUAL SHANKAR GADDEKAR** (SIA00111) — 45 referrals
*   **Vijaykumar hetramji shahare** (SIA01430) — 35 referrals
*   **Kaivalya Garibdasji Wasnik** (SIA01699) — 33 referrals
```

### ADMIN A37 — `PASS` (kyc_aggregate)

**Q:** Total approved KYC users kitne hain abhi system me?

- expected_any: `['1285', '1,285']`
- matched: `['1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `6029`
- db_truth: `1285`

**Reply:**

```
Abhi system me total **1,285** users ka KYC approved hai.
```

### ADMIN A38 — `PASS` (kyc_aggregate)

**Q:** Total pending KYC users kitne hain?

- expected_any: `['1473', '1,473']`
- matched: `['1,473']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `9095`
- db_truth: `1473`

**Reply:**

```
SIA system mein total pending KYC users ki jankari niche di gayi hai:

*   **Pending (Abhi submit nahi kiya):** 1,473
*   **Submitted (Verification ke liye baki):** 5

Iske alawa 44 users ka KYC rejected status mein hai aur 1,285 users ka approved hai.
```

### ADMIN A39 — `PASS` (withdrawal_aggregate)

**Q:** Pichhle 30 dino me kitne approved withdrawal requests pass hue aur unka total amount kya hai?

- expected_any: `['937', '5761985', '5,761,985']`
- matched: `['937']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `11403`
- db_truth: `937|5761985.62`

**Reply:**

```
Pichhle 30 dino mein withdrawal requests ka status niche diya gaya hai:

*   **Total Approved Requests:** 937
*   **Total Approved Amount:** ₹57,61,985.62
```

### ADMIN A40 — `FAIL` (withdrawal_projection)

**Q:** Admin POV: agle withdrawal date par mere paas approximately kitni amount ki withdrawal demand aa sakti hai (upper bound)?

- expected_any: `['7571367', '7,571,367', '7571']`
- matched: `[]`
- tool_calls: `['getAdminProjectedWithdrawalDemand']`
- elapsed_ms: `6078`
- db_truth: `7571367.03`

**Reply:**

```
Admin POV: Agle withdrawal date **30-04-2026** (jo ki 5 din baad hai) par, upper-bound projected withdrawal demand approximately **₹75,71,367.03** ho sakti hai.

Yeh demand total **1,281 eligible users** (KYC-approved aur active) se expected hai. Wallet-wise breakdown niche diya gaya hai:

*   **Main (Other) Wallet:** ₹61,67,387.31
*   **SPOT Wallet:** ₹7,71,424.57
*   **Team Royalty Wallet:** ₹6,32,555.15
*   **Total Projected Demand:** **₹75,71,367.03**

*Note: Yeh ek upper-bound estimate hai, yeh maante hue ki sabhi eligible users apna pura balance withdraw karenge. Actual demand users ki 10x capping aur partial requests ki wajah se isse kam ho sakti hai.*
```

### ADMIN A41 — `PASS` (withdrawal_eligible)

**Q:** User SIA00299 ki agle withdrawal date pe eligible withdrawal amount kya hai?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `8253`
- db_truth: `46208.31`

**Reply:**

```
User SIA00299 ke liye agla withdrawal date **30 April 2026** hai. 

Is date pe wo total **₹46,208.31** withdraw kar sakte hain. Wallet-wise breakdown niche diya gaya hai:

*   **SPOT Wallet:** ₹14,850.25
*   **Main Wallet (Other):** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82

**Zaroori Jankari:**
*   Withdrawal ka time window subah 10:00 AM se shaam 5:00 PM IST tak hota hai.
*   30 tarik ko SPOT, Main aur Team Royalty teeno wallets se withdrawal allowed hai.
*   Inke account par koi active blockers nahi hain.
```

### ADMIN A42 — `PASS` (network)

**Q:** User SIA00299 ka total downline network size kitna hai?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6825`
- db_truth: `1893`

**Reply:**

```
User SIA00299 ka total downline network size **1,893** members ka hai. Iska level-wise breakdown niche diya gaya hai:

*   **Total Downline:** 1,893 members
*   **Direct Referrals (Level 1):** 28
*   **Level 2:** 73
*   **Level 3:** 188
*   **Maximum Depth:** 15 levels tak team bani hui hai.

Inka upline depth filhal 5 hai.
```

### ADMIN A43 — `PASS` (network)

**Q:** User SIA00299 ke total kitne direct referrals hain?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `5397`
- db_truth: `28`

**Reply:**

```
User SIA00299 ke total **28 direct referrals** hain.
```

### ADMIN A44 — `PASS` (income_compound)

**Q:** User SIA00111 ka 7500 wale English Speaking-III package se SELF income lifetime kitna mila hai?

- expected_any: `['180', '180.00']`
- matched: `['180', '180.00']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6925`
- db_truth: `180.00`

**Reply:**

```
User SIA00111 ko ₹7,500 wale English Speaking-III package se ab tak total **₹180.00** ki SELF income mili hai (total 24 entries).
```

### ADMIN A45 — `PASS` (withdrawal_aggregate)

**Q:** Globally rejected withdrawal requests kitne hain aur unka total amount kya hai?

- expected_any: `['73', '510544', '510,544']`
- matched: `['73']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5424`
- db_truth: `73|510544.00`

**Reply:**

```
Globally total **73** withdrawal requests rejected hui hain, aur unka total amount **₹5,10,544.00** hai.
```

### ADMIN A46 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets opened hote hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `7305`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30 April 2026** hai (jo ki 5 din baad hai).

Is din ye sabhi wallets withdrawals ke liye open rahenge:
* **SPOT** wallet
* **Main/Other** wallet
* **Team Royalty** wallet

Rule ke mutabiq, har mahine ki 30 tarikh (Feb mein 28) ko saare wallets open hote hain, jabki 10 aur 20 tarikh ko sirf SPOT wallet open hota hai. Withdrawal ka samay subah 10:00 AM se shaam 5:00 PM IST tak hota hai.
```

### ADMIN A47 — `PASS` (income_compound)

**Q:** User SIA00299 ka pichhle 30 dino me sirf MONTHLY recurring income type ka kitna paisa credit hua?

- expected_any: `['30312', '30,312']`
- matched: `['30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7169`
- db_truth: `30312.92`

**Reply:**

```
User SIA00299 ko pichhle 30 dino me total **₹30,312.92** ka MONTHLY recurring income credit hua hai. Isme total 13,326 entries record ki gayi hain.
```
