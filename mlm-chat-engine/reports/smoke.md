# SIA MLM Chat-Engine Evaluation Report

- Generated: 2026-04-25T15:12:44
- Chat engine: `http://localhost:3004`
- API: `http://localhost:3000/api/v1`
- DB container: `mlm-local-dump-20260425` (mlm_user@mlm_commission)

## Overall

- Total scenarios: **2**
- Passed: **2**
- Satisfactory score: **100.0%**

## By role

| Role | Total | Passed | Score |
|---|---|---|---|
| user | 1 | 1 | 100.0% |
| admin | 1 | 1 | 100.0% |

## By area

| Area | Total | Passed | Score |
|---|---|---|---|
| profile | 1 | 1 | 100.0% |
| system_stats | 1 | 1 | 100.0% |

## Per-scenario detail

### USER U01 — `PASS` (profile)

**Q:** What is my SIA ID and registered name?

- expected_any: `['SIA00299', 'RAHUL']`
- matched: `['SIA00299', 'RAHUL']`
- tool_calls: `['getUserProfile']`
- elapsed_ms: `14002`
- db_truth: `SIA00299|RAHUL PARWATKAR`

**Reply:**

```
Your SIA ID is **SIA00299** and your registered name is **RAHUL PARWATKAR**.
```

### ADMIN A01 — `PASS` (system_stats)

**Q:** How many total users are registered on the SIA platform right now?

- expected_any: `['2807', '2,807']`
- matched: `['2,807']`
- tool_calls: `['getSystemStats']`
- elapsed_ms: `11802`
- db_truth: `2807`

**Reply:**

```
Right now, there are a total of **2,807 registered users** on the SIA platform. Out of these, **2,803 are currently active** users. 

Let me know if you need more statistics or details!
```
