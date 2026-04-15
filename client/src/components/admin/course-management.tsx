import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, CreditCard, Loader2, Image as ImageIcon } from "lucide-react";
import { fetchStaff, fetchCourses, createCourse, updateCourse, deleteCourse, formatPrice, formatDuration, type Course, type Staff } from "@/lib/booking-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function CourseManagement({ shopId }: { shopId: number }) {
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDuration, setFormDuration] = useState(60);
  const [formPrice, setFormPrice] = useState(0);
  const [formDescription, setFormDescription] = useState("");
  const [formPrepayment, setFormPrepayment] = useState(false);
  const [formUnspecifiedTime, setFormUnspecifiedTime] = useState(false);
  const [formStaffIds, setFormStaffIds] = useState<string[]>([]);
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    const [c, s] = await Promise.all([fetchCourses(shopId), fetchStaff(shopId)]);
    setCourseList(c);
    setStaffList(s);
  };

  useEffect(() => { setLoading(true); reload().catch(() => { setCourseList([]); setStaffList([]); }).finally(() => setLoading(false)); }, [shopId]);

  const openAdd = () => {
    setEditingCourse(null);
    setFormName("");
    setFormDuration(60);
    setFormPrice(0);
    setFormDescription("");
    setFormPrepayment(false);
    setFormUnspecifiedTime(false);
    setFormStaffIds([]);
    setFormImageUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setFormName(course.name);
    setFormDuration(course.duration);
    setFormPrice(course.price);
    setFormDescription(course.description);
    setFormPrepayment(course.prepaymentOnly);
    setFormUnspecifiedTime(course.enableRequestMode);
    setFormStaffIds(course.staffIds);
    setFormImageUrl(course.imageUrl);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFormImageUrl(data.url);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formName) return;
    setSaving(true);
    const data = {
      name: formName,
      duration: formDuration,
      price: formPrice,
      description: formDescription,
      prepaymentOnly: formPrepayment,
      enableRequestMode: formUnspecifiedTime,
      staffIds: formStaffIds,
      imageUrl: formImageUrl,
    };
    if (editingCourse) {
      await updateCourse(shopId, { id: editingCourse.id, ...data });
    } else {
      await createCourse(shopId, data);
    }
    await reload();
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteCourse(shopId, id);
    await reload();
  };

  const toggleStaff = (staffId: string) => {
    setFormStaffIds(
      formStaffIds.includes(staffId)
        ? formStaffIds.filter((id) => id !== staffId)
        : [...formStaffIds, staffId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="admin-course-management">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">コース管理</h2>
          <p className="text-sm text-muted-foreground">コースの料金設定・担当者の設定</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5" data-testid="button-add-course">
          <Plus className="h-4 w-4" />
          コース追加
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>コース名</TableHead>
              <TableHead className="text-right">時間</TableHead>
              <TableHead className="text-right">料金</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead className="text-center">事前決済</TableHead>
              <TableHead className="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courseList.map((course) => (
              <TableRow key={course.id} data-testid={`course-row-${course.id}`}>
                <TableCell className="font-medium text-foreground">{course.name}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDuration(course.duration)}
                </TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {formatPrice(course.price)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {course.staffIds.map((sid) => {
                      const staff = staffList.find((s) => s.id === sid);
                      return staff ? (
                        <Badge key={sid} variant="outline" className="text-[10px]">
                          {staff.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {course.prepaymentOnly ? (
                    <Badge className="bg-primary/10 text-primary text-[10px] gap-1">
                      <CreditCard className="h-2.5 w-2.5" />
                      必須
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(course)} data-testid={`button-edit-course-${course.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(course.id)} data-testid={`button-delete-course-${course.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "コース編集" : "コース追加"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">コース名</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例: フェイシャルベーシック" data-testid="input-course-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">所要時間(分)</label>
                <Input type="number" value={formDuration} onChange={(e) => setFormDuration(parseInt(e.target.value) || 0)} min={15} step={15} data-testid="input-course-duration" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">料金(円)</label>
                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(parseInt(e.target.value) || 0)} min={0} step={100} data-testid="input-course-price" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">説明</label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="コースの説明..." rows={3} data-testid="input-course-description" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">コース画像</label>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={() => imageInputRef.current?.click()} disabled={uploading} size="sm" className="gap-1.5">
                  <ImageIcon className="h-4 w-4" />
                  {uploading ? "アップロード中..." : "画像を選択"}
                </Button>
                {formImageUrl && (
                  <div className="relative">
                    <img src={formImageUrl} alt="preview" className="h-24 w-24 rounded-lg object-cover border border-border" />
                    <button onClick={() => setFormImageUrl(null)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium text-foreground">事前決済のみ</div>
                <div className="text-xs text-muted-foreground">ONにすると予約時にオンライン決済が必須になります</div>
              </div>
              <Switch checked={formPrepayment} onCheckedChange={setFormPrepayment} data-testid="switch-prepayment" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium text-foreground">日付・時間指定なし予約を許可する</div>
                <div className="text-xs text-muted-foreground">
                  ONにするとお客様より予約リクエストが届きます。<br />
                  お客様にご連絡いただき、店舗様側で予約調整を行ってください。
                </div>
              </div>
              <Switch checked={formUnspecifiedTime} onCheckedChange={setFormUnspecifiedTime} data-testid="switch-prepayment" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">担当スタッフ</label>
              <div className="flex flex-col gap-2">
                {staffList.map((staff) => (
                  <label key={staff.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={formStaffIds.includes(staff.id)} onCheckedChange={() => toggleStaff(staff.id)} />
                    <span className="text-foreground">{staff.name}</span>
                    <span className="text-xs text-muted-foreground">({staff.role})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={!formName || saving} data-testid="button-save-course">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCourse ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
