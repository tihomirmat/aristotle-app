import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, MessageSquare, Code2, AlertTriangle } from "lucide-react";
import KnowledgeBaseTab from "@/components/klepet/KnowledgeBaseTab";
import ConversationsTab from "@/components/klepet/ConversationsTab";
import EmbedTab from "@/components/klepet/EmbedTab";

export default function Klepet() {
  const { business } = useBusiness();

  const { data: conversations = [] } = useQuery({
    queryKey: ["convs", business?.id],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["kb", business?.id],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const escalatedCount = conversations.filter(c => c.escalated && c.status !== "resolved").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Klepetalni pomočnik</h1>
        <p className="text-muted-foreground mt-1">Upravljajte znanje chatbota, pregledujte pogovore in pridobite embed kodo.</p>
      </div>

      <Tabs defaultValue="kb">
        <TabsList className="mb-6">
          <TabsTrigger value="kb" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Baza znanja
            {docs.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{docs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="convs" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Pogovori
            {escalatedCount > 0 && (
              <Badge className="bg-red-100 text-red-700 border-0 text-xs ml-1 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />{escalatedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="embed" className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            Namestitev
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kb">
          <KnowledgeBaseTab businessId={business?.id} />
        </TabsContent>

        <TabsContent value="convs">
          <ConversationsTab businessId={business?.id} />
        </TabsContent>

        <TabsContent value="embed">
          <EmbedTab business={business} />
        </TabsContent>
      </Tabs>
    </div>
  );
}