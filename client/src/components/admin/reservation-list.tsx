import { useState, useEffect } from "react";
import { fetchReservations, fetchStaff, fetchCourses, updateReservation, formatPrice, type Staff, type Course, type Reservation } from "@/lib/booking-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Ban, Pencil, Trash2, FileText, SquareArrowOutUpRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

const STATUS_MAP = {
  confirmed: { label: "確定", className: "bg-[#06C755] text-white hover:bg-[#06C755]" },
  pending: { label: "未確定", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  cancelled: { label: "キャンセル", className: "bg-destructive text-destructive-foreground" },
};

export function ReservationList({ shopId }: { shopId: number }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [viewNoteTarget, setViewNoteTarget] = useState<Reservation | null>(null);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    date: "",
    time: "",
    staffId: "",
    courseId: "",
    status: "pending" as string,
  });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const [r, s, c] = await Promise.all([
      fetchReservations(shopId),
      fetchStaff(shopId),
      fetchCourses(shopId),
    ]);
    setReservations(r);
    setStaffList(s);
    setCourseList(c);
  };

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => {
        setReservations([]);
        setStaffList([]);
        setCourseList([]);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    await updateReservation(shopId, { id: cancelTarget.id, status: "cancelled" });
    await reload();
    setCancelTarget(null);
    setCancelling(false);
  };

  const openEdit = (res: Reservation) => {
    setEditTarget(res);
    setEditForm({
      customerName: res.customerName,
      customerPhone: res.customerPhone || "",
      customerEmail: res.customerEmail || "",
      date: res.date,
      time: res.time,
      staffId: res.staffId,
      courseId: res.courseId,
      status: res.status,
    });
  };

  const isEditFormValid = editForm.customerName && editForm.date && editForm.time && editForm.staffId && editForm.courseId;

  const handleEditSave = async () => {
    if (!editTarget || !isEditFormValid) return;
    setSaving(true);
    await updateReservation(shopId, {
      id: editTarget.id,
      customerName: editForm.customerName,
      customerPhone: editForm.customerPhone,
      customerEmail: editForm.customerEmail,
      date: editForm.date,
      time: editForm.time,
      staffId: editForm.staffId,
      courseId: editForm.courseId,
      status: editForm.status,
      paid: !!courseList.find(c => c.id === editForm.courseId)?.prepaymentOnly,
    });
    await reload();
    setEditTarget(null);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="admin-reservation-list">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">予約一覧</h2>
        <p className="text-sm text-muted-foreground">現在の予約状況を確認・編集・削除</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>予約日時</TableHead>
              <TableHead>お客様名</TableHead>
              <TableHead>コース</TableHead>
              <TableHead>人数</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead className="text-right">料金</TableHead>
              <TableHead className="text-center">決済</TableHead>
              <TableHead className="text-center">ステータス</TableHead>
              <TableHead className="text-center">備考</TableHead>
              <TableHead className="w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((res) => {
              const staff = staffList.find((s) => s.id === res.staffId);
              const course = courseList.find((c) => c.id === res.courseId);
              const status = STATUS_MAP[res.status as keyof typeof STATUS_MAP] || STATUS_MAP.pending;
              const parsedDate = res.date ? parseISO(res.date) : null;
              const isCancelled = res.status === "cancelled";

              return (
                <TableRow key={res.id} className={isCancelled ? "opacity-50" : ""} data-testid={`reservation-row-${res.id}`}>
                  <TableCell className="font-medium text-foreground">
                    {parsedDate ? (
                      <>
                        <div>{format(parsedDate, "M/d(E)", { locale: ja })}</div>
                        <div className="text-xs text-muted-foreground">{res.time}</div>
                      </>
                    ) : (
                      <div className="text-sm font-medium">リクエスト予約</div>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground">
                    <div>{res.customerName}</div>
                    {res.customerEmail && <div className="text-[10px] text-muted-foreground">{res.customerEmail}</div>}
                    {res.customerPhone && <div className="text-[10px] text-muted-foreground">{res.customerPhone}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{course?.name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{res.customerCount || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{staff?.name || "-"}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {course ? formatPrice(course.price) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {course?.prepaymentOnly ? (
                      <Badge variant="secondary" className="bg-[#06C755]/10 text-[#06C755] text-[10px]">事前決済</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">当日払い</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={status.className}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {res.customerNote ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setViewNoteTarget(res)}
                      >
                        <SquareArrowOutUpRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(res)} data-testid={`button-edit-reservation-${res.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!isCancelled && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setCancelTarget(res)} data-testid={`button-cancel-reservation-${res.id}`}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewNoteTarget} onOpenChange={(open) => { if (!open) setViewNoteTarget(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              備考内容の確認
            </DialogTitle>
            <DialogDescription>
              {viewNoteTarget?.customerName} 様の予約備考
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 rounded-md bg-muted p-4 text-sm leading-relaxed text-foreground">
            {viewNoteTarget?.customerNote || "備考はありません。"}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setViewNoteTarget(null)} className="w-full sm:w-auto">
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予約をキャンセルしますか？</DialogTitle>
            <DialogDescription>
              {cancelTarget && (() => {
                const course = courseList.find((c) => c.id === cancelTarget.courseId);
                const staff = staffList.find((s) => s.id === cancelTarget.staffId);
                return `${cancelTarget.customerName}様 - ${cancelTarget.date} ${cancelTarget.time} ${course?.name || ""} (${staff?.name || ""})`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>戻る</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "キャンセルする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>予約を編集</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">お客様名</label>
              <Input value={editForm.customerName} onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} data-testid="input-edit-customer-name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">メールアドレス</label>
              <Input type="email" value={editForm.customerEmail} onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })} placeholder="example@email.com" data-testid="input-edit-customer-email" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">電話番号</label>
              <Input value={editForm.customerPhone} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} placeholder="090-1234-5678" data-testid="input-edit-customer-phone" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">日付</label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} data-testid="input-edit-date" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">時間</label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} placeholder="10:00" data-testid="input-edit-time" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">コース</label>
              <Select value={editForm.courseId} onValueChange={(v) => setEditForm({ ...editForm, courseId: v })}>
                <SelectTrigger data-testid="select-edit-course"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {courseList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">担当スタッフ</label>
              <Select value={editForm.staffId} onValueChange={(v) => setEditForm({ ...editForm, staffId: v })}>
                <SelectTrigger data-testid="select-edit-staff"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">ステータス</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">未確定</SelectItem>
                  <SelectItem value="confirmed">確定</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm font-medium text-foreground">決済方法</div>
              <div className="text-sm text-muted-foreground" data-testid="text-edit-payment-method">
                {courseList.find(c => c.id === editForm.courseId)?.prepaymentOnly ? "事前決済" : "当日払い"}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>キャンセル</Button>
            <Button onClick={handleEditSave} disabled={!isEditFormValid || saving} data-testid="button-save-edit-reservation">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
