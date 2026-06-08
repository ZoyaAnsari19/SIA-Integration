# Secure Pharma – SIA Refer ID Integration

**Ye file Cursor AI ko do. Cursor is instructions + code use karke Secure Pharma mein SIA Refer ID validation implement kar dega.**

---

## PART 1: Cursor Instructions (Prompt)

Secure Pharma mein SIA Refer ID validation add karo.

**Context:**
- MLM API (SIA) pe ek public endpoint hai: `GET {BASE_URL}/api/v1/sia/validate-refer/:displayId`
- Response 200: `{ is_sia_user: true, display_id, name }`
- Response 404: `{ is_sia_user: false, error }`
- Refer ID sirf SIA users ka valid hona chahiye (Apply as Distributor / Apply as Franchise forms ke liye).

**Requirements:**
1. **Env:** `NEXT_PUBLIC_MLM_API_BASE_URL=https://api.secureinfiniteassociation.com` — add in `.env` and `.env.example`.
2. **Utility:** Ek file banao (e.g. `lib/siaRefer.ts` ya `utils/siaRefer.ts`) — Part 2 ka code use karo.
3. **Forms:** Apply as Distributor aur Apply as Franchise forms mein:
   - Refer ID input ke **onBlur** (ya "Verify" button) pe validation call karo.
   - Valid → success message / referrer name dikhao; invalid → error message; loading state handle karo.
   - **Submit se pehle** bhi validate karo; invalid ho to submit block karo.
   - Submit karte waqt `refer_display_id` (valid display_id) backend ko bhejo.

Implement karo: env, utility file, aur dono forms (Distributor + Franchise) mein Refer ID validation + submit-time check.

---

## PART 2: Code to Implement

### 2.1 Environment

**.env** and **.env.example** (add this line):
```env
NEXT_PUBLIC_MLM_API_BASE_URL=https://api.secureinfiniteassociation.com
```

---

### 2.2 Utility – SIA Refer validation

**File:** `lib/siaRefer.ts` (ya `utils/siaRefer.ts` — project structure ke hisaab se)

```typescript
const MLM_API_BASE = process.env.NEXT_PUBLIC_MLM_API_BASE_URL || '';

export type SiaReferResult =
  | { valid: true; display_id: string; name: string | null }
  | { valid: false; error: string };

export async function validateSiaReferId(displayId: string): Promise<SiaReferResult> {
  const trimmed = (displayId || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Refer ID is required' };
  }
  if (!MLM_API_BASE) {
    return { valid: false, error: 'MLM API URL not configured' };
  }
  try {
    const res = await fetch(
      `${MLM_API_BASE}/api/v1/sia/validate-refer/${encodeURIComponent(trimmed)}`
    );
    const data = await res.json();
    if (res.ok && data?.is_sia_user && data?.display_id) {
      return {
        valid: true,
        display_id: data.display_id,
        name: data.name ?? null,
      };
    }
    return {
      valid: false,
      error: data?.error || 'Refer ID not found or not a valid SIA user',
    };
  } catch {
    return {
      valid: false,
      error: 'Could not verify Refer ID. Please try again.',
    };
  }
}
```

---

### 2.3 Form usage (Refer ID field)

**State:**
```typescript
const [referId, setReferId] = useState('');
const [referError, setReferError] = useState('');
const [referName, setReferName] = useState<string | null>(null);
const [referChecking, setReferChecking] = useState(false);
```

**Validate on blur / Verify button:**
```typescript
async function handleValidateRefer() {
  setReferError('');
  setReferName(null);
  if (!referId.trim()) {
    setReferError('Refer ID is required');
    return;
  }
  setReferChecking(true);
  try {
    const result = await validateSiaReferId(referId);
    if (result.valid) {
      setReferError('');
      setReferName(result.name || result.display_id);
    } else {
      setReferError(result.error);
      setReferName(null);
    }
  } finally {
    setReferChecking(false);
  }
}
```

**Refer ID input JSX:**
```tsx
<label>Refer ID *</label>
<input
  value={referId}
  onChange={(e) => setReferId(e.target.value)}
  onBlur={handleValidateRefer}
  placeholder="e.g. SIA0011"
  disabled={referChecking}
/>
{referChecking && <span>Checking...</span>}
{referError && <span className="text-red-600">{referError}</span>}
{referName && <span className="text-green-600">Valid: {referName}</span>}
```

**Submit se pehle check:**
```typescript
async function handleSubmit() {
  if (!referId.trim()) {
    setReferError('Refer ID is required');
    return;
  }
  const result = await validateSiaReferId(referId);
  if (!result.valid) {
    setReferError(result.error);
    return;
  }
  // Submit with refer_display_id
  await submitForm({ ...formData, refer_display_id: result.display_id });
}
```

---

**Apply as Distributor** aur **Apply as Franchise** dono forms mein ye Refer ID validation + submit check laga do.
