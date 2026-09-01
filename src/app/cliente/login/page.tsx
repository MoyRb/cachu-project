"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  customerUsernameToInternalEmail,
  normalizeCustomerUsername,
  validateCustomerUsername,
} from "@/lib/customer/username";

export default function ClienteLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Si ya hay sesión activa, ir directo al panel.
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/cliente");
      } else {
        setIsCheckingSession(false);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeCustomerUsername(username);
    const usernameError = validateCustomerUsername(normalized);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    setIsLoading(true);
    try {
      const internalEmail = customerUsernameToInternalEmail(normalized);
      const { error: authError } = await supabaseBrowser.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (authError) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }

      router.replace("/cliente");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-base font-semibold text-muted">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            Cachu Burger
          </p>
          <h1 className="text-3xl font-bold text-ink">Inicia sesión</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-muted" htmlFor="username">
              Nombre de usuario
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="tu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-muted" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="space-y-3 text-center text-sm text-muted">
          <p>
            ¿No tienes cuenta?{" "}
            <Link
              href="/cliente/registro"
              className="font-semibold text-cta hover:underline"
            >
              Crear cuenta
            </Link>
          </p>
          <p>
            <Link
              href="/kiosco"
              className="font-semibold text-ink hover:underline"
            >
              ← Volver al kiosco
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
