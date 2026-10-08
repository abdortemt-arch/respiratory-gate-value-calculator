"use client";

import { Copy, KeyRound, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/domain/access";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Select } from "@/components/ui/field";

export interface ManagedUser {
  readonly profileId: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly role: string;
  readonly active: boolean;
  readonly lastSignInAt: string | null;
  readonly isSelf: boolean;
  /** Hospitals this user is an active member of (Admins see every hospital). */
  readonly hospitals: readonly string[];
}

type Result = { ok: boolean; error?: string; temporaryPassword?: string };

interface Props {
  readonly users: readonly ManagedUser[];
  readonly hospitals: readonly { id: string; name: string }[];
  readonly createUser: (formData: FormData) => Promise<Result>;
  readonly updateUserRole: (profileId: string, role: string) => Promise<Result>;
  readonly setUserActive: (profileId: string, active: boolean) => Promise<Result>;
  readonly resetUserPassword: (profileId: string) => Promise<Result>;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function OneTimePassword({ label, password }: { label: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert tone="caution" title={label}>
      <p>Share it privately (not by email). It is shown only once, and the user must replace it at first sign-in.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-md border border-line bg-card px-2 py-1 font-mono text-sm text-ink select-all">{password}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          <Copy /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Alert>
  );
}

export function UserAdmin({ users, hospitals, createUser, updateUserRole, setUserActive, resetUserPassword }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ label: string; password: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>, success: string, passwordLabel?: string) => {
    setError(null);
    setNotice(null);
    setIssued(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else if (r.temporaryPassword && passwordLabel) setIssued({ label: passwordLabel, password: r.temporaryPassword });
      else setNotice(success);
    });
  };

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-xl border border-line bg-surface/60 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_12rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          run(
            async () => {
              const r = await createUser(data);
              if (r.ok) form.reset();
              return r;
            },
            "Invitation sent. The user sets a password from the email link.",
            `Temporary password for ${data.get("email")}`,
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Full name</Label>
          <Input id="new-name" name="fullName" required minLength={2} maxLength={120} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" name="email" type="email" required autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-role">Role</Label>
          <Select id="new-role" name="role" defaultValue="viewer">
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            <UserPlus /> Add user
          </Button>
        </div>
        {hospitals.length ? (
          <fieldset className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-4">
            <legend className="font-medium text-ink">Hospital access</legend>
            <p className="text-xs text-muted">Managers and Viewers see only these hospitals. Admins see every hospital.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {hospitals.map((h) => (
                <label key={h.id} className="flex items-center gap-2">
                  <input type="checkbox" name="hospitalIds" value={h.id} className="size-4 accent-brand-blue" /> {h.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <fieldset className="flex flex-wrap gap-x-5 gap-y-1 text-sm sm:col-span-2 lg:col-span-4">
          <legend className="sr-only">How to give access</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="method" value="temporary_password" defaultChecked /> Temporary password (shown once)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="method" value="invite" /> Email invitation (requires SMTP in Supabase)
          </label>
        </fieldset>
      </form>

      {error ? <FieldError>{error}</FieldError> : null}
      {notice ? <Alert tone="positive">{notice}</Alert> : null}
      {issued ? <OneTimePassword label={issued.label} password={issued.password} /> : null}

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">User</th>
              <th scope="col" className="py-2 pr-3 font-medium">Role</th>
              <th scope="col" className="py-2 pr-3 font-medium">Access</th>
              <th scope="col" className="py-2 pr-3 font-medium">Hospitals</th>
              <th scope="col" className="py-2 pr-3 font-medium">Last sign-in</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.profileId} className={u.active ? undefined : "text-muted"}>
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-ink">{u.fullName}</span>
                  {u.isSelf ? <Badge className="ml-2">You</Badge> : null}
                  <span className="block text-xs text-muted">{u.email ?? "—"}</span>
                </td>
                <td className="py-2.5 pr-3">
                  {u.isSelf || !STAFF_ROLES.includes(u.role as StaffRole) ? (
                    <span>{ROLE_LABELS[u.role as StaffRole] ?? u.role}</span>
                  ) : (
                    <Select
                      aria-label={`Role for ${u.fullName}`}
                      value={u.role}
                      disabled={pending}
                      onChange={(e) => run(() => updateUserRole(u.profileId, e.target.value), `Role updated for ${u.fullName}.`)}
                      className="h-8 w-56"
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <Badge tone={u.active ? "positive" : "neutral"}>{u.active ? "Active" : "Deactivated"}</Badge>
                </td>
                <td className="py-2.5 pr-3 text-xs text-ink-soft">
                  {u.role === "admin" ? "All hospitals" : u.hospitals.length ? u.hospitals.join(", ") : <span className="text-caution">None yet</span>}
                </td>
                <td className="py-2.5 pr-3 text-ink-soft">
                  {u.lastSignInAt ? dateFormat.format(new Date(u.lastSignInAt)) : "Never"}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  {u.isSelf ? null : (
                    <span className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => resetUserPassword(u.profileId), "", `New temporary password for ${u.fullName}`)}
                      >
                        <KeyRound /> Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant={u.active ? "danger" : "secondary"}
                        disabled={pending}
                        onClick={() =>
                          run(() => setUserActive(u.profileId, !u.active), `${u.fullName} ${u.active ? "deactivated" : "reactivated"}.`)
                        }
                      >
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FieldHint>
        Users are deactivated rather than deleted, so the audit history keeps their name. Password resets are recorded in
        Supabase Auth logs.
      </FieldHint>
    </div>
  );
}
