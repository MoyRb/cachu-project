import { NextRequest } from 'next/server';

export type Role = 'ADMIN' | 'PLANCHA' | 'FREIDORA' | 'EMPAQUETADO';

export interface AuthContext {
  role: Role;
  userId: number;
}

const allowedRoles: Role[] = ['ADMIN', 'PLANCHA', 'FREIDORA', 'EMPAQUETADO'];

export function getAuthContext(request: NextRequest): AuthContext {
  const rawRoleHeader = request.headers.get('x-role');
  const rawUserIdHeader = request.headers.get('x-user-id');
  const roleHeader = (rawRoleHeader ?? '').trim().toUpperCase();
  const userIdHeader = (rawUserIdHeader ?? '').trim();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth] kitchen headers:', {
      hasRole: Boolean(rawRoleHeader),
      hasUserId: Boolean(rawUserIdHeader),
    });
  }

  if (!roleHeader || !userIdHeader) {
    throw new Error('Missing kitchen auth headers');
  }

  if (!allowedRoles.includes(roleHeader as Role)) {
    throw new Error('Invalid role');
  }

  const userId = Number(userIdHeader);
  if (Number.isNaN(userId)) {
    throw new Error('Invalid user id');
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Invalid user id');
  }

  return { role: roleHeader as Role, userId };
}

export function ensureRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new Error('Forbidden');
  }
}
