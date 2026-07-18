export type ProxyProtocol = 'http' | 'https' | 'socks5';
export type ProxyAuthMode = 'none' | 'username_password';
export type ProxyStatus = 'unchecked' | 'checking' | 'online' | 'offline' | 'timeout' | 'authentication_error' | 'configuration_error' | 'pending_delete';

export interface ProxyView {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  usernameMasked?: string | undefined;
  status: ProxyStatus;
  countryCode?: string | undefined;
  city?: string | undefined;
  timezone?: string | undefined;
  latencyMs?: number | undefined;
  lastCheckedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyTestResult {
  status: ProxyStatus;
  publicIp?: string | undefined;
  countryCode?: string | undefined;
  city?: string | undefined;
  timezone?: string | undefined;
  latencyMs?: number | undefined;
  checkedAt: string;
}

export interface ListProxiesInput {
  search?: string | undefined;
  status?: ProxyStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ProxyListResult { items: ProxyView[]; total: number; }

export interface CreateProxyInput {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  username?: string | undefined;
  password?: string | undefined;
}

export interface UpdateProxyInput {
  proxyId: string;
  name?: string | undefined;
  protocol?: ProxyProtocol | undefined;
  host?: string | undefined;
  port?: number | undefined;
  authMode?: ProxyAuthMode | undefined;
  username?: string | undefined;
  password?: string | undefined;
}

export interface TestDraftProxyInput {
  testId: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  username?: string | undefined;
  password?: string | undefined;
}

export interface ProxiesAPI {
  list(input: ListProxiesInput): Promise<ProxyListResult>;
  create(input: CreateProxyInput): Promise<ProxyView>;
  update(input: UpdateProxyInput): Promise<ProxyView>;
  remove(input: { proxyId: string }): Promise<void>;
  testDraft(input: TestDraftProxyInput): Promise<ProxyTestResult>;
  testStored(input: { proxyId: string; testId: string }): Promise<ProxyTestResult>;
  cancelTest(input: { testId: string }): Promise<void>;
}
