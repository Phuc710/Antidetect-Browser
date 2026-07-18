// Thin wrapper around window.desktop.proxy IPC.
// NO logic here — just type-safe bridge to preload.
import type {
  ListProxiesInput,
  CreateProxyInput,
  UpdateProxyInput,
  TestDraftProxyInput,
  ProxyView,
  ProxyTestResult,
  ProxyListResult,
} from 'shared';

export const proxyIpc = {
  list(input: ListProxiesInput): Promise<ProxyListResult> {
    return window.desktop.proxy.list(input);
  },
  create(input: CreateProxyInput): Promise<ProxyView> {
    return window.desktop.proxy.create(input);
  },
  update(input: UpdateProxyInput): Promise<ProxyView> {
    return window.desktop.proxy.update(input);
  },
  remove(proxyId: string): Promise<void> {
    return window.desktop.proxy.remove({ proxyId });
  },
  testDraft(input: TestDraftProxyInput): Promise<ProxyTestResult> {
    return window.desktop.proxy.testDraft(input);
  },
  testStored(proxyId: string, testId: string): Promise<ProxyTestResult> {
    return window.desktop.proxy.testStored({ proxyId, testId });
  },
  cancelTest(testId: string): Promise<void> {
    return window.desktop.proxy.cancelTest({ testId });
  },
};
