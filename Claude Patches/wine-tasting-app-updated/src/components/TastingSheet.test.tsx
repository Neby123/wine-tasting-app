import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vote, Wine } from '../types/wine';
import TastingSheet from './TastingSheet';

const buildWines = (): Wine[] => [
  { id: 'wA', session_id: 'sess-1', submitted_by: 'David', name: 'Bottle A', price: 20, blind_label: 'A', revealed: false },
  { id: 'wB', session_id: 'sess-1', submitted_by: 'Ben', name: 'Bottle B', price: 22, blind_label: 'B', revealed: false },
  { id: 'wC', session_id: 'sess-1', submitted_by: 'Monica', name: 'Bottle C', price: 18, blind_label: 'C', revealed: false },
];

describe('TastingSheet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists local drafts across unmount/remount so ratings are never lost on refresh', async () => {
    const user = userEvent.setup();
    const onSubmitStandaloneRating = vi.fn().mockResolvedValue(undefined);
    const wines = buildWines();

    const { unmount } = render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Alexcia"
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
        sessionName="Fifty Shades of Grigio"
      />
    );

    const wineATrigger = screen.getByRole('button', { name: /Wine A/i });
    await user.click(wineATrigger);

    const slider = screen.getByLabelText(/Wine A Score/i);
    fireEvent.change(slider, { target: { value: '88' } });

    const notesBox = screen.getByPlaceholderText(/Aroma, flavor notes, finish/i);
    await user.type(notesBox, 'Bright orchard fruit');

    await user.click(screen.getByRole('button', { name: 'Sweetness 2 out of 5' }));

    expect(screen.getByText(/Unsaved drafts for Wine A\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save All Unsaved Ratings \(1\)/i })).toBeInTheDocument();

    unmount();

    render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Alexcia"
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
        sessionName="Fifty Shades of Grigio"
      />
    );

    expect(screen.getByText(/Unsaved drafts for Wine A\./i)).toBeInTheDocument();
    expect(screen.getByText(/Unsaved draft \(88\/100\)/i)).toBeInTheDocument();
  });

  it('protects active dirty drafts from background polling updates while refreshing untouched wines', async () => {
    const user = userEvent.setup();
    const onSubmitStandaloneRating = vi.fn().mockResolvedValue(undefined);
    const wines = buildWines();

    const { rerender } = render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Alexcia"
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
      />
    );

    await user.click(screen.getByRole('button', { name: /Wine A/i }));
    fireEvent.change(screen.getByLabelText(/Wine A Score/i), { target: { value: '91' } });
    expect(screen.getByText(/Unsaved draft \(91\/100\)/i)).toBeInTheDocument();

    // Background Supabase poll updates votes with a saved Wine B rating for Alexcia and another vote on Wine A
    const polledVotes: Vote[] = [
      {
        id: 'vote-a-server',
        session_id: 'sess-1',
        voter_name: 'Alexcia',
        match_id: 'STANDALONE_A',
        wine_1_label: 'A',
        wine_2_label: 'A',
        slider_value: 60,
      },
      {
        id: 'vote-b-server',
        session_id: 'sess-1',
        voter_name: 'alexcia',
        match_id: 'STANDALONE_B',
        wine_1_label: 'B',
        wine_2_label: 'B',
        slider_value: 76,
      },
    ];

    rerender(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Alexcia"
        votes={polledVotes}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
      />
    );

    // Wine A keeps in-progress 91 draft instead of reverting to server 60; untouched Wine B shows Saved: 76/100
    expect(screen.getByText(/Unsaved draft \(91\/100\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved: 76\/100/i)).toBeInTheDocument();
  });

  it('batch-saves all unsaved drafts and keeps failed drafts for retry', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();
    const onSubmitStandaloneRating = vi.fn(async (label: string) => {
      if (label === 'C') {
        throw new Error('Network timeout saving Wine C');
      }
    });
    const wines = buildWines();

    render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Jack"
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
        onNotify={onNotify}
      />
    );

    await user.click(screen.getByRole('button', { name: /Wine A/i }));
    fireEvent.change(screen.getByLabelText(/Wine A Score/i), { target: { value: '82' } });
    await user.click(screen.getByRole('button', { name: /Wine C/i }));
    fireEvent.change(screen.getByLabelText(/Wine C Score/i), { target: { value: '74' } });

    await user.click(screen.getByRole('button', { name: /Save All Unsaved Ratings \(2\)/i }));

    await waitFor(() => {
      expect(onSubmitStandaloneRating).toHaveBeenCalledTimes(2);
    });

    // Wine A draft cleared, Wine C failed draft retained with visible alert
    expect(screen.getByText(/Unsaved drafts for Wine C\./i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Network timeout saving Wine C');
  });

  it('surfaces inline error and focuses custom taster field instead of disabling Save when voterName is blank', async () => {
    const user = userEvent.setup();
    const onSubmitStandaloneRating = vi.fn().mockResolvedValue(undefined);
    const wines = buildWines();

    render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName=""
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
        onUpdateVoterName={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Wine A/i }));
    const saveBtn = screen.getByRole('button', { name: /Save Rating for Wine A/i });
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);

    expect(onSubmitStandaloneRating).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      'Please select or enter your taster name at the top first.'
    );
    expect(screen.getByPlaceholderText('Or enter a custom name...')).toHaveFocus();
  });

  it('implements WAI-ARIA heading disclosure attributes and warns beforeunload when dirty drafts exist', async () => {
    const user = userEvent.setup();
    const onSubmitStandaloneRating = vi.fn().mockResolvedValue(undefined);
    const wines = buildWines();

    render(
      <TastingSheet
        sessionId="sess-1"
        wines={wines}
        voterName="Alexcia"
        votes={[]}
        onSubmitStandaloneRating={onSubmitStandaloneRating}
      />
    );

    const trigger = screen.getByRole('button', { name: /Wine B/i });
    expect(trigger.closest('h3')).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = document.getElementById(panelId!);
    expect(region).toHaveAttribute('role', 'region');
    expect(region).not.toHaveAttribute('hidden');

    fireEvent.change(screen.getByLabelText(/Wine B Score/i), { target: { value: '93' } });

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);
    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
  });
});
