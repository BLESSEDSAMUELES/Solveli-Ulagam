import AuthPage from "@/components/AuthPage";

export default async function SignIn({ searchParams }: PageProps<"/signin">) {
  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : undefined; };
  const next = one("next");
  return <AuthPage mode="signin" error={one("error")} next={next?.startsWith("/") && !next.startsWith("//") ? next : undefined} />;
}
