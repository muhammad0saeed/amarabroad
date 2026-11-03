"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// Native <dialog>: focus trap, Esc to close and a backdrop for free.
// A bottom sheet on phones, a centred panel on wider screens.
export function BottomSheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 sm:inset-auto sm:m-auto sm:max-w-lg sm:rounded-card"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <h2 id="sheet-title" className="text-heading font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid size-tap place-items-center rounded-full hover:bg-surface-2">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </dialog>
  );
}
