'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, BarChart3, Package, MessageSquare, Percent, Camera, Search, Brain, FileText, TrendingUp, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const features = [
  { icon: BarChart3, name: 'Dashboard KPI i wykresy trendów' },
  { icon: TrendingUp, name: 'Porównywarka pakietów' },
  { icon: Package, name: 'Pełna historia cen z eksportem' },
  { icon: MessageSquare, name: 'Opinie z analizą AI' },
  { icon: Percent, name: 'Monitoring rabatów i alerty' },
  { icon: Camera, name: 'Screenshots stron konkurencji' },
  { icon: Search, name: 'SEO monitoring pozycji' },
  { icon: Brain, name: 'SEO LLM - widoczność w AI' },
  { icon: FileText, name: 'Raporty brandowe i rynkowe' },
]

const plans = [
  {
    key: 'monthly' as const,
    name: 'Miesięczny',
    price: '3 999',
    period: '/ msc',
    description: 'Elastyczny plan bez zobowiązań',
    badge: null,
    highlight: false,
  },
  {
    key: 'quarterly' as const,
    name: 'Kwartalny',
    price: '3 199',
    period: '/ msc',
    description: 'Oszczędzasz 20% vs plan miesięczny',
    badge: 'Popularny',
    highlight: true,
  },
  {
    key: 'yearly' as const,
    name: 'Roczny',
    price: '2 499',
    period: '/ msc',
    description: 'Oszczędzasz 37% vs plan miesięczny',
    badge: 'Najlepsza cena',
    highlight: false,
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleCheckout = async (priceKey: string) => {
    if (!user) {
      toast.error('Musisz być zalogowany, żeby wybrać plan')
      return
    }

    setLoadingPlan(priceKey)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceKey },
      })

      if (error) throw error
      if (data?.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      toast.error('Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 space-y-12 max-w-5xl">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">Pełny monitoring konkurencji</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Wybierz plan dopasowany do Twojego biznesu cateringowego
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.key}
                className={`relative flex flex-col ${plan.highlight ? 'border-primary shadow-lg scale-[1.02]' : 'border-border'}`}
              >
                {plan.badge && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1">
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 items-center space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-lg text-muted-foreground"> zł{plan.period}</span>
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    variant={plan.highlight ? 'default' : 'outline'}
                    disabled={loadingPlan !== null}
                    onClick={() => handleCheckout(plan.key)}
                  >
                    {loadingPlan === plan.key ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Crown className="h-4 w-4 mr-2" />
                    )}
                    Wybierz plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Każdy plan Enterprise zawiera:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                {features.map((feature, idx) => {
                  const Icon = feature.icon
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-full bg-primary/10 shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{feature.name}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border-t pt-6">
                <ul className="grid md:grid-cols-2 gap-3">
                  {[
                    'Nielimitowana liczba marek',
                    'Pełna historia danych',
                    'Nielimitowany eksport',
                    'Dostęp do API',
                    'Dedykowane wsparcie techniczne',
                    'Szkolenie z platformy',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Potrzebujesz indywidualnej oferty?</p>
            <Link href="/contact" className={buttonVariants({ variant: 'outline' })}>Skontaktuj się z nami</Link>
            <p className="text-sm text-muted-foreground">
              lub napisz na{' '}
              <a href="mailto:info@cateringmonitor.pl" className="text-primary hover:underline font-medium">
                info@cateringmonitor.pl
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
