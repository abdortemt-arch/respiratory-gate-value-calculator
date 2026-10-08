"use client";

import { ROLE_LABELS, type AppRole } from "@/domain/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, Label, Select } from "@/components/ui/field";
import { ActionForm, Feedback, useActionRunner, type Result } from "./forms";

export interface MemberView {
  readonly id: string;
  readonly name: string;
  readonly orgRole: string;
  readonly role: "manager" | "viewer";
  readonly active: boolean;
}

/** Who can see and edit this hospital (organisation Admins always can). */
export function MembersManager({
  members,
  candidates,
  add,
  update,
}: {
  members: readonly MemberView[];
  candidates: readonly { userId: string; name: string; orgRole: string }[];
  add: (form: FormData) => Promise<Result>;
  update: (memberId: string, change: { role?: string; active?: boolean }) => Promise<Result>;
}) {
  const runner = useActionRunner();
  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-muted">No members yet. Organisation Admins always have access.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {members.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 ${m.active ? "" : "text-muted"}`}>
              <span>
                <span className="font-medium text-ink">{m.name}</span>{" "}
                {m.active ? null : <Badge tone="neutral">No access</Badge>}
                <span className="block text-xs text-muted">Organisation role: {ROLE_LABELS[m.orgRole as AppRole] ?? m.orgRole}</span>
              </span>
              <span className="flex items-center gap-2">
                <Select
                  aria-label={`Hospital role for ${m.name}`}
                  value={m.role}
                  disabled={runner.pending || m.orgRole === "viewer"}
                  onChange={(e) => runner.run(() => update(m.id, { role: e.target.value }), `Role updated for ${m.name}.`)}
                  className="h-8 w-40"
                >
                  <option value="manager">Manager (edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                </Select>
                <Button
                  size="sm"
                  variant={m.active ? "danger" : "secondary"}
                  disabled={runner.pending}
                  onClick={() => runner.run(() => update(m.id, { active: !m.active }), `${m.name} ${m.active ? "removed" : "restored"}.`)}
                >
                  {m.active ? "Remove access" : "Restore access"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Feedback error={runner.error} notice={runner.notice} />
      {candidates.length ? (
        <ActionForm action={add} success="Access given." className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface/60 p-4">
          {(pending) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="member-user">Person</Label>
                <Select id="member-user" name="userId" required defaultValue="" className="w-60">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {candidates.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name} ({ROLE_LABELS[c.orgRole as AppRole] ?? c.orgRole})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-role">Hospital role</Label>
                <Select id="member-role" name="role" defaultValue="manager" className="w-44">
                  <option value="manager">Manager (edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                </Select>
              </div>
              <Button type="submit" disabled={pending}>
                Give access
              </Button>
              <FieldHint className="w-full">Viewers stay read-only in every hospital, whatever their hospital role.</FieldHint>
            </>
          )}
        </ActionForm>
      ) : (
        <p className="text-xs text-muted">Everyone with a Manager or Viewer account already has access. Add people in Settings → Users.</p>
      )}
    </div>
  );
}
