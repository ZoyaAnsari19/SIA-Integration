# Secure Infinite Association – Domain Model (Entities & Relations)

Yeh file backend design ke liye **final entities + unke relations** ko document karti hai.  
Hierarchy ka core flow:

> **User → Cart / PurchaseHistory → Course → Module → Video**

---

## 1. User (`users`)

Platform pe registered koi bhi user – student / admin.

```text
User
  id              PK
  name
  email           (unique)
  passwordHash
  role            (STUDENT | ADMIN)
  createdAt
  updatedAt
```

**Relations**

- 1 `User` → 1 `Cart`
- 1 `User` → many `PurchaseHistory` records

---

## 2. Course (`courses`)

Top-level course jo listing / detail page me dikh raha hai.

```text
Course
  id              PK
  slug            (unique, URL ke liye)
  title
  shortDescription
  longDescription
  price
  originalPrice   (optional, discount show karne ke liye)
  language        (HINDI | ENGLISH | ...)
  level           (BEGINNER | INTERMEDIATE | ADVANCED)
  category        (e.g. Basic Recorded Course, Basic to Advance)
  thumbnailUrl
  isPublished
  createdAt
  updatedAt
```

**Relations**

- 1 `Course` → many `Module`
- 1 `Course` → many `PurchaseHistory` rows (har successful purchase)

---

## 3. Module (`modules`)

Course ke andar logical section / chapter.

```text
Module
  id              PK
  courseId        FK → Course.id
  title
  description     (optional)
  orderIndex      (1,2,3…; course ke andar order)
  createdAt
  updatedAt
```

**Relations**

- 1 `Course` → many `Module`
- 1 `Module` → many `Video`

---

## 4. Video (`videos`)

Actual recorded lesson.  
Video **sirf apne module ko jaanta hai**, module course ko jaanta hai.

```text
Video
  id              PK
  moduleId        FK → Module.id
  title
  description     (optional)
  videoUrl        (S3/CDN/Vimeo/YouTube URL ya ID)
  durationSeconds
  orderIndex      (module ke andar order)
  isPreview       (bool – free preview?)
  isPublished
  createdAt
  updatedAt
```

**Relations**

- 1 `Module` → many `Video`

---

## 5. Cart (`cart` + `cart_items`)

User ka current shopping cart.

### `cart`

```text
Cart
  id              PK
  userId          FK → User.id (1:1 relation recommended)
  createdAt
  updatedAt
```

### `cart_items`

```text
CartItem
  id              PK
  cartId          FK → Cart.id
  courseId        FK → Course.id
  quantity        (abhi 1, future ke liye field)
  createdAt
  updatedAt
```

**Relations**

- 1 `User` → 1 `Cart`
- 1 `Cart` → many `CartItem`
- 1 `Course` → 0..n `CartItem` (different users ke carts)

---

## 6. Purchase History (`purchase_history`)

Yeh **single source of truth** hai:

- Kis user ne kaunsa course kab kharida  
- Kitne paise me  
- Payment status kya hai

Isi se:

- **My Courses / My Enrollments**
- **Payment history**
- **Order history / reporting**

sab generate honge.  

```text
PurchaseHistory
  id              PK
  userId          FK → User.id
  courseId        FK → Course.id
  priceAtPurchase
  currency        (e.g. INR)
  paymentStatus   (PENDING | SUCCESS | FAILED | REFUNDED)
  paymentMethod   (e.g. RAZORPAY | STRIPE | UPI | CARD)
  paymentRef      (gateway order/payment id)
  purchasedAt
  meta            (JSON – raw gateway payload / extra info)
```

**Important derived concepts**

- **My Courses / Enrollments**

  ```sql
  SELECT DISTINCT courseId
  FROM purchase_history
  WHERE userId = :currentUserId
    AND paymentStatus = 'SUCCESS';
  ```

- **Payment history**

  ```sql
  SELECT *
  FROM purchase_history
  WHERE userId = :currentUserId
  ORDER BY purchasedAt DESC;
  ```

- **Revenue / reporting**

  ```sql
  SELECT courseId, COUNT(*) as totalSales, SUM(priceAtPurchase) as revenue
  FROM purchase_history
  WHERE paymentStatus = 'SUCCESS'
  GROUP BY courseId;
  ```

> Note: Agar future me multi-course checkout chahiye ho to is table me
> `orderGroupId` jaisa field add karke multiple rows ko ek hi order se link
> kar sakte ho. V1 ke liye simple flow (one-course-per-purchase) bahut
> sahi rahega.

---

## 7. High-level ER Diagram (text representation)

```text
User (1) ──< Cart (1) ──< CartItem >── (1) Course
   │                        ▲
   └───────< PurchaseHistory >───(1) Course

Course (1) ──< Module (1) ──< Video
```

- **User** ka ek hi active **Cart** hota hai.
- User ke har successful purchase ka record **PurchaseHistory** me aata hai.
- **My Courses** = `PurchaseHistory` se nikle hue distinct `courseId` jinke `paymentStatus = SUCCESS` ho.

Yeh file backend implement karte waqt reference ke liye use ki ja sakti hai  
(Prisma schema / SQL tables isi se derive honge). 


