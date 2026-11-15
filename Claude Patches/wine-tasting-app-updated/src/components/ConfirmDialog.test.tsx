import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('opens native dialog via showModal when open=true and displays title and message', () => {
    const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');

    render(
      <ConfirmDialog
        open={true}
        title="Remove bottle?"
        message="This will remove Wine A from the cellar registry."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(showModalSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Remove bottle?' })).toBeInTheDocument();
    expect(screen.getByText('This will remove Wine A from the cellar registry.')).toBeInTheDocument();
    showModalSpy.mockRestore();
  });

  it('calls only onConfirm when confirm button is clicked and resets returnValue', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Reset session?"
        message="Start fresh."
        confirmLabel="Start New"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Start New' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    const dialog = container.querySelector('dialog');
    expect(dialog?.returnValue).toBe('');
  });

  it('calls only onCancel when cancel button or Escape cancel is triggered', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete entry?"
        message="Cannot be undone."
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('prevents dismissal and disables actions while busy=true', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Working..."
        message="Please wait."
        busy={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = container.querySelector('dialog')!;
    expect(dialog).toHaveAttribute('closedby', 'none');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled();

    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
