import { NextRequest, NextResponse } from 'next/server'
import { generateSyncCode, syncCodeExists, createSyncAccount } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    let syncCode = generateSyncCode()
    let attempts = 0

    while (attempts < 10) {
      const exists = await syncCodeExists(syncCode)
      if (!exists) break
      syncCode = generateSyncCode()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: '生成同步码失败，请重试' }, { status: 500 })
    }

    const account = await createSyncAccount(syncCode)

    return NextResponse.json({
      success: true,
      syncCode: account.syncCode,
      createdAt: account.createdAt
    })
  } catch (error) {
    console.error('创建同步账户失败:', error)
    return NextResponse.json({ error: '创建同步账户失败' }, { status: 500 })
  }
}
