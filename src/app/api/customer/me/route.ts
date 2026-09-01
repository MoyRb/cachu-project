import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    // Extraer Bearer token del header Authorization.
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return jsonError('No autorizado.', 401);
    }

    const supabase = getSupabaseAdmin();

    // Validar el JWT contra Supabase Auth. No confiamos en ningún ID enviado por el navegador.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonError('No autorizado.', 401);
    }

    // Buscar la cuenta de lealtad vinculada al usuario autenticado.
    const { data: account, error: accountError } = await supabase
      .from('loyalty_accounts')
      .select('id, username, name, points_int')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError) {
      throw new Error(accountError.message);
    }
    if (!account) {
      return jsonError('Cuenta no encontrada.', 404);
    }

    // Responder solo con datos mínimos y seguros. Nunca el email interno ni el service role.
    return NextResponse.json({
      user: {
        id: user.id,
        username: account.username ?? account.name,
        name: account.name,
      },
      points: account.points_int,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
