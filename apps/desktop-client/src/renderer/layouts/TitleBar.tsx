import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

export function TitleBar(): JSX.Element {
  return (
    <div className="title-bar">
      <div className="title-bar__app">
        <span className="title-bar__mark" />
        <span>RoxyBrowser v3.9.2</span>
      </div>

      <div className="title-bar__controls">
        <button
          className="title-bar__control"
          aria-label="Minimize"
          onClick={() => {
            window.desktop.window.minimize().catch(() => undefined);
          }}
        >
          <Minus size={13} />
        </button>
        <button
          className="title-bar__control"
          aria-label="Maximize"
          onClick={() => {
            window.desktop.window.maximize().catch(() => undefined);
          }}
        >
          <Square size={11} />
        </button>
        <button
          className="title-bar__control title-bar__control--close"
          aria-label="Close"
          onClick={() => {
            window.desktop.window.close().catch(() => undefined);
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
