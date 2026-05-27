import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('defaults to type button inside forms', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <form onSubmit={onSubmit}>
        <Button>Save</Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
