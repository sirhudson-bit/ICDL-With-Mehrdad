"use client";

import { useMemo, useState } from "react";

import { getIcon } from "@/components/icon";
import { Input } from "@/components/ui/primitives";
import { assessPasswordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

/**
 * Password field with real-time strength feedback.
 *
 * The strength assessment already existed but was only used on the registration
 * form, so changing a password gave no feedback at all — you typed blind and
 * found out from a server error. This renders the meter, the requirement
 * checklist and the actionable suggestions as you type.
 */

const LEVELS = [
  { label: "خیلی ضعیف", bar: "bg-danger", text: "text-danger", width: "w-1/5" },
  { label: "ضعیف", bar: "bg-danger", text: "text-danger", width: "w-2/5" },
  { label: "متوسط", bar: "bg-warning", text: "text-warning", width: "w-3/5" },
  { label: "قوی", bar: "bg-primary", text: "text-primary", width: "w-4/5" },
  { label: "خیلی قوی", bar: "bg-success", text: "text-success", width: "w-full" },
] as const;

export function PasswordStrengthInput({
  name,
  id,
  required,
  autoComplete = "new-password",
  minLength = 8,
}: {
  name: string;
  id?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  const [value, setValue] = useState("");

  const assessment = useMemo(() => assessPasswordStrength(value), [value]);
  const level = LEVELS[Math.min(assessment.score, LEVELS.length - 1)]!;

  const requirements = [
    { ok: value.length >= minLength, label: `حداقل ${minLength} کاراکتر` },
    { ok: /[A-Za-z]/.test(value), label: "حرف انگلیسی" },
    { ok: /\d/.test(value), label: "عدد" },
    { ok: /[^A-Za-z0-9]/.test(value), label: "نشانه (مثل ! یا @)" },
  ];

  const CheckIcon = getIcon("Check");
  const CircleIcon = getIcon("Circle");

  return (
    <div>
      <Input
        id={id}
        name={name}
        type="password"
        required={required}
        dir="ltr"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={`${name}-strength`}
      />

      {/* The meter is only meaningful once something has been typed. */}
      {value.length > 0 ? (
        <div id={`${name}-strength`} className="mt-2" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
            <span className="text-muted-foreground">قدرت رمز عبور</span>
            <span className={cn("font-bold", level.text)}>{level.label}</span>
          </div>

          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
            <div className={cn("h-full rounded-full transition-all duration-300", level.bar, level.width)} />
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {requirements.map((requirement) => (
              <li
                key={requirement.label}
                className={cn(
                  "inline-flex items-center gap-1 text-[0.6875rem]",
                  requirement.ok ? "text-success" : "text-muted-foreground",
                )}
              >
                {requirement.ok ? (
                  <CheckIcon size={12} aria-hidden="true" />
                ) : (
                  <CircleIcon size={10} aria-hidden="true" />
                )}
                {requirement.label}
              </li>
            ))}
          </ul>

          {assessment.suggestions.length > 0 ? (
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
              {assessment.suggestions[0]}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-[0.6875rem] text-subtle-foreground">
          حداقل {minLength} کاراکتر، ترکیبی از حرف، عدد و نشانه.
        </p>
      )}
    </div>
  );
}
