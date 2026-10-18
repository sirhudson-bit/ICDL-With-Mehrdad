"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { loginAction, registerAction } from "@/app/actions/auth";
import {
  validateRegistrationField,
  type FieldCheck,
  type RegistrationField,
} from "@/app/actions/validation";
import { getIcon } from "@/components/icon";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import { assessPasswordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

/**
 * Sign-in and sign-up form.
 *
 * Both modes share this component so the validation messaging, error handling
 * and layout stay identical. Errors come back from the server action as
 * per-field messages in Persian.
 */
export function AuthForm({
  mode,
  next,
  allowRegistration,
}: {
  mode: "login" | "register";
  next?: string;
  allowRegistration: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Live per-field validation (register only).
   *
   * Runs debounced while typing and immediately on blur, so a taken email or a
   * too-short password is reported before the learner presses submit. The rules
   * come from the same server module the submit path uses.
   */
  const [live, setLive] = useState<Record<string, FieldCheck>>({});
  const passwordRef = useRef("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runCheck = async (field: RegistrationField, value: string) => {
    try {
      const outcome = await validateRegistrationField({ field, value, password: passwordRef.current });
      setLive((current) => ({ ...current, [field]: outcome }));
    } catch {
      // A failed check is never worth interrupting the form for.
    }
  };

  const scheduleCheck = (field: RegistrationField, value: string) => {
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(() => void runCheck(field, value), 450);
  };

  const liveError = (field: RegistrationField) =>
    errors[field] ?? (live[field] && !live[field].ok ? live[field].message : undefined);

  const isRegister = mode === "register";
  const strength = isRegister && password.length > 0 ? assessPasswordStrength(password) : null;

  const onSubmit = (formData: FormData) => {
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const outcome = isRegister ? await registerAction(formData) : await loginAction(formData);

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setMessage(outcome.message);
        return;
      }

      toast({
        title: isRegister ? "حساب شما ساخته شد" : "خوش آمدید!",
        description: isRegister ? "از همین‌جا یادگیری را شروع کنید." : "به ادامه یادگیری برگردید.",
        tone: "success",
      });

      router.push(outcome.redirectTo);
      router.refresh();
    });
  };

  const LockIcon = getIcon("Lock");
  const EyeIcon = getIcon(showPassword ? "EyeOff" : "Eye");

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      {message ? (
        <p className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}

      {isRegister ? (
        <Field label="نام و نام خانوادگی" htmlFor="name" required error={liveError("name")}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder="مثلاً علی رضایی"
            onChange={(event) => scheduleCheck("name", event.target.value)}
            onBlur={(event) => void runCheck("name", event.target.value)}
          />
          <LiveStatus state={live.name} />
        </Field>
      ) : null}

      <Field label="ایمیل" htmlFor="email" required error={liveError("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          placeholder="you@example.com"
          onChange={isRegister ? (event) => scheduleCheck("email", event.target.value) : undefined}
          onBlur={isRegister ? (event) => void runCheck("email", event.target.value) : undefined}
        />
        {isRegister ? <LiveStatus state={live.email} /> : null}
      </Field>

      <Field
        label="رمز عبور"
        htmlFor="password"
        required
        error={liveError("password")}
        hint={isRegister ? "حداقل ۸ کاراکتر، ترکیبی از حرف و عدد و علامت" : undefined}
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(event) => {
              const next = event.target.value;
              setPassword(next);
              passwordRef.current = next;
              if (isRegister) scheduleCheck("password", next);
            }}
            onBlur={isRegister ? () => void runCheck("password", passwordRef.current) : undefined}
            className={cn("pe-11", showPassword && "reveal-in")}
            dir="ltr"
          />
          {/* The reveal control sits on the right, where the eye is expected in
              this RTL interface, and animates when the password becomes visible. */}
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            title={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            className={cn(
              "absolute inset-y-0 start-0 inline-flex w-11 items-center justify-center transition-colors",
              showPassword ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <EyeIcon
              size={18}
              className={cn(showPassword && "reveal-icon-in")}
              aria-hidden="true"
            />
          </button>
        </div>
        {isRegister ? <LiveStatus state={live.password} /> : null}
      </Field>

      {isRegister ? null : (
        <div className="-mt-1 text-end">
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </div>
      )}

      {strength ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < strength.score
                    ? strength.score <= 1
                      ? "bg-danger"
                      : strength.score === 2
                        ? "bg-warning"
                        : "bg-success"
                    : "bg-border-strong",
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{strength.label}</span>
        </div>
      ) : null}

      {isRegister ? (
        <Field
          label="تکرار رمز عبور"
          htmlFor="confirmPassword"
          required
          error={liveError("confirmPassword")}
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            onChange={(event) => scheduleCheck("confirmPassword", event.target.value)}
            onBlur={(event) => void runCheck("confirmPassword", event.target.value)}
          />
          <LiveStatus state={live.confirmPassword} />
        </Field>
      ) : null}

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "لطفاً صبر کنید…" : isRegister ? "ساخت حساب کاربری" : "ورود به حساب"}
        <LockIcon size={17} aria-hidden="true" />
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? (
          <>
            قبلاً حساب ساخته‌اید؟{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              وارد شوید
            </Link>
          </>
        ) : allowRegistration ? (
          <>
            حساب کاربری ندارید؟{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              حساب رایگان بسازید
            </Link>
          </>
        ) : null}
      </p>
    </form>
  );
}

/** Inline result of a live field check. */
function LiveStatus({ state }: { state?: FieldCheck }) {
  if (!state || !state.message) return null;

  const Icon = getIcon(state.ok ? "CheckCircle2" : "TriangleAlert");

  return (
    <p
      role="status"
      className={cn(
        "mt-1 flex items-center gap-1.5 text-[0.6875rem]",
        state.ok ? "text-success" : "text-danger",
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {state.message}
    </p>
  );
}
