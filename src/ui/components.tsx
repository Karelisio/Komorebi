import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { Icon } from './icons';

/** Feuille coulissante (bottom sheet) : glisser vers le bas ou toucher le voile pour fermer. */
export function BottomSheet({
  title,
  onClose,
  children,
  tabs,
  actions,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 230);
  };

  return (
    <>
      <div className="sheet-scrim" onPointerDown={close} />
      <div
        ref={sheetRef}
        className={`sheet${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, dy: 0 };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current || !sheetRef.current) return;
            drag.current.dy = Math.max(0, e.clientY - drag.current.y);
            sheetRef.current.style.transform = `translateY(${drag.current.dy}px)`;
          }}
          onPointerUp={() => {
            if (!drag.current || !sheetRef.current) return;
            if (drag.current.dy > 90) close();
            else sheetRef.current.style.transform = '';
            drag.current = null;
          }}
        >
          <div className="sheet-handle" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {actions}
              <button className="icon-btn" onClick={close} aria-label={t('common.close')}>
                <Icon.close />
              </button>
            </div>
          </div>
        </div>
        {tabs}
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button
          key={o.id}
          className={`chip${o.id === value ? ' on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.id)}
          className={`chip${o.id === value ? ' on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="stars">{'★'.repeat(n) + '☆'.repeat(Math.max(0, max - n))}</span>;
}

/** Affiche un canvas existant (portraits de koïs, vignettes). */
export function CanvasView({
  canvas,
  className,
}: {
  canvas: HTMLCanvasElement | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    setSrc(canvas ? canvas.toDataURL() : '');
  }, [canvas]);
  return src ? <img src={src} className={className} alt="" draggable={false} /> : null;
}

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return t('common.minutes', { n: min });
  const h = Math.round(min / 60);
  if (h < 48) return t('common.hours', { n: h });
  return t('common.days', { n: Math.round(h / 24) });
}
