import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import type { Shop } from "@shared/schema";
import { CourseSelect } from "@/components/booking/course-select";
import { CourseDetail } from "@/components/booking/course-detail";
import { StaffSelect } from "@/components/booking/staff-select";
import { DateTimeSelect } from "@/components/booking/date-time-select";
import { PaymentConfirm } from "@/components/booking/payment-confirm";
import { BookingComplete } from "@/components/booking/booking-complete";
import { createReservation, fetchSettings, SHOP_STAFF_ID, type Course, type Staff } from "@/lib/booking-api";

type Step = "course" | "course-detail" | "staff" | "datetime" | "confirm" | "complete";

const STEP_TITLES: Record<Step, string> = {
  course: "コース一覧",
  "course-detail": "コース詳細",
  staff: "スタッフ選択",
  datetime: "日時選択",
  confirm: "予約確認",
  complete: "予約完了",
};

export default function ReservationPage() {
  const params = useParams<{ id: string }>();
  const shopId = parseInt(params.id || "0");
  const [, navigate] = useLocation();

  const { data: shop, isLoading } = useQuery<Shop>({
    queryKey: ["/api/shops", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/shops/${params.id}`);
      if (!res.ok) throw new Error("Shop not found");
      return res.json();
    },
  });

  const [step, setStep] = useState<Step>("course");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [staffSelectionEnabled, setStaffSelectionEnabled] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [reservationToken, setReservationToken] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    fetchSettings(shopId).then((s) => {
      setStaffSelectionEnabled(s.staff_selection_enabled === "true");
    }).catch(() => {});
  }, [shopId]);

  const handleBack = () => {
    switch (step) {
      case "course-detail":
        setStep("course");
        break;
      case "staff":
        setStep("course-detail");
        break;
      case "datetime":
        setStep(staffSelectionEnabled ? "staff" : "course-detail");
        break;
      case "confirm":
        setStep("datetime");
        break;
      default:
        break;
    }
  };

  const handleReset = () => {
    setStep("course");
    setSelectedCourse(null);
    setSelectedStaff(null);
    setSelectedDate("");
    setSelectedTime("");
    setReservationId(null);
    setReservationToken(null);
  };

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Skeleton className="w-full h-[200px] rounded-md" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="bg-background flex items-center justify-center py-20">
        <Card className="p-8 text-center overflow-visible">
          <h2 className="font-bold text-lg mb-2">お店が見つかりませんでした</h2>
          <Button variant="outline" onClick={() => navigate("/app")}>
            トップページへ戻る
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        {step !== "course" && step !== "complete" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleBack}
            data-testid="button-booking-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            戻る
          </Button>
        ) : (
          <div />
        )}
        <span className="text-xs font-medium text-muted-foreground" data-testid="text-booking-step">
          {STEP_TITLES[step]}
        </span>
      </div>

      {step === "course" && (shop.reservationImageUrl || shop.imageUrl) && (
        <div className="relative">
          <img
            src={shop.reservationImageUrl || shop.imageUrl}
            alt={shop.name}
            className="w-full h-[120px] object-cover"
            data-testid="img-reservation-hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <p className="text-white text-sm font-bold">{shop.name}</p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto">
        {step === "course" && (
          <CourseSelect
            shopId={shopId}
            onSelect={(course) => {
              setSelectedCourse(course);
              setStep("course-detail");
            }}
          />
        )}
        {step === "course-detail" && selectedCourse && (
          <CourseDetail
            shopId={shopId}
            course={selectedCourse}
            onBook={() => {
              if (staffSelectionEnabled) {
                setStep("staff");
              } else {
                setSelectedStaff(null);
                setStep("datetime");
              }
            }}
          />
        )}
        {step === "staff" && selectedCourse && (
          <StaffSelect
            shopId={shopId}
            course={selectedCourse}
            onSelect={(staff) => {
              setSelectedStaff(staff);
              setStep("datetime");
            }}
          />
        )}
        {step === "datetime" && selectedCourse && (
          <DateTimeSelect
            shopId={shopId}
            course={selectedCourse}
            staff={selectedStaff}
            onSelect={(date, time) => {
              setSelectedDate(date);
              setSelectedTime(time);
              setStep("confirm");
            }}
          />
        )}
        {step === "confirm" && selectedCourse && (
          <PaymentConfirm
            shopId={shopId}
            course={selectedCourse}
            staff={selectedStaff}
            date={selectedDate}
            time={selectedTime}
            onConfirm={async ({ customerName, customerEmail, customerPhone }) => {
              const res = await createReservation(shopId, {
                customerName,
                customerEmail,
                customerPhone,
                date: selectedDate,
                time: selectedTime,
                staffId: selectedStaff?.id || SHOP_STAFF_ID,
                courseId: selectedCourse!.id,
                status: "confirmed",
                paid: selectedCourse!.prepaymentOnly,
              });
              const result = res as { id: string; reservationToken: string };
              setReservationId(result.id);
              setReservationToken(result.reservationToken);
              setStep("complete");
            }}
            onBack={() => setStep("datetime")}
          />
        )}
        {step === "complete" && selectedCourse && (
          <BookingComplete
            shopId={shopId}
            course={selectedCourse}
            staff={selectedStaff}
            date={selectedDate}
            time={selectedTime}
            reservationId={reservationId}
            reservationToken={reservationToken}
            onClose={() => navigate(`/app/shop/${shop.id}`)}
          />
        )}
      </div>

      <footer className="bg-card border-t py-6 px-4 mt-4">
        <div className="max-w-lg mx-auto text-center">
          <Link href="/app">
            <span className="text-sm font-bold text-primary cursor-pointer" data-testid="link-footer-reservation-home">
              神奈川おでかけナビ
            </span>
          </Link>
          <p className="text-xs text-muted-foreground mt-2">
            &copy; 2026 神奈川おでかけナビ All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
