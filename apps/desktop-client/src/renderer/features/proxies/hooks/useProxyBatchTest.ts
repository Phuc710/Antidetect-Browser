import { useState, useCallback } from 'react';
import type { ParsedProxyItem } from '../proxy-batch-model.js';
import { useTestProxy } from '../hooks/proxy-hooks.js';

export function useProxyBatchTest(
  parsedList: ParsedProxyItem[],
  setParsedList: React.Dispatch<React.SetStateAction<ParsedProxyItem[]>>
) {
  const [testing, setTesting] = useState(false);
  const { testDraft } = useTestProxy();

  const testAllBatch = useCallback(async () => {
    if (parsedList.length === 0 || testing) return;
    setTesting(true);

    // Chuyển toàn bộ danh sách sang trạng thái checking
    setParsedList((prev) => prev.map((p) => ({ ...p, status: 'checking' })));

    const limit = 5;
    let index = 0;
    const listToTest = [...parsedList];

    async function worker() {
      while (index < listToTest.length) {
        const currentIdx = index++;
        const item = listToTest[currentIdx];
        if (!item) continue;

        try {
          const result = await testDraft({
            testId: `batch-test-${item.id}-${Date.now()}`,
            protocol: item.protocol,
            host: item.host,
            port: item.port,
            authMode: item.authMode,
            username: item.username,
            password: item.password,
          });

          setParsedList((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? {
                    ...p,
                    status: result.status === 'online' ? 'online' : 'offline',
                    outboundIp: result.publicIp,
                  }
                : p
            )
          );
        } catch {
          setParsedList((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'offline' } : p))
          );
        }
      }
    }

    const workers = Array.from({ length: Math.min(limit, listToTest.length) }, worker);
    await Promise.all(workers);
    setTesting(false);
  }, [parsedList, testing, setParsedList, testDraft]);

  return {
    testAllBatch,
    testing,
  };
}
