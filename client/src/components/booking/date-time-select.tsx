import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetchSlots, SHOP_STAFF_ID, type Course, type Staff, type TimeSlot } from "@/lib/booking-api";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import { ja } from "date-fns/locale";

interface DateTimeSelectProps {
  shopId: number;
  course: Course;
  staff: Staff | null;
  onSelect: (date: string, time: string) => void;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function DateTimeSelect({ shopId, course, staff, onSelect }: DateTimeSelectProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  useEffect(() => {
    if (!selectedDate) return;
    const staffId = staff?.id || SHOP_STAFF_ID;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setLoadingSlots(true);
    fetchSlots(shopId, staffId, dateStr, course.id).then((slots) => {
      setTimeSlots(slots);
    }).catch(() => {
      setTimeSlots([]);
    }).finally(() => {
      setLoadingSlots(false);
    });
  }, [selectedDate, staff, shopId]);

  const handleDateClick = (date: Date) => {
    if (isBefore(date, today) || !isSameMonth(date, currentMonth)) return;
    setSelectedDate(date);
  };

  const handleTimeClick = (time: string) => {
    if (!selectedDate) return;
    onSelect(format(selectedDate, "yyyy-MM-dd"), time);
  };

  return (
    <div className="flex flex-col" data-testid="booking-datetime-select">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">選択中</div>
        <div className="mt-0.5 text-sm font-bold text-foreground">{course.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {staff ? `担当: ${staff.name}` : ""}
        </div>
      </div>

      <div className="bg-muted px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">日時を選択</h2>
      </div>

      <div className="bg-card px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-foreground" data-testid="text-current-month">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-1 text-center text-[11px] font-medium ${
                i === 0 ? "text-destructive" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {calendarDays.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth);
            const past = isBefore(day, today);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const todayMark = isToday(day);
            const dayOfWeek = day.getDay();
            const disabled = !inMonth || past;

            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => handleDateClick(day)}
                className={`flex h-9 w-full items-center justify-center text-xs transition-colors ${
                  disabled
                    ? "text-muted-foreground/30"
                    : selected
                      ? "rounded-full bg-primary font-bold text-primary-foreground"
                      : todayMark
                        ? "rounded-full font-bold text-primary underline"
                        : dayOfWeek === 0
                          ? "text-destructive hover:bg-muted rounded-full"
                          : dayOfWeek === 6
                            ? "text-blue-500 hover:bg-muted rounded-full"
                            : "text-foreground hover:bg-muted rounded-full"
                }`}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="flex flex-col">
          <div className="bg-muted px-4 py-2.5">
            <h2 className="text-sm font-bold text-foreground" data-testid="text-selected-date">
              {format(selectedDate, "M月d日(E)", { locale: ja })}の空き状況
            </h2>
          </div>
          {loadingSlots ? (
            <div className="flex items-center justify-center bg-card py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 bg-card p-4">
              {timeSlots.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => handleTimeClick(slot.time)}
                  className={`rounded-md border px-2 py-2.5 text-center text-xs font-medium transition-colors ${
                    slot.available
                      ? "border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground/40 line-through"
                  }`}
                  data-testid={`time-slot-${slot.time}`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
