import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X, Loader2, Ban } from "lucide-react";
import { fetchStaff, fetchSettings, SHOP_STAFF_ID, type Staff, type StoreSettings } from "@/lib/booking-api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ja } from "date-fns/locale";

interface SlotDateOverrides {
  [key: string]: boolean;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function generateTimes(openTime: string, closeTime: string): string[] {
  const start = timeToMin(openTime || "10:00");
  const end = timeToMin(closeTime || "19:00");
  const times: string[] = [];
  for (let m = start; m < end; m += 30) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return times;
}

function parseDow(val: string | undefined | boolean): number[] {
  if (!val || typeof val === "boolean") return [];
  return String(val).split(",").map(Number).filter((n) => !isNaN(n));
}

function isNewYearDate(date: Date): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (m === 12 && d >= 29) || (m === 1 && d <= 3);
}

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const DOW_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export function SlotManagement({ shopId }: { shopId: number }) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [staffEnabled, setStaffEnabled] = useState(true);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [overrides, setOverrides] = useState<SlotDateOverrides>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStaff(shopId), fetchSettings(shopId)])
      .then(([s, st]) => {
        setStaffList(s);
        setSettings(st);
        const enabled = st.staff_selection_enabled === "true";
        setStaffEnabled(enabled);
        if (enabled && s.length > 0) setSelectedStaff(s[0].id);
        else setSelectedStaff(SHOP_STAFF_ID);
      })
      .catch(() => setStaffList([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  useEffect(() => {
    if (!selectedStaff) return;
    const from = toDateKey(weekDays[0]);
    const to = toDateKey(weekDays[6]);
    fetch(`/api/shops/${shopId}/slot-dates?staffId=${encodeURIComponent(selectedStaff)}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((rows: { date: string; time: string; available: boolean }[]) => {
        const map: SlotDateOverrides = {};
        rows.forEach((r) => { map[`${r.date}|${r.time}`] = r.available; });
        setOverrides(map);
      })
      .catch(() => {});
  }, [selectedStaff, shopId, currentWeekStart, weekDays]);

  const TIMES = useMemo(
    () => generateTimes(settings?.open_time || "10:00", settings?.close_time || "19:00"),
    [settings?.open_time, settings?.close_time]
  );

  const closedDow = useMemo(() => parseDow(settings?.closed_dow), [settings?.closed_dow]);
  const closedNewYear = settings?.closed_newyear === "true" || settings?.closed_newyear === true;

  function getClosedInfo(date: Date): { closed: boolean; reason: string } {
    const dow = date.getDay();
    if (closedDow.includes(dow)) return { closed: true, reason: `定休（${DOW_NAMES[dow]}）` };
    if (closedNewYear && isNewYearDate(date)) return { closed: true, reason: "年末年始" };
    return { closed: false, reason: "" };
  }

  function getCellAvailable(date: Date, time: string): boolean {
    const { closed } = getClosedInfo(date);
    if (closed) return false;
    const key = `${toDateKey(date)}|${time}`;
    return key in overrides ? overrides[key] : true;
  }

  const toggleCell = async (date: Date, time: string) => {
    const { closed } = getClosedInfo(date);
    if (closed) return;
    const dk = toDateKey(date);
    const key = `${dk}|${time}`;
    const next = !(key in overrides ? overrides[key] : true);
    setOverrides((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    try {
      await fetch(`/api/shops/${shopId}/slot-dates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedStaff, date: dk, time, available: next }),
      });
    } finally {
      setSavingKey(null);
    }
  };

  const toggleDate = async (date: Date) => {
    const { closed } = getClosedInfo(date);
    if (closed) return;
    const allOpen = TIMES.every((t) => getCellAvailable(date, t));
    const next = !allOpen;
    const dk = toDateKey(date);
    const newOverrides = { ...overrides };
    TIMES.forEach((t) => { newOverrides[`${dk}|${t}`] = next; });
    setOverrides(newOverrides);
    setSavingKey(dk);
    try {
      await fetch(`/api/shops/${shopId}/slot-dates/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedStaff, date: dk, times: TIMES, available: next }),
      });
    } finally {
      setSavingKey(null);
    }
  };

  const changeWeek = async (dir: "prev" | "next") => {
    setOverrides({});
    setCurrentWeekStart((w) => (dir === "prev" ? subWeeks(w, 1) : addWeeks(w, 1)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="admin-slot-management">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">予約枠管理</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {staffEnabled ? "スタッフごとの予約受付時間を設定" : "店舗の予約受付時間を設定"}
            {settings?.open_time && settings?.close_time && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                {settings.open_time}〜{settings.close_time}
              </span>
            )}
            {closedDow.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                定休：{closedDow.map((d) => DOW_NAMES[d]).join("・")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {staffEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">スタッフ:</span>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-[180px]" data-testid="select-slot-staff">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => changeWeek("prev")}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">
            {format(weekDays[0], "M月d日", { locale: ja })} - {format(weekDays[6], "M月d日", { locale: ja })}
          </span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => changeWeek("next")}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-sm bg-[#06C755]" />
          <span className="text-xs text-muted-foreground">受付可</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-sm bg-muted border border-border" />
          <span className="text-xs text-muted-foreground">受付不可</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-sm bg-orange-100 border border-orange-200" />
          <span className="text-xs text-muted-foreground">定休日</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[70px]">
                時間
              </th>
              {weekDays.map((day, i) => {
                const { closed, reason } = getClosedInfo(day);
                const isSun = day.getDay() === 0;
                const isSat = day.getDay() === 6;
                const isSaving = savingKey === toDateKey(day);
                return (
                  <th key={i} className={`px-1 py-2 text-center ${closed ? "bg-orange-50" : ""}`}>
                    <button
                      onClick={() => toggleDate(day)}
                      disabled={closed || isSaving}
                      className={`flex flex-col items-center gap-0.5 w-full rounded-md px-2 py-1 transition-colors ${
                        closed
                          ? "cursor-default"
                          : "hover:bg-muted active:bg-muted/80"
                      }`}
                      data-testid={`slot-day-header-${i}`}
                      title={closed ? reason : "クリックして一括変更"}
                    >
                      <span className={`text-[10px] font-medium ${
                        isSun ? "text-destructive" : isSat ? "text-blue-500" : "text-muted-foreground"
                      }`}>
                        {format(day, "E", { locale: ja })}
                      </span>
                      <span className={`text-sm font-bold ${
                        isSun ? "text-destructive" : isSat ? "text-blue-500" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </span>
                      {isSaving ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
                      ) : closed ? (
                        <span className="text-[9px] text-orange-600 font-semibold leading-tight">{reason}</span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground/50">一括</span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {TIMES.map((time) => (
              <tr key={time} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-0.5 text-xs text-muted-foreground font-mono">
                  {time}
                </td>
                {weekDays.map((day, dayIndex) => {
                  const { closed } = getClosedInfo(day);
                  const key = `${toDateKey(day)}|${time}`;
                  const isOpen = getCellAvailable(day, time);
                  const isSaving = savingKey === key || savingKey === toDateKey(day);
                  return (
                    <td
                      key={dayIndex}
                      className={`px-1 py-0.5 text-center ${closed ? "bg-orange-50/40" : ""}`}
                    >
                      <button
                        onClick={() => toggleCell(day, time)}
                        disabled={closed || isSaving}
                        className={`mx-auto flex h-6 w-full max-w-[80px] items-center justify-center rounded-sm text-[10px] font-medium transition-colors ${
                          closed
                            ? "bg-orange-100/70 text-orange-300 cursor-default"
                            : isSaving
                              ? "bg-muted text-muted-foreground/30 cursor-wait"
                              : isOpen
                                ? "bg-[#06C755]/15 text-[#06C755] hover:bg-[#06C755]/25"
                                : "bg-muted text-muted-foreground/40 hover:bg-muted/80"
                        }`}
                        data-testid={`slot-${dayIndex}-${time}`}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : closed ? (
                          <Ban className="h-3 w-3" />
                        ) : isOpen ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {TIMES.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  営業時間が設定されていません。「予約設定」タブで営業時間を設定してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        日付の見出しをクリックすると、その日の全時間帯を一括で受付可/不可に切り替えます（その日のみ）。定休日は変更できません。
      </p>
    </div>
  );
}
