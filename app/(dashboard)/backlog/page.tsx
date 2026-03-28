'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { AlertCircle, Bug, Lightbulb, Wrench } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  change_type: string;
  created_at: string;
  updated_at: string;
}

export default function Backlog() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("development_tasks")
        .select("*")
        .eq("reporter_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks((data as Task[]) || []);
    } catch (error) {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      nowe: "outline",
      realizacja: "secondary",
      wykonane: "default",
    };
    const labels: Record<string, string> = {
      nowe: "Nowe",
      realizacja: "W realizacji",
      wykonane: "Wykonane",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    };
    const labels: Record<string, string> = {
      critical: "Krytyczny",
      high: "Wysoki",
      medium: "Średni",
      low: "Niski",
    };
    return (
      <Badge className={colors[priority] || ""} variant="outline">
        {labels[priority] || priority}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bugfix":
        return <Bug className="h-4 w-4" />;
      case "feature":
        return <Lightbulb className="h-4 w-4" />;
      case "improvement":
        return <Wrench className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bugfix: "Błąd",
      feature: "Nowa funkcja",
      improvement: "Ulepszenie",
      breaking: "Krytyczna zmiana",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Backlog zgłoszeń</h1>
        <p className="text-muted-foreground">Lista Twoich zgłoszeń błędów i sugestii</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Brak zgłoszeń</h3>
          <p className="text-muted-foreground">
            Nie masz jeszcze żadnych zgłoszeń. Użyj opcji &quot;Zgłoś błąd / sugestię&quot; aby dodać nowe.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead className="w-24">Typ</TableHead>
                <TableHead>Tytuł</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-32">Priorytet</TableHead>
                <TableHead className="w-40">Data zgłoszenia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-sm">#{task.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(task.change_type)}
                      <span className="text-sm hidden lg:inline">{getTypeLabel(task.change_type)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(task.created_at), "d MMM yyyy, HH:mm", { locale: pl })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
