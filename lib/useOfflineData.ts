"use client";

import { useCallback, useEffect, useState } from "react";
import { getOfflineDb, type OfflineEntity, type OfflineRecord } from "./offlineDb";
import { checkIsOnline, pullEntityFromServer } from "./syncManager";

export function useOfflineData<T extends OfflineRecord = OfflineRecord>(
  entity: OfflineEntity,
  query = "limit=200"
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const db = getOfflineDb();
      const table = db.getEntityTable(entity);
      const cached = (await table.filter((r) => !r._deleted).toArray()) as T[];
      if (cached.length > 0) {
        setData(cached);
        setIsFromCache(true);
      }

      const online = await checkIsOnline();
      if (online) {
        const fresh = (await pullEntityFromServer(entity, query)) as T[];
        setData(fresh);
        setIsFromCache(false);
      }
    } catch {
      // Keep cached data if available
    } finally {
      setLoading(false);
    }
  }, [entity, query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, isFromCache, refresh };
}
