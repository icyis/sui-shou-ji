import { NextRequest, NextResponse } from 'next/server'
import { getSyncAccount, updateSyncAccount, mergeNotes, type NoteData } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const account = await getSyncAccount(code)

    if (!account) {
      return NextResponse.json({ error: '同步码不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      syncCode: account.syncCode,
      notes: account.notes,
      updatedAt: account.updatedAt
    })
  } catch (error) {
    console.error('获取同步数据失败:', error)
    return NextResponse.json({ error: '获取同步数据失败' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const { notes }: { notes: NoteData[] } = body

    const account = await getSyncAccount(code)
    if (!account) {
      return NextResponse.json({ error: '同步码不存在' }, { status: 404 })
    }

    const mergedNotes = mergeNotes(notes, account.notes)
    const updatedAccount = await updateSyncAccount(code, mergedNotes)

    if (!updatedAccount) {
      return NextResponse.json({ error: '更新数据失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '同步成功',
      notes: updatedAccount.notes,
      syncCount: mergedNotes.length
    })
  } catch (error) {
    console.error('同步数据失败:', error)
    return NextResponse.json({ error: '同步数据失败' }, { status: 500 })
  }
}
