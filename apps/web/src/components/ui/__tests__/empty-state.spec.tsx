import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing yet" description="Add your first item" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first item')).toBeInTheDocument();
  });
  it('renders and fires the action', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Create', onClick }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
