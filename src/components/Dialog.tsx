import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

let openCount = 0;
let previousOverflow = "";
export function Dialog({
  title,
  eyebrow,
  children,
  onClose,
  drawer = false,
  busy = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    if (openCount++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      element.close();
      if (--openCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "dialog drawer" : "dialog"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        if (
          !busy &&
          event.target === event.currentTarget &&
          (event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom)
        )
          onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Закрыть окно"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
