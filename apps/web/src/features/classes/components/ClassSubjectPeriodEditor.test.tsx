import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassSubjectPeriodEditor } from './ClassSubjectPeriodEditor';

describe('ClassSubjectPeriodEditor', () => {
  it('saves a valid class requirement and prevents reducing below assigned periods', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ClassSubjectPeriodEditor
        value={5}
        assignedPeriods={3}
        gradeDefaultPeriods={5}
        periodMode="inherited"
        onSave={onSave}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2' } });
    expect(screen.getByRole('button', { name: /common\.save|save|ذخیره/i })).toBeDisabled();

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /common\.save|save|ذخیره/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(4));
  });
});
