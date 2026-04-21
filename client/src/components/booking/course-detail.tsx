import { Clock, CreditCard, Info } from "lucide-react";
import { formatPrice, formatDuration, type Course } from "@/lib/booking-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CourseDetailProps {
  shopId: number;
  course: Course;
  onBook: () => void;
}

export function CourseDetail({ course, onBook }: CourseDetailProps) {
  return (
    <div className="flex flex-col" data-testid="booking-course-detail">
    {course.imageUrl && (
      <div 
        className="relative h-48 bg-cover bg-center rounded-t-lg border-b border-border bg-muted w-full" 
        style={{ backgroundImage: `url(${course.imageUrl})` }}
      >
      </div>
    )}

      <div className="flex flex-col gap-4 px-4 py-5">
        <div>
          <div className="flex items-center gap-2">
            {course.prepaymentOnly && (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                <CreditCard className="h-2.5 w-2.5" />
                事前決済
              </Badge>
            )}
          </div>
          <h2 className="mt-2 text-lg font-bold text-foreground" data-testid="text-course-name">{course.name}</h2>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDuration(course.duration)}
          </span>
          <span className="text-xl font-bold text-primary" data-testid="text-course-price">
            {formatPrice(course.price)}
          </span>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">コース内容</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {course.description}
          </p>
        </div>

        {course.enableRequestMode && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <Info className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold mb-0.5">日時指定なしの予約となります</p>
              <p>
                リクエスト送信後、店舗よりご連絡いたしますので日程調整を行ってください。
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={onBook}
          className="mt-2 w-full rounded-xl py-6 text-base font-bold"
          data-testid="button-book-course"
        >
          {course.enableRequestMode ? "予約リクエストを送信する" : "このコースを予約する"}
        </Button>
      </div>
    </div>
  );
}
