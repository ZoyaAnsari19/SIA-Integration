# ⚠️ CRITICAL: Countdown Implementation Rules

## ❌ WRONG Way (Causes Timer Restart in New Browser)

```javascript
// ❌ DON'T DO THIS
const [countdown, setCountdown] = useState({ seconds: 30 });

useEffect(() => {
  const interval = setInterval(() => {
    setCountdown(prev => ({
      ...prev,
      seconds: prev.seconds - 1  // ❌ DECREMENTING - WRONG!
    }));
  }, 1000);
}, []);
```

**Problem:** Different browsers start at different times, so countdown is different.

---

## ✅ CORRECT Way (Works Across All Browsers)

```javascript
// ✅ DO THIS
const [renewalDeadline, setRenewalDeadline] = useState(null);

useEffect(() => {
  // Store ONLY the fixed deadline from backend
  setRenewalDeadline(new Date(countdownData.renewal_deadline));
}, [countdownData]);

useEffect(() => {
  if (!renewalDeadline) return;

  const calculateCountdown = () => {
    const now = new Date();
    const remainingMs = renewalDeadline.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    return {
      days: Math.floor(remainingSeconds / (24 * 60 * 60)),
      hours: Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60)),
      minutes: Math.floor((remainingSeconds % (60 * 60)) / 60),
      seconds: remainingSeconds % 60,
      totalSeconds: remainingSeconds,
    };
  };

  // Initial calculation
  setCountdown(calculateCountdown());

  // Update every second - ALWAYS recalculate from deadline
  const interval = setInterval(() => {
    setCountdown(calculateCountdown()); // ✅ FRESH CALCULATION - CORRECT!
  }, 1000);

  return () => clearInterval(interval);
}, [renewalDeadline]); // Only depend on deadline
```

**Why This Works:**
- All browsers use same `renewal_deadline` (fixed date)
- Every second: `deadline - now` = same result for all browsers
- No localStorage needed
- Works even if user switches browsers

---

## Key Rules

1. ✅ **ALWAYS calculate:** `renewal_deadline - client_now`
2. ❌ **NEVER decrement:** `countdown.seconds - 1`
3. ✅ **Store only deadline:** Not countdown values
4. ❌ **NO localStorage:** Deadline comes from API
