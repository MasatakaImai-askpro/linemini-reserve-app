import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X, Loader2, Ban } from "lucide-react";
// import { fetchStaff, fetchSlots, fetchSettings, bulkUpdateSlots, updateSlot, SHOP_STAFF_ID, type Staff } from "@/lib/booking-api";
import { fetchStaff, fetchSlots, fetchSettings, bulkUpdateSlots, updateSlot, SHOP_STAFF_ID, type Staff, type StoreSettings } from "@/lib/booking-api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  format, startOfWeek, addDays, addWeeks, subWeeks,
} from "date-fns";
import { ja } from "date-fns/locale";

interface SlotState {
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
  const [slotStates, setSlotStates] = useState<SlotState>({});
  const [staffEnabled, setStaffEnabled] = useState(true);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [overrides, setOverrides] = useState<SlotState>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // useEffect(() => {
  //   setLoading(true);
  //   Promise.all([fetchStaff(shopId), fetchSettings(shopId)]).then(([s, settings]) => {
  //     setStaffList(s);
  //     const enabled = settings.staff_selection_enabled === true;
  //     setStaffEnabled(enabled);
  //     const ot = settings.store_open_time || "10:00";
  //     const ct = settings.store_close_time || "19:00";
  //     setStoreOpenTime(ot);
  //     setStoreCloseTime(ct);
  //     const times: string[] = [];
  //     const [oh] = ot.split(":").map(Number);
  //     const [ch] = ct.split(":").map(Number);
  //     for (let h = oh; h < ch; h++) {
  //       times.push(`${String(h).padStart(2, "0")}:00`);
  //       if (h < ch - 1) times.push(`${String(h).padStart(2, "0")}:30`);
  //     }
  //     setTimesToDisplay(times);
  //     if (enabled && s.length > 0) {
  //       setSelectedStaff(s[0].id);
  //     } else if (!enabled) {
  //       setSelectedStaff(SHOP_STAFF_ID);
  //     }
  //   }).catch(() => {
  //     setStaffList([]);
  //   }).finally(() => setLoading(false));
  // }, [shopId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStaff(shopId), fetchSettings(shopId)])
      .then(([s, st]) => {
        setStaffList(s);
        setSettings(st);
        const enabled = st.staff_selection_enabled === true;
        setStaffEnabled(enabled);
        if (enabled && s.length > 0) setSelectedStaff(s[0].id);
        else setSelectedStaff(SHOP_STAFF_ID);
      })
      .catch(() => setStaffList([]))
      .finally(() => setLoading(false));
  }, [shopId]);


  useEffect(() => {
    if (!selectedStaff) return;
    fetchSlots(shopId, selectedStaff).then((slots) => {
      const states: SlotState = {};
      slots.forEach((s) => {
        const slot = s as unknown as { day_of_week: number; time: string; available: boolean };
        states[`${selectedStaff}-${slot.day_of_week}-${slot.time}`] = slot.available;
      });
      setSlotStates(states);
    });
  }, [selectedStaff, shopId]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const TIMES = useMemo(
    () => generateTimes(settings?.store_open_time || "10:00", settings?.store_close_time || "19:00"),
    [settings?.store_open_time, settings?.store_close_time]
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
    
    // overrides（日付ベース）ではなく slotStates（曜日ベース）を参照するように変更
    const dayOfWeek = date.getDay();
    const key = `${selectedStaff}-${dayOfWeek}-${time}`;
    return slotStates[key] ?? true;
  }
  const toggleCell = async (date: Date, time: string) => {
    const { closed } = getClosedInfo(date);
    if (closed) return;

    // 引数の date から曜日（0〜6）を取得
    const dayOfWeek = date.getDay();
    const key = `${selectedStaff}-${dayOfWeek}-${time}`;
    const newVal = !(slotStates[key] ?? true);

    // 状態を更新
    setSlotStates((prev) => ({ ...prev, [key]: newVal }));

    // 既存の updateSlot API をそのまま流用して呼び出し
    await updateSlot(shopId, selectedStaff, dayOfWeek, time, newVal);
  };

  const toggleSlot = async (dayIndex: number, time: string) => {
    const dayOfWeek = weekDays[dayIndex].getDay();
    const key = `${selectedStaff}-${dayOfWeek}-${time}`;
    const newVal = !(slotStates[key] ?? true);
    setSlotStates((prev) => ({ ...prev, [key]: newVal }));
    await updateSlot(shopId, selectedStaff, dayOfWeek, time, newVal);
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

  const toggleDayAll = async (date: Date) => {
    const { closed } = getClosedInfo(date);
    if (closed) return;

    // 引数の date から曜日（0〜6）を取得
    const dayOfWeek = date.getDay();
    
    // 現在その曜日のすべての時間帯が「受付可」になっているかチェック
    const allOpen = TIMES.every((t) => {
      const key = `${selectedStaff}-${dayOfWeek}-${t}`;
      return slotStates[key] ?? true;
    });
    // すべて受付可なら「一括不可」に、それ以外なら「一括可」にする
    const next = !allOpen;

    // 1. フロントエンドの状態（slotStates）を即座に一括更新
    const newStates = { ...slotStates };
    TIMES.forEach((t) => {
      const key = `${selectedStaff}-${dayOfWeek}-${t}`;
      newStates[key] = next;
    });
    setSlotStates(newStates);

    // 2. ローディング表示用（該当する日付のキーをセット）
    const dk = toDateKey(date);
    setSavingKey(dk);

    try {
      // 提供された既存の bulkUpdateSlots API をそのまま流用
      await bulkUpdateSlots(shopId, selectedStaff, dayOfWeek, TIMES, next);
    } catch (e) {
      console.error("一括更新に失敗しました:", e);
    } finally {
      setSavingKey(null);
    }
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
            {settings?.store_open_time && settings?.store_close_time && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                {settings.store_open_time}〜{settings.store_close_time}
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">
            {format(weekDays[0], "M月d日", { locale: ja })} - {format(weekDays[6], "M月d日", { locale: ja })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} data-testid="button-next-week">
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
              {/* {weekDays.map((day, i) => (
                <th key={i} className="px-1 py-2 text-center">
                  <button
                    onClick={() => toggleDayAll(i)}
                    className="flex flex-col items-center gap-0.5 w-full rounded-md px-2 py-1 transition-colors hover:bg-muted"
                    data-testid={`slot-day-header-${i}`}
                  >
                    <span className={`text-[10px] font-medium ${
                      day.getDay() === 0 ? "text-destructive" : day.getDay() === 6 ? "text-blue-500" : "text-muted-foreground"
                    }`}>
                      {format(day, "E", { locale: ja })}
                    </span>
                    <span className={`text-sm font-bold ${
                      day.getDay() === 0 ? "text-destructive" : day.getDay() === 6 ? "text-blue-500" : "text-foreground"
                    }`}>
                      {format(day, "d")}
                    </span>
                  </button>
                </th>
              ))} */}
              {weekDays.map((day, i) => {
                const { closed, reason } = getClosedInfo(day);
                const isSun = day.getDay() === 0;
                const isSat = day.getDay() === 6;
                const isSaving = savingKey === toDateKey(day);
                return (
                  <th key={i} className={`px-1 py-2 text-center ${closed ? "bg-orange-50" : ""}`}>
                    <button
                      onClick={() => toggleDayAll(day)}
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
                    <td key={dayIndex} className="px-1 py-0.5 text-center">
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
                        {isOpen ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
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
