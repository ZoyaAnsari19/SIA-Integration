# SIA00299 (Rahul Parwatkar) – Spot wallet 0 ka reason (summary)

## User ka sawal
Withdrawal request **3357** (₹5,894 spot) jab **approve hi nahi hua** (admin side pe "insufficient_spot_balance" aaya), to **spot wallet 0 kaise ho gaya** / **wo amount kahan gaya**?

---

## Short answer

- **Request 3357 se paisa cut nahi hua.** Approve fail ho gaya tha, isliye us request ki koi ledger entry nahi bani aur na hi `user_balances.spot_balance` us request se decrease hua.
- **Spot 0 isliye hua** kyunki is user pe **10x Spot/Team Royalty flush** rule lag chuka hai:  
  `spot_team_flush_active = true`.  
  Is rule ke hisaab se jab user apna **10x withdraw limit use kar leta hai** aur **15 din tak package upgrade nahi karta**, to system **spot_balance** aur **team_royalty_balance** dono **0 kar deta hai**. Ye **withdrawal approve** se nahi, **flush logic** se hua.

---

## Evidence (local DB – user_id 280)

| Check | Result |
|-------|--------|
| Withdraw request 3357 | `status = pending`, `processed_at = null` |
| Ledger with reference_id 3357 | Koi entry nahi → approve API success run nahi hua, is request se koi deduction nahi |
| user_balances (280) | `spot_balance = 0`, `team_royalty_balance = 0` |
| **spot_team_flush_active** | **true** |
| spot_team_limit_reached_at | Set (e.g. 2026-02-04) – 10x limit use ho chuka |
| spot_team_withdraw_used | 61356.00 |

**Conclusion:** Spot 0 hone ka reason **withdrawal 3357 approve** nahi hai, **10x flush** hai. Jo amount “withdrawable” tha, wo **flush rule** ke through zero ho gaya (spot + team_royalty dono 0 kiye gaye).

---

## Flush code – kab aur kaun set karta hai

### 1. `spot_team_limit_reached_at` kis path se set hota hai (2 jagah)

- **admin-withdraw.ts (approve):** Jab koi **spot/team_royalty** withdrawal approve hota hai aur  
  `limitInfo.spot_team_withdraw_used + withdrawalAmount >= limitInfo.spot_team_withdraw_limit`  
  (yani is approval se 10x limit exhaust ho jati hai), tab `spot_team_limit_reached_at = now` set hota hai.  
  Is user pe approved spot+team total = 61,356, limit = 75,000 → kabhi bhi `used + amount >= 75,000` nahi hua, so **ye path is user pe nahi chalna chahiye tha.**

- **dashboard.ts (backfill):** Jab user wallet/balance API call karta hai, agar  
  `limit > 0` aur `remaining === 0` aur `spot_team_limit_reached_at` abhi null hai, to backfill  
  `spot_team_limit_reached_at = now` set kar deta tha.  
  Remaining = 0 tab hota hai jab `used >= limit`. Is user ka used = 61,356, limit = 75,000, so **normal case me remaining 0 nahi hona chahiye.**  
  **Safeguard add kiya:** ab backfill me `used >= limit` explicitly check hai, taaki galat set na ho.

### 2. Flush (spot = 0) kab run hota hai

- **wallet.ts – addLedgerAndWallet():** Jab **SPOT** ya **MONTHLY** credit hota hai, pehle check:  
  `spot_team_limit_reached_at` set hai **aur** (15 din ho gaye **ya** pehle se `spot_team_flush_active = true`).  
  Agar haan, to:  
  `spot_balance = 0`, `team_royalty_balance = 0`, `spot_team_flush_active = true` (pehli baar flush pe).  
  Matlab **flush tabhi chalta hai jab pehle se `spot_team_limit_reached_at` set ho chuka ho** — wo ya to approve path se (limit exhaust) ya dashboard backfill se set hota hai.

### 3. Is user (280) pe kya hua

- DB me **used = 61,356**, **limit = 75,000** → remaining = 13,644.  
  Design ke hisaab se **kisi bhi path se `spot_team_limit_reached_at` set nahi hona chahiye tha.**  
  Phir bhi `spot_team_limit_reached_at` set hai (e.g. 2026-02-04) → iska matlab **kisi waqt limit ya used ka value different tha** (e.g. limit temporarily kam / used temporarily zyada) **ya** koi script/manual/edge case.  
  Ek baar `spot_team_limit_reached_at` set ho gaya, uske baad koi bhi SPOT/MONTHLY credit aate hi flush condition true ho sakti hai (15 din ya flush_active) aur **spot 0 ho jata hai**.

---

## Code reference

- **Flush execution:** `MLM-API/src/utils/wallet.ts` – `addLedgerAndWallet()` me SPOT/MONTHLY credit ke time: `spot_team_limit_reached_at` + (15 din ya `spot_team_flush_active`) → spot/team_royalty = 0, `spot_team_flush_active = true`.
- **Limit_reached set (approve):** `MLM-API/src/routes/admin-withdraw.ts` – spot/team withdrawal approve pe `used + amount >= limit` → `spot_team_limit_reached_at = now`.
- **Limit_reached set (backfill):** `MLM-API/src/routes/dashboard.ts` – wallet API me `limit > 0`, `remaining === 0`, **aur ab `used >= limit`** → `spot_team_limit_reached_at = now`.
- **Approve path:** `MLM-API/src/routes/admin-withdraw.ts` – Approve pe balance check fail → "insufficient_spot_balance", koi deduction nahi.

---

## Script

- `MLM-API/scripts/check-sia00299-withdrawal.ts` – User 280 balance, request 3357, ledger summary + **flush flags** + conclusion run karta hai.  
  Run: `npx tsx scripts/check-sia00299-withdrawal.ts`
