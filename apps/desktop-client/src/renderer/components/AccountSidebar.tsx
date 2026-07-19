import { BrandIcon } from './AppIcons.js';

/**
 * AccountSidebar — Clean component rendering brand account shortcuts
 * Uses 100% offline BrandIcon component.
 */
const accounts = [
  { name: 'Facebook', id: 'facebook' },
  { name: 'Amazon', id: 'amazon' },
  { name: 'LinkedIn', id: 'linkedin' },
  { name: 'X.com', id: 'x' },
  { name: 'PayPal', id: 'paypal' },
  { name: 'Gmail', id: 'gmail' },
  { name: 'Outlook', id: 'outlook' },
  { name: 'Vinted', id: 'vinted' },
];

export function AccountSidebar(): JSX.Element {
  return (
    <div className="account-sidebar">
      {accounts.map((account) => (
        <button className="account-item" key={account.name} type="button">
          <BrandIcon name={account.id} size={20} />
          <span>{account.name}</span>
        </button>
      ))}
    </div>
  );
}
