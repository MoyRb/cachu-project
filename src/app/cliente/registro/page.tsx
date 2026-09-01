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
  PASSWORD_MIN,
  validateCustomerUsername,
} from "@/lib/customer/username";

export default function ClienteRegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    // Validaciones en cliente para feedback inmediato.
    const normalized = normalizeCustomerUsername(username);
    const usernameError = validateCustomerUsername(normalized);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Crear cuenta en el servidor.
      const registerResponse = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized, password }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setError(
          typeof registerData?.error === "string"
            ? registerData.error
            : "No se pudo crear la cuenta."
        );
        return;
      }

      // 2. Login automático después del registro exitoso.
      const internalEmail = customerUsernameToInternalEmail(normalized);
      const { error: loginError } = await supabaseBrowser.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (loginError) {
        // El registro fue exitoso pero el login automático falló; redirigir al login.
        router.replace("/cliente/login");
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
          <h1 className="text-3xl font-bold text-ink">Crea tu cuenta</h1>
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
            <p className="text-xs text-muted">
              Letras, números, punto, guion y guion bajo. 3–32 caracteres.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-muted" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-muted" htmlFor="confirm">
              Confirmar contraseña
            </label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <div className="space-y-3 text-center text-sm text-muted">
          <p>
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/cliente/login"
              className="font-semibold text-cta hover:underline"
            >
              Iniciar sesión
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
