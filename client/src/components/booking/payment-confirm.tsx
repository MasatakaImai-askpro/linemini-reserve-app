import { useState, useEffect } from "react";
import { Calendar, Clock, User, UserCircle, CreditCard, Loader2, Mail, Phone, FileText } from "lucide-react";
import { formatPrice, formatDuration, type Course, type Staff } from "@/lib/booking-api";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface PaymentConfirmProps {
  shopId: string;
  course: Course;
  staff: Staff | null;
  date: string;
  time: string;
  maxPartySize?: number;
  staffSelectionEnabled?: boolean;
  category: string;
  onConfirm: (info: { customerName: string; customerEmail: string; customerPhone: string; partySize?: number, customerNote: string }) => void;
  onBack: () => void;
}

function CardPaymentForm({
  shopId,
  course,
  customerName,
  customerEmail,
  customerPhone,
  onPaid,
  onBack,
  children,
}: {
  shopId: string;
  course: Course;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onPaid: () => void;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piError, setPiError] = useState("");

  useEffect(() => {
    if (course.price <= 0) return;
    fetch("/api/stripe/connect/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId,
        amount: course.price,
        currency: "jpy",
        courseName: course.name,
        courseId: course.id,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setPiError(data.error || "決済の準備に失敗しました");
      })
      .catch(() => setPiError("決済の準備に失敗しました"));
  }, [shopId, course.price, course.name, course.id]);

  const handlePay = async () => {
    if (!stripe || !elements || !clientSecret) return;
    setPaying(true);
    setCardError("");
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardEl,
        billing_details: {
          name: customerName,
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
        },
      },
    });

    if (error) {
      setCardError(error.message || "決済に失敗しました");
      setPaying(false);
    } else if (paymentIntent?.status === "succeeded") {
      onPaid();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {children}

      <div className="bg-muted px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" />
          カード情報
        </h2>
      </div>

      <div className="px-4 pb-2">
        {piError ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
            {piError}
          </div>
        ) : !clientSecret ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            決済を準備中...
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card px-3 py-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "14px",
                    color: "#1a1a1a",
                    fontFamily: "'Noto Sans JP', sans-serif",
                    "::placeholder": { color: "#9ca3af" },
                  },
                  invalid: { color: "#ef4444" },
                },
                hidePostalCode: true,
              }}
            />
          </div>
        )}
        {cardError && (
          <p className="text-xs text-destructive mt-1.5">{cardError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-4">
        <Button
          onClick={handlePay}
          disabled={paying || !stripe || !clientSecret || !!piError}
          className="w-full bg-primary py-6 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          data-testid="button-confirm-payment"
        >
          {paying ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />決済中...</span>
          ) : (
            `${formatPrice(course.price)} を支払って予約確定`
          )}
        </Button>
        <Button variant="outline" onClick={onBack} className="w-full py-5 text-sm" data-testid="button-confirm-back">
          戻る
        </Button>
      </div>
    </div>
  );
}

let stripePromiseCache: ReturnType<typeof loadStripe> | null = null;

async function getStripePromise() {
  if (stripePromiseCache) return stripePromiseCache;
  const res = await fetch("/api/stripe/config");
  const { publishableKey } = await res.json();
  stripePromiseCache = loadStripe(publishableKey);
  return stripePromiseCache;
}

export function PaymentConfirm({
  shopId,
  course,
  staff,
  date,
  time,
  maxPartySize = 20,
  staffSelectionEnabled = false,
  category,
  onConfirm,
  onBack,
}: PaymentConfirmProps) {
  // const parsedDate = parseISO(date);
  const parsedDate = date ? parseISO(date) : null;
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // スタッフなし設定の店舗のみ人数セレクタを表示
  const showPartySize = !staffSelectionEnabled;
  const needsPayment = course.prepaymentOnly && course.price > 0;

  useEffect(() => {
    if (needsPayment) {
      getStripePromise().then(setStripePromise);
    }
  }, [needsPayment]);

  const validate = () => {
    const e: typeof errors = {};
    if (!customerName.trim()) e.name = "お名前を入力してください";
    if (!customerEmail.trim()) e.email = "メールアドレスを入力してください";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) e.email = "正しいメールアドレスを入力してください";
    if (!customerPhone.trim()) e.phone = "電話番号を入力してください";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const info = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      partySize: showPartySize ? partySize : undefined,
      customerNote: notes.trim(),
    };
    if (!needsPayment) {
      onConfirm(info);
    } else {
      setFormSubmitted(true);
    }
  };

  // 人数表示対象のカテゴリか
  const targetCategory = ["gourmet"].includes(category);

  // 人数を表示させるか否か
  const isPartySizeVisible = showPartySize && targetCategory;

  const bookingInfo = (
    <div className="flex flex-col gap-0 divide-y divide-border bg-card">
      <div className="flex items-start gap-3 px-4 py-3">
        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="text-xs text-muted-foreground">日時</div>
          <div className="text-sm font-bold text-foreground" data-testid="text-confirm-datetime">
          {course.enableRequestMode ? (
            "店舗と相談して決定"
          ) : (
            parsedDate ? `${format(parsedDate, "yyyy年M月d日(E)", { locale: ja })} ${time}` : "日時未設定"
          )}
          </div>
        </div>
      </div>
      {staff && (
        <div className="flex items-start gap-3 px-4 py-3">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">担当スタッフ</div>
            <div className="text-sm font-bold text-foreground" data-testid="text-confirm-staff">{staff.name}</div>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3 px-4 py-3">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="text-xs text-muted-foreground">コース</div>
          <div className="text-sm font-bold text-foreground" data-testid="text-confirm-course">{course.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{formatDuration(course.duration)}</div>
        </div>
      </div>
      {isPartySizeVisible && (
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">人数</span>
          <span className="text-sm font-bold text-foreground" data-testid="text-confirm-party-size">{partySize}名</span>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-bold text-foreground">お支払い金額</span>
        <span className="text-xl font-bold text-primary" data-testid="text-confirm-price">{formatPrice(course.price)}</span>
      </div>
      <div className="px-4 py-3">
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {needsPayment ? "カードにて事前決済が必要です。決済は直接店舗アカウントへ送金されます" : "お支払いは当日店舗にてお願いいたします"}
        </div>
      </div>
    </div>
  );

  if (needsPayment && formSubmitted) {
    if (!stripePromise) {
      return (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Stripeを読み込み中...
        </div>
      );
    }
    return (
      <div className="flex flex-col" data-testid="booking-payment-confirm">
        <div className="bg-muted px-4 py-2.5">
          <h2 className="text-sm font-bold text-foreground">予約内容の確認・お支払い</h2>
        </div>
        {bookingInfo}
        <Elements stripe={stripePromise}>
          <CardPaymentForm
            shopId={shopId}
            course={course}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            onPaid={() => onConfirm({
              customerName: customerName.trim(),
              customerEmail: customerEmail.trim(),
              customerPhone: customerPhone.trim(),
              partySize: showPartySize ? partySize : undefined,
              customerNote: notes.trim(),
            })}
            onBack={() => setFormSubmitted(false)}
          >
            <div />
          </CardPaymentForm>
        </Elements>
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="booking-payment-confirm">
      <div className="bg-muted px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">予約内容の確認</h2>
      </div>

      {bookingInfo}

      <div className="bg-muted px-4 py-2.5 mt-1">
        <h2 className="text-sm font-bold text-foreground">お客様情報</h2>
      </div>

      <div className="flex flex-col gap-4 bg-card px-4 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="customerName" className="flex items-center gap-1.5 text-xs font-medium">
            <UserCircle className="h-3.5 w-3.5" />
            お名前 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="山田 太郎"
            data-testid="input-customer-name"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customerEmail" className="flex items-center gap-1.5 text-xs font-medium">
            <Mail className="h-3.5 w-3.5" />
            メールアドレス <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="example@email.com"
            data-testid="input-customer-email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customerPhone" className="flex items-center gap-1.5 text-xs font-medium">
            <Phone className="h-3.5 w-3.5" />
            電話番号 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="090-1234-5678"
            data-testid="input-customer-phone"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        {isPartySizeVisible && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <User className="h-3.5 w-3.5" />
              人数
            </Label>
            <Select
              value={String(partySize)}
              onValueChange={(v) => setPartySize(Number(v))}
            >
              <SelectTrigger data-testid="select-party-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxPartySize }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}名</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="flex items-center gap-1.5 text-xs font-medium">
            <FileText className="h-3.5 w-3.5" />
            備考
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="アレルギーや、特別なご要望があればご記入ください"
            className="resize-none text-sm"
            rows={3}
            data-testid="input-notes"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-4">
        <Button
          onClick={handleNext}
          className="w-full bg-primary py-6 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          data-testid="button-confirm-reservation"
        >
          {needsPayment ? "カード決済へ進む" : "予約を確定する"}
        </Button>
        <Button variant="outline" onClick={onBack} className="w-full py-5 text-sm" data-testid="button-confirm-back">
          戻る
        </Button>
      </div>
    </div>
  );
}
