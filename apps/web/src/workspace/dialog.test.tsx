// @vitest-environment jsdom
import { Dialog } from "@hearth/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";

const originalShow = HTMLDialogElement.prototype.showModal,
  originalClose = HTMLDialogElement.prototype.close;
afterEach(() => {
  cleanup();
  HTMLDialogElement.prototype.showModal = originalShow;
  HTMLDialogElement.prototype.close = originalClose;
});
let allowClose = false;
function GuardedDialog() {
  const [open, setOpen] = useState(true);
  return open ? (
    <Dialog
      title="Pending save"
      onClose={() => {
        if (allowClose) setOpen(false);
      }}
    >
      Saving
    </Dialog>
  ) : null;
}
it("lets guarded dialog state control Escape rather than closing the native dialog behind React", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  allowClose = false;
  render(<GuardedDialog />);
  const dialog = screen.getByRole("dialog"),
    cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(screen.getByRole("dialog")).toBe(dialog);
  allowClose = true;
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
