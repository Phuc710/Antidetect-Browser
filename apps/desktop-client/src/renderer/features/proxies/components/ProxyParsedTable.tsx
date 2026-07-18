import { Trash2 } from 'lucide-react';
import type { ParsedProxyItem } from '../proxy-batch-model.js';
import { ProxyTestStatus } from './ProxyTestStatus.js';

interface ProxyParsedTableProps {
  parsedList: ParsedProxyItem[];
  onDeleteRow(id: string): void;
  disabled: boolean;
}

export function ProxyParsedTable({ parsedList, onDeleteRow, disabled }: ProxyParsedTableProps): JSX.Element | null {
  if (parsedList.length === 0) return null;

  return (
    <div className="proxy-dialog__batch-table-wrap">
      <h3 className="proxy-dialog__sub-title">Proxy đã phân tích ({parsedList.length})</h3>
      <div className="proxy-dialog__table-scroll">
        <table className="proxy-dialog__table">
          <thead>
            <tr>
              <th>Giao thức</th>
              <th>Host</th>
              <th>Port</th>
              <th>Username</th>
              <th>Password</th>
              <th>URL làm mới</th>
              <th>Ghi chú</th>
              <th>IP đầu ra</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {parsedList.map((item) => (
              <tr key={item.id}>
                <td className="font-mono text-uppercase">{item.protocol}</td>
                <td className="font-mono">{item.host}</td>
                <td className="font-mono">{item.port}</td>
                <td>{item.username || '-'}</td>
                <td>{item.password ? '******' : '-'}</td>
                <td className="proxy-dialog__table-cell-url" title={item.refreshUrl}>{item.refreshUrl || '-'}</td>
                <td>{item.notes || '-'}</td>
                <td className="font-mono">{item.outboundIp || '-'}</td>
                <td>
                  <ProxyTestStatus status={item.status} />
                </td>
                <td>
                  <button
                    type="button"
                    className="proxy-dialog__row-delete"
                    onClick={() => onDeleteRow(item.id)}
                    disabled={disabled}
                    aria-label="Xóa dòng"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
