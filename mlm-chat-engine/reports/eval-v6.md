# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T17:42:31
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **95**
- Passed: **93**
- Satisfactory score: **97.89%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 48 | 46 | 95.83% |
| admin | 47 | 47 | 100.0% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 2 | 100.0% |
| concept | 16 | 16 | 100.0% |
| income | 2 | 2 | 100.0% |
| income_compound | 10 | 9 | 90.0% |
| kyc_aggregate | 2 | 2 | 100.0% |
| leaderboard | 1 | 1 | 100.0% |
| levels | 2 | 2 | 100.0% |
| network | 4 | 4 | 100.0% |
| packages | 7 | 6 | 85.71% |
| profile | 5 | 5 | 100.0% |
| purchases | 1 | 1 | 100.0% |
| system | 5 | 5 | 100.0% |
| system_stats | 5 | 5 | 100.0% |
| team | 3 | 3 | 100.0% |
| team_metrics | 2 | 2 | 100.0% |
| user_lookup | 8 | 8 | 100.0% |
| wallet | 5 | 5 | 100.0% |
| withdrawal_aggregate | 2 | 2 | 100.0% |
| withdrawal_counts | 1 | 1 | 100.0% |
| withdrawal_date | 2 | 2 | 100.0% |
| withdrawal_eligible | 2 | 2 | 100.0% |
| withdrawal_projection | 1 | 1 | 100.0% |
| withdrawals | 7 | 7 | 100.0% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `6354`
- db_truth: `SIA00299|RAHUL PARWATKAR`

**Reply:**

```
Your SIA ID is **SIA00299** and your registered name is **RAHUL PARWATKAR**.
```

### USER U02 — `PASS` (profile)

**Q:** What is my registered email and phone number?

- expected_any: `['rahulparwatkar1983@gmail.com', '8605099465']`
- matched: `['rahulparwatkar1983@gmail.com', '8605099465']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5915`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Your registered details are:

*   **Email:** rahulparwatkar1983@gmail.com
*   **Phone Number:** 8605099465
```

### USER U03 — `PASS` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `['approved']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5515`
- db_truth: `approved`

**Reply:**

```
Your current KYC status is **Approved**.
```

### USER U04 — `PASS` (profile)

**Q:** What is my account status — active or blocked?

- expected_any: `['active']`
- matched: `['active']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5794`
- db_truth: `active`

**Reply:**

```
Your account status is **Active**. 

Here are the details of your account:
*   **Status:** Active
*   **Withdrawal Status:** Not blocked (You are allowed to make withdrawals)
*   **KYC Status:** Approved
*   **Disqualification Status:** Not disqualified

Your SIA ID is **SIA00299** and you are currently at **Level 3**.
```

### USER U05 — `PASS` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `['92']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5113`
- db_truth: `92`

**Reply:**

```
Your sponsor is **SHAMUAL SHANKAR GADDEKAR** (SIA ID: **SIA00111**). Their referrer user ID is **92**.
```

### USER U06 — `PASS` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `['46208', '46,208']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `7223`
- db_truth: `46208.31`

**Reply:**

```
Your main wallet (other balance) currently has **₹4,778.24**.

Here is a summary of all your balances:
*   **Main Wallet (Other):** ₹4,778.24
*   **SPOT Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Combined Balance:** ₹46,208.31
```

### USER U07 — `PASS` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `['46208', '14850', '4778', '26579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `6010`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Sure, here are your current wallet balances:

*   **Main Wallet (Other):** ₹4,778.24
*   **Spot Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Balance:** ₹46,208.31

Your total Spot and Team Royalty withdrawals used in this cycle is ₹85,921.00. Currently, your wallet flush is inactive.
```

### USER U08 — `PASS` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `['14850', '14,850']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `5042`
- db_truth: `14850.25`

**Reply:**

```
Your spot wallet balance is ₹14,850.25.
```

### USER U09 — `PASS` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `['26579', '26,579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `6290`
- db_truth: `26579.82`

**Reply:**

```
Your team royalty wallet balance is ₹26,579.82.
```

### USER U10 — `PASS` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `6708`
- db_truth: `4`

**Reply:**

```
आपने अब तक कुल **4** पैकेज खरीदे हैं। इनका विवरण नीचे दिया गया है:

*   **Active (2):**
    *   English Speaking-III (₹7,500.00)
    *   Share Market Learning (₹30,000.00)
*   **Pending (2):**
    *   Graphic Designing & Video Editing (₹50,000.00)
    *   Digital Marketing (₹15,000.00)
```

### USER U11 — `PASS` (packages)

**Q:** List the names of all packages I have ever purchased.

- expected_any: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- matched: `['English Speaking', 'Digital Marketing', 'Share Market', 'Graphic Designing']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `5587`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
Aapne ab tak niche diye gaye packages purchase kiye hain:

*   **English Speaking-III** (Active)
*   **Share Market Learning** (Active)
*   **Graphic Designing & Video Editing** (Pending)
*   **Digital Marketing** (Pending)
```

### USER U12 — `FAIL` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `[]`
- tool_calls: `['getPendingPurchaseRequests']`
- elapsed_ms: `6380`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
You currently have no package purchase requests in pending status. All your requests have been processed.
```

### USER U13 — `PASS` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `['30000', '30,000']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `6421`
- db_truth: `30000.00`

**Reply:**

```
Your Share Market Learning purchase (ID: 2210) was priced at **₹30,000.00**. 

This package was purchased on 27th February 2026 and is currently active, having earned ₹4,474.32 in income so far.
```

### USER U14 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6032`
- db_truth: `33`

**Reply:**

```
Aapne total **33 withdrawal requests** raise kiye hain.

Yaha aapka summary hai:
*   **Total Requests:** 33
*   **Status:** Sabhi 33 requests **approved** ho chuke hain.
*   **Total Amount:** ₹3,26,090.00
```

### USER U15 — `PASS` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `['no']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5642`
- db_truth: `0`

**Reply:**

```
No, aapka koi bhi pending withdrawal request nahi hai.

Aapke total **33 withdrawal requests** hain aur wo sabhi **Approved** ho chuke hain.
```

### USER U16 — `PASS` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6229`
- db_truth: `33`

**Reply:**

```
Aapke total **33** withdrawal requests approve ho chuke hain, jinka total amount **₹3,26,090.00** hai.
```

### USER U17 — `PASS` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['326090', '326,090', '3,26,090']`
- matched: `['326090', '326,090', '3,26,090']`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `15122`
- db_truth: `326090.00`

**Reply:**

```
Your total approved withdrawal amount across all 33 requests is **₹3,26,090.00**.

Here is the breakdown by wallet type:
*   **Main Wallet:** ₹1,72,919.00 (13 requests)
*   **Spot Wallet:** ₹1,06,494.00 (19 requests)
*   **Team Royalty Wallet:** ₹46,677.00 (1 request)

All your requests have been successfully processed and approved.
```

### USER U18 — `PASS` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `['204567', '204,567']`
- tool_calls: `['getWalletTransactionsSummary']`
- elapsed_ms: `5874`
- db_truth: `204567.31`

**Reply:**

```
Aapke wallet mein ab tak total ₹2,04,567.31 credit hue hain. Ye sum aapke saare positive wallet transactions ka total hai.
```

### USER U19 — `PASS` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `['56714', '56,714']`
- tool_calls: `['getWalletTransactionsSummary']`
- elapsed_ms: `6856`
- db_truth: `56714`

**Reply:**

```
Aapke account mein total **56,714** wallet transactions recorded hain. Iska summary neeche diya gaya hai:

*   **Total Transactions:** 56,714
*   **Total Credit:** ₹2,04,567.31
*   **Total Debit:** ₹1,49,225.19
*   **Net Balance Change:** ₹55,342.12
```

### USER U20 — `PASS` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `5762`
- db_truth: `28`

**Reply:**

```
You have 28 direct referrals (direct legs) in your network.
```

### USER U21 — `PASS` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `['1893', '1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `7006`
- db_truth: `1893`

**Reply:**

```
Your total downline size is **1,893** members (excluding yourself).

Here is a brief breakdown of your network by depth:
*   **Level 1 (Directs):** 28 members
*   **Level 2:** 73 members
*   **Level 3:** 188 members
*   **Level 4:** 345 members
*   **Level 5:** 288 members

Your network currently extends up to **15 depths** in total, and you are positioned at an upline depth of **5** within the system.
```

### USER U22 — `PASS` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `['5']`
- tool_calls: `['getUserNetwork']`
- elapsed_ms: `9403`
- db_truth: `5`

**Reply:**

```
Aapki upline chain total **5 levels** deep hai. Aapke upar total 5 ancestors hain:

1. **SHAMUAL SHANKAR GADDEKAR** (SIA00111) - Depth 1
2. **Pratibha Sikandar Sahare** (SIA00107) - Depth 2
3. **SHANKAR DASHRATH GADDEKAR** (SIA00022) - Depth 3
4. **Mariyam Naseer Sheikh** (SIA00021) - Depth 4
5. **Admin** (SIA ID: admin) - Depth 5
```

### USER U23 — `PASS` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `['991']`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `8318`
- db_truth: `991`

**Reply:**

```
Aapke account mein total **991 pending commission entries** recorded hain.

Inka total amount **₹3,14,237.50** hai. Yeh saari commissions **SPOT** type ki hain aur alag-alag levels par pending hain:

*   **Level 4:** 276 entries (₹1,02,500.00)
*   **Level 5:** 226 entries (₹76,481.25)
*   **Level 6:** 156 entries (₹35,968.75)
*   **Level 7:** 186 entries (₹79,487.50)
*   **Level 8:** 146 entries (₹19,725.00)
*   **Level 9:** 1 entry (₹75.00)

Yeh commissions tab release hongi jab aap relevant levels ke liye qualify kar jayenge ya system eligibility criteria meet ho jayega.
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6247`
- db_truth: `13`

**Reply:**

```
SIA platform total **13 packages** offer karta hai. Inme se **10 packages active** hain aur **3 packages inactive** hain. 

Yahan list di gayi hai:
* **Active Packages (10):** English Speaking Basic-I, English Speaking-III, Digital Marketing, Share Market Learning, Graphic Designing & Video Editing, Personality Development + Financial Planning, Artificial Intelligence, Cyber Security & Online Safety (I, II, aur III).
* **Inactive Packages (3):** English Speaking-II, Digital Marketing-II, aur Personality Development + Financial Planning-II.
```

### USER U25 — `PASS` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15000', '15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `12846`
- db_truth: `15000.00`

**Reply:**

```
Digital Marketing package ki price ₹15,000.00 hai.
```

### USER U26 — `PASS` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `['2300000', '23,00,000', '2,300,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6722`
- db_truth: `7500.00`

**Reply:**

```
The price of the highest tier package on SIA is **₹23,00,000.00**. This corresponds to the **Cyber Security & Online Safety-III** package, which also offers the highest monthly self ROI of 7.0%.
```

### USER U27 — `PASS` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `6537`
- db_truth: `10`

**Reply:**

```
The SIA MLM system has **10 levels** configured (from Level 0 to Level 9). Here is the breakdown:

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

Each level has specific business requirements (like direct referrals and team business volume) and offers different rewards, ranging from T-shirts to real estate and directorship roles.
```

### USER U28 — `PASS` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `['King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `6239`
- db_truth: `King`

**Reply:**

```
SIA MLM mein sabse bade level (Level 9) ka title **King** hai. Is level tak pahunchne ke liye total team business ₹2,100 Crore hona chahiye.
```

### USER U29 — `PASS` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `['upline', 'downline', 'sponsor']`
- tool_calls: `[]`
- elapsed_ms: `5829`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein **Upline** aur **Downline** ka matlab ye hai:

*   **Upline:** Ye wo log hote hain jo tree mein aapse upar hain. Aapka direct sponsor aapka pehla upline (Level 0) hota hai, aur uske upar ke sponsors up to 9 levels tak aapke uplines kehlate hain. Jab aap koi package kharidte hain, toh uska commission inhi uplines ko milta hai.
*   **Downline:** Ye wo log hote hain jo aapke niche join karte hain. Aapke direct referrals aapke pehle downline level pe hote hain, aur unki team aage chalkar aapka total downline banti hai. Aapko apne downline ki purchases par SPOT aur MONTHLY commissions milte hain.

SIA mein ye relationship **user_tree_paths** (closure table) ke zariye track ki jati hai, jo 9 levels tak kaam karti hai.
```

### USER U30 — `PASS` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `['main', 'spot', 'team royalty', 'wallet']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `9930`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein basically ek main balance hota hai jo four sub-wallets mein divided hai:

*   **Spot Wallet (`spot_balance`):** Isme aapki saari **SPOT commissions** (downline ke package purchase par milne wali one-time income) aati hai. Is wallet se withdrawal har mahine ki 10, 20, aur 30 tarikh ko kiya ja sakta hai. Dhyaan rahe ki har SPOT credit par 10-day ka hold hota hai.
*   **Main / Other Wallet (`other_balance`):** Isme aapki **SELF income** (ROI) aur **GLOBAL_HELPING income** aati hai. Iska withdrawal sirf mahine ki 30 tarikh (Feb mein 28) ko hota hai. Agar aapne reinvestment kiya hai, toh isme 90, 150, ya 180 dino ka lock period bhi ho sakta hai.
*   **Team Royalty Wallet (`team_royalty_balance`):** Isme aapki **MONTHLY team royalty** (level 0 se level 9 tak ki recurring inco …
```

### USER U31 — `PASS` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `['direct', 'commission', 'package', 'level']`
- tool_calls: `[]`
- elapsed_ms: `11238`
- db_truth: `concept`

**Reply:**

```
Direct commission (Level 0) calculate karne ke liye do main components hote hain:

1.  **Direct SPOT Commission (One-time):**
    *   Jab aapka koi direct referral package buy karta hai, toh aapko turant **5%** commission milta hai purchase amount par.
    *   Iske liye aapka apna course active hona chahiye.
    *   Dhyan rahe ki agar referral "reinvestment" kar raha hai, toh bhi Level 0 par aapka commission kam nahi hota (halved nahi hota), aapko pura 5% hi milta hai.

2.  **Direct MONTHLY Royalty (Recurring):**
    *   Yeh commission aapko rozana (daily) milta hai jab tak referral ka package active hai.
    *   **₹3,00,000 tak ke packages** par yeh **0.5% per month** hota hai.
    *   **₹5,00,000 aur usse bade packages** par yeh **1.0% per month** hota hai.
    *   Daily amount calculate …
```

### USER U32 — `PASS` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `23522`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein withdrawal request ka end-to-end flow kuch is tarah hota hai:

1.  **Request Submission:** Aap apne dashboard se withdrawal request submit karte hain jisme Amount, Payment Method (Bank/UPI), Account Details, Wallet Type aur apna **Transaction PIN** enter karna hota hai.
2.  **Validation Gates:** System lagbhag 12 checks verify karta hai, jaise:
    *   Aapka KYC status **Approved** hona chahiye.
    *   Aapka account withdrawal blocked nahi hona chahiye.
    *   Wallet mein sufficient available balance hona chahiye (SPOT 10-day hold aur reinvestment locks ko exclude karke).
    *   Min/Max withdrawal limits aur "One pending request per wallet" rule follow hona chahiye.
3.  **Pending Status:** Agar validation pass ho jata hai, toh request **Pending** state mein chali jat …
```

### USER U33 — `PASS` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `['p2p', 'transfer', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `32552`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein **P2P (Peer-to-Peer) Transfer** ka matlab hai ek user se dusre user ko paise bhejna.

Iske baare mein zaroori jaankari:
*   **Wallet:** Yeh sirf **Main wallet (`other_balance`)** ka istemal karta hai. SPOT wallet se P2P transfer nahi kiya ja sakta.
*   **Tax:** Sender par **3% tax** lagta hai (agar aap ₹1,000 bhejte hain, toh aapke wallet se ₹1,030 katenge aur receiver ko poore ₹1,000 milenge).
*   **Requirements:** Sender aur Receiver dono ka **KYC Approved** hona chahiye aur sender ke paas **Transaction PIN** hona zaroori hai.
*   **Limits:** Iski minimum limit ₹100 aur maximum limit ₹9,999.96 hai.
```

### USER U34 — `PASS` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `['kyc', 'verification', 'approved', 'withdraw']`
- tool_calls: `[]`
- elapsed_ms: `7926`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein KYC (Know Your Customer) identity verification ke liye zaroori hai. Iska main purpose system ki security maintain karna aur financial regulations ko follow karna hai.

**KYC kyun zaroori hai?**
*   **Withdrawals:** Bina KYC approval ke aap apna balance bank account mein withdraw nahi kar sakte.
*   **P2P Transfers:** Doosre users se funds receive karne ke liye KYC approved hona mandatory hai.
*   **Verification:** Yeh ensure karta hai ki account ek genuine person ka hai.

**Agar KYC approve nahi hua toh kya hoga?**
*   Aapka withdrawal request reject ho jayega ya submit hi nahi hoga.
*   Aap P2P transfers receive nahi kar payenge.
*   Dashboard par status 'pending', 'submitted', ya 'rejected' dikhega. Agar reject hota hai, toh aap admin ka diya hua rejection reason dekh …
```

### USER U35 — `PASS` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `['level', 'business', 'team', 'requirement', 'leg']`
- tool_calls: `['getAllLevels', 'getUserLevelProgress']`
- elapsed_ms: `17634`
- db_truth: `concept`

**Reply:**

```
SIA MLM hierarchy mein level badhane ke liye aapko **Leg-based business requirements** aur **Total Team Business** targets achieve karne hote hain.

Aapka current status aur agle level ki details neeche di gayi hain:

### Aapka Current Status:
*   **Current Level:** Level 3 — Company Area Manager
*   **Next Target:** Level 4 — Company District Manager
*   **Reward for Level 4:** Motorcycle 🏍️

### Level 4 (Company District Manager) ki Requirements:
Agle level par pahunchne ke liye aapko ye targets pure karne honge:
1.  **Total Team Business:** ₹2,32,86,000 (₹2.32 Crore)
2.  **Qualifying Legs:** Kam se kam **3 legs** aisi honi chahiye jinme se har ek ka business ₹77,62,000 (₹77.62 Lakh) se zyada ho.

### Aapki Progress vs Requirements:
Aapka total business target pehle hi pura ho chuka hai, …
```

### USER U36 — `PASS` (income_compound)

**Q:** Mere 7500 wala English Speaking-III (package id 2) me pichhle 5 dino kitna SELF + GLOBAL income aaya hai?

- expected_any: `['197.50', '197.5', '197']`
- matched: `['197.50', '197.5', '197']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7554`
- db_truth: `197.50`

**Reply:**

```
Aapke ₹7,500 waale English Speaking-III (ID: 2) package mein pichhle 5 dino mein total **₹197.50** ki income aayi hai:

*   **SELF Income:** ₹37.50 (5 entries)
*   **GLOBAL_HELPING Income:** ₹160.00 (5 entries)

Total: ₹197.50.
```

### USER U37 — `PASS` (income_compound)

**Q:** Pichhle 5 dino me mera total SELF + GLOBAL income kitna hai across all packages?

- expected_any: `['752.70', '752.7', '752']`
- matched: `['752.70', '752.7', '752']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6566`
- db_truth: `752.70`

**Reply:**

```
Pichhle 5 dino mein aapka total SELF aur GLOBAL income **₹752.70** hai. 

Iska breakdown niche diya gaya hai:
*   **SELF Income:** ₹237.50
*   **GLOBAL_HELPING Income:** ₹515.20
```

### USER U38 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets allowed hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `8779`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30 April 2026** hai (jo ki abhi se 5 din baad hai).

Us din aap in teeno wallets se withdrawal kar sakte hain:
* **SPOT** Wallet
* **Main (Other)** Wallet
* **Team Royalty** Wallet

SIA system ke rule ke mutabiq, mahine ki 10 aur 20 tarikh ko sirf SPOT wallet allow hota hai, lekin mahine ki aakhri tarikh (30th ya Feb mein 28th) ko saare wallets open rehte hain. Withdrawal window subah 10:00 AM se shaam 5:00 PM IST tak khuli rehti hai.
```

### USER U39 — `PASS` (withdrawal_eligible)

**Q:** Agle withdrawal date pe main exactly kitna amount apply / withdraw kar sakta hu?

- expected_any: `['46208', '46,208']`
- matched: `['46208', '46,208']`
- tool_calls: `['getEligibleWithdrawalAmount', 'getWalletSummary', 'getUserProfile']`
- elapsed_ms: `27094`
- db_truth: `46208.31`

**Reply:**

```
Agle withdrawal date **30 April 2026** ko aap total **₹46,208.31** withdraw kar sakte hain.

Iska exact breakdown niche diya gaya hai:
*   **Spot Wallet:** ₹14,850.25
*   **Main Wallet (Other):** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Eligible Amount:** **₹46,208.31**

**Kuch zaroori points:**
*   **KYC Status:** Aapka KYC already **Approved** hai, isliye koi dikkat nahi hai.
*   **Time Window:** 30 April ko withdrawal window subah **10:00 AM se shaam 5:00 PM (IST)** tak open rahegi.
*   **Processing Fee:** Har approved withdrawal request par ₹30 ki processing fee deduct ki jayegi.
*   **Capping:** Aapka Spot + Team Royalty ka combined withdrawal limit ke andar hai, toh aap pura amount apply kar sakte hain.

Agar 30 tarikh se pehle aapke wallet mein aur commissions a …
```

### USER U40 — `PASS` (withdrawal_counts)

**Q:** Mere ab tak kitne withdrawal requests approved aur kitne rejected hue hain?

- expected_any: `['33', 'approved']`
- matched: `['33', 'approved']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6494`
- db_truth: `approved=33`

**Reply:**

```
Aapke ab tak ke withdrawal requests ka status niche diya gaya hai:

*   **Approved:** 33 (Total raashi: ₹3,26,090.00)
*   **Rejected:** 0

Aapke sabhi 33 requests approve ho chuke hain aur abhi tak koi bhi request reject nahi hui hai.
```

### USER U41 — `PASS` (network)

**Q:** Mera total downline network kitna bada hai (sab depths milake)?

- expected_any: `['1893', '1,893']`
- matched: `['1893', '1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6219`
- db_truth: `1893`

**Reply:**

```
Aapka total downline network **1,893** logo ka hai. 

Depth-wise breakdown kuch is tarah hai:
* **Level 1 (Directs):** 28
* **Level 2:** 73
* **Level 3:** 188
* **Level 4:** 345
* **Level 5:** 288
* **Level 6 se 15:** 771

Aapka network total **15 levels** tak faila hua hai.
```

### USER U42 — `PASS` (network)

**Q:** Mere kitne direct referrals hain (level-1 wale)?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `4983`
- db_truth: `28`

**Reply:**

```
Aapke total 28 direct referrals (Level 1) hain.
```

### USER U43 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total MONTHLY recurring income kitna mila hai?

- expected_any: `['30312', '30,312']`
- matched: `['30312', '30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7203`
- db_truth: `30312.92`

**Reply:**

```
Pichhle 30 dino me aapka total **MONTHLY (Team Royalty)** income **₹30,312.92** raha hai. Yeh total 13,326 entries se calculate kiya gaya hai.
```

### USER U44 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total SPOT income kitni aayi?

- expected_any: `['19118', '19,118']`
- matched: `['19118', '19,118']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `5694`
- db_truth: `19118.75`

**Reply:**

```
Pichhle 30 dino me aapki total SPOT income **₹19,118.75** aayi hai. Isme total 30 transactions record hue hain.
```

### USER U45 — `PASS` (income_compound)

**Q:** Mere 2500 wale package (English Speaking Basic-I, package id 1) se ab tak total kitni income aayi hai (lifetime)?

- expected_any: `['7244', '7,244']`
- matched: `['7244', '7,244']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `8550`
- db_truth: `7244.95`

**Reply:**

```
Aapke English Speaking Basic-I package (₹2,500) se ab tak total **₹7,244.95** ki income aayi hai.

Iska breakdown niche diya gaya hai:
* **SPOT Income:** ₹2,193.75
* **Monthly Royalty:** ₹5,166.14
* **Admin Adjustments:** -₹114.94

Aapki total lifetime income is package se **₹7,244.95** banti hai.
```

### USER U46 — `PASS` (income_compound)

**Q:** Pichhle 7 din ka mera net income (saare types ka sum) kitna hai?

- expected_any: `['5275', '5,275']`
- matched: `['5275', '5,275']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `8355`
- db_truth: `5275.79`

**Reply:**

```
Pichhle 7 dino ka aapka total net income **₹5,275.79** hai. Iska detail breakdown niche diya gaya hai:

*   **SELF Income:** ₹332.50
*   **GLOBAL_HELPING:** ₹713.60
*   **SPOT Income:** ₹643.75
*   **MONTHLY (Team Royalty):** ₹7,610.94
*   **FEE_DEDUCTION:** -₹4,025.00 (Fees jo deduct hui hain)

**Total Net Income: ₹5,275.79**
```

### USER U47 — `FAIL` (income_compound)

**Q:** Is mahine (April 2026) ki MONTHLY recurring income kitni mili hai abhi tak?

- expected_any: `['25588', '25,588']`
- matched: `[]`
- error: `llm_failed`
- tool_calls: `[]`
- elapsed_ms: `2715`
- db_truth: `25588.85`

**Reply:**

```
(no reply text)
```

### USER U48 — `PASS` (income_compound)

**Q:** English Speaking-III (package id 2) ka mera SPOT income lifetime kitna mila hai?

- expected_any: `['8887', '8,887']`
- matched: `['8887', '8,887']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6426`
- db_truth: `8887.50`

**Reply:**

```
Aapka English Speaking-III (Package ID: 2) se lifetime total SPOT income **₹8,887.50** hai (total 58 entries).
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2807', '2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `6144`
- db_truth: `2807`

**Reply:**

```
Right now, there are a total of **2,807** users registered on the SIA platform. Out of these, 2,803 are currently active.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2803', '2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `11389`
- db_truth: `2803`

**Reply:**

```
System mein total **2,807 users** registered hain, jinmein se **2,803 users active** hain.

*   **Total Users:** 2,807
*   **Active Users:** 2,803
*   **Active Purchases:** 2,141 (current running packages)
```

### ADMIN A03 — `PASS` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `['1285', '1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `5880`
- db_truth: `1285`

**Reply:**

```
SIA MLM system mein total **1,285** users ka KYC status **approved** hai.
```

### ADMIN A04 — `PASS` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5406`
- db_truth: `13`

**Reply:**

```
There are currently **13 MLM packages** configured in the system:

*   **10 Active** packages (ranging from ₹2,500 to ₹23,00,000).
*   **3 Inactive** packages.
```

### ADMIN A05 — `PASS` (system_stats)

**Q:** How many levels are defined in the level master table?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `6288`
- db_truth: `10`

**Reply:**

```
SIA MLM system mein total **10 levels** defined hain (Level 0 se Level 9 tak). Har level ke apne requirements aur rewards hain:

*   **Level 0:** Field Worker (Direct)
*   **Level 1:** Company Representative (T-shirt aur Diary)
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
- matched: `['0', 'no']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6388`
- db_truth: `0`

**Reply:**

```
Right now, there are **0 withdrawal requests** sitting in the pending bucket. 

Based on the system records:
*   **Total requests:** 5,125
*   **Approved:** 5,052
*   **Rejected:** 73

Since the approved and rejected counts account for all requests in the system, there are currently no pending or unprocessed withdrawals.
```

### ADMIN A07 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been approved across the platform till date?

- expected_any: `['5052', '5,052']`
- matched: `['5052', '5,052']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5801`
- db_truth: `5052`

**Reply:**

```
SIA MLM system par abhi tak total **5,052** withdrawal requests approve ho chuki hain. 

In approved withdrawals ki kul raashi (total amount) **₹3,05,34,304.83** hai.
```

### ADMIN A08 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been rejected so far?

- expected_any: `['73']`
- matched: `['73']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5843`
- db_truth: `73`

**Reply:**

```
Ab tak total **73** withdrawal requests reject ho chuki hain, jinki total value ₹5,10,544.00 hai.
```

### ADMIN A09 — `PASS` (purchases)

**Q:** How many package purchases (rows in purchases) exist in the database?

- expected_any: `['2838', '2,838']`
- matched: `['2838', '2,838']`
- tool_calls: `['getAdminPlatformStats']`
- elapsed_ms: `5825`
- db_truth: `2838`

**Reply:**

```
Database mein total **2,838** package purchases (purchases rows) exist karte hain.

Iska breakdown is tarah hai:
*   **Completed:** 2,553
*   **Pending:** 226
```

### ADMIN A10 — `PASS` (commissions)

**Q:** How many pending commission entries are sitting in the system in total?

- expected_any: `['13636', '13,636']`
- matched: `['13636', '13,636']`
- tool_calls: `['getAdminPlatformStats']`
- elapsed_ms: `7995`
- db_truth: `13636`

**Reply:**

```
There are exactly 13,636 pending commission entries currently in the system.
```

### ADMIN A11 — `PASS` (wallet)

**Q:** How many wallet transaction rows exist across all users (rough magnitude is fine)?

- expected_any: `['893336', '893,336', '893']`
- matched: `['893336', '893,336', '893']`
- tool_calls: `['getAdminPlatformStats']`
- elapsed_ms: `5375`
- db_truth: `893336`

**Reply:**

```
Pure system mein total **8,93,336** wallet transaction rows hain.
```

### ADMIN A12 — `PASS` (user_lookup)

**Q:** Pull profile details for SIA00299 — name, email, phone, status.

- expected_any: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- matched: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `5528`
- db_truth: `SIA00299|RAHUL PARWATKAR|rahulparwatkar1983@gmail.com|8605099465|active`

**Reply:**

```
SIA00299 ki profile details ye rahi:

*   **Name:** RAHUL PARWATKAR
*   **Email:** rahulparwatkar1983@gmail.com
*   **Phone:** 8605099465
*   **Status:** active (KYC: approved)
*   **Current Level:** Level 3 (Company Area Manager)
*   **Sponsor:** SHAMUAL SHANKAR GADDEKAR (SIA00111)

Inka account fully qualified hai aur filhal inka total balance ₹46,208.31 hai.
```

### ADMIN A13 — `PASS` (user_lookup)

**Q:** What is the KYC status of user SIA00299?

- expected_any: `['approved']`
- matched: `['approved']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `5435`
- db_truth: `approved`

**Reply:**

```
User SIA00299 (Rahul Parwatkar) ka KYC status **approved** hai.
```

### ADMIN A14 — `PASS` (user_lookup)

**Q:** How many direct referrals does SIA00299 have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `5017`
- db_truth: `28`

**Reply:**

```
User SIA00299 ke total **28 direct referrals** hain.
```

### ADMIN A15 — `PASS` (user_lookup)

**Q:** What is the total downline size of SIA00299 (excluding the user himself)?

- expected_any: `['1893', '1,893']`
- matched: `['1893', '1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6957`
- db_truth: `1893`

**Reply:**

```
The total downline size for user **SIA00299** (excluding themselves) is **1,893**.

Here is a breakdown of the team across various depths:
*   **Direct Referrals (Depth 1):** 28 users
*   **Depths 2–5:** 894 users
*   **Depths 6–9:** 759 users
*   **Depths 10 and above:** 212 users

Total network size: **1,893** users.
```

### ADMIN A16 — `PASS` (user_lookup)

**Q:** What is the main wallet balance of SIA00299?

- expected_any: `['46208', '46,208']`
- matched: `['46208', '46,208']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `9257`
- db_truth: `46208.31`

**Reply:**

```
User SIA00299 (RAHUL PARWATKAR) ka main wallet balance ₹4,778.24 hai.

Yahan unka pura wallet summary diya gaya hai:
*   **Main Wallet:** ₹4,778.24
*   **Spot Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Balance:** ₹46,208.31
```

### ADMIN A17 — `PASS` (user_lookup)

**Q:** How many package purchases has SIA00299 made?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `9036`
- db_truth: `4`

**Reply:**

```
User SIA00299 ne total **4 package purchases** kiye hain:

*   **Active (Completed):** 2 (English Speaking-III aur Share Market Learning)
*   **Pending:** 2 (Graphic Designing & Video Editing aur Digital Marketing)
*   **Expired:** 0

In purchases ki total value ₹1,02,500.00 hai.
```

### ADMIN A18 — `PASS` (user_lookup)

**Q:** How many withdrawal requests has SIA00299 raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5597`
- db_truth: `33`

**Reply:**

```
User SIA00299 ne total **33** withdrawal requests raise kiye hain. 

Yeh sabhi requests **Approved** status mein hain aur inka total amount **₹3,26,090.00** hai.
```

### ADMIN A19 — `PASS` (user_lookup)

**Q:** Has SIA00299 paid for the Graphic Designing & Video Editing package, and what is its status?

- expected_any: `['pending']`
- matched: `['pending']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `8426`
- db_truth: `pending`

**Reply:**

```
Yes, user **SIA00299** has a record for the **Graphic Designing & Video Editing** package (₹50,000.00), but it is currently in **Pending** status.

Here are the details:
*   **Purchase ID:** 2472
*   **Amount:** ₹50,000.00
*   **Date of Request:** March 18, 2026, 08:47 AM IST
*   **Current Status:** Pending (Not yet active)

Since the status is pending, the package has not yet started generating income. Once the payment is verified or approved by the admin, the status will change to "completed" and commissions will begin.
```

### ADMIN A20 — `PASS` (packages)

**Q:** Which package is the highest priced on SIA and what is its price?

- expected_any: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- matched: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5561`
- db_truth: `Cyber Security & Online Safety-III|2300000.00`

**Reply:**

```
SIA system par sabse mehnga package **Cyber Security & Online Safety-III** hai, jiski price **₹23,00,000** hai.
```

### ADMIN A21 — `PASS` (packages)

**Q:** Which package is the cheapest on SIA and what is its price?

- expected_any: `['English Speaking Basic', '2500', '2,500']`
- matched: `['English Speaking Basic', '2500', '2,500']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5576`
- db_truth: `English Speaking Basic -I|2500.00`

**Reply:**

```
SIA system par sabse sasta package **English Speaking Basic -I** hai, jiski price **₹2,500.00** hai.
```

### ADMIN A22 — `PASS` (packages)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15000', '15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `5090`
- db_truth: `15000.00`

**Reply:**

```
The Digital Marketing package is priced at **₹15,000.00**. It is currently an active package in the system.
```

### ADMIN A23 — `PASS` (levels)

**Q:** What is the title of level 0 and level 9 in the level master?

- expected_any: `['Field Worker', 'King']`
- matched: `['Field Worker', 'King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `5321`
- db_truth: `0:Field Worker, 9:King`

**Reply:**

```
The titles for the requested levels in the SIA MLM system are:

*   **Level 0:** Field Worker
*   **Level 9:** King
```

### ADMIN A24 — `PASS` (levels)

**Q:** List the titles for levels 1 through 4 in the SIA MLM level master.

- expected_any: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- matched: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `5798`
- db_truth: `Company Representative, Company City Manager, Company Area Manager, Company District Manager`

**Reply:**

```
The titles for levels 1 through 4 in the SIA MLM system are:

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
- elapsed_ms: `5270`
- db_truth: `SIA00111|45`

**Reply:**

```
Platform par sabse zyada direct referrals **SHAMUAL SHANKAR GADDEKAR** ke hain.

*   **SIA ID:** SIA00111
*   **Direct Referrals Count:** 45
```

### ADMIN A26 — `PASS` (team_metrics)

**Q:** How big is SIA00111's downline (descendants count, excluding self)?

- expected_any: `[]`
- matched: `[]`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6346`
- db_truth: `2325`

**Reply:**

```
User **SIA00111** has a total downline of **2,325** users (descendants).

Here is the breakdown by depth:
*   **Direct Referrals (Level 1):** 45 users
*   **Level 2:** 72 users
*   **Level 3:** 130 users
*   **Level 4:** 235 users
*   **Level 5:** 394 users
*   **Levels 6–16:** 1,449 users

The network extends to a maximum depth of **16 levels**.
```

### ADMIN A27 — `PASS` (concept)

**Q:** Explain what a pending commission row in the database represents and when it gets cleared.

- expected_any: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- matched: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- tool_calls: `[]`
- elapsed_ms: `6981`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, a **pending commission** represents money (specifically **SPOT commission** for Levels 1–9) that an upline user is "entitled" to based on a downline purchase, but cannot yet receive because they haven't met the specific level eligibility requirements.

Here is a breakdown of what these rows represent and how they are handled:

### What it represents
*   **Qualified Earnings on Hold:** When a user in your downline buys a package, the system checks if you (the upline) are eligible for the commission at that specific level (e.g., Level 3 requirements). 
*   **SPOT Only:** Currently, the system only uses the `pending_commissions` table for SPOT income. MONTHLY royalty is calculated dynamically and does not go into a pending state.
*   **Database Entry:** These are stored …
```

### ADMIN A28 — `PASS` (concept)

**Q:** Walk me through the lifecycle of a withdrawal request from creation to approval/rejection.

- expected_any: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- matched: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `12244`
- db_truth: `concept`

**Reply:**

```
The lifecycle of a withdrawal request in the SIA system follows a structured path from submission to final settlement:

### 1. Creation & Validation
When you initiate a withdrawal, the system performs several real-time checks:
*   **KYC Check:** Your KYC status must be **approved**.
*   **Gateways:** The system verifies your **Transaction PIN** and ensures your account isn't marked as `withdrawal_blocked`.
*   **Date & Time:** Unless "Open Mode" is enabled, withdrawals are only allowed on the **10th, 20th, and 30th** of the month between **10:00 AM and 5:00 PM IST**.
*   **Capping (N× Rule):** For SPOT and Team Royalty, the request must fit within your remaining withdrawal limit (typically 7× your package value).
*   **Balance & Holds:** The system subtracts any "locked" amounts (like the  …
```

### ADMIN A29 — `PASS` (concept)

**Q:** What is the difference between purchases and pending_commissions tables in this system?

- expected_any: `['purchase', 'package', 'commission', 'pending', 'level']`
- matched: `['purchase', 'package', 'commission', 'pending', 'level']`
- tool_calls: `[]`
- elapsed_ms: `7019`
- db_truth: `concept`

**Reply:**

```
The difference between the **purchases** and **pending_commissions** tables lies in their purpose within the transaction lifecycle:

*   **purchases**: This is the core sales table. It records every time a user buys, renews, or upgrades an education package (e.g., English Speaking, Digital Marketing).
    *   It tracks the `amount` paid, the `status` (completed/pending), and the `income` generated by that specific package to enforce the **2x income rule**.
    *   Every purchase is a "source" event that triggers the commission engine.

*   **pending_commissions**: This is a temporary "holding area" for earnings. When a purchase occurs, the system calculates commissions for the upline. If an upline member is not yet eligible for a certain level (due to business requirements), their **SPOT c …
```

### ADMIN A30 — `PASS` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `['closure', 'ancestor', 'descendant', 'depth']`
- tool_calls: `[]`
- elapsed_ms: `7303`
- db_truth: `concept`

**Reply:**

```
The **`user_tree_paths`** table is a **closure table** used to store and manage the multi-level hierarchy (tree structure) of the SIA MLM system. Instead of just storing a parent ID, it stores every relationship between any two users in the tree.

Each row represents a specific link between an **ancestor** (upline) and a **descendant** (downline):

*   **`ancestor_id`**: The ID of the user higher up in the tree.
*   **`descendant_id`**: The ID of the user lower down in the tree.
*   **`depth`**: The number of levels between them.

### What each row means:
*   **Depth 0**: A self-reference row (e.g., User A is an ancestor of User A). Every user has exactly one row with depth 0.
*   **Depth 1**: A direct relationship. The ancestor is the immediate **Sponsor** (referrer) of the descendant.
*  …
```

### ADMIN A31 — `PASS` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `['main', 'spot', 'team royalty', 'balance']`
- tool_calls: `[]`
- elapsed_ms: `7151`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein user ke liye **char (4)** tarah ke wallet buckets hote hain, jo `user_balances` table mein maintain kiye jaate hain:

1.  **Spot Wallet (`spot_balance`):**
    *   **Source:** Isme saara **SPOT income** (downline purchase par milne wala immediate commission) credit hota hai.
    *   **Withdrawal:** Isse `withdraw_type = "spot"` ke roop mein withdraw kiya jaata hai.
    *   **Rule:** Har credit par **10-day hold** hota hai, yaani paisa aane ke 10 din baad hi withdrawable banta hai.

2.  **Main/Other Wallet (`other_balance`):**
    *   **Source:** Isme aapka **SELF ROI**, **GLOBAL_HELPING** income, aur Admin adjustments aate hain.
    *   **Withdrawal:** Isse `withdraw_type = "wallet"` ke roop mein withdraw kiya jaata hai.
    *   **Rule:** Reinvestment packages par isme  …
```

### ADMIN A32 — `PASS` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `['disqualified', 'commission', 'income']`
- tool_calls: `[]`
- elapsed_ms: `6473`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein, jab kisi user ka `is_disqualified` status **true** hota hai, toh iska matlab hai ki woh user platform ke commission engine se bahar ho gaya hai. Iske baare mein kuch zaroori baate niche di gayi hain:

*   **Kyu hota hai?**: Jab kisi user ke paas **21 dino tak** koi bhi active package nahi rehta (yaani uske saare packages 2x income limit touch kar chuke hain aur usne naya package buy nahi kiya), toh system use automatically disqualified mark kar deta hai.
*   **Income par asar**: Disqualified users ko **SPOT** ya **MONTHLY** commissions nahi milte. Agar koi downline user purchase karta hai, toh disqualified upline ko skip kar diya jata hai.
*   **Pending Commissions**: Disqualification ke waqt user ke jitne bhi `pending_commissions` hote hain, woh delete kar diye jaate  …
```

### ADMIN A33 — `PASS` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `7974`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein kai important automated (cron) jobs chalte hain jo commissions aur system health maintain karte hain:

*   **Daily Commission Job (06:22 AM IST):** Yeh job har active purchase ke liye SELF, GLOBAL_HELPING aur MONTHLY commissions compute aur credit karta hai.
*   **Eligibility Check (06:25 AM IST):** Sabhi users ki level eligibility recompute karta hai aur qualified users ke pending SPOT commissions release karta hai.
*   **Purchase Commission (Immediate):** Jab bhi koi naya purchase complete hota hai, yeh job turant upline SPOT commissions aur Level 0 (direct) commissions process karta hai.
*   **Database Backup (05:00 AM IST):** Rozana poore database ka backup Bunny Storage par upload kiya jata hai.
*   **Disqualification Check:** Yeh job un users ko check aur mark kar …
```

### ADMIN A34 — `PASS` (concept)

**Q:** Explain what the legacy_activation_history and legacy_spot_history tables are used for.

- expected_any: `['legacy', 'history', 'old', 'spot', 'activation']`
- matched: `['legacy', 'history', 'old', 'spot', 'activation']`
- tool_calls: `[]`
- elapsed_ms: `4401`
- db_truth: `concept`

**Reply:**

```
Legacy tables in the SIA MLM system are used to store data imported from the old system (pre-December 2025). These tables are **read-only** and do not trigger any new commissions or eligibility recomputations.

*   **legacy_activation_history**: Contains records of package activations and recharges from the previous system. This data is used for admin reporting and to provide users with a historical "Activation History" on their dashboard.
*   **legacy_spot_history**: Stores historical SPOT income credits. It allows users to view their past SPOT earnings and helps admins perform reconciliation between the old records and the new ledger system.
```

### ADMIN A35 — `PASS` (concept)

**Q:** Can an admin manually adjust a user's wallet, and if yes, where is that recorded?

- expected_any: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- matched: `['admin', 'adjust', 'wallet', 'ledger']`
- tool_calls: `[]`
- elapsed_ms: `5020`
- db_truth: `concept`

**Reply:**

```
Yes, an admin can manually adjust a user's wallet balance (add or subtract funds). This is typically used for corrections, bonuses, or migration adjustments.

**Where it is recorded:**
*   **Ledger entries:** Every adjustment creates a row in the `ledger_entries` table with the commission type **`ADMIN_OPS`**. The metadata includes the reason for the adjustment and which specific wallet was affected.
*   **Audit logs:** The action is also recorded in the **`admin_activity_logs`** table, which tracks the admin's ID, the timestamp, the reason provided, and their IP address.

**Wallet options:**
Admins can target any of the three sub-wallets:
*   `other_balance` (Main Wallet)
*   `spot_balance`
*   `team_royalty_balance`
```

### ADMIN A36 — `PASS` (leaderboard)

**Q:** Top 3 referrers kaun hain — kis user ke sabse zyada direct referrals hain?

- expected_any: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- matched: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- tool_calls: `['getTopReferrers']`
- elapsed_ms: `5364`
- db_truth: `SIA00111=45,SIA01430=35,SIA01699=33`

**Reply:**

```
SIA system ke top 3 referrers ye hain:

*   **SHAMUAL SHANKAR GADDEKAR** (SIA00111) — 45 referrals
*   **Vijaykumar hetramji shahare** (SIA01430) — 35 referrals
*   **Kaivalya Garibdasji Wasnik** (SIA01699) — 33 referrals
```

### ADMIN A37 — `PASS` (kyc_aggregate)

**Q:** Total approved KYC users kitne hain abhi system me?

- expected_any: `['1285', '1,285']`
- matched: `['1285', '1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `6967`
- db_truth: `1285`

**Reply:**

```
Abhi system me total **1,285** users ke KYC approved hain. 

Pure system ka KYC status breakdown ye raha:
*   **Approved:** 1,285
*   **Pending:** 1,473
*   **Rejected:** 44
*   **Submitted:** 5
```

### ADMIN A38 — `PASS` (kyc_aggregate)

**Q:** Total pending KYC users kitne hain?

- expected_any: `['1473', '1,473']`
- matched: `['1473', '1,473']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `6753`
- db_truth: `1473`

**Reply:**

```
System mein total **1,473** users ka KYC status **pending** (incomplete) hai, aur **5** users ne KYC documents **submit** kar diye hain jo approval ke liye waiting mein hain.

Yahan poora breakdown hai:
* **Pending (Incomplete):** 1,473
* **Submitted (Waiting Review):** 5
* **Approved:** 1,285
* **Rejected:** 44

Total users: 2,807
```

### ADMIN A39 — `PASS` (withdrawal_aggregate)

**Q:** Pichhle 30 dino me kitne approved withdrawal requests pass hue aur unka total amount kya hai?

- expected_any: `['937', '5761985', '5,761,985']`
- matched: `['937', '5761985', '5,761,985']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `9723`
- db_truth: `937|5761985.62`

**Reply:**

```
Pichhle 30 dino mein total **937** approved withdrawal requests pass hue hain. Inka kul total amount **₹57,61,985.62** hai.
```

### ADMIN A40 — `PASS` (withdrawal_projection)

**Q:** Admin POV: agle withdrawal date par mere paas approximately kitni amount ki withdrawal demand aa sakti hai (upper bound)?

- expected_any: `['7571367', '7,571,367', '7571']`
- matched: `['7571367', '7,571,367', '7571']`
- tool_calls: `['getAdminProjectedWithdrawalDemand']`
- elapsed_ms: `8595`
- db_truth: `7571367.03`

**Reply:**

```
Agle withdrawal date (30 April 2026) par total withdrawal demand ka upper-bound estimate approximately **₹75,71,367.03** hai.

Iska breakdown niche diya gaya hai:

*   **Next Withdrawal Date:** 30 April 2026 (is din Spot, Main, aur Team Royalty teeno wallets open rahenge).
*   **Total Projected Demand:** ₹75,71,367.03
    *   **Main (Other) Wallet:** ₹61,67,387.31
    *   **SPOT Wallet:** ₹7,71,424.57
    *   **Team Royalty Wallet:** ₹6,32,555.15
*   **Eligible Users:** 1,281 users (jo KYC-approved aur non-blocked hain).

**Note:** Ye ek upper-bound estimate hai, matlab agar har eligible user apna pura balance withdraw karega toh itni demand aa sakti hai. Actual demand usually isse kam hoti hai kyunki users partial amounts withdraw karte hain ya capping rules (10x limit) apply hote hain.
```

### ADMIN A41 — `PASS` (withdrawal_eligible)

**Q:** User SIA00299 ki agle withdrawal date pe eligible withdrawal amount kya hai?

- expected_any: `['46208', '46,208']`
- matched: `['46208', '46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `8748`
- db_truth: `46208.31`

**Reply:**

```
User SIA00299 ka agla withdrawal date **30 April 2026** hai. Us din wo total **₹46,208.31** withdraw karne ke liye eligible hain.

Wallet-wise breakdown kuch is tarah hai:
* **Spot Wallet:** ₹14,850.25
* **Main Wallet (Other):** ₹4,778.24
* **Team Royalty Wallet:** ₹26,579.82

**Note:** 30 tareek ko Spot, Main, aur Team Royalty teeno wallets se withdrawal request daali ja sakti hai. Yaad rakhein ki withdrawal window subah 10:00 baje se shaam 5:00 baje (IST) tak hi open rehti hai.
```

### ADMIN A42 — `PASS` (network)

**Q:** User SIA00299 ka total downline network size kitna hai?

- expected_any: `['1893', '1,893']`
- matched: `['1893', '1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `8845`
- db_truth: `1893`

**Reply:**

```
User SIA00299 ka total downline network size **1,893** hai.

Iska depth-wise breakdown niche diya gaya hai:
* **Direct Referrals (Level 1):** 28
* **Level 2:** 73
* **Level 3:** 188
* **Level 4:** 345
* **Level 5:** 288
* **Level 6-15:** 771

Inka upline depth filhal 5 hai.
```

### ADMIN A43 — `PASS` (network)

**Q:** User SIA00299 ke total kitne direct referrals hain?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `5620`
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
- elapsed_ms: `7063`
- db_truth: `180.00`

**Reply:**

```
User SIA00111 ko ₹7,500 wale **English Speaking-III** package se ab tak total **₹180.00** ki SELF income mili hai. 

Yeh amount 24 entries ka total hai jo unke ledger me credit hua hai.
```

### ADMIN A45 — `PASS` (withdrawal_aggregate)

**Q:** Globally rejected withdrawal requests kitne hain aur unka total amount kya hai?

- expected_any: `['73', '510544', '510,544']`
- matched: `['73', '510544', '510,544']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `8407`
- db_truth: `73|510544.00`

**Reply:**

```
Globally total **73** withdrawal requests rejected hain, jinka total amount **₹5,10,544.00** hai.
```

### ADMIN A46 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets opened hote hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `5898`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30 April 2026** hai.

Us din system ke saare wallets withdrawals ke liye open hote hain:
*   **SPOT wallet**
*   **Main wallet** (Other balance)
*   **Team Royalty wallet**

Yaad rakhein ki withdrawal ka time window subah **10:00 AM se shaam 5:00 PM IST** tak hota hai.
```

### ADMIN A47 — `PASS` (income_compound)

**Q:** User SIA00299 ka pichhle 30 dino me sirf MONTHLY recurring income type ka kitna paisa credit hua?

- expected_any: `['30312', '30,312']`
- matched: `['30312', '30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6136`
- db_truth: `30312.92`

**Reply:**

```
User SIA00299 ko pichhle 30 dino me total **₹30,312.92** ki MONTHLY recurring income credit hui hai. Ye income total 13,326 entries ke zariye unke wallet me aayi hai.
```
