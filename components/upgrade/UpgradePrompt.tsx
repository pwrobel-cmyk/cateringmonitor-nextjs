'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { Crown } from 'lucide-react'

interface UpgradePromptProps {
  feature: string
  currentPackage?: string
  targetPackage: string
  benefits?: string[]
  className?: string
}

export function UpgradePrompt({ targetPackage }: UpgradePromptProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          Wymagany plan {targetPackage}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link href="/pricing" className={buttonVariants()}>Rozszerz plan</Link>
      </CardContent>
    </Card>
  )
}
