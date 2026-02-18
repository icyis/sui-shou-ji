'use client'

import { useState } from 'react'
import { Cloud, Copy, Check, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  syncCode: string
  onSyncCodeChange: (code: string) => void
  onSyncUp: () => Promise<void>
  onSyncDown: () => Promise<void>
  onCreateSyncCode: () => Promise<string | null>
  isSyncing: boolean
  lastSyncTime: string
}

export function SyncDialog({
  open,
  onOpenChange,
  syncCode,
  onSyncCodeChange,
  onSyncUp,
  onSyncDown,
  onCreateSyncCode,
  isSyncing,
  lastSyncTime,
}: Props) {
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(syncCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreate = async () => {
    const code = await onCreateSyncCode()
    if (code) {
      setInputCode(code)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-violet-500" />
            云同步
          </DialogTitle>
          <DialogDescription>
            多设备同步你的数据
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {syncCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-lg px-3 py-1">{syncCode}</Badge>
                <Button variant="ghost" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              {lastSyncTime && (
                <p className="text-xs text-slate-500">上次同步：{lastSyncTime}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={onSyncUp} disabled={isSyncing} className="flex-1 gap-1">
                  <ArrowUp className="w-4 h-4" />
                  上传数据
                </Button>
                <Button onClick={onSyncDown} disabled={isSyncing} variant="outline" className="flex-1 gap-1">
                  <ArrowDown className="w-4 h-4" />
                  下载数据
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button onClick={handleCreate} className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                生成新的同步码
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或者</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入同步码..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button onClick={() => onSyncCodeChange(inputCode)} disabled={!inputCode}>
                  连接
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
