import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { readCache, writeCache } from "@/lib/option-cache";
import type { StatusFieldData } from "@/lib/types";

export function useStatusField(projectId: string | null) {
  return useQuery({
    queryKey: ["statusField", projectId],
    queryFn: async () => {
      const data = await api.statusField(projectId as string);
      writeCache(`status:${projectId}`, data);
      return data;
    },
    enabled: !!projectId,
    initialData: () => (projectId ? readCache<StatusFieldData>(`status:${projectId}`) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}
