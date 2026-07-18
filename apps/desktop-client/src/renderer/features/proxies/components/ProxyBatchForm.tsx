import { Loader2 } from 'lucide-react';
import type { ProxyProtocol } from 'shared';
import type { ParsedProxyItem } from '../proxy-batch-model.js';
import { ProxyParsedTable } from './ProxyParsedTable.js';

interface ProxyBatchFormProps {
  batchText: string;
  setBatchText: React.Dispatch<React.SetStateAction<string>>;
  batchIpType: 'ipv4' | 'ipv6';
  setBatchIpType: React.Dispatch<React.SetStateAction<'ipv4' | 'ipv6'>>;
  batchProtocol: ProxyProtocol;
  setBatchProtocol: React.Dispatch<React.SetStateAction<ProxyProtocol>>;
  batchIpDetection: string;
  setBatchIpDetection: React.Dispatch<React.SetStateAction<string>>;
  deduplicate: boolean;
  setDeduplicate: React.Dispatch<React.SetStateAction<boolean>>;
  parsedList: ParsedProxyItem[];
  onParseBatch(): void;
  onClearBatch(): void;
  onDeleteRow(id: string): void;
  onTestAll(): void;
  onSaveAll(): void;
  testing: boolean;
  saving: boolean;
  onCancel(): void;
}

export function ProxyBatchForm({
  batchText,
  setBatchText,
  batchIpType,
  setBatchIpType,
  batchProtocol,
  setBatchProtocol,
  batchIpDetection,
  setBatchIpDetection,
  deduplicate,
  setDeduplicate,
  parsedList,
  onParseBatch,
  onClearBatch,
  onDeleteRow,
  onTestAll,
  onSaveAll,
  testing,
  saving,
  onCancel,
}: ProxyBatchFormProps): JSX.Element {
  return (
    <>
      <div className="proxy-dialog__body">
        {/* Batch Setup Controls */}
        <div className="proxy-dialog__row proxy-dialog__row--batch-header">
          <div className="proxy-dialog__field">
            <label className="proxy-dialog__label">Loại IP</label>
            <div className="proxy-dialog__select-wrap">
              <select
                className="proxy-dialog__select"
                value={batchIpType}
                onChange={(e) => setBatchIpType(e.target.value as 'ipv4' | 'ipv6')}
                disabled={testing || saving}
              >
                <option value="ipv4">IPv4</option>
                <option value="ipv6">IPv6</option>
              </select>
            </div>
          </div>

          <div className="proxy-dialog__field">
            <label className="proxy-dialog__label">Giao thức mặc định</label>
            <div className="proxy-dialog__select-wrap">
              <select
                className="proxy-dialog__select"
                value={batchProtocol}
                onChange={(e) => setBatchProtocol(e.target.value as ProxyProtocol)}
                disabled={testing || saving}
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
          </div>

          <div className="proxy-dialog__field">
            <label className="proxy-dialog__label">Kênh kiểm tra IP</label>
            <div className="proxy-dialog__select-wrap">
              <select
                className="proxy-dialog__select"
                value={batchIpDetection}
                onChange={(e) => setBatchIpDetection(e.target.value)}
                disabled={testing || saving}
              >
                <option>IPRust.io</option>
                <option>IP2Location</option>
              </select>
            </div>
          </div>
        </div>

        {/* Batch Textarea */}
        <div className="proxy-dialog__field">
          <label className="proxy-dialog__label">Quy tắc nhập hàng loạt (Tối đa 500 dòng)</label>
          <textarea
            className="proxy-dialog__textarea proxy-dialog__textarea--batch font-mono"
            placeholder="Ví dụ (URL làm mới và Ghi chú là tùy chọn):
192.168.0.1:8000
192.168.0.1:8000:username:password
192.168.0.1:8000:username:password[http://refresh.url]{Notes}
username:password@192.168.0.1:8000[http://refresh.url]{Notes}"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            disabled={testing || saving}
          />
        </div>

        {/* Deduplication & Parse controls */}
        <div className="proxy-dialog__batch-actions">
          <label className="proxy-dialog__checkbox-label">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => setDeduplicate(e.target.checked)}
              disabled={testing || saving}
            />
            <span>Tự động loại bỏ trùng lặp</span>
          </label>
          <button
            type="button"
            className="button button--primary"
            onClick={onParseBatch}
            disabled={!batchText.trim() || testing || saving}
          >
            Phân tích dữ liệu
          </button>
        </div>

        {/* Parsed List Table */}
        <ProxyParsedTable
          parsedList={parsedList}
          onDeleteRow={onDeleteRow}
          disabled={testing || saving}
        />
      </div>

      {/* Footer actions for Batch tab */}
      <footer className="proxy-dialog__footer">
        <div className="proxy-dialog__footer-left-buttons">
          {parsedList.length > 0 && (
            <>
              <button
                type="button"
                className="button button--danger-outline"
                onClick={onClearBatch}
                disabled={testing || saving}
              >
                Xóa danh sách
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={onTestAll}
                disabled={testing || saving}
              >
                {testing ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
                <span>{testing ? 'Đang test đồng thời...' : 'Kiểm tra kết nối tất cả'}</span>
              </button>
            </>
          )}
        </div>
        <div className="proxy-dialog__footer-right">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={testing || saving}
          >
            Hủy
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onSaveAll}
            disabled={parsedList.length === 0 || testing || saving}
          >
            {saving ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
            <span>{saving ? 'Đang lưu hàng loạt...' : 'Lưu tất cả'}</span>
          </button>
        </div>
      </footer>
    </>
  );
}
