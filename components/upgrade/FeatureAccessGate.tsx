'use client'

import { ReactNode } from 'react'
import { usePackageAccess } from '@/hooks/usePackageAccess'

interface FeatureAccessGateProps {
  feature: string
  children: ReactNode
  title?: string
  description?: string
}

export function FeatureAccessGate({ feature, children }: FeatureAccessGateProps) {
  const { needsUpgrade } = usePackageAccess()
  if (needsUpgrade(feature)) return null
  return <>{children}</>
}
