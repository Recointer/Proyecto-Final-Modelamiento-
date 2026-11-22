import { LoginForm } from "./LoginForm";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ restablecida?: string }>;
}) {
  const { restablecida } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Portal de Acceso Comunal</h1>
      <p className="mb-6 mt-1 text-slate-600">
        Ingrese sus credenciales para acceder a su espacio de trabajo comunal o administrativo.
      </p>
      <LoginForm restablecida={restablecida === "1"} />
    </main>
  );
}
