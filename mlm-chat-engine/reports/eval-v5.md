# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T17:21:35
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **95**
- Passed: **85**
- Satisfactory score: **89.47%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 48 | 40 | 83.33% |
| admin | 47 | 45 | 95.74% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| commissions | 2 | 1 | 50.0% |
| concept | 16 | 16 | 100.0% |
| income | 2 | 0 | 0.0% |
| income_compound | 10 | 8 | 80.0% |
| kyc_aggregate | 2 | 2 | 100.0% |
| leaderboard | 1 | 1 | 100.0% |
| levels | 2 | 2 | 100.0% |
| network | 4 | 4 | 100.0% |
| packages | 7 | 7 | 100.0% |
| profile | 5 | 5 | 100.0% |
| purchases | 1 | 1 | 100.0% |
| system | 5 | 5 | 100.0% |
| system_stats | 5 | 5 | 100.0% |
| team | 3 | 3 | 100.0% |
| team_metrics | 2 | 2 | 100.0% |
| user_lookup | 8 | 8 | 100.0% |
| wallet | 5 | 3 | 60.0% |
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
- elapsed_ms: `5254`
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
- elapsed_ms: `5975`
- db_truth: `rahulparwatkar1983@gmail.com|8605099465`

**Reply:**

```
Your registered details are as follows:

*   **Email:** rahulparwatkar1983@gmail.com
*   **Phone Number:** 8605099465
```

### USER U03 — `PASS` (profile)

**Q:** What is my current KYC status?

- expected_any: `['approved', 'verified']`
- matched: `['approved']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `5458`
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
- elapsed_ms: `5412`
- db_truth: `active`

**Reply:**

```
Your account status is **active**.

Here are the details of your profile:
*   **Status:** Active
*   **Withdrawal Blocked:** No (False)
*   **Is Disqualified:** No (False)
*   **KYC Status:** Approved

You are currently at **Level 3** and your profile is in good standing.
```

### USER U05 — `PASS` (profile)

**Q:** Who is my sponsor / referrer user id?

- expected_any: `['92']`
- matched: `['92']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `7056`
- db_truth: `92`

**Reply:**

```
Your sponsor is **SHAMUAL SHANKAR GADDEKAR** (SIA ID: **SIA00111**). Your referrer user ID in the system is **92**.
```

### USER U06 — `PASS` (wallet)

**Q:** What is my main wallet balance right now?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `5731`
- db_truth: `46208.31`

**Reply:**

```
Aapka main wallet balance abhi ₹4,778.24 hai.

Yahan aapke sabhi wallets ki details hain:
*   **Main Wallet (Other):** ₹4,778.24
*   **SPOT Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Balance:** ₹46,208.31
```

### USER U07 — `FAIL` (wallet)

**Q:** Show me all my wallet balances — main, spot, other and team royalty.

- expected_any: `['46208', '14850', '4778', '26579']`
- matched: `[]`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `7447`
- db_truth: `46208.31|14850.25|4778.24|26579.82`

**Reply:**

```
Here are your current wallet balances:

*   **Spot Balance:** ₹14,850.25
*   **Other Balance (Main):** ₹4,778.24
*   **Team Royalty Balance:** ₹26,579.82
*   **Total Balance:** ₹46,208.31

*Last updated on: 25-04-2026*
```

### USER U08 — `PASS` (wallet)

**Q:** What is my spot wallet balance?

- expected_any: `['14850', '14,850']`
- matched: `['14,850']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `13547`
- db_truth: `14850.25`

**Reply:**

```
Your spot wallet balance is:

*   **Spot Wallet:** ₹14,850.25
```

### USER U09 — `PASS` (wallet)

**Q:** What is my team royalty wallet balance?

- expected_any: `['26579', '26,579']`
- matched: `['26,579']`
- tool_calls: `['getWalletSummary']`
- elapsed_ms: `5169`
- db_truth: `26579.82`

**Reply:**

```
Your team royalty wallet balance is **₹26,579.82**.
```

### USER U10 — `PASS` (packages)

**Q:** How many packages have I purchased so far?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `6253`
- db_truth: `4`

**Reply:**

```
आपने अब तक कुल **4** पैकेजेस खरीदे हैं। यहाँ उनका विवरण है:

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
- elapsed_ms: `8303`
- db_truth: `Digital Marketing, English Speaking-III, Graphic Designing & Video Editing, Share Market Learning`

**Reply:**

```
You have purchased the following 4 packages:

*   **English Speaking-III** (Active)
*   **Share Market Learning** (Active)
*   **Graphic Designing & Video Editing** (Pending)
*   **Digital Marketing** (Pending)
```

### USER U12 — `PASS` (packages)

**Q:** Which of my package purchases are still in pending status?

- expected_any: `['Graphic Designing', 'Digital Marketing']`
- matched: `['Graphic Designing', 'Digital Marketing']`
- tool_calls: `['getPendingPurchaseRequests', 'getMyPurchases']`
- elapsed_ms: `11743`
- db_truth: `Graphic Designing & Video Editing, Digital Marketing`

**Reply:**

```
Aapke account mein filhaal 2 package purchases **pending** status mein hain:

*   **Graphic Designing & Video Editing** (₹50,000) - Purchased on 18 March 2026
*   **Digital Marketing** (₹15,000) - Purchased on 30 March 2026

Baki ke 2 packages (English Speaking-III aur Share Market Learning) successfully complete ho chuke hain aur active hain.
```

### USER U13 — `PASS` (packages)

**Q:** What was the price of my Share Market Learning purchase?

- expected_any: `['30000', '30,000']`
- matched: `['30,000']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `6022`
- db_truth: `30000.00`

**Reply:**

```
Your **Share Market Learning** package was purchased for **₹30,000.00**.

Here are the details of that purchase:
*   **Purchase Date:** 27 Feb 2026
*   **Status:** Completed (Active)
*   **Amount Paid:** ₹30,000.00
```

### USER U14 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have I raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5825`
- db_truth: `33`

**Reply:**

```
आपने कुल मिलाकर **33 withdrawal requests** डाली हैं।

आपका रिकॉर्ड इस प्रकार है:
* **Total Requests:** 33
* **Total Amount:** ₹3,26,090.00
* **Status:** आपके सभी 33 requests **approved** हो चुके हैं।
```

### USER U15 — `PASS` (withdrawals)

**Q:** Do I currently have any pending withdrawal requests?

- expected_any: `['0', 'no', 'none', 'do not have any']`
- matched: `['0', 'no']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6029`
- db_truth: `0`

**Reply:**

```
No, currently aapka koi bhi withdrawal request **pending** nahi hai. Aapke sabhi 33 requests (Total: ₹3,26,090.00) successfully **approve** ho chuke hain.
```

### USER U16 — `FAIL` (withdrawals)

**Q:** How many of my withdrawal requests have been approved so far?

- expected_any: `['32']`
- matched: `[]`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5800`
- db_truth: `33`

**Reply:**

```
Aapke ab tak total **33** withdrawal requests approve ho chuke hain, jinka total amount **₹3,26,090.00** hai.
```

### USER U17 — `FAIL` (withdrawals)

**Q:** What is the total approved withdrawal amount across all my requests?

- expected_any: `['192', '193', '194']`
- matched: `[]`
- tool_calls: `['getUserWithdrawals']`
- elapsed_ms: `20295`
- db_truth: `326090.00`

**Reply:**

```
Across your request history, you have a total of **33 approved withdrawals**.

The total approved amount is **₹3,26,090.00**.

Here is a quick summary of your withdrawals by type:
*   **Spot Wallet:** ₹1,34,517.00 (20 requests)
*   **Main Wallet (Other):** ₹1,44,896.00 (12 requests)
*   **Team Royalty Wallet:** ₹46,677.00 (1 request)
```

### USER U18 — `FAIL` (income)

**Q:** What is the total credit amount I have received in my wallet so far (sum of positive wallet transactions)?

- expected_any: `['204567', '204,567']`
- matched: `[]`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `11174`
- db_truth: `204567.31`

**Reply:**

```
Your total wallet credit amount so far (sum of your major income categories) is **₹2,04,467.31**.

Here is the breakdown of the credits received:
*   **SPOT Income:** ₹82,856.25
*   **MONTHLY Royalty:** ₹1,12,327.78
*   **GLOBAL HELPING:** ₹6,075.98
*   **SELF Income:** ₹3,207.30

Note: Your account also shows **ADMIN_OPS** entries totaling **-₹29,014.19** (which are typically debits or adjustments), bringing your net income across these categories to ₹1,75,453.12.
```

### USER U19 — `FAIL` (income)

**Q:** Roughly how many wallet transactions are recorded against my account?

- expected_any: `['56714', '56,714', '56000', '57000']`
- matched: `[]`
- tool_calls: `['getUserTransactions', 'getUserTransactions', 'getUserTransactions', 'getUserTransactions']`
- elapsed_ms: `37623`
- db_truth: `56714`

**Reply:**

```
Based on the information available, there is 1 wallet transaction recorded against your account.
```

### USER U20 — `PASS` (team)

**Q:** How many direct referrals (direct legs) do I have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `4802`
- db_truth: `28`

**Reply:**

```
You have a total of **28 direct referrals** (direct legs) in your network.
```

### USER U21 — `PASS` (team)

**Q:** What is my total downline size (across all levels, excluding myself)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6510`
- db_truth: `1893`

**Reply:**

```
Aapka total downline size **1,893** members hai (aapko chhodkar). 

Iska breakdown kuch is tarah hai:
* **Direct Referrals (Level 1):** 28 members
* **Total Depth:** 15 levels tak aapka network faila hua hai.
* **Upline Depth:** Aapke upar system mein 5 levels hain.
```

### USER U22 — `PASS` (team)

**Q:** How deep does my upline chain go (number of ancestors above me)?

- expected_any: `['5']`
- matched: `['5']`
- tool_calls: `['getUserProfile', 'getNetworkSize']`
- elapsed_ms: `12080`
- db_truth: `5`

**Reply:**

```
Your upline chain goes **5 levels** deep. This means there are 5 ancestors above you in the system, starting from your direct sponsor, **SHAMUAL SHANKAR GADDEKAR (SIA00111)**, up to the system's root user.
```

### USER U23 — `FAIL` (commissions)

**Q:** How many pending commission entries are recorded for me as the receiver?

- expected_any: `['991']`
- matched: `[]`
- tool_calls: `['getPendingCommissions']`
- elapsed_ms: `24790`
- db_truth: `991`

**Reply:**

```
Based on your pending commissions records, there are **200 entries** currently waiting to be released.

All of these are **SPOT commissions** that are being held because you have not yet qualified for the required levels (predominantly Levels 4 through 8). These commissions will be automatically credited to your wallet once you meet the eligibility criteria for the respective levels.

The pending amounts in your record range from small commissions of ₹12.50 up to larger single entries of ₹22,000.00.
```

### USER U24 — `PASS` (system)

**Q:** How many packages does the SIA platform offer in total?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `19677`
- db_truth: `13`

**Reply:**

```
SIA platform par total **13 packages** available hain, jisme se **10 active** hain aur **3 inactive** hain. In packages ki kimat ₹2,500 se lekar ₹23,00,000 tak hai.
```

### USER U25 — `PASS` (system)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `7016`
- db_truth: `15000.00`

**Reply:**

```
Digital Marketing package ki price **₹15,000.00** hai.
```

### USER U26 — `PASS` (system)

**Q:** What is the price of the highest tier package on SIA?

- expected_any: `['2300000', '23,00,000', '2,300,000']`
- matched: `['23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6643`
- db_truth: `7500.00`

**Reply:**

```
SIA system mein sabse bada package **Cyber Security & Online Safety-III** hai. Iska price **₹23,00,000.00** hai.

Is package ke mukhya benefits ye hain:
* **SELF ROI:** 7.0% per month
* **Global IDs:** 57,000
* **Direct Monthly Royalty:** 1.0%
* **Direct SPOT:** 5%
```

### USER U27 — `PASS` (system)

**Q:** How many MLM levels are configured in the system?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `6825`
- db_truth: `10`

**Reply:**

```
The SIA MLM system is configured with a total of **10 levels** (ranging from Level 0 to Level 9). Here is the breakdown:

*   **Level 0:** Field Worker (Direct level)
*   **Level 1:** Company Representative
*   **Level 2:** Company City Manager
*   **Level 3:** Company Area Manager
*   **Level 4:** Company District Manager
*   **Level 5:** Division Manager
*   **Level 6:** Regional Manager
*   **Level 7:** State Manager
*   **Level 8:** National Manager
*   **Level 9:** King

Each level has specific business requirements (total team business and leg counts) and associated rewards, such as a T-shirt, 5G Mobile, Laptop, or even Land/Flat in Secure City.
```

### USER U28 — `PASS` (system)

**Q:** What is the title of the highest level in SIA MLM?

- expected_any: `['King']`
- matched: `['King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `5231`
- db_truth: `King`

**Reply:**

```
SIA MLM system mein sabse highest level (Level 9) ka title **"King"** hai.
```

### USER U29 — `PASS` (concept)

**Q:** Briefly explain the difference between upline and downline in SIA MLM.

- expected_any: `['upline', 'downline', 'ancestor', 'descendant', 'sponsor', 'referrer']`
- matched: `['upline', 'downline', 'sponsor']`
- tool_calls: `[]`
- elapsed_ms: `5913`
- db_truth: `concept`

**Reply:**

```
SIA MLM mein **Upline** aur **Downline** ka matlab ye hai:

*   **Downline:** Ye wo log hote hain jo aapke referral link se ya aapke team members ke referral se join karte hain. Aapke niche jitne bhi log depth 1 se depth 9 tak aate hain, wo aapka downline team bante hain. Aapko inki purchases par SPOT aur MONTHLY commissions milte hain.
*   **Upline:** Ye wo log hote hain jo aapke upar hain (aapka sponsor, unka sponsor, aur aise hi upar tak 9 levels). Jab aap koi package buy karte hain, toh aapke upline ko commissions distribute hote hain.

Aapka poora network **Closure Table** ke zariye manage kiya jata hai, jisme aap apne poore downline ka size aur business dekh sakte hain.
```

### USER U30 — `PASS` (concept)

**Q:** What are the different types of wallets in SIA MLM and what does each one represent?

- expected_any: `['main', 'spot', 'team royalty', 'wallet']`
- matched: `['main', 'spot', 'team royalty', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `6531`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein basically teen main types ke wallets hote hain jo aapki alag-alag earnings aur transactions ko manage karte hain:

*   **SPOT Wallet (`spot_balance`):** Isme aapka "Spot Income" jama hota hai, jo aapko apne downline ki har nayi purchase par milta hai. Har credit par typically 10 din ka hold rehta hai.
*   **Main Wallet (`other_balance`):** Isse "Other Wallet" bhi kehte hain. Isme aapka apna package ROI (**SELF income**) aur **GLOBAL_HELPING** income aati hai. Platform ke zyada-tar fees aur P2P transfers isi wallet se manage hote hain.
*   **Team Royalty Wallet (`team_royalty_balance`):** Isme aapka **MONTHLY** team royalty commission jama hota hai jo aapko aapke network se milta hai.
*   **Total Balance:** Yeh upar diye gaye teeno wallets ka kul (sum) total hota hai.

A …
```

### USER U31 — `PASS` (concept)

**Q:** How does direct commission get calculated when someone in my downline buys a package?

- expected_any: `['direct', 'commission', 'package', 'level']`
- matched: `['direct', 'commission', 'package', 'level']`
- tool_calls: `[]`
- elapsed_ms: `6959`
- db_truth: `concept`

**Reply:**

```
Direct commission (Level 0) is earned by the direct sponsor when someone they referred buys a package. It consists of two parts:

*   **Direct SPOT Commission:** This is a one-time payment of **5%** of the package price, credited immediately at the time of purchase.
*   **Direct MONTHLY Royalty:** This is a recurring monthly income based on the package price:
    *   **0.5%** per month for packages up to ₹3,00,000.
    *   **1.0%** per month for packages of ₹5,00,000 and above.
    *   This amount is prorated and credited daily to your Team Royalty wallet.

**Important Rules:**
*   **Active Status:** You must have an active package (one that hasn't reached its 2x income limit) to receive these commissions.
*   **No Reinvestment Cut:** Unlike Level 1–9 commissions, the direct commission (Le …
```

### USER U32 — `PASS` (concept)

**Q:** What is the typical end-to-end flow when I raise a withdrawal request?

- expected_any: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- matched: `['withdraw', 'request', 'admin', 'approve', 'pending']`
- tool_calls: `[]`
- elapsed_ms: `7969`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein withdrawal request ka end-to-end flow kuch is tarah hota hai:

1.  **Request Submission:** Aap apne dashboard se withdrawal request raise karte hain jisme Amount, Wallet type (Spot, Main, ya Team Royalty), Payment method, aur Transaction PIN enter karna hota hai.
2.  **System Validation:** System check karta hai ki aapka KYC approved hai, transaction PIN sahi hai, withdrawal block toh nahi hai, aur aapke wallet mein sufficient "available" balance hai (holds aur capping ko exclude karke).
3.  **Pending Status:** Validation ke baad aapki request "Pending" state mein chali jaati hai. Is waqt aapke wallet se paise deduct nahi hote.
4.  **Admin Review:** SIA admin team aapki request ko review karti hai.
5.  **Approval aur Payout:** Admin approval ke baad, paise aapke bank ac …
```

### USER U33 — `PASS` (concept)

**Q:** What does a P2P transfer mean and which wallet does it use?

- expected_any: `['p2p', 'transfer', 'wallet']`
- matched: `['p2p', 'transfer', 'wallet']`
- tool_calls: `[]`
- elapsed_ms: `5341`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein **P2P (Peer-to-Peer) Transfer** ka matlab hai ek user se doosre user ko paise bhejna. Iske kuch mukhya points niche diye gaye hain:

*   **Wallet:** Yeh transfer hamesha aapke **Main Wallet (`other_balance`)** se hota hai. SPOT wallet se P2P transfer allowed nahi hai.
*   **Fees:** Sender (bhejne wale) ko **3% tax** dena hota hai jo transfer amount ke upar se deduct hota hai. Receiver ko pura amount milta hai.
*   **Requirements:** Sender aur Receiver dono ka **KYC Approved** hona zaruri hai.
*   **Limits:** Minimum transfer ₹100 hai aur maximum ₹9,999.96 tak ho sakta hai.
*   **Security:** Transfer karne ke liye aapko apna **Transaction PIN** enter karna hoga.

Paise receive karne wale user ko aap unki SIA ID (e.g., SIA00299), Email, ya User ID ke zariye dhund sakte ha …
```

### USER U34 — `PASS` (concept)

**Q:** Why do I need KYC and what happens if my KYC is not approved?

- expected_any: `['kyc', 'verification', 'approved', 'withdraw']`
- matched: `['kyc', 'approved', 'withdraw']`
- tool_calls: `[]`
- elapsed_ms: `9003`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein **KYC (Know Your Customer)** mandatory hai aur iske peeche main reasons aur rules ye hain:

**KYC Kyun Zaroori Hai?**
*   **Withdrawals:** Bina approved KYC ke aap apne wallet se paise bank ya UPI mein withdraw nahi kar sakte.
*   **P2P Transfers:** Doosre users se funds receive karne ke liye KYC approved hona zaroori hai.
*   **Security:** Ye aapki identity aur bank details ko verify karne ke liye hota hai taaki transactions secure rahein.

**Agar KYC Approved Nahi Hai toh Kya Hoga?**
*   **Withdrawal Blocked:** Aap withdrawal request nahi laga payenge.
*   **P2P Restriction:** Aap kisi se P2P transfer receive nahi kar payenge.
*   **Status:** Jab tak admin ise approve nahi karta, aapka status "submitted" ya "pending" rahega. Agar "reject" hota hai, toh aapko rejection …
```

### USER U35 — `PASS` (concept)

**Q:** How can I increase my level in the SIA MLM hierarchy — what is required?

- expected_any: `['level', 'business', 'team', 'requirement', 'leg']`
- matched: `['level', 'business', 'team', 'requirement', 'leg']`
- tool_calls: `['getAllLevels', 'getUserLevelProgress']`
- elapsed_ms: `17553`
- db_truth: `concept`

**Reply:**

```
SIA MLM hierarchy mein aapka level badhane ke liye aapko primarily teen cheezon par focus karna hota hai: total team business, number of qualifying legs, aur har qualifying leg ka minimum business requirement.

Aapka current status aur agle level ki details niche di gayi hain:

*   **Current Level:** Level 3 (Company Area Manager)
*   **Next Level:** Level 4 (Company District Manager)
*   **Requirement for Level 4:**
    *   **Total Team Business:** ₹2,32,86,000
    *   **Required Qualifying Legs:** 3 legs
    *   **Min Business per Leg:** ₹77,62,000
    *   **Reward:** Motorcycle 🏍️

**Aapka Progress Analysis:**
*   Aapka **Total Team Business (₹4,38,97,500)** requirement se kaafi zyada hai, toh ye condition already complete hai.
*   Aapke paas filhaal **2 qualifying legs** hain (Leg 281  …
```

### USER U36 — `PASS` (income_compound)

**Q:** Mere 7500 wala English Speaking-III (package id 2) me pichhle 5 dino kitna SELF + GLOBAL income aaya hai?

- expected_any: `['197.50', '197.5', '197']`
- matched: `['197.50', '197.5', '197']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7796`
- db_truth: `197.50`

**Reply:**

```
Aapke ₹7,500 wale English Speaking-III package me pichhle 5 dino ka total income **₹197.50** aaya hai.

Breakdown:
*   **SELF Income:** ₹37.50
*   **GLOBAL_HELPING Income:** ₹160.00
```

### USER U37 — `PASS` (income_compound)

**Q:** Pichhle 5 dino me mera total SELF + GLOBAL income kitna hai across all packages?

- expected_any: `['752.70', '752.7', '752']`
- matched: `['752.70', '752.7', '752']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `7252`
- db_truth: `752.70`

**Reply:**

```
Pichhle 5 dino me aapka total SELF aur GLOBAL income ₹752.70 hai. Iska breakdown niche diya gaya hai:

*   **SELF Income:** ₹237.50
*   **GLOBAL HELPING Income:** ₹515.20
*   **Total Amount:** ₹752.70

Yeh income total 20 transactions (10 SELF aur 10 GLOBAL HELPING) se aayi hai.
```

### USER U38 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets allowed hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `7481`
- db_truth: `logic_check`

**Reply:**

```
Aapka agla withdrawal date **30 April 2026** hai. 

Us din niche diye gaye sabhi wallets se withdrawal allowed hai:
* **SPOT Wallet**
* **Other (Main) Wallet**
* **Team Royalty Wallet**

SIA system ke rule ke mutabiq, har mahine ki 30 tarikh (February mein 28) ko saare wallets open hote hain. Withdrawal requests subah 10:00 AM se shaam 5:00 PM (IST) ke beech daali ja sakti hain.
```

### USER U39 — `PASS` (withdrawal_eligible)

**Q:** Agle withdrawal date pe main exactly kitna amount apply / withdraw kar sakta hu?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `12140`
- db_truth: `46208.31`

**Reply:**

```
Agle withdrawal date **30 April 2026** hai. Is din aapke teeno wallets (SPOT, Main/Other, aur Team Royalty) open rahenge.

Aapka total eligible amount **₹46,208.31** hai. Iska breakdown niche diya gaya hai:

*   **SPOT Wallet:** ₹14,850.25
*   **Main (Other) Wallet:** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Amount:** ₹46,208.31

**Kuch zaruri baatein:**
*   Withdrawal ka samay **10:00 AM se 5:00 PM (IST)** ke bich hi rahega.
*   Ye amount aapki 7x capping (Spot + Team Royalty limit) aur ₹30 processing fee ke hisaab se final process hoga.
*   Aapka KYC approved hona chahiye aur Transaction PIN zaruri hai.
```

### USER U40 — `PASS` (withdrawal_counts)

**Q:** Mere ab tak kitne withdrawal requests approved aur kitne rejected hue hain?

- expected_any: `['33', 'approved']`
- matched: `['33', 'approved']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5975`
- db_truth: `approved=33`

**Reply:**

```
Aapke ab tak ke withdrawal requests ki jaankari niche di gayi hai:

*   **Approved:** 33
*   **Rejected:** 0
*   **Total Amount (Approved):** ₹3,26,090.00

Aapka koi bhi withdrawal request abhi tak reject nahi hua hai.
```

### USER U41 — `PASS` (network)

**Q:** Mera total downline network kitna bada hai (sab depths milake)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `8997`
- db_truth: `1893`

**Reply:**

```
Aapka total downline network **1,893** members ka hai (saari depths ko milakar).

Depth-wise breakdown kuch is tarah hai:
* **Direct Referrals (Level 1):** 28 members
* **Level 2:** 73 members
* **Level 3:** 188 members
* **Level 4:** 345 members
* **Level 5 se 15:** 1,259 members

Aapka network total 15 levels tak phaila hua hai.
```

### USER U42 — `PASS` (network)

**Q:** Mere kitne direct referrals hain (level-1 wale)?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `29366`
- db_truth: `28`

**Reply:**

```
Aapke total **28** direct referrals hain (Level-1 members).
```

### USER U43 — `PASS` (income_compound)

**Q:** Pichhle 30 dino me total MONTHLY recurring income kitna mila hai?

- expected_any: `['30312', '30,312']`
- matched: `['30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `24789`
- db_truth: `30312.92`

**Reply:**

```
Pichhle 30 dino me aapka total **MONTHLY** recurring income **₹30,312.92** raha hai. 

Ye income total 13,326 small daily credits se milkar bani hai jo aapke team members ke active packages se daily basis par credit hui hai.
```

### USER U44 — `FAIL` (income_compound)

**Q:** Pichhle 30 dino me total SPOT income kitni aayi?

- expected_any: `['29118', '29,118']`
- matched: `[]`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `6622`
- db_truth: `19118.75`

**Reply:**

```
Pichhle 30 dino me aapki total SPOT income **₹19,118.75** aayi hai (isame total 30 transactions hain).
```

### USER U45 — `PASS` (income_compound)

**Q:** Mere 2500 wale package (English Speaking Basic-I, package id 1) se ab tak total kitni income aayi hai (lifetime)?

- expected_any: `['7244', '7,244']`
- matched: `['7,244']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `12673`
- db_truth: `7244.95`

**Reply:**

```
Aapke ₹2,500 wale English Speaking Basic-I package (Package ID: 1) se ab tak total **₹7,244.95** ki income aayi hai.

Iska breakdown is tarah hai:
* **SPOT Income:** ₹2,193.75
* **Team Royalty (MONTHLY):** ₹5,166.14
* **Admin Adjustments (Net):** -₹114.94

Note: Ye aapki is package category se judi lifetime aggregate income hai.
```

### USER U46 — `PASS` (income_compound)

**Q:** Pichhle 7 din ka mera net income (saare types ka sum) kitna hai?

- expected_any: `['5275', '5,275']`
- matched: `['5,275']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `8908`
- db_truth: `5275.79`

**Reply:**

```
Pichhle 7 dino ka aapka total net income **₹5,275.79** hai.

Iska breakdown ye raha:
* **MONTHLY:** ₹7,610.94
* **GLOBAL_HELPING:** ₹713.60
* **SPOT:** ₹643.75
* **SELF:** ₹332.50
* **FEE_DEDUCTION:** -₹4,025.00 (debit)

Aapka total gross income ₹9,300.79 tha, jisme se fees katne ke baad net amount ₹5,275.79 banti hai.
```

### USER U47 — `FAIL` (income_compound)

**Q:** Is mahine (April 2026) ki MONTHLY recurring income kitni mili hai abhi tak?

- expected_any: `['25588', '25,588']`
- matched: `[]`
- error: `llm_failed`
- tool_calls: `[]`
- elapsed_ms: `3846`
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
- elapsed_ms: `6585`
- db_truth: `8887.50`

**Reply:**

```
Aapke English Speaking-III (Package ID 2) se lifetime total **₹8,887.50** ka SPOT income mila hai. Yeh amount total 58 entries ke zariye credit hua hai.
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `5955`
- db_truth: `2807`

**Reply:**

```
SIA platform par abhi tak total **2,807** users registered hain. Inme se **2,803** users active status mein hain.
```

### ADMIN A02 — `PASS` (system_stats)

**Q:** How many active (non-blocked) users are there in the system?

- expected_any: `['2803', '2,803']`
- matched: `['2,803']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `7183`
- db_truth: `2803`

**Reply:**

```
System mein total **2,803 active users** hain (jin ke paas active course/package hai).

Puri system ki summary yeh rahi:
*   **Total Users:** 2,807
*   **Active Users:** 2,803
*   **Active Purchases:** 2,141
*   **Total Payouts:** ₹60,85,000.24
```

### ADMIN A03 — `PASS` (system_stats)

**Q:** How many users have an approved KYC status?

- expected_any: `['1285', '1,285']`
- matched: `['1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `7399`
- db_truth: `1285`

**Reply:**

```
System mein total **1,285** users ka KYC status **approved** hai.

Yahan KYC status ka breakdown hai:
*   **Approved:** 1,285
*   **Pending:** 1,473
*   **Rejected:** 44
*   **Submitted:** 5

Total users ki sankhya **2,807** hai.
```

### ADMIN A04 — `PASS` (system_stats)

**Q:** How many MLM packages are currently configured?

- expected_any: `['13']`
- matched: `['13']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6308`
- db_truth: `13`

**Reply:**

```
System mein total **13 packages** configured hain. Inmein se **10 packages active** hain aur **3 packages inactive** status par hain.

Active packages ki list niche di gayi hai:
*   English Speaking Basic -I (₹2,500)
*   English Speaking-III (₹7,500)
*   Digital Marketing (₹15,000)
*   Share Market Learning (₹30,000)
*   Graphic Designing & Video Editing (₹50,000)
*   Personality Development + Financial Planning (₹1,00,000)
*   Artificial Intelligence (₹3,00,000)
*   Cyber Security & Online Safety (₹5,00,000)
*   Cyber Security & Online Safety-II (₹11,00,000)
*   Cyber Security & Online Safety-III (₹23,00,000)
```

### ADMIN A05 — `PASS` (system_stats)

**Q:** How many levels are defined in the level master table?

- expected_any: `['10']`
- matched: `['10']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `6504`
- db_truth: `10`

**Reply:**

```
SIA MLM system mein total **10 levels** defined hain (Level 0 se Level 9 tak):

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
```

### ADMIN A06 — `PASS` (withdrawals)

**Q:** How many withdrawal requests are sitting in the pending bucket right now?

- expected_any: `['0', 'no', 'none']`
- matched: `['0']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `7389`
- db_truth: `0`

**Reply:**

```
Abhi system mein ek bhi withdrawal request **pending** nahi hai. 

Saari requests process ho chuki hain:
*   **Total requests:** 5,125
*   **Approved:** 5,052 (₹3,05,34,304.83)
*   **Rejected:** 73 (₹5,10,544.00)
*   **Pending:** 0
```

### ADMIN A07 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been approved across the platform till date?

- expected_any: `['5052', '5,052']`
- matched: `['5,052']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6071`
- db_truth: `5052`

**Reply:**

```
Across the platform, a total of **5,052** withdrawal requests have been approved to date. The total amount disbursed for these requests is **₹3,05,34,304.83**.
```

### ADMIN A08 — `PASS` (withdrawals)

**Q:** How many withdrawal requests have been rejected so far?

- expected_any: `['73']`
- matched: `['73']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5122`
- db_truth: `73`

**Reply:**

```
Ab tak system mein total **73 withdrawal requests** reject hui hain, jinka total amount ₹5,10,544.00 hai.
```

### ADMIN A09 — `PASS` (purchases)

**Q:** How many package purchases (rows in purchases) exist in the database?

- expected_any: `['2838', '2,838']`
- matched: `['2,838']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `11335`
- db_truth: `2838`

**Reply:**

```
Database mein total **2,838** package purchase records (rows) hain. Inme se **2,141** purchases abhi active status mein hain.
```

### ADMIN A10 — `PASS` (commissions)

**Q:** How many pending commission entries are sitting in the system in total?

- expected_any: `['13636', '13,636']`
- matched: `['13,636']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `11750`
- db_truth: `13636`

**Reply:**

```
System knowledge base ke mutabik, SIA system mein total **13,636 pending commission entries** (SPOT commissions) record ki gayi hain. 

Ye wo commissions hain jo uplines ko tab credit hongi jab wo apni respective level eligibility qualify kar lenge. Daily eligibility cron job in entries ko process karke qualify hone wale users ko release karta hai.
```

### ADMIN A11 — `FAIL` (wallet)

**Q:** How many wallet transaction rows exist across all users (rough magnitude is fine)?

- expected_any: `['893336', '893,336', '893']`
- matched: `[]`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `6938`
- db_truth: `893336`

**Reply:**

```
SIA system mein wallet transaction rows ki rough magnitude lagbhag **8,94,000** hai. 

Yeh data system ke `ledger_entries` aur `wallet_transactions` tables se aata hai, jo har ek credit aur debit ko track karte hain.
```

### ADMIN A12 — `PASS` (user_lookup)

**Q:** Pull profile details for SIA00299 — name, email, phone, status.

- expected_any: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- matched: `['SIA00299', 'RAHUL', 'rahulparwatkar1983', '8605099465']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `6885`
- db_truth: `SIA00299|RAHUL PARWATKAR|rahulparwatkar1983@gmail.com|8605099465|active`

**Reply:**

```
User SIA00299 ki profile details niche di gayi hain:

*   **Name:** RAHUL PARWATKAR
*   **Email:** rahulparwatkar1983@gmail.com
*   **Phone:** 8605099465
*   **Status:** active
*   **KYC Status:** approved
*   **Sponsor:** SHAMUAL SHANKAR GADDEKAR (SIA00111)
*   **Current Level:** 3 (Company Area Manager)
```

### ADMIN A13 — `PASS` (user_lookup)

**Q:** What is the KYC status of user SIA00299?

- expected_any: `['approved']`
- matched: `['approved']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `8803`
- db_truth: `approved`

**Reply:**

```
User SIA00299 (RAHUL PARWATKAR) ka KYC status **approved** hai.
```

### ADMIN A14 — `PASS` (user_lookup)

**Q:** How many direct referrals does SIA00299 have?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `19024`
- db_truth: `28`

**Reply:**

```
User SIA00299 has a total of **28 direct referrals**.
```

### ADMIN A15 — `PASS` (user_lookup)

**Q:** What is the total downline size of SIA00299 (excluding the user himself)?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `15161`
- db_truth: `1893`

**Reply:**

```
SIA00299 ka total downline size **1,893** hai (aapko chhod kar).

Aapke network ka breakdown is tarah hai:
*   **Direct Referrals (Depth 1):** 28 users
*   **Total depth:** 15 levels tak aapka network faila hua hai.
*   **Upline position:** Aap system tree mein depth 5 par hain.
```

### ADMIN A16 — `PASS` (user_lookup)

**Q:** What is the main wallet balance of SIA00299?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getUserProfileByDisplayId']`
- elapsed_ms: `9452`
- db_truth: `46208.31`

**Reply:**

```
SIA00299 (Rahul Parwatkar) ka main wallet balance **₹4,778.24** hai.

Yahan unke baaki wallets ki details hain:
*   **Main Wallet (Other):** ₹4,778.24
*   **Spot Wallet:** ₹14,850.25
*   **Team Royalty Wallet:** ₹26,579.82
*   **Total Balance:** ₹46,208.31
```

### ADMIN A17 — `PASS` (user_lookup)

**Q:** How many package purchases has SIA00299 made?

- expected_any: `['4']`
- matched: `['4']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `7217`
- db_truth: `4`

**Reply:**

```
User SIA00299 ne total **4** package purchases kiye hain:

*   **Active (Completed):** 2
*   **Pending:** 2
*   **Expired (2x):** 0

Yahan packages ki details hain:
*   **English Speaking-III** (₹7,500.00) — Active
*   **Share Market Learning** (₹30,000.00) — Active
*   **Graphic Designing & Video Editing** (₹50,000.00) — Pending
*   **Digital Marketing** (₹15,000.00) — Pending
```

### ADMIN A18 — `PASS` (user_lookup)

**Q:** How many withdrawal requests has SIA00299 raised in total?

- expected_any: `['33']`
- matched: `['33']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `6356`
- db_truth: `33`

**Reply:**

```
User SIA00299 has raised a total of **33 withdrawal requests**.

All **33** requests have been **approved**, for a total withdrawal amount of **₹3,26,090.00**.
```

### ADMIN A19 — `PASS` (user_lookup)

**Q:** Has SIA00299 paid for the Graphic Designing & Video Editing package, and what is its status?

- expected_any: `['pending']`
- matched: `['pending']`
- tool_calls: `['getMyPurchases']`
- elapsed_ms: `8209`
- db_truth: `pending`

**Reply:**

```
User SIA00299 has initiated a purchase for the **Graphic Designing & Video Editing** package (₹50,000), but it is not yet fully completed.

Here are the details:
* **Package:** Graphic Designing & Video Editing
* **Amount:** ₹50,000.00
* **Status:** **Pending**
* **Purchase Date:** March 18, 2026

Since the status is pending, the payment may be undergoing verification or awaiting admin approval (if it was a manual purchase request). Once approved, the status will change to "completed" and commissions will begin to generate.
```

### ADMIN A20 — `PASS` (packages)

**Q:** Which package is the highest priced on SIA and what is its price?

- expected_any: `['Cyber Security & Online Safety-III', '2300000', '23,00,000', '2,300,000']`
- matched: `['Cyber Security & Online Safety-III', '23,00,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6603`
- db_truth: `Cyber Security & Online Safety-III|2300000.00`

**Reply:**

```
SIA platform par sabse mehnga package **Cyber Security & Online Safety-III** hai, jiski price **₹23,00,000.00** hai.
```

### ADMIN A21 — `PASS` (packages)

**Q:** Which package is the cheapest on SIA and what is its price?

- expected_any: `['English Speaking Basic', '2500', '2,500']`
- matched: `['English Speaking Basic', '2,500']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6769`
- db_truth: `English Speaking Basic -I|2500.00`

**Reply:**

```
SIA system mein sabse sasta package **English Speaking Basic -I** hai, jiski price **₹2,500.00** hai.
```

### ADMIN A22 — `PASS` (packages)

**Q:** What is the price of the Digital Marketing package?

- expected_any: `['15000', '15,000']`
- matched: `['15,000']`
- tool_calls: `['getAllPackages']`
- elapsed_ms: `6067`
- db_truth: `15000.00`

**Reply:**

```
Digital Marketing package ki price ₹15,000.00 hai. 

Is package ke saath aapko ye benefits milte hain:
* **Self ROI:** 3.5% per month
* **Global IDs:** 325
* **Validity:** 365 din
```

### ADMIN A23 — `PASS` (levels)

**Q:** What is the title of level 0 and level 9 in the level master?

- expected_any: `['Field Worker', 'King']`
- matched: `['Field Worker', 'King']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `5588`
- db_truth: `0:Field Worker, 9:King`

**Reply:**

```
SIA MLM system ke level master mein:

*   **Level 0** ka title **Field Worker** hai.
*   **Level 9** ka title **King** hai.
```

### ADMIN A24 — `PASS` (levels)

**Q:** List the titles for levels 1 through 4 in the SIA MLM level master.

- expected_any: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- matched: `['Company Representative', 'City Manager', 'Area Manager', 'District Manager']`
- tool_calls: `['getAllLevels']`
- elapsed_ms: `5192`
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
- elapsed_ms: `7017`
- db_truth: `SIA00111|45`

**Reply:**

```
The user with the highest number of direct referrals is **SHAMUAL SHANKAR GADDEKAR**.

* **SIA ID:** SIA00111
* **Direct Referrals:** 45
```

### ADMIN A26 — `PASS` (team_metrics)

**Q:** How big is SIA00111's downline (descendants count, excluding self)?

- expected_any: `[]`
- matched: `[]`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `6791`
- db_truth: `2325`

**Reply:**

```
SIA00111 has a total downline of **2,325** members (excluding themselves). 

Here is the breakdown of their network size by depth:
*   **Depth 1 (Direct Referrals):** 45 members
*   **Depth 2:** 72 members
*   **Depth 3:** 130 members
*   **Depth 4:** 235 members
*   **Depth 5:** 394 members
*   **Depth 6–16:** 1,449 members

The user is positioned at an upline depth of 4 within the system.
```

### ADMIN A27 — `PASS` (concept)

**Q:** Explain what a pending commission row in the database represents and when it gets cleared.

- expected_any: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- matched: `['pending', 'commission', 'trigger', 'purchase', 'level']`
- tool_calls: `[]`
- elapsed_ms: `7317`
- db_truth: `concept`

**Reply:**

```
A **pending commission** represents a **SPOT income** credit that an upline member is not yet qualified to receive. 

Here is how it works:
*   **When it is created:** When a downline member buys a package, the system checks if the upline ancestors are eligible for their respective levels (Level 1 to 9). If an upline is not yet eligible (e.g., they haven't met the "legs" or "total business" requirements for that level), the commission is saved in the `pending_commissions` table instead of being paid out.
*   **When it gets cleared (Released):** The commission is "released" to the user's **SPOT wallet** as soon as they meet the eligibility requirements for that level. 
*   **Trigger Points:** The system checks for these clearances during:
    *   **Daily Eligibility Cron:** Every day at **0 …
```

### ADMIN A28 — `PASS` (concept)

**Q:** Walk me through the lifecycle of a withdrawal request from creation to approval/rejection.

- expected_any: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- matched: `['withdraw', 'pending', 'approved', 'rejected', 'admin']`
- tool_calls: `[]`
- elapsed_ms: `7122`
- db_truth: `concept`

**Reply:**

```
The lifecycle of a withdrawal request in the SIA MLM system follows a specific path from creation by a student to processing by an admin:

1.  **Creation (Student Initiation):**
    *   A user with an **Approved KYC** status initiates a request via the dashboard.
    *   The user must select a `withdraw_type` (**SPOT**, **Main/Other**, or **Team Royalty**) and enter their **Transaction PIN**.
    *   **Validation Gates:** The system checks roughly 12 rules before allowing the request, including:
        *   Minimum (₹500) and Maximum (₹2,00,000) limits.
        *   The **10/20/30 date rule** (unless open mode is enabled).
        *   **Available Balance:** Excludes locked SPOT (10-day hold) or reinvestment holds (90/150/180 days).
        *   **Capping:** SPOT and Team Royalty withdrawals  …
```

### ADMIN A29 — `PASS` (concept)

**Q:** What is the difference between purchases and pending_commissions tables in this system?

- expected_any: `['purchase', 'package', 'commission', 'pending', 'level']`
- matched: `['purchase', 'package', 'commission', 'pending', 'level']`
- tool_calls: `[]`
- elapsed_ms: `6566`
- db_truth: `concept`

**Reply:**

```
In the SIA MLM system, the **purchases** and **pending_commissions** tables serve two very different stages of the financial lifecycle:

### 1. Purchases Table
*   **Purpose:** Records every package bought, renewed, or upgraded by a user.
*   **Role:** It is the source of truth for a user's active investment. It tracks the `amount` paid and the `income` generated by that specific package.
*   **Expiry:** This table is used to enforce the **2x rule**; once a purchase's income reaches double its amount, it is marked as expired.

### 2. Pending_commissions Table
*   **Purpose:** Holds commissions (specifically **SPOT** commissions) that have been generated but cannot yet be paid out.
*   **Role:** When a downline member makes a purchase, the system calculates commissions for 9 levels of uplin …
```

### ADMIN A30 — `PASS` (concept)

**Q:** Explain the role of the user_tree_paths closure table — what does each row mean?

- expected_any: `['closure', 'ancestor', 'descendant', 'depth']`
- matched: `['closure', 'ancestor', 'descendant', 'depth']`
- tool_calls: `[]`
- elapsed_ms: `7564`
- db_truth: `concept`

**Reply:**

```
The **user_tree_paths** table is a **closure table** that stores every relationship in the SIA MLM hierarchy. Instead of just storing a user's parent, it stores every ancestor-descendant connection across all levels.

Each row represents a specific link between two users:

*   **`ancestor_id`**: The user who is higher up in the tree.
*   **`descendant_id`**: The user who is lower down in the tree.
*   **`depth`**: The number of levels between them.

### What the Depths Mean:
*   **Depth 0**: A self-reference row (e.g., User A is at depth 0 from User A). Every user has one such row.
*   **Depth 1**: A direct sponsorship. The `ancestor_id` is the direct sponsor of the `descendant_id`.
*   **Depth 2 to 9**: Indirect relationships. For example, if User A is the "Grand-Sponsor" of User C, the d …
```

### ADMIN A31 — `PASS` (concept)

**Q:** What types of wallets exist for each user in the system and how are they used?

- expected_any: `['main', 'spot', 'team royalty', 'balance']`
- matched: `['main', 'spot', 'team royalty', 'balance']`
- tool_calls: `[]`
- elapsed_ms: `5572`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein har user ke paas ek primary `balance` hota hai, jo basically niche diye gaye teen sub-wallets ka total sum hai:

*   **Spot Wallet (`spot_balance`):** Ismein aapki saari **SPOT commissions** (direct aur upline level commissions) aati hain. Har credit par 10-day ka hold rehta hai. Yeh wallet mahine ki **10th, 20th, aur 30th** ko withdrawal ke liye khulta hai.
*   **Main Wallet (`other_balance`):** Ismein aapki **SELF ROI** aur **GLOBAL HELPING** income aati hai. Saare platform fees (jaise KYC fee ko chhod kar baaki sab) isi wallet se deduct hote hain aur P2P transfers bhi isi se hote hain. Yeh mahine ki **30th** ko withdraw kiya ja sakta hai.
*   **Team Royalty Wallet (`team_royalty_balance`):** Ismein aapki **MONTHLY team royalty** commissions jama hoti hain. Yeh wallet …
```

### ADMIN A32 — `PASS` (concept)

**Q:** What does it mean when a user is marked as is_disqualified=true in the users table?

- expected_any: `['disqualified', 'block', 'commission', 'withdraw', 'income']`
- matched: `['disqualified', 'commission']`
- tool_calls: `[]`
- elapsed_ms: `7872`
- db_truth: `concept`

**Reply:**

```
जब SIA MLM सिस्टम में किसी यूजर को `is_disqualified=true` मार्क किया जाता है, तो इसका मतलब है कि वह यूजर सिस्टम के बेनिफिट्स के लिए अब पात्र (eligible) नहीं रहा। इसके मुख्य कारण और परिणाम नीचे दिए गए हैं:

*   **कारण (Trigger):** जब किसी यूजर के पास लगातार **21 दिनों** तक कोई भी "Active Package" (ऐसा पैकेज जिसने अभी तक अपनी 2x इनकम लिमिट पूरी न की हो) नहीं होता, तो सिस्टम उन्हें ऑटोमैटिकली डिस्क्वालिफाई कर देता है।
*   **कमीशन पर रोक:** डिस्क्वालिफाई होने के बाद यूजर को कोई भी नया कमीशन (SPOT, MONTHLY, आदि) नहीं मिलता। साथ ही, उनके डाउनलाइन से आने वाले कमीशन में उन्हें "Skip" कर दिया जाता है।
*   **पेंडिंग कमीशन:** डिस्क्वालिफाई होते ही यूजर के जितने भी `pending_commissions` होते हैं, उन्हें सिस्टम से डिलीट कर दिया जाता है।
*   **एलिजिबिलिटी (Eligibility) पर असर:** यूजर के डिस्क्वालिफाई हो …
```

### ADMIN A33 — `PASS` (concept)

**Q:** What are the cron jobs or scheduled jobs running in the SIA MLM system?

- expected_any: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- matched: `['cron', 'scheduled', 'monthly', 'daily', 'job']`
- tool_calls: `['explainSystemConcept']`
- elapsed_ms: `7990`
- db_truth: `concept`

**Reply:**

```
SIA MLM system mein basically yeh important cron jobs/scheduled jobs run hote hain:

*   **Daily Commission Job (06:22 AM IST / 00:52 UTC):** Yeh sabse main job hai jo har active purchase ke liye SELF ROI, GLOBAL_HELPING, aur MONTHLY royalty commissions calculate karke credit karti hai.
*   **Eligibility Check Job (06:25 AM IST / 00:55 UTC):** Yeh job sabhi users ki Level Eligibility recompute karti hai aur agar koi user naye level ke liye qualify hota hai, toh uske pending SPOT commissions ko release karti hai.
*   **Database Backup (05:00 AM IST / 23:30 UTC):** System ka daily backup lekar Bunny Storage par upload karti hai.
*   **Purchase Commission (Event-driven):** Jaise hi koi purchase complete hota hai, yeh job turant SPOT commission distribute karne ka kaam karti hai.
*   **Disqual …
```

### ADMIN A34 — `PASS` (concept)

**Q:** Explain what the legacy_activation_history and legacy_spot_history tables are used for.

- expected_any: `['legacy', 'history', 'old', 'spot', 'activation']`
- matched: `['legacy', 'history', 'old', 'spot', 'activation']`
- tool_calls: `[]`
- elapsed_ms: `10730`
- db_truth: `concept`

**Reply:**

```
The **legacy_activation_history** and **legacy_spot_history** tables are used to store data imported from the old MLM system (pre-December 2025). Their primary purposes are:

*   **Legacy Activation History:** This table contains historical activation and recharge records imported from Excel files. It is used for admin reporting and allows users to view their past activation history in their dashboard.
*   **Legacy Spot History:** This table stores SPOT income credits from the previous system. It provides users with a view of their historical SPOT earnings and assists admins in reconciling old data with the current system.

**Key points about both tables:**
*   **Read-Only:** They are informational only. The data does not trigger any new commissions, ROI, or eligibility recomputations in t …
```

### ADMIN A35 — `PASS` (concept)

**Q:** Can an admin manually adjust a user's wallet, and if yes, where is that recorded?

- expected_any: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- matched: `['admin', 'adjust', 'wallet', 'ledger', 'transaction']`
- tool_calls: `[]`
- elapsed_ms: `9441`
- db_truth: `concept`

**Reply:**

```
Yes, an admin can manually adjust a user's wallet (Main/Other, Spot, or Team Royalty) using the **Wallet Management** tool in the Admin Panel. 

These adjustments are recorded in two places for transparency and auditing:
*   **Ledger Entries:** Every adjustment creates a row in the `ledger_entries` table with the commission type **ADMIN_OPS**. This ensures the wallet balance and transaction history remain accurate.
*   **Admin Activity Logs:** The system logs the specific admin who performed the action, the target user, the amount changed, the reason provided, and the timestamp. 

Admin operations can be used to add funds (credits) or subtract funds (debits) to correct errors, provide bonuses, or handle migration adjustments.
```

### ADMIN A36 — `PASS` (leaderboard)

**Q:** Top 3 referrers kaun hain — kis user ke sabse zyada direct referrals hain?

- expected_any: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- matched: `['SIA00111', '45', 'SIA01430', 'SIA01699']`
- tool_calls: `['getTopReferrers']`
- elapsed_ms: `7002`
- db_truth: `SIA00111=45,SIA01430=35,SIA01699=33`

**Reply:**

```
Top 3 referrers (sabse zyada direct referrals wale users) ye hain:

*   **SIA00111** - SHAMUAL SHANKAR GADDEKAR: **45** referrals
*   **SIA01430** - Vijaykumar hetramji shahare: **35** referrals
*   **SIA01699** - Kaivalya Garibdasji Wasnik: **33** referrals

Sabse zyada direct referrals **SHAMUAL SHANKAR GADDEKAR (SIA00111)** ke hain.
```

### ADMIN A37 — `PASS` (kyc_aggregate)

**Q:** Total approved KYC users kitne hain abhi system me?

- expected_any: `['1285', '1,285']`
- matched: `['1,285']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `7326`
- db_truth: `1285`

**Reply:**

```
Abhi system me total **1,285** approved KYC users hain.

Yahan complete breakdown hai:
* **Approved:** 1,285
* **Pending:** 1,473
* **Rejected:** 44
* **Submitted:** 5

System me total users ki ginti 2,807 hai.
```

### ADMIN A38 — `PASS` (kyc_aggregate)

**Q:** Total pending KYC users kitne hain?

- expected_any: `['1473', '1,473']`
- matched: `['1,473']`
- tool_calls: `['getKycCounts']`
- elapsed_ms: `5569`
- db_truth: `1473`

**Reply:**

```
System mein total 1,473 users hain jinka KYC status abhi **pending** hai.
```

### ADMIN A39 — `PASS` (withdrawal_aggregate)

**Q:** Pichhle 30 dino me kitne approved withdrawal requests pass hue aur unka total amount kya hai?

- expected_any: `['937', '5761985', '5,761,985']`
- matched: `['937']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `12546`
- db_truth: `937|5761985.62`

**Reply:**

```
Pichhle 30 dino me total **937 approved withdrawal requests** pass hue hain, jinka total amount **₹57,61,985.62** hai.
```

### ADMIN A40 — `FAIL` (withdrawal_projection)

**Q:** Admin POV: agle withdrawal date par mere paas approximately kitni amount ki withdrawal demand aa sakti hai (upper bound)?

- expected_any: `['7571367', '7,571,367', '7571']`
- matched: `[]`
- tool_calls: `['getAdminProjectedWithdrawalDemand']`
- elapsed_ms: `7720`
- db_truth: `7571367.03`

**Reply:**

```
Admin POV ke hisaab se, agle withdrawal date (**30 April 2026**) par total projected demand approximately **₹75,71,367.03** ho sakti hai.

Yeh demand **1,281 eligible users** (jo KYC-approved aur active hain) ke full balances par based ek upper-bound estimate hai. Wallet-wise breakdown niche diya gaya hai:

*   **SPOT Wallet:** ₹7,71,424.57
*   **Main/Other Wallet:** ₹61,67,387.31
*   **Team Royalty Wallet:** ₹6,32,555.15
*   **Total Max Demand:** **₹75,71,367.03**

**Important Notes:**
*   Agle withdrawal date (30th) ko **saare wallets** (SPOT, Other/Main, aur Team Royalty) withdrawals ke liye open rahenge.
*   Yeh ek upper-bound estimate hai. Actual demand thodi kam ho sakti hai kyunki har user apna pura balance withdraw nahi karta aur kuch users par 10x capping bhi apply hoti hai.
```

### ADMIN A41 — `PASS` (withdrawal_eligible)

**Q:** User SIA00299 ki agle withdrawal date pe eligible withdrawal amount kya hai?

- expected_any: `['46208', '46,208']`
- matched: `['46,208']`
- tool_calls: `['getEligibleWithdrawalAmount']`
- elapsed_ms: `8216`
- db_truth: `46208.31`

**Reply:**

```
User SIA00299 ke liye agle withdrawal ki details ye hain:

*   **Agli Withdrawal Date:** 30 April 2026 (is din Spot, Main, aur Team Royalty teeno wallets open rahenge).
*   **Total Eligible Amount:** ₹46,208.31

**Wallet-wise breakdown:**
*   **Spot Wallet:** ₹14,850.25
*   **Main Wallet (Other):** ₹4,778.24
*   **Team Royalty Wallet:** ₹26,579.82

**Zaroori Jankari:**
*   Withdrawal ka samay subah **10:00 AM se shaam 5:00 PM IST** tak rahega.
*   Ye ek estimate hai; final amount withdrawal ke waqt apply hone wali fees aur 10× capping rules par depend karega.
*   User ka KYC approved hai aur filhaal koi withdrawal blocker nahi laga hai.
```

### ADMIN A42 — `PASS` (network)

**Q:** User SIA00299 ka total downline network size kitna hai?

- expected_any: `['1893', '1,893']`
- matched: `['1,893']`
- tool_calls: `['getNetworkSize']`
- elapsed_ms: `8996`
- db_truth: `1893`

**Reply:**

```
User SIA00299 ka total downline network size **1,893** hai.

Iska depth-wise breakdown kuch is prakar hai:
*   **Direct Referrals (Depth 1):** 28 users
*   **Depth 2:** 73 users
*   **Depth 3:** 188 users
*   **Total Depth:** Inka network total 15 levels tak phaila hua hai.

SIA00299 khud top se 5 levels niche (upline depth 5) base level par hain.
```

### ADMIN A43 — `PASS` (network)

**Q:** User SIA00299 ke total kitne direct referrals hain?

- expected_any: `['28']`
- matched: `['28']`
- tool_calls: `['getDirectReferralCount']`
- elapsed_ms: `4642`
- db_truth: `28`

**Reply:**

```
User SIA00299 ke total **28** direct referrals hain.
```

### ADMIN A44 — `PASS` (income_compound)

**Q:** User SIA00111 ka 7500 wale English Speaking-III package se SELF income lifetime kitna mila hai?

- expected_any: `['180', '180.00']`
- matched: `['180', '180.00']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `8150`
- db_truth: `180.00`

**Reply:**

```
User SIA00111 ko ₹7,500 wale English Speaking-III package se ab tak total **₹180.00** ki SELF income mili hai. Ye amount total 24 daily entries ke zariye unke wallet mein credit hua hai.
```

### ADMIN A45 — `PASS` (withdrawal_aggregate)

**Q:** Globally rejected withdrawal requests kitne hain aur unka total amount kya hai?

- expected_any: `['73', '510544', '510,544']`
- matched: `['73']`
- tool_calls: `['getWithdrawalCounts']`
- elapsed_ms: `5878`
- db_truth: `73|510544.00`

**Reply:**

```
Globally rejected withdrawal requests ki kul sankhya 73 hai aur unka total amount ₹5,10,544.00 hai.
```

### ADMIN A46 — `PASS` (withdrawal_date)

**Q:** Agla withdrawal date kab hai aur us din kaunse wallets opened hote hain?

- expected_any: `['2026-04-30', '30', 'spot', 'team', 'all']`
- matched: `['30', 'spot', 'team', 'all']`
- tool_calls: `['getNextWithdrawalDate']`
- elapsed_ms: `6061`
- db_truth: `logic_check`

**Reply:**

```
Agla withdrawal date **30 April 2026** hai.

Us din niche diye gaye saare wallets withdrawal ke liye khule rehte hain:
*   **SPOT wallet**
*   **Other wallet** (Main wallet)
*   **Team Royalty wallet**

Yaad rakhiye ki withdrawal ka samay subah **10:00 AM se shaam 5:00 PM (IST)** tak hota hai.
```

### ADMIN A47 — `PASS` (income_compound)

**Q:** User SIA00299 ka pichhle 30 dino me sirf MONTHLY recurring income type ka kitna paisa credit hua?

- expected_any: `['30312', '30,312']`
- matched: `['30,312']`
- tool_calls: `['getIncomeSummary']`
- elapsed_ms: `4764`
- db_truth: `30312.92`

**Reply:**

```
User SIA00299 ka pichhle 30 dino me total **₹30,312.92** MONTHLY recurring income credit hua hai. Yeh amount total 13,326 entries se mil kar bana hai.
```
