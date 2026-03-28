'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Building2, User, MessageSquare, Send, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: "",
    inquiryType: "price",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const inquiryLabel = formData.inquiryType === "price"
        ? "Zapytanie o cenę"
        : "Prośba o live demo";

      const { error } = await (supabase as any)
        .from("contact_submissions")
        .insert({
          name: formData.name,
          company: formData.company,
          email: formData.email,
          phone: formData.phone || null,
          message: formData.message,
          inquiry_type: inquiryLabel,
        });

      if (error) throw error;

      setSubmitStatus("success");
      setFormData({ name: "", company: "", email: "", phone: "", message: "", inquiryType: "price" });
    } catch (error) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Powrót do cennika
        </Link>

        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl">Zapytaj o cenę Enterprise</CardTitle>
          </CardHeader>
          <CardContent>
            {submitStatus === "success" ? (
              <Alert className="border-primary/50 bg-primary/5">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <AlertDescription className="text-foreground ml-2">
                  <strong>Dziękujemy za wiadomość!</strong><br />
                  Skontaktujemy się z Tobą wkrótce.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {submitStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-5 w-5" />
                    <AlertDescription className="ml-2">
                      Wystąpił błąd podczas wysyłania. Spróbuj ponownie lub napisz na info@cateringmonitor.pl
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-3">
                  <Label>Czego dotyczy zapytanie? *</Label>
                  <RadioGroup
                    value={formData.inquiryType}
                    onValueChange={(value) => setFormData({ ...formData, inquiryType: value })}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="price" id="price" />
                      <Label htmlFor="price" className="font-normal cursor-pointer">
                        Chcę zapytać się o cenę
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="demo" id="demo" />
                      <Label htmlFor="demo" className="font-normal cursor-pointer">
                        Chcę umówić się na live demo
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Imię i nazwisko *
                    </Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Jan Kowalski"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Firma *
                    </Label>
                    <Input
                      id="company"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Nazwa firmy"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jan@firma.pl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+48 123 456 789"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Wiadomość *
                  </Label>
                  <Textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Opisz swoje potrzeby, liczbę monitorowanych marek, interesujące funkcje..."
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Wysyłanie..." : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Wyślij zapytanie
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Możesz też napisać bezpośrednio na{" "}
          <a href="mailto:info@cateringmonitor.pl" className="text-primary hover:underline">
            info@cateringmonitor.pl
          </a>
        </p>
      </div>
    </div>
  );
}
