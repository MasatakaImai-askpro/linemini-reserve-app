import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { fetchStaff, fetchSlots, fetchSettings, bulkUpdateSlots, updateSlot, SHOP_STAFF_ID, type Staff } from "@/lib/booking-api";
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

const TIMES = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 10;
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}).filter((t) => t !== "19:30");

export function SlotManagement({ shopId }: { shopId: number }) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [slotStates, setSlotStates] = useState<SlotState>({});
  const [staffEnabled, setStaffEnabled] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStaff(shopId), fetchSettings(shopId)]).then(([s, settings]) => {
      setStaffList(s);
      const enabled = settings.staff_selection_enabled === "true";
      setStaffEnabled(enabled);
      if (enabled && s.length > 0) {
        setSelectedStaff(s[0].id);
      } else if (!enabled) {
        setSelectedStaff(SHOP_STAFF_ID);
      }
    }).catch(() => {
      setStaffList([]);
    }).finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => {
    if (!selectedStaff) return;
    fetchSlots(shopId, selectedStaff).then((slots) => {
      const states: SlotState = {};
      slots.forEach((s) => {
        const slot = s as unknown as { dayOfWeek: number; time: string; available: boolean };
        states[`${selectedStaff}-${slot.dayOfWeek}-${slot.time}`] = slot.available;
      });
      setSlotStates(states);
    });
  }, [selectedStaff, shopId]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const toggleSlot = async (dayIndex: number, time: string) => {
    const dayOfWeek = weekDays[dayIndex].getDay();
    const key = `${selectedStaff}-${dayOfWeek}-${time}`;
    const newVal = !(slotStates[key] ?? true);
    setSlotStates((prev) => ({ ...prev, [key]: newVal }));
    await updateSlot(shopId, selectedStaff, dayOfWeek, time, newVal);
  };

  const toggleDayAll = async (dayIndex: number) => {
    const dayOfWeek = weekDays[dayIndex].getDay();
    const allOpen = TIMES.every((time) => slotStates[`${selectedStaff}-${dayOfWeek}-${time}`] ?? true);
    const newStates = { ...slotStates };
    TIMES.forEach((time) => {
      newStates[`${selectedStaff}-${dayOfWeek}-${time}`] = !allOpen;
    });
    setSlotStates(newStates);
    await bulkUpdateSlots(shopId, selectedStaff, dayOfWeek, TIMES, !allOpen);
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
          <p className="text-sm text-muted-foreground">
            {staffEnabled ? "スタッフごとの予約受付時間を設定" : "店舗の予約受付時間を設定"}
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground w-[70px]">
                時間
              </th>
              {weekDays.map((day, i) => (
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
              ))}
            </tr>
          </thead>
          <tbody>
            {TIMES.map((time) => (
              <tr key={time} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-0.5 text-xs text-muted-foreground font-mono">
                  {time}
                </td>
                {weekDays.map((day, dayIndex) => {
                  const dayOfWeek = day.getDay();
                  const key = `${selectedStaff}-${dayOfWeek}-${time}`;
                  const isOpen = slotStates[key] ?? true;
                  return (
                    <td key={dayIndex} className="px-1 py-0.5 text-center">
                      <button
                        onClick={() => toggleSlot(dayIndex, time)}
                        className={`mx-auto flex h-6 w-full max-w-[80px] items-center justify-center rounded-sm text-[10px] font-medium transition-colors ${
                          isOpen
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
