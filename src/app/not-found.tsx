import { getIcon } from "@/components/icon";
import { ButtonLink } from "@/components/ui/primitives";
import { getSettings } from "@/services/settings-service";

/** Friendly Persian 404 — never exposes technical detail. */
export default async function NotFound() {
  const site = await getSettings("site");
  const Icon = getIcon("Compass");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-primary-soft text-primary">
        <Icon size={30} aria-hidden="true" />
      </span>
      <p className="text-5xl font-bold tracking-tight">۴۰۴</p>
      <h1 className="text-xl font-bold">این صفحه پیدا نشد</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        ممکن است آدرس را اشتباه وارد کرده باشید یا این درس جابه‌جا شده باشد. از فهرست دوره یا
        جستجو می‌توانید صفحه مورد نظر را پیدا کنید.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">بازگشت به صفحه اصلی</ButtonLink>
        <ButtonLink href="/course" variant="outline">
          فهرست دوره
        </ButtonLink>
        <ButtonLink href="/search" variant="ghost">
          جستجو
        </ButtonLink>
      </div>
      <p className="mt-4 text-xs text-subtle-foreground">{site.name}</p>
    </div>
  );
}
