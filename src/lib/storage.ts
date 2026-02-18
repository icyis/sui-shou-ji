// 统一存储工具 - 支持 Vercel KV 和本地内存存储

interface NoteData {
  id: string
  content: string
  type: string
  tags: string[]
  images: string[]
  createdAt: string
  reminderAt?: string
  aiSuggestion?: string
  aiTypeReason?: string
  isAiAnalyzed?: boolean
}

interface SyncAccount {
  syncCode: string
  notes: NoteData[]
  createdAt: string
  updatedAt: string
}

// 本地内存存储（开发环境降级方案）
const memoryStore = new Map<string, SyncAccount>()

// 检查是否在 Vercel 环境且有 KV 配置
function isKvEnabled(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// 动态导入 KV
async function getKv() {
  if (!isKvEnabled()) return null
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

// 生成同步码
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'SSJ-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 检查同步码是否存在
export async function syncCodeExists(syncCode: string): Promise<boolean> {
  const kv = await getKv()
  if (kv) {
    const account = await kv.get<SyncAccount>(`sync:${syncCode}`)
    return !!account
  }
  return memoryStore.has(syncCode)
}

// 创建同步账户
export async function createSyncAccount(syncCode: string): Promise<SyncAccount> {
  const account: SyncAccount = {
    syncCode,
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  const kv = await getKv()
  if (kv) {
    await kv.set(`sync:${syncCode}`, account)
  } else {
    memoryStore.set(syncCode, account)
  }
  return account
}

// 获取同步账户
export async function getSyncAccount(syncCode: string): Promise<SyncAccount | null> {
  const kv = await getKv()
  if (kv) {
    return await kv.get<SyncAccount>(`sync:${syncCode}`)
  }
  return memoryStore.get(syncCode) || null
}

// 更新同步账户数据
export async function updateSyncAccount(syncCode: string, notes: NoteData[]): Promise<SyncAccount | null> {
  const existing = await getSyncAccount(syncCode)
  if (!existing) return null
  const account: SyncAccount = {
    ...existing,
    notes,
    updatedAt: new Date().toISOString()
  }
  const kv = await getKv()
  if (kv) {
    await kv.set(`sync:${syncCode}`, account)
  } else {
    memoryStore.set(syncCode, account)
  }
  return account
}

// 合并同步数据
export function mergeNotes(localNotes: NoteData[], cloudNotes: NoteData[]): NoteData[] {
  const noteMap = new Map<string, NoteData>()
  for (const note of cloudNotes) {
    noteMap.set(note.id, note)
  }
  for (const note of localNotes) {
    const existing = noteMap.get(note.id)
    if (!existing || new Date(note.createdAt) > new Date(existing.createdAt)) {
      noteMap.set(note.id, note)
    }
  }
  return Array.from(noteMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export type { NoteData, SyncAccount }
