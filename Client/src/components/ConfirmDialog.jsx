/**
 * Client/src/components/ConfirmDialog.jsx
 * Reusable confirmation modal — pure CSS, ad- namespace
 */
import React from "react";

const ConfirmDialog = ({
  isOpen,
  title = "Confirm Action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDanger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="cd-backdrop" onClick={onCancel}>
      <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cd-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className="cd-title">{title}</h3>
        <p className="cd-message">{message}</p>
        <div className="cd-actions">
          <button className="cd-btn cd-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`cd-btn ${confirmDanger ? "cd-btn--danger" : "cd-btn--confirm"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;