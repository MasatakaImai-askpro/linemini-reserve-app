import { useState, useEffect } from "react";
import { Clock, ChevronRight, CreditCard, Loader2, MapPin, Phone, Mail, CalendarOff, Send, CheckCircle, ImageIcon } from "lucide-react";
import { fetchCourses, fetchSettings, createInquiry, formatPrice, formatDuration, type Course, type StoreSettings } from "@/lib/booking-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CourseSelectProps {
  shopId: number;
  stripeConnectId?: string | null;
  stripeConnectStatus?: string | null;
  onSelect: (course: Course) => void;
}

type MenuItem = {
    id: number;
    name: string;
    price: number;
    comment: string;
    imageUrl: string | null;
    isVisible: boolean;
    displayOrder: number;
  };

  type Tab = "courses" | "menu" | "store-info";

export function CourseSelect({ shopId, stripeConnectId, stripeConnectStatus, onSelect}: CourseSelectProps) {
  const stripeActive = !!(stripeConnectId && stripeConnectStatus === "active");
  const [activeTab, setActiveTab] = useState<Tab>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
      setLoading(true);
      Promise.all([
        fetchCourses(shopId),
        fetchSettings(shopId),
        fetch(`/api/shops/${shopId}/menu-items`).then((r) => r.ok ? r.json() : []),
      ]).then(([c, s, m]) => {
        setCourses(c);
        setSettings(s);
        setMenuItems(m || []);
        setLoading(false);
      });
    }, [shopId]);

  const handleSubmit = async () => {
    if (!formName || !formMessage) return;
    setSending(true);
    await createInquiry(shopId, {
      name: formName,
      email: formEmail || undefined,
      phone: formPhone || undefined,
      message: formMessage,
    });
    setSending(false);
    setSent(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="booking-course-select">

      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab("courses")}
          className={`flex-1 px-4 py-3 text-center text-sm font-bold ${
            activeTab === "courses"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
          data-testid="tab-courses"
        >
          コース一覧
        </button>
        {menuItems.length > 0 && (
            <button
              onClick={() => setActiveTab("menu")}
              className={`flex-1 px-4 py-3 text-center text-sm font-bold ${
                activeTab === "menu"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-menu"
            >
              メニュー
            </button>
          )}
                  <button
          onClick={() => setActiveTab("store-info")}
          className={`flex-1 px-4 py-3 text-center text-sm font-bold ${
            activeTab === "store-info"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
          data-testid="tab-store-info"
        >
          店舗情報
        </button>
      </div>

      {/* {activeTab === "courses" && (
        <>
          {!stripeActive && courses.some((c) => c.prepaymentOnly) && (
            <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 leading-relaxed">
                「事前決済」マークのコースはオンライン決済の設定が完了していないため、現在ご予約いただけません。
              </p>
            </div>
          )}
          {categories.map((category) => (
            <div key={category} className="flex flex-col">
              <div className="bg-muted px-4 py-2.5">
                <h2 className="text-sm font-bold text-foreground">{category}</h2>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {courses.filter((c) => c.category === category).map((course) => {
                  const disabled = course.prepaymentOnly && !stripeActive;
                  return (
                    <button
                      key={course.id}
                      onClick={() => !disabled && onSelect(course)}
                      disabled={disabled}
                      className={`flex items-start gap-3 px-4 py-4 text-left transition-colors ${
                        disabled
                          ? "bg-muted/30 opacity-50 cursor-not-allowed"
                          : "bg-card hover:bg-muted/50 active:bg-muted"
                      }`}
                      data-testid={`course-item-${course.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{course.name}</h3>
                          {course.prepaymentOnly && (
                            <Badge
                              variant="secondary"
                              className={`gap-1 text-[10px] px-1.5 py-0 ${
                                stripeActive
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <CreditCard className="h-2.5 w-2.5" />
                              事前決済
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {course.description}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(course.duration)}
                          </span>
                          <span className="text-base font-bold text-primary">
                            {formatPrice(course.price)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )} */}

      {activeTab === "courses" && (
        <>
          {/* Stripe未設定時の警告ボックス（ロジックは維持） */}
          {!stripeActive && courses.some((c) => c.prepaymentOnly) && (
            <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 leading-relaxed">
                「事前決済」マークのコースはオンライン決済の設定が完了していないため、現在ご予約いただけません。
              </p>
            </div>
          )}

          {/* コースを直接ループして表示 */}
          <div className="flex flex-col divide-y divide-border">
            {courses.map((course) => {
              const disabled = course.prepaymentOnly && !stripeActive;
              return (
                <button
                  key={course.id}
                  onClick={() => !disabled && onSelect(course)}
                  disabled={disabled}
                  className={`flex items-start gap-3 px-4 py-4 text-left transition-colors ${
                    disabled
                      ? "bg-muted/30 opacity-50 cursor-not-allowed"
                      : "bg-card hover:bg-muted/50 active:bg-muted"
                  }`}
                  data-testid={`course-item-${course.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{course.name}</h3>
                      {course.prepaymentOnly && (
                        <Badge
                          variant="secondary"
                          className={`gap-1 text-[10px] px-1.5 py-0 ${
                            stripeActive
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <CreditCard className="h-2.5 w-2.5" />
                          事前決済
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {course.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(course.duration)}
                      </span>
                      <span className="text-base font-bold text-primary">
                        {formatPrice(course.price)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "menu" && (
          <div className="flex flex-col" data-testid="booking-menu-tab">
            <div className="bg-muted px-4 py-2.5">
              <h2 className="text-sm font-bold text-foreground">メニュー</h2>
            </div>
            <div className="flex flex-col divide-y divide-border bg-card">
              {menuItems.map((item) => (
                <div key={item.id} className="flex gap-3 px-4 py-3" data-testid={`menu-item-${item.id}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground" data-testid={`menu-name-${item.id}`}>{item.name}</p>
                    <p className="text-base font-bold text-primary">¥{item.price.toLocaleString()}</p>
                    {item.comment && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

              {activeTab === "store-info" && settings && (
        <>
          {sent ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#06C755]/10">
                <CheckCircle className="h-8 w-8 text-[#06C755]" />
              </div>
              <h2 className="text-lg font-bold text-foreground">送信完了</h2>
              <p className="text-center text-sm text-muted-foreground">
                お問い合わせありがとうございます。<br />内容を確認し、折り返しご連絡いたします。
              </p>
              <Button variant="outline" onClick={() => { setSent(false); setActiveTab("courses"); }} className="mt-4">
                コース一覧に戻る
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-muted px-4 py-2.5">
                <h2 className="text-sm font-bold text-foreground">店舗情報</h2>
              </div>
              <div className="flex flex-col divide-y divide-border bg-card">
                {settings.store_description && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-foreground leading-relaxed">{settings.store_description}</p>
                  </div>
                )}
                <div className="flex items-start gap-3 px-4 py-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">住所</div>
                    <div className="text-sm text-foreground">{settings.store_address || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">電話番号</div>
                    <div className="text-sm text-foreground">{settings.store_phone || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">メール</div>
                    <div className="text-sm text-foreground">{settings.store_email || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">営業時間</div>
                    <div className="text-sm text-foreground">{settings.store_hours || "-"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">定休日</div>
                    <div className="text-sm text-foreground">{settings.store_closed_days || "-"}</div>
                  </div>
                </div>
              </div>

              {/* <div className="bg-muted px-4 py-2.5">
                <h2 className="text-sm font-bold text-foreground">お問い合わせ</h2>
              </div>

              {!showForm ? (
                <div className="bg-card px-4 py-4">
                  <Button
                    onClick={() => setShowForm(true)}
                    className="w-full gap-2 bg-primary py-5 text-sm font-bold text-primary-foreground"
                    data-testid="button-open-inquiry"
                  >
                    <Send className="h-4 w-4" />
                    お問い合わせフォームを開く
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 bg-card px-4 py-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">お名前 *</label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="山田 太郎" className="text-sm" data-testid="input-inquiry-name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">メールアドレス</label>
                    <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="example@email.com" className="text-sm" data-testid="input-inquiry-email" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">電話番号</label>
                    <Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="090-1234-5678" className="text-sm" data-testid="input-inquiry-phone" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">お問い合わせ内容 *</label>
                    <Textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} placeholder="ご質問やご要望をお書きください..." rows={4} className="text-sm" data-testid="input-inquiry-message" />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formName || !formMessage || sending}
                    className="w-full gap-2 bg-primary py-5 text-sm font-bold text-primary-foreground"
                    data-testid="button-submit-inquiry"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    送信する
                  </Button>
                </div>
              )} */}
            </>
          )}
        </>
      )}
    </div>
  );
}
