# دليل نظام دفع آمن بـ Stripe + Supabase (Next.js)

> هذا الدليل يوثّق الخطوات التي بُني بها نظام الدفع في مشروع **RijTheorie**،
> مكتوب بالعربية مع الكود الكامل، ليصلح للاستخدام في أي مشروع آخر.
>
> **النسخة:** 1.0 — مُراجَع ومُختبر (`tsc` + `eslint` + `next build` ناجحة).

---

## المحتويات

1. [نظرة عامة على المعمارية](#1-نظرة-عامة-على-المعمارية)
2. [القرارات المعمارية المهمة](#2-القرارات-المعمارية-المهمة)
3. [متغيّرات البيئة](#3-متغيّرات-البيئة)
4. [إعداد Stripe Dashboard](#4-إعداد-stripe-dashboard)
5. [قاعدة البيانات — SQL كامل](#5-قاعدة-البيانات--sql-كامل)
6. [المسار الأول: إنشاء جلسة الدفع](#6-المسار-الأول-إنشاء-جلسة-الدفع)
7. [المسار الثاني: Webhook](#7-المسار-الثاني-webhook)
8. [التعامل من جانب العميل](#8-التعامل-من-جانب-العميل)
9. [قائمة الاختبار](#9-قائمة-الاختبار)
10. [قائمة المراجعة الأمنية](#10-قائمة-المراجعة-الأمنية)
11. [الأخطاء الشائعة (فخاخ) — اقرأها قبل أن تبدأ](#11-الأخطاء-الشائعة-فخاخ)
12. [ملاحظات النشر](#12-ملاحظات-النشر)

---

## 1. نظرة عامة على المعمارية

```
┌──────────┐   1. POST /api/stripe/create-checkout
│  المتصفح │──────────────────────────────────────────┐
└──────────┘                                          ▼
                                          ┌───────────────────────┐
                                          │  الخادم (Route Handler)│
                                          │  - يتحقق من الـ session│
                                          │  - يحسب السعر من DB   │
                                          │  - يتحقق من الكوبون   │
                                          └───────────┬───────────┘
                                                      │ ينشئ Checkout Session
                                                      ▼
                                          ┌───────────────────────┐
                                          │      Stripe           │
                                          └───────────┬───────────┘
                                                      │ 2. يدفع المستخدم
                                                      ▼
                                          ┌───────────────────────┐
                                          │  صفحة Stripe Callback  │
                                          └───────────┬───────────┘
                                                      │ 3. Webhook
                                                      ▼
┌──────────┐   4. استطلاع الحالة          ┌───────────────────────┐
│  المتصفح │◄─────────────────────────────│  /api/stripe/webhook   │
└──────────┘                             └───────────┬───────────┘
                                                      │ RPC (Service Role)
                                                      ▼
                                          ┌───────────────────────┐
                                          │      Supabase         │
                                          │  user_subscriptions   │
                                          │  checkout_sessions    │
                                          │  stripe_events        │
                                          └───────────────────────┘
```

**المبدأ الأساسي:** المتصفح لا يقرّر شيئًا. كل قرار مالي (السعر، الصلاحية، الخصم)
يحدث في **الخادم** أو **قاعدة البيانات**، ومصدر الحقيقة هو **Stripe**.

---

## 2. القرارات المعمارية المهمة

| القرار | السبب |
|---|---|
| **لا يوجد Stripe Connect** | كل المبالغ تذهب ١٠٠٪ إلى حساب المنصة. لا `transfer_data` ولا `application_fee` ولا حساب Express. (تبقى متطلبات KYC/بنك لحساب المنصة نفسه في Stripe.) |
| **`mode: "payment"` وليس `subscription`** | اشتراك منطقي داخل تطبيقك (جدول `user_subscriptions`)، وليس اشتراك Stripe متكرر. أبسط وأوضح للتعامل مع الفواتير. |
| **الصلاحية تُخزَّن في `user_subscriptions`** | يتيح الاستعلام والتسجيل المنطقي داخل Supabase مع RLS. |
| **الأسعار تُحسب في الخادم** | لا يُقبل أي سعر من المتصفح إطلاقًا. |
| **الويب هوك هو مصدر الحقيقة** | تفعيل الاشتراك لا يحدث أبدًا بناءً على redirect المتصفح، لأن المستخدم يستطيع إغلاق المتصفح. |
| **`SECURITY DEFINER` + `SET search_path = ''`** | يمنع تصعيد الصلاحيات وحقن SQL. |
| **`service_role` فقط** | دوال الـ RPC الحساسة ممنوعة على `anon` و `authenticated`. |

---

## 3. متغيّرات البيئة

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # سري(server فقط)

# Stripe
STRIPE_SECRET_KEY=sk_test_...            # سري(server فقط)

# رابط الموقع — يُستخدم في success_url / cancel_url
NEXT_PUBLIC_SITE_URL=https://example.com
```

> ⚠️ **قواعد إلزامية**
> - `SUPABASE_SERVICE_ROLE_KEY` و `STRIPE_SECRET_KEY` **لا تضعهما أبدًا** في متغيّر يبدأ بـ `NEXT_PUBLIC_` — يتم فضحهما في المتصفح.
> - لا ترفع `.env.local` إلى Git.
> - **غطّئهم611 فوراً إذا ظهرت في محادثة أو سجلّ أو لقطة شاشة.**

---

## 4. إعداد Stripe Dashboard

1. **لوحة التحكم** (Dashboard) ← فعّل **مفاتيح الوصول** — انسخ `STRIPE_SECRET_KEY`.
2. **Webhooks** ← أنشئ endpoint:

   | الحقل | القيمة |
   |---|---|
   | URL | `https://your-domain.com/api/stripe/webhook` |
   | Events | `checkout.session.completed` · `checkout.session.async_payment_succeeded` · `checkout.session.async_payment_failed` · `checkout.session.expired` · `charge.refunded` · `charge.dispute.created` |

3. انسخ **Signing secret** (`whsec_...`) وضعه في جدول الإعدادات:

```sql
UPDATE public.site_settings
SET payment_settings = jsonb_set(
  COALESCE(payment_settings, '{}'::jsonb),
  '{webhook_secret}', '"whsec_..."'::jsonb
)
WHERE id = 1;
```

4. في بيئة الإنتاج: استبدل `sk_test_` بـ `sk_live_` وأنشئ **webhook ثانٍ**.Live (الـ endpoint والـ secret مختلفان عن Test).

---

## 5. قاعدة البيانات — SQL كامل

> شغّله في **Supabase → SQL Editor**. كل الأوامر idempotent أي يمكن تشغيلها أكثر من مرة بأمان.

### 5.1 افتراضات

هذا الـ SQL يفترض وجود:

- `public.subscription_plans` بأعمدة: `id UUID`, `name`, `description`, `price`, `duration_days`, `is_active`
- `public.coupon_codes` بأعمدة: `id UUID`, `code`, `discount_percent`, `plan_ids JSONB`, `is_active`, `expires_at`, `max_uses`, `used_count`
- `public.user_subscriptions` بـ `user_id`, `plan_id`, `start_date`, `end_date`, `is_active`
- دالة `public.is_admin()` موجودة

### 5.2 الجداول

```sql
-- سجلّ أحداث Stripe: يمنع معالجة نفس الحدث مرتين
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access to stripe_events" ON public.stripe_events;
CREATE POLICY "No public access to stripe_events"
  ON public.stripe_events FOR ALL USING (false);

-- تتبع حالة كل جلسة دفع (مهم لوسائل الدفع غير المتزامنة مثل iDEAL)
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id TEXT PRIMARY KEY,                       -- Stripe Session ID: cs_test_...
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','expired','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- أعمدة إضافية: نعرف ماذا اشترى الطالب وكم دفع
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS coupon_id TEXT;

ALTER TABLE public.checkout_sessions DROP CONSTRAINT IF EXISTS checkout_sessions_status_check;
ALTER TABLE public.checkout_sessions ADD CONSTRAINT checkout_sessions_status_check
  CHECK (status IN ('pending','succeeded','failed','expired','refunded'));

CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx
  ON public.checkout_sessions (user_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_pending_idx
  ON public.checkout_sessions (user_id, plan_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users read own checkout sessions"
  ON public.checkout_sessions FOR SELECT USING (auth.uid() = user_id);

-- رابط الدفع back: يسمح بإلغاء الوصول عند الاسترجاع
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

CREATE INDEX IF NOT EXISTS user_subscriptions_payment_intent_idx
  ON public.user_subscriptions (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- سجلّ استبدال الكوبون (يمنع استخدام نفس الكوبون مرتين لنفس المستخدم)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.coupon_codes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
```

### 5.3 RPC #1 — تسوية الدفع بالكامل في معاملة واحدة

هذه أهم دالة في النظام كله. تنفّذ **كل** خطوات التسوية — تسجيل الحدث، استبدال الكوبون، إدراج الاشتراك، وتحديث حالة الجلسة — داخل **معاملة واحدة**.

**لماذا هذا مهم؟** النسخة السابقة كانت تنشّط الاشتراك في نداء RPC واحد، ثم تنفّذ استبدال الكوبون وتحديث الحالة في نداءات منفصلة من الـ webhook. لو حدث انهيار (أو خطأ مؤقت في القاعدة) بين تلك الخطوات، كان الحدث قد سُجِّل كمعالَج، فتُتخطّى إعادة إرسال Stripe، ولا يُستهلك الكوبون أبداً، ولا تتحدث حالة الجلسة. الآن لا شيء يمكن أن يحدث بشكل جزئي: إما أن كل شيء يُحفظ أو لا شيء.

**القاعدة الذهبية:** ذاكرة الحدث (tombstone) تُحذف في **كل** مسار خطأ. هذا يجعل الفشل قابلاً لإعادة المحاولة، وهو ما يسمح للـ webhook بإرجاع 500 وإعادة محاولة الإلغاء.

```sql
DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(TEXT,TEXT,TEXT,UUID,INTEGER,TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(TEXT,TEXT,TEXT,UUID,INTEGER,TIMESTAMPTZ,INTEGER,UUID,TEXT);
DROP FUNCTION IF EXISTS public.settle_paid_checkout_session(TEXT,TEXT,TEXT,UUID,INTEGER,INTEGER,UUID,TEXT);

CREATE OR REPLACE FUNCTION public.settle_paid_checkout_session(
  p_event_id TEXT,
  p_checkout_session_id TEXT,
  p_plan_id TEXT,
  p_user_id UUID,
  p_duration_days INTEGER,
  p_amount_cents INTEGER,      -- ما دفعه Stripe فعلاً
  p_coupon_id UUID,
  p_payment_intent_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_plan_id UUID;
  v_plan_active BOOLEAN;
  v_price NUMERIC;
  v_expected INTEGER;
  v_new_end TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_discount INTEGER;
  v_max_uses INTEGER;
  v_used_count INTEGER;
  v_coupon_active BOOLEAN;
BEGIN
  IF p_event_id IS NULL OR p_checkout_session_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('processed', false, 'error', 'missing_identifiers', 'refund', true);
  END IF;

  -- 1) ذاكرة الحدث: ذرّية. ON CONFLICT هو ما يجعل إزالة التكرار آمنة
  --    تحت التزامن — تسليمان لنفس الحدث لا يمكن أن يمرّا معاً.
  INSERT INTO public.stripe_events (id, type)
  VALUES (p_event_id, 'checkout.session.paid')
  ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('processed', false, 'duplicate_event', true);
  END IF;

  -- 2) المشتري يجب أن يكون مستخدماً حقيقياً
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'user_not_found', 'refund', true);
  END IF;

  -- 3) شراء واحد = اشتراك واحد
  IF EXISTS (SELECT 1 FROM public.user_subscriptions
             WHERE checkout_session_id = p_checkout_session_id) THEN
    UPDATE public.checkout_sessions
    SET status = 'succeeded', updated_at = NOW()
    WHERE id = p_checkout_session_id;
    RETURN jsonb_build_object('processed', false, 'duplicate_session', true);
  END IF;

  -- 4) الخطة يجب أن تكون موجودة وما زالت قابلة للشراء
  BEGIN
    SELECT id, price, is_active INTO v_plan_id, v_price, v_plan_active
    FROM public.subscription_plans WHERE id::text = p_plan_id;
  EXCEPTION WHEN invalid_text_representation THEN
    v_plan_id := NULL;
  END;
  IF v_plan_id IS NULL THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_not_found', 'refund', true);
  END IF;
  IF NOT COALESCE(v_plan_active, false) THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_inactive', 'refund', true);
  END IF;

  -- 5) التحقق من الكوبون واستبداله، هنا في نفس المعاملة.
  --    expires_at لا يُفحص عمداً: جلسة أُنشئت والكونبون صالح تُحترم حتى لو
  --    استغرقت التسوية دقائق.
  IF p_coupon_id IS NOT NULL THEN
    -- قفل الصف يسلّم الاستبدالات المتزامنة لنفس الكوبون، فلا يستطيع طالبان
    -- التنافس على آخر استخدام متاح فيربح كلاهما.
    SELECT max_uses, used_count, is_active, discount_percent
    INTO v_max_uses, v_used_count, v_coupon_active, v_discount
    FROM public.coupon_codes WHERE id = p_coupon_id FOR UPDATE;

    IF NOT FOUND THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_not_found', 'refund', true);
    END IF;
    IF NOT COALESCE(v_coupon_active, false) THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_inactive', 'refund', true);
    END IF;
    IF v_max_uses IS NOT NULL AND COALESCE(v_used_count, 0) >= v_max_uses THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_limit_reached', 'refund', true);
    END IF;
    IF EXISTS (SELECT 1 FROM public.coupon_redemptions
               WHERE coupon_id = p_coupon_id AND user_id = p_user_id) THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_already_used', 'refund', true);
    END IF;
  END IF;

  -- 6) مقاومة التلاعب: أعد حساب السعر من القاعدة وقارن بما دفعه Stripe.
  --    انتبه لـ ::numeric — بدونها يصبح القسمة قسمة أعداد صحيحة فتُقطع
  --    (999 * 50 / 100 = 499) بينما Math.round يعطي 500.
  v_expected := ROUND(v_price::numeric * 100);
  IF v_expected IS NULL OR v_expected <= 0 THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_price_invalid', 'refund', true);
  END IF;
  IF p_coupon_id IS NOT NULL THEN
    v_discount := LEAST(GREATEST(COALESCE(v_discount, 0), 0), 99);
    v_expected := ROUND(v_expected::numeric * (100 - v_discount) / 100);
  END IF;

  IF p_amount_cents IS NULL THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'amount_missing', 'refund', true);
  END IF;
  IF ABS(p_amount_cents - v_expected) > 1 THEN   -- تسامح سنت واحد لأخطاء الفاصلة العائمة
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'amount_mismatch',
      'expected_cents', v_expected, 'received_cents', p_amount_cents, 'refund', true);
  END IF;

  -- 7) المدة هي المرجع. حُذف p_end_date: تاريخ النهاية يُشتق هنا ولا يمكن
  --    للعميل التأثير عليه.
  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'invalid_duration', 'refund', true);
  END IF;
  v_new_end := NOW() + make_interval(days => p_duration_days);

  -- 8) تثبيت استبدال الكوبون — لا يزال في نفس المعاملة
  IF p_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (p_coupon_id, p_user_id) ON CONFLICT (coupon_id, user_id) DO NOTHING;
    IF NOT FOUND THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_already_used', 'refund', true);
    END IF;
    UPDATE public.coupon_codes
    SET used_count = COALESCE(used_count, 0) + 1 WHERE id = p_coupon_id;
  END IF;

  -- 9) لا تقطع وصولاً أطول! من يملك 6 أشهر ويشتري "شهر" بالخطأ
  --    يجب ألا يخسر المدة الأطول.
  UPDATE public.user_subscriptions SET is_active = false
  WHERE user_id = p_user_id AND is_active = true AND end_date <= v_new_end;

  SELECT COALESCE(MAX(end_date), v_new_end) INTO v_end
  FROM public.user_subscriptions WHERE user_id = p_user_id AND is_active = true;

  -- 10) الفهرس الفريد أدناه هو الحارس الحقيقي؛ الاستثناء يحوّل التعارض
  --     إلى تكرار نظيف.
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id, plan_id, start_date, end_date, is_active,
      checkout_session_id, stripe_event_id, payment_intent_id
    ) VALUES (
      p_user_id, v_plan_id, NOW(), GREATEST(v_end, v_new_end), true,
      p_checkout_session_id, p_event_id, p_payment_intent_id
    );
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'duplicate_session', true);
  END;

  -- 11) غيّر حالة الجلسة إلى succeeded في نفس المعاملة، فلا يرى الطالب
  --     أبداً حالة "قيد التفعيل" وقد دفع فعلاً.
  UPDATE public.checkout_sessions
  SET status = 'succeeded', updated_at = NOW()
  WHERE id = p_checkout_session_id;

  RETURN jsonb_build_object('processed', true, 'refund', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_paid_checkout_session(TEXT,TEXT,TEXT,UUID,INTEGER,INTEGER,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paid_checkout_session(TEXT,TEXT,TEXT,UUID,INTEGER,INTEGER,UUID,TEXT) TO service_role;
```

> ملاحظة: `p_end_date` لم يعد موجوداً. كان التطبيق يحسب تاريخ النهاية ويُرسله، وكنا نتجاهله. الآن يُحسب في SQL فقط.

### 5.3.1 قيد التطابق: فهرس فريد على `checkout_session_id`

فحص `IF EXISTS` داخل الدالة **سباق بطبيعته**: تسليمان متزامنان لحدثين **مختلفين** لنفس جلسة الدفع يمرّان من الفحص ثم يدرجان اشتراكين. الفهرس الفريد أدناه يجعل القاعدة نفسها تفرض القاعدة:

```sql
-- اختيار الصف الذي يبقى: النشط أولاً، ثم الأطول، ثم الأقدم.
-- على قاعدة سليمة لا يطابق هذا أي صف ولا يغيّر شيئاً.
DELETE FROM public.user_subscriptions a
USING public.user_subscriptions b
WHERE a.checkout_session_id IS NOT NULL
  AND a.checkout_session_id = b.checkout_session_id
  AND (NOT COALESCE(a.is_active, false), a.end_date, a.start_date, a.ctid)
    < (NOT COALESCE(b.is_active, false), b.end_date, b.start_date, b.ctid);

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_checkout_session_uniq
  ON public.user_subscriptions (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;
```

### 5.4 ~~RPC #2~~ استبدال الكوبون — صار جزءاً من RPC #1

الدالة `redeem_coupon` لم تعد مستخدمة. منطقها (قفل الصف، `max_uses`، `is_active`، الاستخدام مرة واحدة لكل طالب) انتقل **داخل** `settle_paid_checkout_session`، حتى يُحفظ استبدال الكوبون وإدراج الاشتراك في **معاملة واحدة**.

> **لا تنسخ هذه الدالة في مشروع جديد.** إذا بقيت مستقلة، يمكن أن يُستهلك الكوبون **دون** اشتراك مقابل — وهذا باب مجاني. استخدم RPC #1 فقط.

```sql
-- للرجوع للخلف فقط. لا يستدعيها الـ webhook.
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_coupon_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_max_uses INTEGER;
  v_used_count INTEGER;
  v_is_active BOOLEAN;
BEGIN
  SELECT max_uses, used_count, is_active
  INTO v_max_uses, v_used_count, v_is_active
  FROM public.coupon_codes WHERE id = p_coupon_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT COALESCE(v_is_active, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;
  IF v_max_uses IS NOT NULL AND COALESCE(v_used_count, 0) >= v_max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (p_coupon_id, p_user_id)
  ON CONFLICT (coupon_id, user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;

  UPDATE public.coupon_codes SET used_count = COALESCE(used_count, 0) + 1
  WHERE id = p_coupon_id;

  RETURN jsonb_build_object('ok', true, 'used_count', COALESCE(v_used_count, 0) + 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID) TO service_role;
```

> `expires_at` **لا يُفحص عمداً** داخل التسوية: الجلسة التي أُنشئت والكوبون صالح وقتها تُحترم، حتى لو استغرق تأكيد البنك دقائق. يُفحص في `create-checkout` قبل الدفع.

### 5.5 RPC #3 — إلغاء الوصول عند الاسترجاع / النزاع

```sql
CREATE OR REPLACE FUNCTION public.revoke_subscription_from_refund(
  p_payment_intent_id TEXT,
  p_checkout_session_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  -- الاسترجاع من Dashboard يحمل payment_intent فقط، فنبحث عبر الاشتراك
  UPDATE public.checkout_sessions
  SET status = 'refunded', updated_at = NOW()
  WHERE id IN (
    SELECT checkout_session_id FROM public.user_subscriptions
    WHERE checkout_session_id IS NOT NULL
      AND (
        (p_payment_intent_id IS NOT NULL AND payment_intent_id = p_payment_intent_id)
        OR (p_checkout_session_id IS NOT NULL AND checkout_session_id = p_checkout_session_id)
      )
  );

  IF p_checkout_session_id IS NOT NULL THEN
    UPDATE public.checkout_sessions
    SET status = 'refunded', updated_at = NOW()
    WHERE id = p_checkout_session_id;
  END IF;

  UPDATE public.user_subscriptions SET is_active = false
  WHERE (p_payment_intent_id IS NOT NULL AND payment_intent_id = p_payment_intent_id)
     OR (p_checkout_session_id IS NOT NULL AND checkout_session_id = p_checkout_session_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'revoked', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_subscription_from_refund(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_subscription_from_refund(TEXT, TEXT) TO service_role;
```

### 5.6 RPC #4 — انتهاء الاشتراكات فعليًا

> بدون هذه الدالة يبقى `is_active = true` إلى الأبد، فتعرض لوحات التحكم
> والـ statistics مشتركين منتهيين كأنهم نشطون.

```sql
CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.user_subscriptions SET is_active = false
  WHERE is_active = true AND end_date <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions() TO service_role;

-- اختياري: شغّلها كل ١٠ دقائق — فعّل pg_cron من Database > Extensions أولاً
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('expire-stale-subscriptions');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule('expire-stale-subscriptions', '*/10 * * * *',
      'SELECT public.expire_stale_subscriptions()');
  END IF;
END;
$$;
```

### 5.7 بوابة الصلاحيات على مستوى الخادم

```sql
CREATE OR REPLACE FUNCTION public.can_access_exam(p_exam_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_is_free BOOLEAN; v_has_sub BOOLEAN;
BEGIN
  SELECT is_free INTO v_is_free FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_is_free THEN RETURN true; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  -- >= وليس > لتطابق فحص العميل .gte("end_date")
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = auth.uid() AND is_active = true AND end_date >= NOW()
  ) INTO v_has_sub;
  RETURN v_has_sub;
END;
$$;
```

---

## 6. المسار الأول: إنشاء جلسة الدفع

📄 `src/app/api/stripe/create-checkout/route.ts`

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SITE_URL } from "@/lib/site"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

// وجهة إعادة التوجيه يجب أن تأتي من إعداداتنا، لا من ترويسة الطلب.
// استخدام Origin يسمح لأي شخص بإرسال Origin مزوّر وتحويل المشتري
// إلى نطاق يسيطر عليه المهاجم (open redirect / phishing).
const siteUrl = SITE_URL

const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000
const SESSION_REUSE_WINDOW_MS = 15 * 60_000
const IDEMPOTENCY_BUCKET_MS = 10 * 60_000

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  // تنظيف العناصر المنتهية حتى لا تنمو الذاكرة بلا حدود
  if (rateLimit.size > 200) {
    for (const [k, v] of rateLimit) if (v.resetAt < now) rateLimit.delete(k)
  }
  const entry = rateLimit.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT
}

/** خطأ رسالته آمنة للعرض على المستخدم، مع رمز HTTP. */
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "HttpError"
  }
}

export async function POST(req: Request) {
  try {
    if (!platformSecretKey) throw new HttpError("Platform Stripe not configured.", 500)

    // 1) تحقّق من هوية المستخدم من الجلسة (الكوكيز) — لا trusts الجسم
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { planId, userId, couponCode } = await req.json()
    if (!planId || !userId) throw new HttpError("Missing planId or userId", 400)

    // 2) المستخدم لا يشتري إلا لنفسه
    if (userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!checkRateLimit(`checkout:${user.id}`))
      return NextResponse.json({ error: "Too many requests, try again in a minute" }, { status: 429 })

    const sb = createClient(supabaseUrl, supabaseKey)

    // 3) السعر يأتي من القاعدة فقط
    // 3) الخطة يجب أن تكون موجودة ومفعّلة.
    //    is_active يُفحص هنا (fail closed) وفي داخل RPC #1 مرة أخرى، فخطة
    //    مسحوبة لا تبقى قابلة للشراء لمجرد أن معرّفها ما زال في المتصفح.
    //    ‎.eq("is_active", true) يستبعد NULL أيضاً، وهذا مقصود.
    const { data: plan } = await sb
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single()
    if (!plan) throw new HttpError("Plan not found", 404)

    // 4) التحقق من الكوبون على الخادم
    let discountPercent = 0
    let couponId: string | null = null
    if (couponCode && typeof couponCode === "string") {
      const code = String(couponCode).trim().toUpperCase()
      const { data: c } = await sb.from("coupon_codes").select("*").eq("code", code).maybeSingle()
      const coupon = c as Record<string, unknown> | null

      if (!coupon || !coupon.is_active) throw new HttpError("Invalid coupon code", 400)
      if (coupon.expires_at && new Date(coupon.expires_at as string) < new Date())
        throw new HttpError("Coupon expired", 400)
      if (coupon.max_uses != null && Number(coupon.used_count) >= Number(coupon.max_uses))
        throw new HttpError("Coupon usage limit reached", 400)

      const couponPlanIds = Array.isArray(coupon.plan_ids) ? (coupon.plan_ids as string[]) : []
      if (!couponPlanIds.includes(planId)) throw new HttpError("Coupon not valid for this bundle", 400)

      const { count } = await sb
        .from("coupon_redemptions").select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id as string).eq("user_id", user.id)
      if ((count ?? 0) > 0) throw new HttpError("You already used this coupon", 400)

      const rawDiscount = Number(coupon.discount_percent)
      if (!Number.isFinite(rawDiscount)) throw new HttpError("Invalid coupon code", 400)
      discountPercent = Math.min(Math.max(rawDiscount, 0), 99)
      couponId = coupon.id as string
    }

    const planData = plan as Record<string, unknown>
    const stripe = new Stripe(platformSecretKey)
    const fullAmountCents = Math.round(Number(planData.price) * 100)
    if (!Number.isFinite(fullAmountCents) || fullAmountCents <= 0)
      throw new HttpError("Plan price is not configured correctly", 500)

    const finalCents = Math.round((fullAmountCents * (100 - discountPercent)) / 100)
    const durationDays = Number(planData.duration_days ?? 30)
    if (!Number.isFinite(durationDays) || durationDays <= 0)
      throw new HttpError("Plan duration is not configured correctly", 500)

    // 5) إعادة استخدام جلسة مفتوحة لنفس الخطة/السعر/الكوبون
    //    (نقر مزدوج أو تحديث الصفحة = جلسة ثانية = دفع مزدوج)
    const { data: recent } = await sb
      .from("checkout_sessions")
      .select("id, url, amount_cents, coupon_id")
      .eq("user_id", user.id).eq("plan_id", planId).eq("status", "pending")
      .gte("created_at", new Date(Date.now() - SESSION_REUSE_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle()

    if (recent?.url && recent.amount_cents === finalCents && (recent.coupon_id ?? null) === couponId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(recent.id)
        if (existing.status === "open" && existing.url)
          return NextResponse.json({ url: existing.url, reused: true })
      } catch { /* الجلسة لم تعد موجودة — أنشئ واحدة جديدة */ }
    }

    const origin = siteUrl
    const bucket = Math.floor(Date.now() / IDEMPOTENCY_BUCKET_MS)

    // 6) إنشاء جلسة Stripe — بدون حساب متصل: ١٠٠٪ للمنصة
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card", "ideal"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: planData.name as string },
            unit_amount: finalCents,
          },
          quantity: 1,
        }],
        client_reference_id: user.id,
        metadata: {
          plan_id: planId,
          duration_days: String(durationDays),
          ...(couponId ? { coupon_id: couponId, discount_percent: String(discountPercent) } : {}),
        },
        success_url: `${origin}/exams?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/exams?subscription=cancelled`,
      } as Stripe.Checkout.SessionCreateParams,
      // مفتاح ثابت لكل (مستخدم، خطة، كوبون، نافذة زمنية):
      // إعادة الإرسال بنفس المعطيات تعيد نفس الجلسة بدل إنشاء ثانية.
      { idempotencyKey: `checkout_session_${user.id}_${planId}_${couponId ?? "none"}_${bucket}` },
    )

    // 7) تسجيل الجلسة — insert لا upsert!
    //    عند تعارض مفتاح الـ idempotency يعيد Stripe نفس الجلسة المدفوعة،
    //    والـ upsert كان يعيد صفّنا إلى 'pending' فيختفي دفع ناجح.
    if (session.status === "open") {
      const { error: trackErr } = await sb.from("checkout_sessions").insert({
        id: session.id,
        user_id: user.id,
        plan_id: planId,
        url: session.url,
        amount_cents: finalCents,
        coupon_id: couponId,
        status: "pending",
        updated_at: new Date().toISOString(),
      })

      // 23505 = unique_violation: الصف موجود أصلاً، لا حاجة لفعل شيء
      if (trackErr && trackErr.code !== "23505") {
        //_fail closed_: ألغِ الجلسة عند Stripe حتى لا يُرسل المستخدم لصفحة
        // دفع لا نستطيع تتبّعها (وإلا عُرض الدفع الفاشل كـ"قيد التفعيل").
        try { await stripe.checkout.sessions.expire(session.id) }
        catch (expireErr) { console.error("Create checkout: could not expire untracked session", session.id, expireErr) }
        console.error("Create checkout: checkout_sessions insert failed", trackErr.message)
        throw new HttpError("Failed to create checkout session. Please try again.", 500)
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const err = e as { message?: string } | undefined
    if (e instanceof HttpError) {
      if (e.status >= 500) console.error("Create checkout error:", err?.message ?? e)
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    // لا تسرّب رسائل Stripe/Supabase الخام (قد تحتوي معرّفات داخلية)
    console.error("Create checkout error:", err?.message ?? e)
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 500 })
  }
}
```

---

## 7. المسار الثاني: Webhook

📄 `src/app/api/stripe/webhook/route.ts`

```ts
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function expandId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

export async function POST(req: Request) {
  if (!supabaseKey) return NextResponse.json({ error: "Server misconfigured: missing service role key" }, { status: 500 })
  if (!platformSecretKey) return NextResponse.json({ error: "Server misconfigured: missing platform Stripe key" }, { status: 500 })

  const body = await req.text()
  const signature = req.headers.get("stripe-signature") || ""
  const sb = createClient(supabaseUrl, supabaseKey)

  const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
  const webhookSecret = (settings?.payment_settings as Record<string, unknown> | undefined)?.webhook_secret as string | undefined
  if (!webhookSecret) {
    console.error("Webhook: webhook_secret not configured in site_settings.payment_settings")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const stripe = new Stripe(platformSecretKey)

  // 1) التحقق من التوقيع — إجباري قبل أي قراءة للبيانات
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (sigErr) {
    console.error("Webhook signature verification failed:", sigErr)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // 2) حارس التكرار (طبقة سريعة قبل الـ RPC)
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const { data: existing } = await sb.from("stripe_events").select("id").eq("id", event.id).maybeSingle()
    if (existing) return NextResponse.json({ received: true, duplicate: true })
  }

  /**
   * إلغاء الوصول + استرجاع تلقائي لأي دفع لا يمكننا احترامه.
   *
   * الترتيب مقصود: يُلغى الاشتراك **قبل** إعادة الأموال، فلا توجد لحظة
   * يبقى فيها الطالب ممسوحاً بدفع سنُعيده.
   *
   * يُرجع نجاح الإلغاء أم لا. عند الفشل يجب أن يردّ المستدعي بـ 500 ليعيد
   * Stripe المحاولة: الاسترجاع نفسه idempotent (مفتاح ثابت)، فإعادة المحاولة
   * لا تُصدر استرجاعاً ثانياً، بل تُعيد محاولة الإلغاء فقط.
   */
  const refundAndRevoke = async (
    paymentIntentId: string | null,
    checkoutSessionId: string | null,
    reason: string,
  ): Promise<{ revoked: boolean }> => {
    console.error("Webhook: revoking access and refunding", { reason, paymentIntentId, checkoutSessionId })

    const { error: revokeErr } = await sb.rpc("revoke_subscription_from_refund", {
      p_payment_intent_id: paymentIntentId,
      p_checkout_session_id: checkoutSessionId,
    })
    if (revokeErr) {
      console.error("Webhook: revoke RPC failed — will retry", {
        checkoutSessionId, reason, error: revokeErr.message,
      })
    }

    if (paymentIntentId) {
      try {
        const refund = await stripe.refunds.create(
          { payment_intent: paymentIntentId, reason: "requested_by_customer", metadata: { revoke_reason: reason } },
          // ثابت لكل (payment intent, reason): إعادة محاولة من Stripe تعيد
          // نفس الاسترجاع بدل ردّ المبلغ للطالب مرتين.
          { idempotencyKey: `auto_refund_${paymentIntentId}_${reason}` },
        )
        console.error("Webhook: auto-refund issued", refund.id, reason)
      } catch (refundErr) {
        // تسجيل صريح: طالب دفع فعلاً ويلزم استرجاع يدوي
        console.error("Webhook: AUTO-REFUND FAILED — manual action required", {
          paymentIntentId, reason,
          error: refundErr instanceof Error ? refundErr.message : refundErr,
        })
      }

      // Stripe لا يقبل duplicate/fraudulent عبر الـ API، لذا نستخدم
      // requested_by_customer. هذا مضلّل عند المراجعة لاحقاً، فنضيف
      // توضيحاً على الـ PaymentIntent يوضّح السبب الحقيقي.
      // غير قاتل: فشل التوضيح يجب ألا يمنع الإلغاء ولا يلغيه.
      try {
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            auto_refunded: "true",
            revoke_reason: reason,
            revoked_by: "system",
            revoked_at: new Date().toISOString(),
          },
        })
      } catch (metaErr) {
        console.error("Webhook: could not annotate PaymentIntent after refund", {
          paymentIntentId, reason,
          error: metaErr instanceof Error ? metaErr.message : metaErr,
        })
      }
    } else {
      console.error("Webhook: cannot auto-refund (no payment_intent) — manual action required", { reason, checkoutSessionId })
    }

    return { revoked: !revokeErr }
  }

  const activateSession = async (session: Stripe.Checkout.Session, eventId: string) => {
    const userId = session.client_reference_id
    const planId = session.metadata?.plan_id
    const paymentIntentId = expandId(session.payment_intent)

    // duration_days من الـ metadata الذي كتبناه بأنفسنا، لكن لا تمرّر قيمة
    // تالفة: الـ RPC يرفض المدة غير الموجبة، وتاريخ النهاية يُشتق في SQL.
    const parsedDuration = Number.parseInt(session.metadata?.duration_days ?? "", 10)
    const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30

    if (!userId || !planId) {
      // لا نعرف ما الذي اشتراه، فلا يمكننا منح الوصول — لكن المال حقيقي.
      // نسترجعه تلقائياً بدل تركه لإنسان يكتشفه في لوحة Stripe.
      console.error("Webhook: FATAL missing metadata, auto-refunding", {
        eventId, userId, planId, sessionId: session.id, paymentIntentId,
      })
      const { revoked } = await refundAndRevoke(paymentIntentId, session.id, "missing_metadata")
      if (!revoked) return { ok: false as const, status: 500 as const, body: { error: "Revoke failed" } }
      return { ok: true as const, fatal: true as const }
    }

    // اقبل UUID فقط للكوبون، وإلا فشل الـ RPC في التحويل وأعاد Stripe
    // المحاولة للأبد.
    const rawCoupon = session.metadata?.coupon_id
    const couponId = rawCoupon && UUID_RE.test(rawCoupon) ? rawCoupon : null

    // نداء واحد ذرّي يُسوّي كل شيء: ذاكرة الحدث + استبدال الكوبون +
    // إدراج الاشتراك + تحديث حالة الجلسة. إما أن يُحفظ كله أو لا شيء، فلا
    // يمكن أن يبقى طالب دفع دون وصول، أو كوبون مستهلك دون اشتراك.
    const { data: settlement, error: settleErr } = await sb.rpc("settle_paid_checkout_session", {
      p_event_id: eventId,
      p_checkout_session_id: session.id,
      p_plan_id: planId,
      p_user_id: userId,
      p_duration_days: durationDays,
      p_amount_cents: session.amount_total ?? null,
      p_coupon_id: couponId,
      p_payment_intent_id: paymentIntentId,
    })

    if (settleErr) {
      // فشل نقل/قاعدة بيانات، لا مشكلة بيانات: لم يُكتب شيء، فيُرجع 500
      // ليعيد Stripe محاولة التسوية كاملة.
      console.error("Webhook: settle_paid_checkout_session RPC failed", settleErr.message)
      return { ok: false as const, status: 500 as const, body: { error: "Failed to settle checkout session" } }
    }

    const result = settlement as {
      processed?: boolean; duplicate_event?: boolean; duplicate_session?: boolean
      error?: string; expected_cents?: number; received_cents?: number; refund?: boolean
    } | null

    if (result?.error) {
      console.error("Webhook: settlement rejected, refunding", {
        error: result.error, sessionId: session.id,
        expected_cents: result.expected_cents, received_cents: result.received_cents,
      })
      // كل الأخطاء هنا دائمة: مبلغ مخالف، خطة محذوفة أو مسحوبة، كوبون
      // غير موجود/معطّل/مستنفد، أو مدة بلا معنى. إعادة المحاولة لا تُصلح شيئاً،
      // فنسترجع ونؤكّد لوقف عاصفة إعادة المحاولة التي تدوم 3 أيام.
      const { revoked } = await refundAndRevoke(paymentIntentId, session.id, result.error)
      if (!revoked) return { ok: false as const, status: 500 as const, body: { error: "Revoke failed" } }
      return { ok: true as const, fatal: true as const }
    }

    if (!result?.processed) return { ok: true as const, duplicate: true as const }

    return { ok: true as const, processed: true as const }
  }

  // ----Handling الأحداث ----

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    // البطاقات: الدفع مكتمل هنا.
    // iDEAL: Stripe يُطلق completed **قبل** تأكيد البنك — ننتظر
    // async_payment_succeeded.
    if (session.payment_status === "paid") {
      const result = await activateSession(session, event.id)
      if (!result.ok) return NextResponse.json(result.body, { status: result.status })
      if (result.duplicate) return NextResponse.json({ received: true, duplicate: true })
      return NextResponse.json({ received: true, processed: true, fatal: result.fatal === true })
    }
    return NextResponse.json({ received: true })
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session
    const result = await activateSession(session, event.id)
    if (!result.ok) return NextResponse.json(result.body, { status: result.status })
    if (result.duplicate) return NextResponse.json({ received: true, duplicate: true })
    return NextResponse.json({ received: true, processed: true, fatal: result.fatal === true })
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session
    console.error("Webhook: async payment FAILED", { sessionId: session.id, userId: session.client_reference_id })
    if (session.id) {
      const { error } = await sb.from("checkout_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", session.id)
      if (error) console.error("Webhook: could not mark checkout session failed", error.message)
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.id) {
      const { error } = await sb.from("checkout_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", session.id)
      if (error) console.error("Webhook: could not mark checkout session expired", error.message)
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge
    // الاسترجاع الجزئي ليس سبباً للإلغاء — الكامل فقط
    const fullyRefunded = charge.amount_refunded >= charge.amount
    console.error("Webhook: charge.refunded", { chargeId: charge.id, amount: charge.amount, amountRefunded: charge.amount_refunded, fullyRefunded })
    if (fullyRefunded) {
      const paymentIntentId = expandId(charge.payment_intent)
      const { error } = await sb.rpc("revoke_subscription_from_refund", {
        p_payment_intent_id: paymentIntentId, p_checkout_session_id: null,
      })
      if (error) {
        // 500 makes Stripe retry. The RPC is just two UPDATEs, so a retry
        // is safe, and it is the only thing standing between a refunded
        // student and continued access.
        return NextResponse.json({ error: "Revoke after refund failed" }, { status: 500 })
      }
    }
  }

  if (event.type === "charge.dispute.created") {
    // النزاع يعني أن الأموال تُسحب — اقطع الوصول فوراً
    const dispute = event.data.object as Stripe.Dispute
    let paymentIntentId = expandId(dispute.payment_intent as string | { id: string } | null | undefined)
    if (!paymentIntentId && dispute.charge) {
      try {
        const charge = await stripe.charges.retrieve(typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id)
        paymentIntentId = expandId(charge.payment_intent)
      } catch (chargeErr) { console.error("Webhook: could not resolve dispute payment_intent", chargeErr) }
    }
    console.error("Webhook: DISPUTE created — revoking access", { disputeId: dispute.id, paymentIntentId })
    const { error } = await sb.rpc("revoke_subscription_from_refund", {
      p_payment_intent_id: paymentIntentId, p_checkout_session_id: null,
    })
    if (error) {
      // A dispute is funds being clawed back, so access must actually be cut.
      // 500 => Stripe retries until the revocation lands.
      console.error("Webhook: revoke-after-dispute failed, will retry", {
        disputeId: dispute.id, error: error.message,
      })
      return NextResponse.json({ error: "Revoke after dispute failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
```

---

## 8. التعامل من جانب العميل

بعد الدفع يعيد Stripe المستخدم إلى:

```
/exams?subscription=success&session_id={CHECKOUT_SESSION_ID}
```

`{CHECKOUT_SESSION_ID}` يُستبدل تلقائياً بمعرّف الجلسة الحقيقي.

### 8.1 المبدأ: لا تثق بإعادة التوجيه

العودة إلى `success_url` **لا تعني الدفع**. استطلاع الحالة:

```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get("subscription") !== "success") return

  const sessionId = params.get("session_id") ?? ""
  setStatusMessage({ type: "success", text: "Betaling gelukt! Abonnement wordt geactiveerd..." })
  window.history.replaceState({}, "", "/exams")   // نظّف الـ URL

  let attempts = 0
  const maxAttempts = 120                            // ~4 دقائق
  const interval = setInterval(async () => {
    attempts++
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { clearInterval(interval); return }

    // 1) هل هناك نتيجة نهائية؟
    if (sessionId) {
      const { data: cs } = await supabase
        .from("checkout_sessions").select("status").eq("id", sessionId).maybeSingle()

      if (cs?.status === "failed" || cs?.status === "expired") {
        setStatusMessage({
          type: "error",
          text: cs.status === "failed"
            ? "Betaling mislukt. Probeer het opnieuw of gebruik een andere betaalmethode."
            : "De betaling is verlopen. Start een nieuwe betaling.",
        })
        clearInterval(interval)
        return
      }
    }

    // 2) هل تم التفعيل؟
    const { data } = await supabase
      .from("user_subscriptions").select("*")
      .eq("user_id", user.id).eq("is_active", true).gte("end_date", new Date().toISOString())
      .order("end_date", { ascending: false }).limit(1)

    if (data && data.length > 0) {
      setSubscription({ plan: { name: "", features: [] }, end_date: data[0].end_date })
      setStatusMessage({ type: "success", text: "Betaling gelukt! Je abonnement is geactiveerd." })
      clearInterval(interval)
    } else if (attempts >= maxAttempts) {
      // لا تُعلن الفشل: iDEAL قد يكون-bank-lم يؤكد بعد.
      setStatusMessage({ type: "success", text: "Betaling verwerkt. Je abonnement wordt binnen enkele minuten geactiveerd." })
      setPendingActivation(true)
      clearInterval(interval)
    }
  }, 2000)

  return () => clearInterval(interval)
}, [])
```

ا### 8.2 ملاحظات مهمة

- **لا تقل "فشلت الدفع" أبداً قبل أن تعرف.** انتظر `status = 'failed'` أو `'expired'`.
- **RLS:** `checkout_sessions` تسمح بـ `SELECT` للمستخدم المسجَّل على صفوفه فقط.
- **أوقف الاستطلاع عند إخفاء التبويب** لتوفير الشبكة، واستأنف عند ظهوره.

---

## 9. قائمة الاختبار

اختبر **كل** السيناريوهات في **Test mode** قبل الإنتاج.

### 9.1 الوظيفي

| # | السيناريو | النتيجة المتوقعة |
|---|---|---|
| 1 | دفع بالبطاقة ناجح | `user_subscriptions` صف `is_active=true`، و `checkout_sessions.status='succeeded'` |
| 2 | دفع iDEAL ناجح | نفس النتيجة لكن **بعد** تأكيد البنك (بضع دقائق) |
| 3 | iDEAL **فشل** | `status='failed'`، المستخدم يرى رسالة خطأ واضحة، **لا** اشتراك |
| 4 | المستخدم يغلق المتصفح في منتصف الدفع | لا اشتراك (لأن التفعيل عبر webhook فقط) |
| 5 | جلسة منتهية (لم تُدفع) | `status='expired'` |
| 6 | نقر مزدوج على زر الشراء | جلسة Stripe **واحدة** فقط (بفضل `idempotencyKey` + إعادة الاستخدام) |
| 7 | إعادة إرسال نفس الحدث من Stripe (Test → webhook → resend) | لا اشتراك مكرر |
| 8 | إعادة تشغيل webhook يدوياً | نفس النتيجة |
| 9 | شراء خطة ٦ أشهر ثم خطأ شراء شهر | تبقى الـ ٦ أشهر (لا تقطع) |
| 10 | استرجاع كامل من Dashboard | `is_active=false` فوراً، `status='refunded'` |
| 11 | استرجاع جزئي | **لا** يلغي الوصول |
| 12 | نزاع (dispute) | `is_active=false` فوراً |
| 13 | كوبون ٢٠٪ | السعر = ٨٠٪، والكوبون يُستبدل مرة واحدة |
| 14 | نفس الكوبون لنفس المستخدم مرة ثانية | يُرفض في `create-checkout` |
| 15 | كوبون `max_uses=1` + طالبان يدفعان معاً | واحد فقط ينجح، الثاني **يُسترجع تلقائياً** |
| 16 | كوبون نشط حدّه انتهى أثناء الدفع | استرجاع تلقائي + `revoke_reason=coupon_limit_reached` |
| 17 | تعديل سعر الخطة أثناء وجود جلسة مفتوحة | `amount_mismatch` → استرجاع تلقائي |
| 18 | مستخدم غير مسجَّل يطلب `create-checkout` | 401 |
| 19 | `userId` مختلف عن المستخدم المسجَّل | 403 |
| 20 | أرقام عشوائية في `couponCode` | رسالة "Invalid coupon code" |

### 9.2 الأمان

| # | السيناريو | النتيجة المتوقعة |
|---|---|---|
| 21 | طلب يحمل `Origin: https://evil.com` | إعادة التوجيه إلى **نطاقك** لا إلى `evil.com` |
| 22 | توقيع webhook خاطئ | 400 |
| 23 | `client_reference_id` ناقص | لا وصول + سجل `FATAL missing metadata` + استرجاع يدوي |
| 24 | حاول طالب استدعاء `redeem_coupon` مباشرة | 403 (منعُ بـ GRANT/REVOKE) |

### 9.3 كيف تتأكد من نجاح العملية؟

- **Stripe Dashboard** ← قسم الأحداث (Events).
- **Supabase**:
```sql
SELECT id, status, plan_id, amount_cents, created_at
FROM public.checkout_sessions
ORDER BY created_at DESC LIMIT 10;

SELECT user_id, plan_id, start_date, end_date, is_active, payment_intent_id
FROM public.user_subscriptions
ORDER BY created_at DESC LIMIT 10;

SELECT * FROM public.stripe_events ORDER BY created_at DESC LIMIT 10;
```

---

## 10. قائمة المراجعة الأمنية

- [ ] `STRIPE_SECRET_KEY` و `SUPABASE_SERVICE_ROLE_KEY` **server فقط**، ولا Ral `NEXT_PUBLIC_`
- [ ] `.env.local` في `.gitignore`، وليس في Git
- [ ] `git log` و GitHub history لا تحتوي أسرار
- [ ] التحقق من توقيع الـ webhook قبل قراءة أي بيانات
- [ ] `userId` يأتي من الجلسة (الكوكيز)، ومن `body` يُرفض
- [ ] السعر يُحسب من القاعدة، **لا** يُقبل من العميل
- [ ] التفعيل لا يحدث إلا عبر الـ webhook
- [ ] الاسترجاع الجزئي لا يُلغي الوصول
- [ ] النزاع (dispute) يُلغي الوصول
- [ ] روابط إعادة التوجيه من الإعدادات، لا من ترويسة `Origin`
- [ ] دوال الـ RPC مسموحة لـ `service_role` فقط
- [ ] جدول `stripe_events` محمي من القراءة العامة
- [ ] تم تدوير جميع الأسرار التي ظهرت في محادثات/سجلات
- [ ] Rate limit على `create-checkout` (-store خارجي في serverless حقيقي)
- [ ] الخطة مفلترة بـ `is_active` في `create-checkout` **و** داخل دالة التسوية
- [ ] فهرس فريد `user_subscriptions_checkout_session_uniq` موجود
- [ ] التسوية (كوبون + اشتراك + حالة) في **معاملة واحدة** — لا نداءات منفصلة
- [ ] ذاكرة الحدث تُحذف في كل مسار خطأ، حتى تصبح إعادة المحاولة ممكنة
- [ ] فشل الإلغاء بعد استرجاع/نزاع يُرجع 500 (لا 200) ليعيد Stripe المحاولة
- [ ] الإلغاء يتم **قبل** الاسترجاع، لا بعده

---

## 11. الأخطاء الشائعة (فخاخ) — اقرأها قبل أن تبدأ

| # | الفخ | لماذا يوقع | الحل |
|---|---|---|---|
| 1 | تفعيل من `success_url` | المستخدم يغلق المتصفح → اشتراك مجاني | التفعيل عبر webhook فقط |
| 2 | `payment_status` غير مخزَّن | iDEAL يُطلق `completed` **قبل** تأكيد البنك | تحقق `=== "paid"` وانتظر `async_payment_succeeded` |
| 3 | نتيجة كتابة `checkout_sessions` غير مُفحوصة | الدفع الفاشل يُعرض للمستخدم كـ"قيد التفعيل" | سجّل الجلسة قبل إعادة التوجيه، **وافحص** نتيجة الكتابة |
| 4 | `upsert` على `checkout_sessions` | تعارض مفتاح الـ idempotency يعيد جلسة مدفوعة، والـ upsert يعيدها `pending` | استخدم `insert` وتجاهل `23505` |
| 5 | `MAX(start_date)` بلا شرط في المرور | اشتراك منتهٍ يُصفّر العداد مجاناً | `WHERE is_active AND end_date >= NOW()` |
| 6 | `int / 100` في SQL | قسمة أعداد صحيحة تُقطع (999×50/100 = 499 بدل 500) | `::numeric` + `ROUND` |
| 7 | `parseInt` بلا فحص | `NaN` → `Invalid Date` → 500 دائم | `Number.isFinite` |
| 8 | `max_uses` يُفحص قبل الدفع فقط | جلسات متزامنة تتجاوز الحد | `FOR UPDATE` داخل الاستبدال |
| 9 | `is_active` لا ينتهي | لوحات التحكم تُظهر منتهين كأنهم نشطون | `expire_stale_subscriptions()` + cron |
| 10 | `Origin` في `success_url` | open redirect / phishing | `SITE_URL` من الإعدادات |
| 11 | استرجاع لا يلغي الوصول | طالب مدفوع يبقى له وصول بعد الاسترجاع | عالج `charge.refunded` الكامل |
| 12 | `reason: "duplicate"` عبر API | Stripe يرفض (Dashboard فقط) | `requested_by_customer` + metadata توضيحية |
| 13 | Rate limit في الذاكرة | غير فعّال على serverless متعدد النسخ | Redis / Upstash |
| 14 | كشف رسالة Stripe الخام | تسرّب معرّفات داخلية | `HttpError` + catch عام |
| 15 | `gift card/100% discount` | يمكن إلغاء الاشتراك بـ0.01 € | رفض `amount <= 0` |
| 16 | تفعيل والكوبون في نداءين منفصلين | انهيار بينهما = طالب دفع بلا وصول + كوبون لم يُستهلك | معاملة واحدة (RPC #1) |
| 17 | ذاكرة الحدث تبقى بعد فشل جزئي | إعادة محاولة Stripe تُتخطّى فلا تُكمل العمل | `DELETE FROM stripe_events` في كل خطأ |
| 18 | `IF EXISTS` وحده لمنع التكرار | حدثان مختلفان لنفس الجلسة يمرّان معاً | فهرس فريد + التقاط `unique_violation` |
| 19 | `is_active` غير مفلتر عند الشراء | خطة مسحوبة تبقى قابلة للشراء | `.eq("is_active", true)` مرتين |
| 20 | الاسترجاع قبل الإلغاء | نافذة يبقى فيها الوصول معاد دفعها | ألغِ ثم استرجع |
| 21 | ترديد 200 بعد فشل الإلغاء | طالب مسترجَع منه يبقى نشطاً | ردّ 500 ليعيد Stripe المحاولة |

---

## 12. ملاحظات النشر

### 12.1 ترتيب التشغيل

```
1. supabase-schema.sql / supabase-fix-rls.sql     (الجداول + RLS + البوابات)
2. supabase-stripe-idempotency.sql                (stripe_events + RPCs)
3. supabase-stripe-payment-status.sql             (checkout_sessions)
4. supabase-stripe-hardening.sql                  (التحصين النهائي)
5. supabase-fix-attempt-gate.sql                  (إصلاح عدّاد المحاولات)
```

> ⚠️ **ترتيب مهم:** إذا لم تشغّل `supabase-stripe-hardening.sql` **فشل الدفع عمداً**
> (`fail closed`) — لأن أعمدة `checkout_sessions` غير موجودة ولا نستطيع تتبّع الجلسات.

### 12.2 قائمة قبل الإنتاج

- [ ] استبدل `sk_test_` بـ `sk_live_` في **Netlify** (وليس في المستودع)
- [ ] أنشئ Webhook في بيئة **Live** بـ `https://your-domain.com/api/stripe/webhook`
- [ ] ضع `whsec_...` الجديد في `site_settings`
- [ ] `NEXT_PUBLIC_SITE_URL` = نطاق الإنتاج
- [ ] فعّل `pg_cron` (Database → Extensions) أو شغّل `expire_stale_subscriptions()` بمجدول خارجي
- [ ] فعّل تنبيهاً على رسالتَي `AUTO-REFUND FAILED` و `FATAL missing metadata`
- [ ] أنشئ Rate limit حقيقي (Redis/Upstash) إن كنت على serverless
- [ ] اختبر كل سيناريوهات §9 في Test ثم **كرّرها** في Live ببطاقة اختبار

### 12.3 المراقبة المطلوبة

راقب هذه الرسائل في سجلّات الخادم — كلها تعني **فلوس حقيقية بلا خدمة مقدمة**:

```
AUTO-REFUND FAILED — manual action required
FATAL missing metadata, auto-refunding
cannot auto-refund (no payment_intent) — manual action required
```

أنشئ تنبيهاً عليها. نسيانها يعني طالب دفع ولم يحصل على شيء.

---

## 13. مراجع

- [Stripe Docs — Webhooks](https://docs.stripe.com/webhooks)
- [Stripe Docs — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe Docs — Checkout Sessions](https://docs.stripe.com/api/checkout/sessions)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL — `FOR UPDATE` lock](https://www.postgresql.org/docs/current/explicit-locking.html)

---

_هذا الدليل مكتوب ليكون مرجعاً قابلاً للنسخ. أي تعديل على الكود يجب أن يُطبَّق هنا أيضاً._
