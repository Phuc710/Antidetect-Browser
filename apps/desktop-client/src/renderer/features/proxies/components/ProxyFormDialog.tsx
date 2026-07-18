import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { CreateProxyInput, ProxyProtocol, ProxyTestResult, ProxyView, UpdateProxyInput } from 'shared';
import { useCreateProxy, useTestProxy, useUpdateProxy } from '../hooks/proxy-hooks.js';
import { useProxyBatchTest } from '../hooks/useProxyBatchTest.js';
import { parseProxyLine } from '../parsers/proxy-input-parser.js';
import { EMPTY_FORM, type FormState, type ParsedProxyItem } from '../proxy-batch-model.js';
import { randomUUID } from '../utils/uuid.js';
import { ProxyBatchForm } from './ProxyBatchForm.js';
import { ProxySingleForm } from './ProxySingleForm.js';
import './ProxyFormDialog.css';

interface ProxyFormDialogProps {
  open: boolean;
  editTarget?: ProxyView | undefined;
  onClose(): void;
  onSaved(proxy: ProxyView): void;
}

export function ProxyFormDialog({ open, editTarget, onClose, onSaved }: ProxyFormDialogProps): JSX.Element | null {
  const isEdit = Boolean(editTarget);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [recognitionText, setRecognitionText] = useState('');
  const [batchText, setBatchText] = useState('');
  const [parsedList, setParsedList] = useState<ParsedProxyItem[]>([]);
  const [batchIpType, setBatchIpType] = useState<'ipv4' | 'ipv6'>('ipv4');
  const [batchProtocol, setBatchProtocol] = useState<ProxyProtocol>('http');
  const [batchIpDetection, setBatchIpDetection] = useState('First-party identity service');
  const [deduplicate, setDeduplicate] = useState(true);
  const [batchSaving, setBatchSaving] = useState(false);

  const { create, loading: creating, error: createError } = useCreateProxy(onSaved);
  const { update, loading: updating, error: updateError } = useUpdateProxy(onSaved);
  const { testDraft, testingIds } = useTestProxy();
  const { testAllBatch, testing: batchTesting } = useProxyBatchTest(parsedList, setParsedList);
  const isTesting = currentTestId ? testingIds.has(currentTestId) : false;
  const isSaving = creating || updating;

  useEffect(() => {
    if (open && editTarget) {
      setActiveTab('single');
      setForm({
        ...EMPTY_FORM,
        name: editTarget.name,
        protocol: editTarget.protocol,
        host: editTarget.host,
        port: String(editTarget.port),
        authMode: editTarget.authMode,
      });
    } else if (open) {
      setForm(EMPTY_FORM);
      setActiveTab('single');
      setBatchText('');
      setParsedList([]);
    }
    setRecognitionText('');
    setTestResult(null);
    setValidationError(null);
    setShowPassword(false);
  }, [open, editTarget]);

  function handleClose(): void {
    if (!isSaving && !batchSaving && !batchTesting) onClose();
  }

  function handleRecognitionChange(text: string): void {
    setRecognitionText(text);
    const parsed = parseProxyLine(text, form.protocol);
    if (!parsed) return;
    setForm((current) => ({
      ...current,
      protocol: parsed.protocol,
      host: parsed.host,
      port: String(parsed.port),
      authMode: parsed.authMode,
      username: parsed.username ?? '',
      password: parsed.password ?? '',
      refreshUrl: parsed.refreshUrl ?? '',
      notes: parsed.notes ?? '',
    }));
    setValidationError(null);
  }

  function handleParseBatch(): void {
    const items: ParsedProxyItem[] = [];
    const seen = new Set<string>();
    for (const line of batchText.split(/\r?\n/)) {
      const parsed = parseProxyLine(line, batchProtocol);
      if (!parsed) continue;
      const key = `${parsed.protocol}://${parsed.host}:${parsed.port}`;
      if (deduplicate && seen.has(key)) continue;
      seen.add(key);
      items.push(parsed);
    }
    setParsedList(items);
  }

  async function handleSaveBatch(): Promise<void> {
    if (parsedList.length === 0 || batchSaving) return;
    setBatchSaving(true);
    setValidationError(null);
    let lastSavedProxy: ProxyView | null = null;
    let failureCount = 0;
    for (const item of parsedList) {
      if (item.authMode === 'username_password' && (!item.username || !item.password)) {
        failureCount += 1;
        continue;
      }
      try {
        const input: CreateProxyInput = {
          name: item.notes?.trim() || `${item.host}:${item.port}`,
          protocol: item.protocol,
          host: item.host.trim(),
          port: item.port,
          authMode: item.authMode,
          ...(item.authMode === 'username_password' && item.username && item.password
            ? { username: item.username.trim(), password: item.password }
            : {}),
        };
        lastSavedProxy = await window.desktop.proxy.create(input);
      } catch {
        failureCount += 1;
      }
    }
    setBatchSaving(false);
    if (failureCount > 0) setValidationError(`${failureCount} proxy entries could not be saved.`);
    if (lastSavedProxy && failureCount === 0) onSaved(lastSavedProxy);
  }

  function validate(): boolean {
    if (!form.host.trim()) {
      setValidationError('Host is required.');
      return false;
    }
    const port = Number(form.port);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
      setValidationError('Port must be an integer from 1 to 65535.');
      return false;
    }
    if (form.authMode === 'username_password' && !isEdit && (!form.username.trim() || !form.password)) {
      setValidationError('Username and password are required for an authenticated proxy.');
      return false;
    }
    return true;
  }

  async function handleTest(): Promise<void> {
    if (!validate()) return;
    if (form.authMode === 'username_password' && (!form.username.trim() || !form.password)) {
      setValidationError('Enter credentials before testing an authenticated proxy.');
      return;
    }
    const testId = randomUUID();
    setCurrentTestId(testId);
    setTestResult(null);
    try {
      const result = await testDraft({
        testId,
        protocol: form.protocol,
        host: form.host.trim(),
        port: Number(form.port),
        authMode: form.authMode,
        ...(form.authMode === 'username_password'
          ? { username: form.username.trim(), password: form.password }
          : {}),
      });
      setTestResult(result);
    } catch {
      setValidationError('Proxy test failed.');
    } finally {
      setCurrentTestId(null);
    }
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!validate()) return;
    const name = form.name.trim() || form.notes.trim() || `${form.host.trim()}:${form.port}`;
    if (isEdit && editTarget) {
      const input: UpdateProxyInput = {
        proxyId: editTarget.id,
        name,
        protocol: form.protocol,
        host: form.host.trim(),
        port: Number(form.port),
        authMode: form.authMode,
        ...(form.authMode === 'username_password' && form.username.trim()
          ? { username: form.username.trim() }
          : {}),
        ...(form.password ? { password: form.password } : {}),
      };
      await update(input);
      return;
    }
    const input: CreateProxyInput = {
      name,
      protocol: form.protocol,
      host: form.host.trim(),
      port: Number(form.port),
      authMode: form.authMode,
      ...(form.authMode === 'username_password'
        ? { username: form.username.trim(), password: form.password }
        : {}),
    };
    await create(input);
  }

  if (!open) return null;
  const serverError = createError ?? updateError;

  return (
    <div className="proxy-dialog__backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Proxy' : 'Add Proxy'}>
      <div className={`proxy-dialog ${activeTab === 'batch' ? 'proxy-dialog--large' : ''}`} onClick={(event) => event.stopPropagation()}>
        <header className="proxy-dialog__header">
          <h2 className="proxy-dialog__title">{isEdit ? 'Edit Proxy' : 'Add Proxy'}</h2>
          <button className="proxy-dialog__close" onClick={handleClose} aria-label="Close" disabled={isSaving || batchSaving}><X size={16} /></button>
        </header>
        {!isEdit && (
          <div className="proxy-dialog__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === 'single'} className={`proxy-dialog__tab ${activeTab === 'single' ? 'proxy-dialog__tab--active' : ''}`} onClick={() => setActiveTab('single')}>Single</button>
            <button type="button" role="tab" aria-selected={activeTab === 'batch'} className={`proxy-dialog__tab ${activeTab === 'batch' ? 'proxy-dialog__tab--active' : ''}`} onClick={() => setActiveTab('batch')}>Batch</button>
          </div>
        )}
        {activeTab === 'single' ? (
          <ProxySingleForm
            form={form}
            setForm={setForm}
            recognitionText={recognitionText}
            onRecognitionChange={handleRecognitionChange}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            validationError={validationError}
            serverError={serverError}
            testResult={testResult}
            isTesting={isTesting}
            isSaving={isSaving}
            isEdit={isEdit}
            onTest={handleTest}
            onCancel={handleClose}
            onSubmit={handleSubmit}
          />
        ) : (
          <ProxyBatchForm
            batchText={batchText}
            setBatchText={setBatchText}
            batchIpType={batchIpType}
            setBatchIpType={setBatchIpType}
            batchProtocol={batchProtocol}
            setBatchProtocol={setBatchProtocol}
            batchIpDetection={batchIpDetection}
            setBatchIpDetection={setBatchIpDetection}
            deduplicate={deduplicate}
            setDeduplicate={setDeduplicate}
            parsedList={parsedList}
            onParseBatch={handleParseBatch}
            onClearBatch={() => setParsedList([])}
            onDeleteRow={(id) => setParsedList((current) => current.filter((item) => item.id !== id))}
            onTestAll={testAllBatch}
            onSaveAll={handleSaveBatch}
            testing={batchTesting}
            saving={batchSaving}
            onCancel={handleClose}
          />
        )}
      </div>
    </div>
  );
}
