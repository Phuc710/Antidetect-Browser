import type { ProxyAuthMode, ProxyProtocol, ProxyStatus } from 'shared';

export interface ParsedProxyItem {
  id: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  authMode: ProxyAuthMode;
  username?: string | undefined;
  password?: string | undefined;
  refreshUrl?: string | undefined;
  notes?: string | undefined;
  status: ProxyStatus;
  outboundIp?: string | undefined;
  error?: string | undefined;
}

export interface FormState {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  authMode: ProxyAuthMode;
  username: string;
  password: string;
  refreshUrl: string;
  notes: string;
  ipType: 'ipv4' | 'ipv6';
}

export const EMPTY_FORM: Readonly<FormState> = {
  name: '',
  protocol: 'http',
  host: '',
  port: '',
  authMode: 'none',
  username: '',
  password: '',
  refreshUrl: '',
  notes: '',
  ipType: 'ipv4',
};
