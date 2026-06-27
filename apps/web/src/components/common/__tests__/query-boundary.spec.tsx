import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryBoundary } from '@/components/common/query-boundary';

describe('QueryBoundary', () => {
  it('shows the loading state', () => {
    render(<QueryBoundary isLoading isError={false}><div>data</div></QueryBoundary>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('shows the error state', () => {
    render(<QueryBoundary isLoading={false} isError><div>data</div></QueryBoundary>);
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });
  it('shows the empty state', () => {
    render(<QueryBoundary isLoading={false} isError={false} isEmpty emptyTitle="Nothing here"><div>data</div></QueryBoundary>);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
  it('renders children when data is present', () => {
    render(<QueryBoundary isLoading={false} isError={false}><div>the data</div></QueryBoundary>);
    expect(screen.getByText('the data')).toBeInTheDocument();
  });
});
