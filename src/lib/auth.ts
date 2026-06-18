import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { findUser } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET 环境变量未设置或长度不足16位，请在 .env 中配置');
}
const SECRET = new TextEncoder().encode(JWT_SECRET);

export async function createToken(userId: number, username: string, role: string) {
  return new SignJWT({ userId, username, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; username: string; role: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = findUser(payload.username);
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}
