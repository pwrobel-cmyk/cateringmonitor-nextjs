'use client'

import { BrandWithPackages } from '@/hooks/supabase/useBrandsWithPackages'

interface PackagePairConfiguratorProps {
  brandsWithPackages: BrandWithPackages[]
}

export function PackagePairConfigurator({ brandsWithPackages: _ }: PackagePairConfiguratorProps) {
  return <div className="text-muted-foreground text-sm p-8 text-center">Konfiguracja par pakietów — wkrótce dostępna</div>
}
