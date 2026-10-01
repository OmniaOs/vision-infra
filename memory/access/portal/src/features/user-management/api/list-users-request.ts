import { httpGet } from '@/shared/api/http-client'
import type { UserRecord } from '@/shared/types/user-record'

export async function listUsersRequest(): Promise<UserRecord[]> {
  const { users } = await httpGet<{ users: UserRecord[] }>('/api/admin/users')
  return users
}
