import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { fetchStaff, fetchSettings, updateSettings, createStaff, updateStaff, deleteStaff, type Staff } from "@/lib/booking-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export function StaffManagement({ shopId }: { shopId: number }) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [staffEnabled, setStaffEnabled] = useState(true);
  const [togglingStaff, setTogglingStaff] = useState(false);

  const reload = async () => {
    const [s, settings] = await Promise.all([fetchStaff(shopId), fetchSettings(shopId)]);
    setStaffList(s);
    setStaffEnabled(settings.staff_selection_enabled === "true");
  };

  useEffect(() => { setLoading(true); reload().catch(() => { setStaffList([]); }).finally(() => setLoading(false)); }, [shopId]);

  const handleToggleStaff = async (enabled: boolean) => {
    setTogglingStaff(true);
    setStaffEnabled(enabled);
    await updateSettings(shopId, { staff_selection_enabled: enabled ? "true" : "false" });
    setTogglingStaff(false);
  };

  const openAdd = () => {
    setEditingStaff(null);
    setFormName("");
    setFormRole("");
    setDialogOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormRole(staff.role);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName) return;
    setSaving(true);
    if (editingStaff) {
      await updateStaff(shopId, { id: editingStaff.id, name: formName, role: formRole });
    } else {
      await createStaff(shopId, { name: formName, role: formRole });
    }
    await reload();
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteStaff(shopId, id);
    await reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="admin-staff-management">
      <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">スタッフ指名機能</h3>
          <p className="text-xs text-muted-foreground">OFFにすると予約時のスタッフ選択をスキップします</p>
        </div>
        <Switch
          checked={staffEnabled}
          onCheckedChange={handleToggleStaff}
          disabled={togglingStaff}
          data-testid="switch-staff-enabled"
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">スタッフ管理</h2>
          <p className="text-sm text-muted-foreground">担当者の登録・編集・削除</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5" data-testid="button-add-staff">
          <Plus className="h-4 w-4" />
          スタッフ追加
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>氏名</TableHead>
              <TableHead>役職</TableHead>
              <TableHead className="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffList.map((staff) => (
              <TableRow key={staff.id} data-testid={`staff-row-${staff.id}`}>
                <TableCell>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {staff.avatar}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-foreground">{staff.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{staff.role}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(staff)} data-testid={`button-edit-staff-${staff.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(staff.id)} data-testid={`button-delete-staff-${staff.id}`}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff ? "スタッフ編集" : "スタッフ追加"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">氏名</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例: 田中 美咲" data-testid="input-staff-name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">役職</label>
              <Input value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="例: シニアエステティシャン" data-testid="input-staff-role" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={!formName || saving} data-testid="button-save-staff">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingStaff ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
