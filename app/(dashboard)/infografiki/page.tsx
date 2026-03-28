'use client';

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

const infografiki = [
  {
    id: "rynek-2025",
    title: "Rynek Cateringu Dietetycznego w Polsce 2025",
    description: "Analiza i prognozy rynku cateringu dietetycznego",
    image: "/infografika-rynek-cateringu-2025.png",
  },
];

export default function Infografiki() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Infografiki</h1>
        <p className="text-muted-foreground mt-2">
          Wizualne podsumowania i analizy rynku cateringu dietetycznego
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {infografiki.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
            onClick={() => setSelectedImage(item.image)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full h-48">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover object-top"
                />
              </div>
              <p className="text-sm text-muted-foreground p-4 pt-2">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-2">
          {selectedImage && (
            <div className="relative w-full" style={{ minHeight: 400 }}>
              <Image
                src={selectedImage}
                alt="Infografika"
                width={1200}
                height={900}
                className="w-full h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
