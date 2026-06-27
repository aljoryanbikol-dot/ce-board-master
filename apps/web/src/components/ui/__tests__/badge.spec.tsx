import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
  it('applies the success variant', () => {
    render(<Badge variant="success">Passed</Badge>);
    expect(screen.getByText('Passed').className).toContain('text-success');
  });
});
