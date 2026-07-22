import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Command, CommandItem, CommandList } from './command';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

describe('CommandItem', () => {
  it('keeps an enabled item clickable when cmdk emits data-disabled=false', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <Command>
        <CommandList>
          <CommandItem value="room-1" onSelect={onSelect}>
            Room 1
          </CommandItem>
        </CommandList>
      </Command>
    );

    const item = screen.getByRole('option', { name: 'Room 1' });
    expect(item).toHaveAttribute('data-disabled', 'false');
    expect(item.className).toContain('data-[disabled=true]:pointer-events-none');

    await user.click(item);
    expect(onSelect).toHaveBeenCalledWith('room-1');
  });
});
