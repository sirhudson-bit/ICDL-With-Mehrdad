/**
 * Password strength feedback.
 *
 * Deliberately kept in its own module, separate from `password.ts`: that file
 * imports `node:crypto`, so anything importing it is server-only. This checker
 * is pure and is used by the registration form, which runs in the browser —
 * mixing the two would pull Node built-ins into the client bundle and break
 * hydration.
 */

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
};

const COMMON_PASSWORDS = ["123456", "password", "qwerty", "111111", "abc123", "iran123", "12345678"];

/** Beginner-friendly password feedback used on the registration form. */
export function assessPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else suggestions.push("حداقل ۸ کاراکتر استفاده کنید");

  if (password.length >= 12) score += 1;
  else suggestions.push("برای امنیت بیشتر، ۱۲ کاراکتر یا بیشتر بنویسید");

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else if (/[a-zA-Z]/.test(password)) suggestions.push("حروف بزرگ و کوچک را با هم ترکیب کنید");

  if (/[0-9]/.test(password)) score += 1;
  else suggestions.push("حداقل یک عدد به رمز اضافه کنید");

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else suggestions.push("یک علامت مثل ! یا # هم اضافه کنید");

  if (COMMON_PASSWORDS.some((pattern) => password.toLowerCase().includes(pattern))) {
    score = 0;
    suggestions.unshift("این رمز بسیار رایج و ناامن است");
  }

  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ["بسیار ضعیف", "ضعیف", "متوسط", "قوی", "بسیار قوی"];

  return { score: clamped, label: labels[clamped]!, suggestions };
}
