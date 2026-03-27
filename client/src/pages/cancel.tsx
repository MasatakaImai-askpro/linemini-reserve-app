import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useBasePath } from "@/hooks/use-base-path";
import { Ban, Calendar, Clock, CreditCard, Check, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchCancelInfo, executeCancelByToken, formatPrice, formatDuration, type CancelInfo } from "@/lib/booking-api";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export default function CancelPage() {
  const params = useParams<{ shopId: string; token: string }>();
  const shopId = parseInt(params.shopId || "0");
  const token = params.token || "";
  const basePath = useBasePath();

  const [info, setInfo] = useState<CancelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!shopId || !token) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchCancelInfo(shopId, token)
      .then((data) => {
        setInfo(data);
        if (data.status === "cancelled") setCancelled(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shopId, token]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await executeCancelByToken(shopId, token);
      setCancelled(true);
    } catch {
      setError(true);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-sm w-full p-8 text-center" data-testid="cancel-error">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-lg font-bold">予約が見つかりません</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            このキャンセルリンクは無効です。<br />
            予約が既にキャンセルされたか、リンクが正しくない可能性があります。
          </p>
          <Link href={basePath}>
            <Button className="mt-6 w-full" data-testid="button-cancel-back-home">
              トップページへ
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const parsedDate = parseISO(info.date);

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-sm w-full p-8 text-center" data-testid="cancel-complete">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-bold">予約をキャンセルしました</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ご予約のキャンセルが完了しました。<br />
            またのご利用をお待ちしております。
          </p>

          <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-left">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {format(parsedDate, "yyyy年M月d日(E)", { locale: ja })} {info.time}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{info.courseName}</span>
            </div>
          </div>

          <Link href={basePath}>
            <Button className="mt-6 w-full" data-testid="button-cancel-done-home">
              トップページへ
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="max-w-sm w-full overflow-hidden" data-testid="cancel-confirm">
        <div className="bg-destructive/5 px-6 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-bold">予約をキャンセルしますか？</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            以下の予約をキャンセルします
          </p>
        </div>

        <div className="divide-y">
          <div className="flex items-start gap-3 px-6 py-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground">日時</div>
              <div className="text-sm font-bold" data-testid="text-cancel-datetime">
                {format(parsedDate, "yyyy年M月d日(E)", { locale: ja })} {info.time}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-6 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground">コース</div>
              <div className="text-sm font-bold" data-testid="text-cancel-course">{info.courseName}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatDuration(info.courseDuration)}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-6 py-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground">料金</div>
              <div className="text-sm font-bold" data-testid="text-cancel-price">
                {formatPrice(info.coursePrice)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-6 py-6">
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-6 text-sm font-bold"
            data-testid="button-execute-cancel"
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "キャンセルする"}
          </Button>
          <Link href={basePath}>
            <Button variant="outline" className="w-full py-5 text-sm" data-testid="button-cancel-back">
              戻る
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
