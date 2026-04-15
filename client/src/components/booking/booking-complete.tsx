import { Check, Calendar, Clock, CreditCard, Link2, User } from "lucide-react";
import { formatPrice, formatDuration, type Course, type Staff } from "@/lib/booking-api";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface BookingCompleteProps {
  shopId: number;
  course: Course;
  staff: Staff | null;
  date: string;
  time: string;
  reservationId: string | null;
  reservationToken: string | null;
  onClose: () => void;
}

export function BookingComplete({ shopId, course, staff, date, time, reservationToken, onClose}: BookingCompleteProps) {
  // const parsedDate = parseISO(date);
  const parsedDate = date ? parseISO(date) : null;
  const isRequest = course.enableRequestMode;
  const cancelUrl = reservationToken
    ? `${window.location.origin}/app/cancel/${shopId}/${reservationToken}`
    : null;

  return (
    <div className="flex flex-col items-center" data-testid="booking-complete">
      <div className="flex flex-col items-center bg-card px-4 pb-4 pt-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#06C755]">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-foreground" data-testid="text-booking-complete">
          {isRequest ? "予約リクエストを送信しました" : "予約が完了しました"}
        </h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {isRequest ? "店舗よりご連絡させていただきます" : "ご予約ありがとうございます。"}
        </p>
      </div>

      <div className="mt-2 w-full">
        <div className="bg-muted px-4 py-2.5">
          <h3 className="text-sm font-bold text-foreground">予約詳細</h3>
        </div>
        <div className="flex flex-col divide-y divide-border bg-card">
          <div className="flex items-start gap-3 px-4 py-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />
            <div>
              <div className="text-xs text-muted-foreground">日時</div>
              <div className="text-sm font-bold text-foreground">
                {isRequest || !parsedDate ? (
                  "日時指定なし"
                ) : (
                  `${format(parsedDate, "yyyy年M月d日(E)", { locale: ja })} ${time}`
                )}
              </div>
            </div>
          </div>
          {!isRequest && staff && (
            <div className="flex items-start gap-3 px-4 py-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />
              <div>
                <div className="text-xs text-muted-foreground">担当スタッフ</div>
                <div className="text-sm font-bold text-foreground">{staff.name}</div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 px-4 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />
            <div>
              <div className="text-xs text-muted-foreground">コース</div>
              <div className="text-sm font-bold text-foreground">{course.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatDuration(course.duration)}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />
            <div>
              <div className="text-xs text-muted-foreground">お支払い</div>
              <div className="text-sm font-bold text-foreground">
                {formatPrice(course.price)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {course.prepaymentOnly ? "(事前決済)" : "(当日払い)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {cancelUrl && (
        <div className="w-full mt-2">
          <div className="bg-muted px-4 py-2.5">
            <h3 className="text-sm font-bold text-foreground">キャンセルについて</h3>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              予約をキャンセルする場合は、以下のリンクからお手続きください。
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-primary" />
              <a
                href={cancelUrl}
                className="text-xs text-primary underline break-all"
                data-testid="link-cancel-url"
              >
                キャンセルページを開く
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col gap-2 px-4 py-6 bg-card">
        <Button
          onClick={onClose}
          className="w-full bg-[#06C755] py-6 text-sm font-bold text-white hover:bg-[#05b04b]"
          data-testid="button-booking-done"
        >
          トップに戻る
        </Button>
      </div>
    </div>
  );
}
