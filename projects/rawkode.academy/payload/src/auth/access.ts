export function isStaff(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const value = user as Record<string, unknown>
  return value.collection === 'users' && value.role === 'staff'
}
