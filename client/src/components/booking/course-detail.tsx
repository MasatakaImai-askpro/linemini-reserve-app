import { Clock, CreditCard } from "lucide-react";
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

        <Button
          onClick={onBook}
          className="mt-2 w-full rounded-xl py-6 text-base font-bold"
          data-testid="button-book-course"
        >
          このコースを予約する
        </Button>
      </div>
    </div>
  );
}
