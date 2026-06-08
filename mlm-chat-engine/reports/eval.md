# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T15:32:03
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **70**
- Passed: **52**
- Satisfactory score: **74.29%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 35 | 25 | 71.43% |
| admin | 35 | 27 | 77.14% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 1 | 50.0% |
| concept | 16 | 16 | 100.0% |
| income | 2 | 0 | 0.0% |
| levels | 2 | 2 | 100.0% |
| packages | 7 | 5 | 71.43% |
| profile | 5 | 4 | 80.0% |
| purchases | 1 | 1 | 100.0% |
| system | 5 | 5 | 100.0% |
| system_stats | 5 | 4 | 80.0% |
| team | 3 | 2 | 66.67% |
| team_metrics | 2 | 1 | 50.0% |
| user_lookup | 8 | 4 | 50.0% |
| wallet | 5 | 4 | 80.0% |
| withdrawals | 7 | 3 | 42.86% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `11470`
- db_truth: `SIA00299|RAHUL PARWATKAR`

**Reply:**

```
Your SIA ID is **SIA00299** and your registered name is **RAHUL PARWATKAR**. 

Let me know if you need any other details about your profile or wallet!
```

### USER U02 — `FAIL` (profile)

**Q:** What is my registered email and phone number?

- expected_any: `['rahulparwatkar1983@gmail.com', '8605099465']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `15078`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Hello Rahul,

For privacy and security reasons, I do not have access to view your registered email address and phone number. 

However, you can easily check and update these details by logging into your account and visiting the **Profile** section of your SIA MLM dashboard. 

Let me know if you need help with your wallet balance, withdrawals, or commissions!
```

### USER U03 — `PASS` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `['approved']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `14484`
- db_truth: `approved`

**Reply:**

```
Your current KYC status is **approved**. 

Since your KYC is approved, you are fully eligible to make withdrawal requests and use the P2P transfer feature! Let me know if you need help with anything else.
```

### USER U04 — `PASS` (profile)

**Q:** What is my account status — active or blocked?

- expected_any: `['active']`
- matched: `['active']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `12751`
- db_truth: `active`

**Reply:**

```
Your account status is currently **Active**. 

Here are the exact details of your account status:
* **Overall Status:** Active
* **Withdrawal Status:** Not blocked (You can make withdrawals normally)
* **KYC Status:** Approved
* **Disqualification Status:** Not disqualified
* **Active Package:** You currently have an active course ("Share Market Learning").

Your account is in good standing and you can use all platform features without any issues. Let me know if you need help with anything else!
```

### USER U05 — `PASS` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `['92']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `10263`
- db_truth: `92`

**Reply:**

```
Your sponsor / referrer user ID is **92**.
```

### USER U06 — `PASS` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `11769`
- db_truth: `46208.31`

**Reply:**

```
Your current Main wallet (`other_balance`) balance is **₹4,778.24**. 

For your reference, here is the breakdown of your other wallets:
* **Total Balance:** ₹46,208.31
* **Spot Wallet:** ₹14,850.25
* **Team Royalty Wallet:** ₹26,579.82

Let me know if you'd like to check your withdrawable amount or initiate a withdrawal!
```

### USER U07 — `FAIL` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `12130`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Here are your current wallet balances:

- **Total Balance:** ₹46,208.31
- **Main Wallet (Other Balance):** ₹4,778.24
- **Spot Wallet:** ₹14,850.25
- **Team Royalty Wallet:** ₹26,579.82

Let me know if you would like to withdraw from any of these wallets or need a breakdown of your recent transactions!
```

### USER U08 — `PASS` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `['14,850']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `11444`
- db_truth: `14850.25`

**Reply:**

```
Your current Spot wallet balance is **₹14,850.25**. 

For your reference, here is the summary of your other wallets:
- **Main Wallet (Other Balance):** ₹4,778.24
- **Team Royalty Balance:** ₹26,579.82
- **Total Balance:** ₹46,208.31

Let me know if you would like to check your withdrawable amount or need help initiating a withdrawal!
```

### USER U09 — `PASS` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `['26,579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `10973`
- db_truth: `26579.82`

**Reply:**

```
Your current Team Royalty wallet balance is **₹26,579.82**. 

For your reference, your overall total balance across all wallets is ₹46,208.31. Let me know if you would like to know your withdrawable limit or make a withdrawal!
```

### USER U10 — `FAIL` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `19067`
- db_truth: `4`

**Reply:**

```
Based on your profile, you currently have **1 active package**: 

* **Share Market Learning** (₹30,000) - Purchased on 27th February 2026.

However, looking at your recent income history, you are also receiving/have received earnings from at least one other previous purchase. So you have purchased **multiple packages** over time. 

To see the complete detailed list of all your active, expired, and 2X-reached packages, you can visit the **"My Packages"** section in your dashboard. Let me know if you need more details about your current package's income!
```

### USER U11 — `PASS` (packages)

**Q:** List the names of all packages I have ever purchased.

- expected_any: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- matched: `['Share Market']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `16009`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
Based on your profile records, you have purchased the following package:

* **Share Market Learning** (Price: ₹30,000) – *Currently Active* (Purchased on Feb 27, 2026)

Currently, this is the only active package showing on your account. If you had older packages that expired after reaching the 2x income limit, let me know and I can pull up your transaction history to look for past package activations!
```

### USER U12 — `FAIL` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `18547`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
According to your current account details, you do not have any package purchases in **pending** status. Your **Share Market Learning** package (₹30,000) is currently fully **active**. 

If you recently made a manual payment (via bank transfer or UPI) and uploaded your UTR/payment screenshot, it might be in the admin review queue as a "Purchase Request". Once the admin reviews and approves the UTR, the new package will automatically become active and appear in your dashboard. 

You can check the exact status of any recently submitted manual payments in the **Activation Request** or **Purchase Requests** section of your SIA dashboard. Let me know if you need help with anything else!
```

### USER U13 — `PASS` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `['30,000']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `8616`
- db_truth: `30000.00`

**Reply:**

```
The price of your Share Market Learning purchase was **₹30,000**.
```

### USER U14 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `14638`
- db_truth: `33`

**Reply:**

```
You have raised a total of **33 withdrawal requests** so far. 

All 33 of your requests have been successfully approved and processed! Let me know if you need a breakdown of these withdrawals by wallet (Spot, Main, or Team Royalty) or if you need any other details.
```

### USER U15 — `PASS` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `['no', 'do not have any']`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `10686`
- db_truth: `0`

**Reply:**

```
No, you do not have any pending withdrawal requests at the moment. 

I checked your withdrawal history, and all of your recent requests have already been **approved** and processed. 

Let me know if you need help initiating a new withdrawal!
```

### USER U16 — `FAIL` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['32']`
- matched: `[]`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `13621`
- db_truth: `33`

**Reply:**

```
Based on your account records, you have exactly **33 approved withdrawal requests** so far. 

These approved requests include withdrawals across your Spot, Main (Wallet), and Team Royalty balances. Let me know if you would like a detailed breakdown of the amounts or specific dates!
```

### USER U17 — `FAIL` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['192', '193', '194']`
- matched: `[]`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `28724`
- db_truth: `326090.00`

**Reply:**

```
Based on your withdrawal history, you have **33 approved withdrawal requests**. 

The total approved withdrawal amount across all these requests is **₹3,26,090.00**. 

This includes all successful payouts from your Spot, Main (Wallet), and Team Royalty balances. Let me know if you need a detailed breakdown of these transactions!
```

### USER U18 — `FAIL` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `[]`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `27000`
- db_truth: `204567.31`

**Reply:**

```
Based on your current profile summary, the exact lifetime "Total Income" (sum of all positive credits since you joined) is not explicitly displayed as a single number. However, we can calculate a highly accurate estimate based on your current balance and recent withdrawals.

Here is the breakdown of your wallet:

*   **Current Total Balance:** ₹46,208.31
    *   Spot Balance: ₹14,850.25
    *   Main Wallet (Other): ₹4,778.24
    *   Team Royalty: ₹26,579.82

*   **Recent Withdrawals (Last 10 Approved):** ₹79,758.00
    *(You've had 10 successful withdrawals between Jan 2026 and Apr 2026)*

If we add your currently available balance (₹46,208.31) to your last 10 approved withdrawals (₹79,758.00) plus the standard withdrawal processing fees (₹30 per withdrawal), **your total credited amount s …
```

### USER U19 — `FAIL` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `[]`
- tool_calls: `['getUserTransactions']`
- elapsed_ms: `18590`
- db_truth: `56714`

**Reply:**

```
Based on a quick check of your account, I can currently see your most recent transaction—a **MONTHLY** income credit of **₹8.33** recorded on **April 25, 2026**. 

However, the system's quick view didn't return the exact *total* count of all your historical wallet transactions. 

If you'd like a deeper look, I can perform a full wallet audit or pull up your complete income history to give you a better overall picture. Let me know if you want me to do that!
```

### USER U20 — `PASS` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getUserLegs']`
- elapsed_ms: `16876`
- db_truth: `28`

**Reply:**

```
You currently have **28 direct referrals** (direct legs) in your network. 

Here is a quick look at your top 5 strongest direct legs based on their total team business:

1. **SNEHALATA GADPAYLE** (SIA00300) — ₹2,01,65,000
2. **Nitin Kurekar** (SIA00438) — ₹1,32,27,500
3. **Subhash Fakira Medpalliwar** (SIA00446) — ₹66,10,000
4. **Sahil Moreshwar Bhure** (SIA00368) — ₹31,75,000
5. **RUMABAI PARWATKAR** (SIA00729) — ₹2,40,000

Let me know if you would like a deeper analysis of your team's growth or need to check your eligibility for your next level!
```

### USER U21 — `FAIL` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- tool_calls: `['getUserNetwork']`
- elapsed_ms: `42261`
- db_truth: `1893`

**Reply:**

```
Based on your live network data, your team tree is very expansive! 

Here is the breakdown of your downline size:
*   **Direct Members (Level 1):** You have **28 direct members** under you. (Some of your direct legs include *SNEHALATA GADPAYLE, Pramod Raut, Sahil Moreshwar Bhure, Nitin Kurekar*, and *Subhash Fakira Medpalliwar*).
*   **Maximum Depth:** Your network extends very deep, reaching all the way down to **15 levels** (Depth 15).
*   **Total Downline Size:** Counting all your direct members and their entire sub-trees, your total downline size is **approximately 480 members**.

*(Since the detailed tree contains hundreds of nodes, if you need the exact total count or a level-by-level numerical breakdown, let me know and I can pull your summarized `getUserLegs` or dashboard stats!)*
```

### USER U22 — `PASS` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `['5']`
- tool_calls: `['getUserNetwork']`
- elapsed_ms: `16560`
- db_truth: `5`

**Reply:**

```
Your upline chain goes **5 levels deep** above you. 

Here is the exact hierarchy of your ancestors, starting from your direct sponsor up to the top of the network:

1. **Direct Sponsor (Level 1):** SHAMUAL SHANKAR GADDEKAR (SIA00111)
2. **Level 2:** Pratibha Sikandar Sahare (SIA00107)
3. **Level 3:** SHANKAR DASHRATH GADDEKAR (SIA00022)
4. **Level 4:** Mariyam Naseer Sheikh (SIA00021)
5. **Level 5 (Root):** admin

Let me know if you'd like to check anything else about your network or team!
```

### USER U23 — `FAIL` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `[]`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `44712`
- db_truth: `991`

**Reply:**

```
You currently have **200 pending commission entries** recorded in your account as the receiver. 

These are SPOT commissions from purchases made in your downline that are temporarily held. They remain in the pending state because you may not have met the business requirements for those specific levels yet. As soon as your daily eligibility updates and you qualify for those levels, these commissions will be automatically released and credited to your Spot Wallet. 

If you'd like to check what requirements you're missing to release these commissions, just ask me to check your level progress!
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `[]`
- elapsed_ms: `7881`
- db_truth: `13`

**Reply:**

```
The SIA platform offers a total of **13 packages**. 

Out of these:
* **11 packages** are currently **active** and available for purchase.
* **2 packages** are currently **inactive**.

The packages range in price from **₹2,500 to ₹23,00,000**, offering various courses (like English Speaking, Digital Marketing, Artificial Intelligence, Cyber Security, etc.) along with different daily return (SELF ROI) percentages ranging from 2.5% to 7.0%. 

If you'd like to see the details of a specific package or a list of all active packages, just let me know!
```

### USER U25 — `PASS` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `[]`
- elapsed_ms: `8468`
- db_truth: `15000.00`

**Reply:**

```
The price of the **Digital Marketing** package is **₹15,000**. 

Here are some additional details about this package:
* **Self ROI:** 3.5% per month
* **Direct Spot Commission:** 5%
* **Direct Monthly Royalty:** 0.5%
* **Global IDs Capping:** 325 IDs
* **Validity (for renewal countdown):** 365 days 

Let me know if you need more details about this or any other package!
```

### USER U26 — `PASS` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `['23,00,000']`
- tool_calls: `[]`
- elapsed_ms: `8257`
- db_truth: `7500.00`

**Reply:**

```
The highest tier package available on SIA MLM is the **"Cyber Security & Online Safety-III"** (Package ID: 10). 

The price for this package is **₹23,00,000** (23 Lakhs).

Here are a few additional details about what this package offers:
* **SELF ROI:** 7.0% per month
* **Global IDs Cap:** 57,000
* **Direct SPOT Commission:** 5%
* **Direct Monthly Royalty:** 1.0%

Let me know if you would like more details about this or any other package!
```

### USER U27 — `PASS` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `[]`
- elapsed_ms: `12758`
- db_truth: `10`

**Reply:**

```
There are **10 levels (Level 0 to Level 9)** configured in the SIA MLM system. 

Here is the breakdown of the hierarchy:

*   **Level 0:** Field Worker (Direct Sponsor)
*   **Level 1:** Company Representative
*   **Level 2:** Company City Manager
*   **Level 3:** Company Area Manager
*   **Level 4:** Company District Manager
*   **Level 5:** Division Manager
*   **Level 6:** Regional Manager
*   **Level 7:** State Manager
*   **Level 8:** National Manager
*   **Level 9:** King

**How it works:**
*   **Level 0** is your direct team (users you personally sponsor). You automatically qualify for Level 0 commissions as long as you have an active package.
*   **Levels 1 to 9** represent your indirect downline team. To earn commissions from these levels, you need to meet specific business require …
```

### USER U28 — `PASS` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `['King']`
- tool_calls: `[]`
- elapsed_ms: `6360`
- db_truth: `King`

**Reply:**

```
The highest level in SIA MLM is **Level 9**, and its title is **"King"**. 

To reach this level, you need a total team business of at least ₹2,100 Crores (with no specific leg constraints). The reward for achieving this rank is "Freedom".
```

### USER U29 — `PASS` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `['upline', 'downline', 'sponsor']`
- tool_calls: `[]`
- elapsed_ms: `12117`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, **Upline** and **Downline** refer to a user's position relative to others in the 9-level deep network hierarchy:

**1. Upline (Your Sponsors):**
*   **What it is:** The chain of users *above* you in the network. 
*   **Who it includes:** It starts with your Direct Sponsor (the person whose link/ID you used to join, considered Level 0 or Depth 1) and goes up through their sponsor, their grand-sponsor, and so on, up to 9 levels above you.
*   **Commission Flow:** When you make a package purchase, your uplines are the ones who receive the SPOT and MONTHLY commissions from your purchase.

**2. Downline (Your Team):**
*   **What it is:** The chain of users *below* you in the network.
*   **Who it includes:** It includes anyone you directly invite (your direct downline) an …
```

### USER U30 — `PASS` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `['main', 'spot', 'team royalty', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `13112`
- db_truth: `concept`

**Reply:**

```
In SIA MLM, each user has one main account with **four specific wallet balances**. Here is what each wallet represents:

**1. Main Wallet (`other_balance`)**
*   **What it holds:** Your personal ROI (`SELF` income), `GLOBAL_HELPING` income, and any manual admin additions to your main wallet. 
*   **Usage:** You can withdraw from this wallet, use it for P2P (peer-to-peer) transfers to other users, and system fees (like withdrawal processing or name change fees) are deducted from here.
*   **Note:** If you reinvest while having an active package, the credits here might be subject to a 90/150/180-day reinvestment lock.

**2. Spot Wallet (`spot_balance`)**
*   **What it holds:** All `SPOT` commissions earned instantly when someone in your downline (up to 9 levels) purchases or upgrades a packa …
```

### USER U31 — `PASS` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `['direct', 'commission', 'package', 'level']`
- tool_calls: `[]`
- elapsed_ms: `12646`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, when someone directly under you (Level 0 / your direct invitee) buys a package, you earn a **Direct Commission**. This commission is split into two parts: a one-time **SPOT** commission and a recurring **MONTHLY** royalty.

Here is exactly how it is calculated:

### 1. Direct SPOT Commission (One-Time)
You receive an immediate commission the moment your direct downline completes a purchase.
* **Calculation:** It is calculated as **5%** of the package amount they purchased. 
* **Condition:** You (the sponsor) must have an active course (meaning your own package hasn't expired by reaching the 2x income limit).
* **Note:** Even if your downline is reinvesting (buying another package while already active), your direct SPOT commission remains a full 5% (the standard 50% r …
```

### USER U32 — `PASS` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- tool_calls: `[]`
- elapsed_ms: `16390`
- db_truth: `concept`

**Reply:**

```
Here is the complete end-to-end flow when you raise a withdrawal request in the SIA MLM platform:

**1. Initiation (Your Request)**
You submit a withdrawal request specifying the amount, wallet type (`wallet` for Main, `spot`, or `team_royalty`), your receiving account details (Bank/UPI), and your **Transaction PIN**. 

**2. System Validation**
Before the request is accepted, the system runs several checks:
*   **KYC Status:** Your KYC must be `approved`.
*   **Security:** Your Transaction PIN must be correct, and your account shouldn't be blocked from withdrawals.
*   **Dates & Timing:** If the system is in "Date-based mode," Spot withdrawals are only allowed on the 10th, 20th, and 30th (28th in Feb). Main and Team Royalty wallets are only allowed on the 30th (28th in Feb) between 10:00 A …
```

### USER U33 — `PASS` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `['p2p', 'transfer', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `10771`
- db_truth: `concept`

**Reply:**

```
A **P2P (Peer-to-Peer) transfer** in SIA MLM allows you to send money directly to another user within the platform. 

Here is how it works and the specific wallet it uses:

* **Wallet Used:** P2P transfers are strictly done from your **Main Wallet (`other_balance`)** to the receiver's Main Wallet. You cannot use your SPOT wallet or Team Royalty wallet for P2P transfers.
* **Transfer Tax:** There is a **3% tax** applied to P2P transfers. This tax is deducted from the sender's wallet on top of the transfer amount. For example, if you send ₹100, ₹103 will be deducted from your Main Wallet, and the receiver will get the full ₹100.
* **Limits:** The minimum transfer amount is **₹100**, and the maximum limit is **₹9,999.96**.
* **Requirements:** Both the sender and the receiver must be **KYC-app …
```

### USER U34 — `PASS` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `['kyc', 'verification', 'approved', 'withdraw']`
- tool_calls: `[]`
- elapsed_ms: `18063`
- db_truth: `concept`

**Reply:**

```
KYC (Know Your Customer) is a mandatory identity verification step in the SIA MLM platform. Here is why it is required and what happens if it isn't approved:

**Why do you need KYC?**
1. **Withdrawals:** You absolutely need an **approved KYC** to withdraw your earnings (from your Main, SPOT, or Team Royalty wallets) to your bank account or UPI.
2. **P2P Transfers (Peer-to-Peer):** To send or receive money to/from another user's wallet, both the sender and the receiver must have an approved KYC status.

**What happens if your KYC is NOT approved (or pending)?**
* ❌ **No Withdrawals:** You will not be able to raise any withdrawal requests. 
* ❌ **No P2P Transfers:** You cannot send funds to or receive funds from other users.
* ✅ **Earnings Continue:** Your account is **not** stopped. You can …
```

### USER U35 — `PASS` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `['level', 'business', 'team', 'requirement', 'leg']`
- tool_calls: `['getUserLevelProgress']`
- elapsed_ms: `22540`
- db_truth: `concept`

**Reply:**

```
Based on your profile data, congratulations! You have already achieved **Level 3 (Company Area Manager)** in the SIA MLM hierarchy. 

To increase your level further, you need to grow your team's total business and strengthen your direct downline "legs" (a leg is a direct referral and their entire downline). 

Here is exactly what is required for your next upgrade to **Level 4 (Company District Manager)**:

*   **Leg Requirement:** You need at least **3 distinct legs** (teams under 3 of your direct referrals).
*   **Minimum Business Per Leg:** Each of these 3 legs must generate a minimum business of **₹77.62 Lakhs**.
*   **Total Team Business:** Your overall team business across all legs must reach at least **₹2.32 Crores**.
*   **Reward:** Achieving Level 4 rewards you with a Motorcycle an …
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `9223`
- db_truth: `2807`

**Reply:**

```
Currently, there are a total of **2,807 registered users** on the SIA platform. Out of these, **2,803 are active users**.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `13222`
- db_truth: `2803`

**Reply:**

```
Based on the current system statistics, there are **2,803 active users** in the system (out of 2,807 total registered users).
```

### ADMIN A03 — `FAIL` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `13304`
- db_truth: `1285`

**Reply:**

```
Currently, the system's quick statistics overview doesn't provide the exact aggregate count of users with an *approved* KYC status. 

However, looking at the overall system data, we currently have:
* **Total Users:** 2,807
* **Active Users:** 2,803

Since you have admin access, you can view the exact number of KYC-approved users by navigating to the **User Management** section in your Admin Panel and applying the filter for `KYC Status = Approved`. 

Let me know if you need to check the KYC status of any specific user by their SIA ID!
```

### ADMIN A04 — `PASS` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `11264`
- db_truth: `13`

**Reply:**

```
Currently, there are a total of **13 MLM packages** configured in the system. 

Out of these:
*   **10 are Active** (ranging from ₹2,500 for *English Speaking Basic-I* up to ₹23,00,000 for *Cyber Security & Online Safety-III*).
*   **3 are Inactive** (*English Speaking-II* at ₹5,000, *Digital Marketing-II* at ₹25,000, and *Personality Development + Financial Planning-II* at ₹2,00,000). 

Let me know if you need the specific details, ROI, or capping limits for any of these packages!
```

### ADMIN A05 — `PASS` (system_stats)

**Q:** How many levels are defined in the level master table?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `[]`
- elapsed_ms: `9139`
- db_truth: `10`

**Reply:**

```
In the SIA MLM system, there are **10 levels** defined in the level master table (ranging from Level 0 to Level 9). 

Here is the breakdown of the levels and their respective titles:

*   **Level 0:** Field Worker (Direct)
*   **Level 1:** Company Representative
*   **Level 2:** Company City Manager
*   **Level 3:** Company Area Manager
*   **Level 4:** Company District Manager
*   **Level 5:** Division Manager
*   **Level 6:** Regional Manager
*   **Level 7:** State Manager
*   **Level 8:** National Manager
*   **Level 9:** King

Level 0 is your default direct sponsor level for any active user, while Levels 1 through 9 require specific team business and leg criteria to qualify. 

Would you like to know the specific business requirements or commission percentages for any of these levels?
```

### ADMIN A06 — `PASS` (withdrawals)

**Q:** How many withdrawal requests are sitting in the pending bucket right now?

- expected_any: `['0', 'no', 'none']`
- matched: `['0', 'no']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `12471`
- db_truth: `0`

**Reply:**

```
I just checked the live system stats, but unfortunately, the exact count of pending withdrawal requests is not available in the current data snapshot. 

However, here are the system-wide statistics I can currently see:
- **Total Users:** 2,807
- **Active Users:** 2,803
- **Active Purchases:** 2,141
- **Total Payouts Distributed:** ₹60,85,000.24

If you need to check the pending withdrawals for a specific user, just let me know their SIA ID!
```

### ADMIN A07 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests have been approved across the platform till date?

- expected_any: `['5052', '5,052']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `17337`
- db_truth: `5052`

**Reply:**

```
Currently, the exact count of approved withdrawal requests across the platform is not directly available in the system's quick statistics summary. 

However, I can share the latest overall system metrics with you:
- **Total Users:** 2,807
- **Active Users:** 2,803
- **Active Purchases:** 2,141
- **Total Commission Payouts:** ₹60,85,000.24

To see the exact number of approved withdrawals, you can check the **Withdrawals** section directly in your Admin Panel dashboard. Let me know if you want to look up the withdrawal history for any specific user!
```

### ADMIN A08 — `FAIL` (withdrawals)

**Q:** How many withdrawal requests have been rejected so far?

- expected_any: `['73']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `16151`
- db_truth: `73`

**Reply:**

```
I checked the system statistics, but currently, the exact count of **rejected withdrawal requests** is not available in the high-level system summary. 

Here is the current system stats snapshot:
- **Total Users:** 2,807
- **Active Users:** 2,803
- **Total Payouts:** ₹60,85,000.24

To see the exact number of rejected withdrawals, aap apne **Admin UI Panel** ke Withdrawals section mein jaakar `status = rejected` ka filter apply kar sakte hain. Wahan se aapko complete list aur exact count mil jayega.
```

### ADMIN A09 — `PASS` (purchases)

**Q:** How many package purchases (rows in purchases) exist in the database?

- expected_any: `['2838', '2,838']`
- matched: `['2,838']`
- tool_calls: `[]`
- elapsed_ms: `10898`
- db_truth: `2838`

**Reply:**

```
As per the system's database records (last reviewed on 25-04-2026), there are exactly **2,838** package purchases (rows in the `purchases` table) in the SIA MLM database. This includes all package buys, renewals, and upgrades.
```

### ADMIN A10 — `PASS` (commissions)

**Q:** How many pending commission entries are sitting in the system in total?

- expected_any: `['13636', '13,636']`
- matched: `['13,636']`
- tool_calls: `[]`
- elapsed_ms: `8686`
- db_truth: `13636`

**Reply:**

```
Based on the current system database records, there are exactly **13,636 pending commission entries** sitting in the system. 

**What are these?**
These are mostly **SPOT commissions** that have been generated from downline purchases, but the respective upline users have not yet qualified for the required level to receive them. 

Once the upline user meets the business requirements for that level, the daily eligibility cron job (which runs at 00:55 UTC / 06:25 AM IST) automatically releases these pending commissions and credits them to their SPOT wallet.
```

### ADMIN A11 — `PASS` (wallet)

**Q:** How many wallet transaction rows exist across all users (rough magnitude is fine)?

- expected_any: `['893336', '893,336', '893']`
- matched: `['893,336', '893']`
- tool_calls: `[]`
- elapsed_ms: `6791`
- db_truth: `893336`

**Reply:**

```
Based on the system's database records (as of the April 2026 backup), there are exactly **893,336 rows** in the `wallet_transactions` table. 

This table acts as a mirror to the `ledger_entries` table (which has about ~894K rows) and records the specific wallet impact for every single credit, debit, P2P transfer, fee deduction, and withdrawal that happens across all users in the system.
```

### ADMIN A12 — `PASS` (user_lookup)

**Q:** Pull profile details for SIA00299 — name, email, phone, status.

- expected_any: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `15088`
- db_truth: `SIA00299|RAHUL PARWATKAR|rahulparwatkar1983@gmail.com|8605099465|active`

**Reply:**

```
Here are the profile details for **SIA00299**:

* **Name:** RAHUL PARWATKAR
* **Status:** Active 
* **KYC Status:** Approved
* **Email / Phone:** *(Not available in the current profile data)*
* **Role:** STUDENT

**Quick Account Overview:**
* **Active Package:** Share Market Learning (₹30,000)
* **Total Balance:** ₹46,208.31 
  *(Spot: ₹14,850.25 | Main: ₹4,778.24 | Team Royalty: ₹26,579.82)*
* **Account Standing:** The account is fully active. Withdrawals are **not** blocked, and the user is **not** disqualified.

Let me know if you need to check their downline network or specific transactions!
```

### ADMIN A13 — `PASS` (user_lookup)

**Q:** What is the KYC status of user SIA00299?

- expected_any: `['approved']`
- matched: `['approved']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `10687`
- db_truth: `approved`

**Reply:**

```
The KYC status for user **SIA00299** (RAHUL PARWATKAR) is **approved**.
```

### ADMIN A14 — `FAIL` (user_lookup)

**Q:** How many direct referrals does SIA00299 have?

- expected_any: `['28']`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `23347`
- db_truth: `28`

**Reply:**

```
SIA00299 (RAHUL PARWATKAR) ki profile details fetch ho gayi hain, lekin is overview mein unke **direct referrals ka exact count available nahi hai**. 

Halanki, main unki current account details confirm kar sakta hu:

- **Name**: RAHUL PARWATKAR
- **Status**: Active (KYC Approved)
- **Active Package**: Share Market Learning (₹30,000)
- **Total Wallet Balance**: ₹46,208.31
  - Spot Balance: ₹14,850.25
  - Team Royalty Balance: ₹26,579.82
  - Main/Other Balance: ₹4,778.24

Inke exact direct referrals aur team size check karne ke liye humein inka network tree check karna padega jo ki is profile summary mein include nahi hai. Kya aapko inki recent income ya withdrawals ke baare mein koi aur jankari chahiye?
```

### ADMIN A15 — `FAIL` (user_lookup)

**Q:** What is the total downline size of SIA00299 (excluding the user himself)?

- expected_any: `['1893', '1,893']`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `90033`
- db_truth: `1893`

**Reply:**

```
I have accessed the profile for **SIA00299 (RAHUL PARWATKAR)**. 

However, my current admin tools only allow me to fetch the profile details, wallet summary, active packages, and transaction history for a specific user. The tool used to calculate the exact downline/team size (`getUserNetwork`) is currently restricted to the authenticated user's own network and does not support querying by another user's Display ID.

Therefore, I am unable to provide the exact total downline size for SIA00299 at this time. 

If it helps, I can share their current wallet balances, active package details (they are currently active on the *Share Market Learning* package), or their recent income and withdrawal history! Let me know what you would like to check.
```

### ADMIN A16 — `PASS` (user_lookup)

**Q:** What is the main wallet balance of SIA00299?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `13427`
- db_truth: `46208.31`

**Reply:**

```
The main wallet balance (`other_balance`) for **SIA00299 (RAHUL PARWATKAR)** is **₹4,778.24**.

For your reference, here is the complete wallet summary for this user:
- **Main Wallet:** ₹4,778.24
- **Spot Wallet:** ₹14,850.25
- **Team Royalty Wallet:** ₹26,579.82
- **Total Balance:** ₹46,208.31
```

### ADMIN A17 — `PASS` (user_lookup)

**Q:** How many package purchases has SIA00299 made?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `18260`
- db_truth: `4`

**Reply:**

```
Based on the live data for **SIA00299 (RAHUL PARWATKAR)**:

Currently, the user has **1 active package**:
- **Package Name:** Share Market Learning
- **Amount:** ₹30,000
- **Purchased Date:** 27th Feb 2026

While they have 1 currently active package, their recent income history shows SELF and GLOBAL_HELPING credits from another older purchase (Purchase ID 1540). This indicates that the user has made **at least 2 package purchases** in total over the lifetime of their account.
```

### ADMIN A18 — `FAIL` (user_lookup)

**Q:** How many withdrawal requests has SIA00299 raised in total?

- expected_any: `['33']`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `26084`
- db_truth: `33`

**Reply:**

```
SIA00299 (RAHUL PARWATKAR) ke profile snapshot ke anusaar, mere paas unke **last 10 withdrawal requests** ka record available hai. Ek exact lifetime total count dashboard summary mein directly visible nahi hai, lekin unhone kam se kam 10 withdrawals raise kiye hain, aur achhi baat ye hai ki ye **sabhi 10 requests successfully approved** ho chuki hain.

Yahan unke recent withdrawals ki ek quick summary hai:
- **Total Recent Withdrawals Visible:** 10
- **Status:** All 10 Approved ✅
- **Latest Withdrawal:** ₹4,025 (Spot Wallet se) on 20 April 2026
- **Highest Recent Withdrawal:** ₹46,677 (Team Royalty se) on 30 March 2026

Agar aapko in top 10 withdrawals ki date-wise detailed list dekhni hai, toh mujhe batayein!
```

### ADMIN A19 — `FAIL` (user_lookup)

**Q:** Has SIA00299 paid for the Graphic Designing & Video Editing package, and what is its status?

- expected_any: `['pending']`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `16599`
- db_truth: `pending`

**Reply:**

```
Based on the system records, user **SIA00299 (RAHUL PARWATKAR)** does not currently have the "Graphic Designing & Video Editing" package. 

Instead, they have paid for the **Share Market Learning** package (₹30,000), which was purchased on February 27, 2026. 

The status of this Share Market Learning package is currently **active**, and it has generated an income of ₹4,474.32 so far.
```

### ADMIN A20 — `PASS` (packages)

**Q:** Which package is the highest priced on SIA and what is its price?

- expected_any: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- matched: `['Cyber Security & Online Safety-III', '23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `11472`
- db_truth: `Cyber Security & Online Safety-III|2300000.00`

**Reply:**

```
The highest priced package on SIA is the **Cyber Security & Online Safety-III** package. 

Its price is **₹23,00,000** (23 Lakhs). 

Additionally, this package offers the highest monthly Self ROI at **7.0%** and has the maximum capping of **57,000 Global IDs**.
```

### ADMIN A21 — `PASS` (packages)

**Q:** Which package is the cheapest on SIA and what is its price?

- expected_any: `['English Speaking Basic', '2500', '2,500']`
- matched: `['English Speaking Basic', '2,500']`
- tool_calls: `[]`
- elapsed_ms: `7589`
- db_truth: `English Speaking Basic -I|2500.00`

**Reply:**

```
The cheapest package currently available on SIA is **English Speaking Basic-I**. 

Its price is **₹2,500**. 

Here are a few quick details about this package:
* **Self ROI:** 2.5% per month
* **Direct Spot Commission:** 5%
* **Direct Monthly Royalty:** 0.5%
* **Validity:** 395 days (Note: Income stops when the total earning from Self + Global reaches 2x the package amount, i.e., ₹5,000). 

Let me know if you need more details about this or any other package!
```

### ADMIN A22 — `PASS` (packages)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `[]`
- elapsed_ms: `6632`
- db_truth: `15000.00`

**Reply:**

```
The price of the **Digital Marketing** package is **₹15,000**. 

*(Note: There is also a "Digital Marketing-II" package which is currently inactive, and its price is ₹25,000.)* 

Let me know if you need more details about the benefits or daily commissions for this package!
```

### ADMIN A23 — `PASS` (levels)

**Q:** What is the title of level 0 and level 9 in the level master?

- expected_any: `['Field Worker', 'King']`
- matched: `['Field Worker', 'King']`
- tool_calls: `[]`
- elapsed_ms: `5583`
- db_truth: `0:Field Worker, 9:King`

**Reply:**

```
In the SIA MLM system, the titles for these levels are:

* **Level 0:** Field Worker (Direct)
* **Level 9:** King

If you need details about their business requirements or commission percentages, just let me know!
```

### ADMIN A24 — `PASS` (levels)

**Q:** List the titles for levels 1 through 4 in the SIA MLM level master.

- expected_any: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- matched: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- tool_calls: `[]`
- elapsed_ms: `4982`
- db_truth: `Company Representative, Company City Manager, Company Area Manager, Company District Manager`

**Reply:**

```
Here are the titles for Levels 1 through 4 in the SIA MLM system:

* **Level 1:** Company Representative
* **Level 2:** Company City Manager
* **Level 3:** Company Area Manager
* **Level 4:** Company District Manager

*(For context, Level 0 is "Field Worker / Direct" and the levels go all the way up to Level 9, which is "King".)*
```

### ADMIN A25 — `FAIL` (team_metrics)

**Q:** Who currently has the highest number of direct referrals on the platform — give their SIA ID and count?

- expected_any: `['SIA00111', '45']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `20143`
- db_truth: `SIA00111|45`

**Reply:**

```
I apologize, but as an AI assistant, I don't currently have a tool to pull the global leaderboard for the highest direct referrals across the entire platform. 

However, since you have Admin access, you can easily find this information directly in the dashboard:
1. Navigate to the **Leaderboard** section in the Admin Panel.
2. Look for the **Team Leaderboard** (or `/team-leaderboard` endpoint data), which ranks users by their recruitment and team size.

If you already have a top user's SIA ID in mind (e.g., SIA00001 or any top earner), you can share their ID with me, and I can instantly pull up their exact direct leg count and team network size!
```

### ADMIN A26 — `PASS` (team_metrics)

**Q:** How big is SIA00111's downline (descendants count, excluding self)?

- expected_any: `[]`
- matched: `[]`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `26240`
- db_truth: `2325`

**Reply:**

```
I have retrieved the profile for **SIA00111 (SHAMUAL SHANKAR GADDEKAR)**. However, my current admin tools only allow me to pull the exact downline/network count for the currently logged-in user, not for other specific users. 

To give you some context on their network activity based on their ledger:
* They have a highly active downline. Their recent transaction history shows continuous **MONTHLY** team royalty credits flowing in from numerous downline members (e.g., from user IDs 1880, 190, 441, 427, 280, 544, etc.).
* They are currently active on the **English Speaking-III** package (₹7,500).

To see their exact descendants count and complete closure tree, you will need to view their profile's **Team/Network** section directly within the Admin Panel.
```

### ADMIN A27 — `PASS` (concept)

**Q:** Explain what a pending commission row in the database represents and when it gets cleared.

- expected_any: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- matched: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- tool_calls: `[]`
- elapsed_ms: `16039`
- db_truth: `concept`

**Reply:**

```
A **pending commission row** in the database (stored in the `pending_commissions` table) represents a **SPOT commission** that an upline is entitled to receive from a downline's purchase, but **has not yet qualified for** based on their current level eligibility.

Here is a detailed breakdown of how it works:

### What it represents:
*   **SPOT Credits Only:** It is currently used exclusively for Level 1 to Level 9 SPOT commissions. (As of the Dec 20, 2025 redesign, MONTHLY royalties no longer go through the pending state).
*   **Parked Funds:** During a package purchase (`handlePurchase`), the system walks up the 9-level upline chain. If an upline is supposed to get a SPOT commission but their `level_eligibility` for that specific level is `false`, the money is held in the `pending_commis …
```

### ADMIN A28 — `PASS` (concept)

**Q:** Walk me through the lifecycle of a withdrawal request from creation to approval/rejection.

- expected_any: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- matched: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- tool_calls: `[]`
- elapsed_ms: `16990`
- db_truth: `concept`

**Reply:**

```
Here is the complete lifecycle of a withdrawal request in the SIA MLM platform, from the moment a user initiates it to the final admin decision:

### 1. Pre-requisites & Validation (Before Creation)
Before a user can even submit a withdrawal request, the system checks several strict validation gates:
*   **KYC Status:** The user's KYC must be `approved`.
*   **Transaction PIN:** The user must provide their correct transaction PIN.
*   **Account Status:** The user must not have their `withdrawal_blocked` flag set to true.
*   **Existing Requests:** A user can only have **one** `pending` or `processing` request per withdrawal type at a time.
*   **Date/Time Gates:** 
    *   If the system is in **Date-based mode**, withdrawals are only allowed on specific dates (e.g., 10th and 20th for SPOT, …
```

### ADMIN A29 — `PASS` (concept)

**Q:** What is the difference between purchases and pending_commissions tables in this system?

- expected_any: `['purchase', 'package', 'commission', 'pending', 'level']`
- matched: `['purchase', 'package', 'commission', 'pending', 'level']`
- tool_calls: `[]`
- elapsed_ms: `11019`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, the `purchases` and `pending_commissions` tables serve two very different purposes in the financial lifecycle. 

Here is the exact difference between them:

### 1. `purchases` Table (The Source of Business)
* **What it is:** This table records every package bought, renewed, or upgraded by a user in the system. 
* **Core Function:** It acts as the trigger for the entire commission engine. When a row is marked as `completed` here, it immediately fires the distribution of SPOT and MONTHLY commissions to uplines.
* **The 2x Rule Tracker:** This table contains an `income` column which acts as a live tracker. It accumulates the `SELF` and `GLOBAL_HELPING` income for that specific purchase. Once `purchases.income` reaches 2× the `amount` paid, the package is considered "exp …
```

### ADMIN A30 — `PASS` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `['closure', 'ancestor', 'descendant', 'depth']`
- tool_calls: `[]`
- elapsed_ms: `13569`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM platform, the 9-level upline and downline hierarchy is stored using a database design pattern called a **closure table**. This is managed in the `user_tree_paths` table.

Here is the structure of the table:
`user_tree_paths(ancestor_id BIGINT, descendant_id BIGINT, depth INT)`

Instead of just storing "who invited who," this table explicitly stores every single path between any ancestor (upline) and descendant (downline) in the network. 

Here is what each row means based on the `depth`:

*   **Depth 0 (Self-row):** Every user gets a row pointing to themselves. For example, `(User X, User X, 0)`.
*   **Depth 1 (Direct Sponsor/Referral):** This represents a direct connection (Level 0 in commission terms). If User A directly invites User B, a row is created: `(User A, User B,  …
```

### ADMIN A31 — `PASS` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `['main', 'spot', 'team royalty', 'balance']`
- tool_calls: `[]`
- elapsed_ms: `13105`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, every user has a single wallet record that is divided into **four specific sub-balances**. Here is a breakdown of what they are and how they are used:

### 1. Main Wallet (`other_balance`)
*   **What it holds:** This is where your daily **SELF ROI** (return on your own package) and **GLOBAL_HELPING** (income from new global users) commissions are credited. 
*   **How it's used:** You can withdraw from this wallet using the `wallet` withdrawal type. It is also the wallet used to deduct most platform fees (like withdrawal processing, name change, etc.) and is the source wallet if you want to make a **P2P (peer-to-peer) transfer** to another user.
*   *Note:* If you buy a new package while already having an active one (Reinvestment), credits to this wallet will be subje …
```

### ADMIN A32 — `PASS` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `['disqualified', 'commission', 'income']`
- tool_calls: `[]`
- elapsed_ms: `11542`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, when a user is marked with `is_disqualified = true`, it means they have been penalized for remaining **inactive for 21 days or more**. 

(A user is considered "inactive" when they do not have any active courses—meaning all of their purchased packages have reached the 2x income limit and they haven't renewed or upgraded).

Here is exactly what happens when a user gets disqualified:

**1. Commission Flow Stops**
*   **Skipped for Payouts:** They are entirely skipped during the commission distribution. They will not receive any SPOT or MONTHLY team royalty commissions from their downline's purchases.
*   **Pending Commissions Deleted:** The moment they are disqualified, any SPOT commissions they had waiting in the `pending_commissions` table (waiting for them to qualify …
```

### ADMIN A33 — `PASS` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- tool_calls: `[]`
- elapsed_ms: `13801`
- db_truth: `concept`

**Reply:**

```
The SIA MLM system uses **PgBoss** to manage background jobs and cron schedules. Here are the active scheduled jobs and event-driven workers running in the system:

### ⏱️ Scheduled Cron Jobs

1. **Daily Commission (`daily-commission`)**
   * **Schedule:** Daily at `00:52 UTC` (06:22 AM IST)
   * **Purpose:** This is the main commission engine. It dynamically computes and credits the **SELF**, **GLOBAL_HELPING**, and **MONTHLY** (Team Royalty) commissions for every active purchase in the network.

2. **Eligibility Check (`eligibility-check`)**
   * **Schedule:** Daily at `00:55 UTC` (06:25 AM IST)
   * **Purpose:** Runs immediately after the daily commissions. It recomputes the `level_eligibility` (Levels 1 to 9) for all users based on their updated team business, and releases any **Pendin …
```

### ADMIN A34 — `PASS` (concept)

**Q:** Explain what the legacy_activation_history and legacy_spot_history tables are used for.

- expected_any: `['legacy', 'history', 'old', 'spot', 'activation']`
- matched: `['legacy', 'history', 'old', 'spot', 'activation']`
- tool_calls: `[]`
- elapsed_ms: `11645`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, **Legacy Data** refers to historical records that were imported from the old MLM system (pre-December 2025) via Excel/CSV files. 

These tables are strictly **read-only**. They exist for historical tracking, auditing, and transparency, and they **do not** trigger any new commissions, downstream eligibility, or affect the active commission engine.

Here is the breakdown of what each table is used for:

### 1. `legacy_activation_history`
*   **What it is:** Contains the old-system package activations and recharges.
*   **How it's stored:** The original Excel/CSV data is preserved exactly as it was via a raw JSONB blob to ensure no historical data was lost.
*   **Where it's used:** 
    *   **Users:** Can see this in their dashboard under "Activation History (Old Data)" …
```

### ADMIN A35 — `PASS` (concept)

**Q:** Can an admin manually adjust a user's wallet, and if yes, where is that recorded?

- expected_any: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- matched: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- tool_calls: `[]`
- elapsed_ms: `10401`
- db_truth: `concept`

**Reply:**

```
Yes, an admin can manually adjust a user's wallet in the SIA MLM system. Admins with the `WALLET_MANAGE` permission can add (credit) or subtract (debit) any amount from a user's specific sub-wallets: Main (`other_balance`), Spot (`spot_balance`), or Team Royalty (`team_royalty_balance`). 

This is often used for corrections, bonuses, refunds, or migration adjustments.

Whenever an admin performs a wallet adjustment, it is strictly recorded in **two places** for transparency and auditing:

1. **The Core Ledger (`ledger_entries` table):**
   A new transaction row is created with:
   * `commission_type`: **`ADMIN_OPS`**
   * `amount`: Positive for additions, negative for deductions.
   * `metadata`: Contains a flag `admin_ops: true`, the target `wallet_type`, and the `reason` provided by the  …
```
