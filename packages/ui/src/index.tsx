import { type ButtonHTMLAttributes, type ReactNode, useEffect, useId, useRef } from "react";

export function Button({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}

export function HearthMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 3 35 12v17L20 37 5 29V12Z" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M21 10c1 8-9 10-7 17 1 5 10 6 13 0 2-4 0-8-2-10 0 5-3 5-3 5 2-5-1-9-1-12Z"
          fill="currentColor"
        />
      </svg>
      <span>
        hearth<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="error-message" role="alert">
      {error instanceof Error ? error.message : "The action could not be completed. Try again."}
    </p>
  );
}
