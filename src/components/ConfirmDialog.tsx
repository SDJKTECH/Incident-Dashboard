import { useRef } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal title={title} onClose={onCancel} initialFocusRef={cancelRef}>
      <p className="text-sm text-gray-800">{message}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
