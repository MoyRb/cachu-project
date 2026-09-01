import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  customerUsernameToInternalEmail,
  normalizeCustomerUsername,
  PASSWORD_MIN,
  validateCustomerUsername,
} from '@/lib/customer/username';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const rawUsername = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    const username = normalizeCustomerUsername(rawUsername);

    const usernameError = validateCustomerUsername(username);
    if (usernameError) {
      return jsonError(usernameError, 400);
    }

    if (!password || password.length < PASSWORD_MIN) {
      return jsonError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, 400);
    }

    const supabase = getSupabaseAdmin();

    // Verificar unicidad del username antes de crear el usuario auth.
    const { data: existing, error: checkError } = await supabase
      .from('loyalty_accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (checkError) {
      throw new Error(checkError.message);
    }
    if (existing) {
      return jsonError('Ese nombre de usuario ya está en uso.', 409);
    }

    // Crear usuario en Supabase Auth con email técnico interno.
    // email_confirm: true porque no existe flujo de confirmación de correo real.
    const internalEmail = customerUsernameToInternalEmail(username);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (authError || !authData.user) {
      const msg = authError?.message ?? '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        return jsonError('Ese nombre de usuario ya está en uso.', 409);
      }
      return jsonError('No se pudo crear la cuenta. Intenta de nuevo.', 400);
    }

    const authUserId = authData.user.id;

    // Crear la cuenta de lealtad vinculada al usuario auth.
    const { error: loyaltyError } = await supabase.from('loyalty_accounts').insert({
      user_id: authUserId,
      username,
      name: username,
      phone: null,
      points_int: 0,
    });

    if (loyaltyError) {
      // Rollback: eliminar el usuario auth para no dejar huérfanos.
      await supabase.auth.admin.deleteUser(authUserId);
      throw new Error(loyaltyError.message);
    }

    return NextResponse.json({ ok: true, username }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
