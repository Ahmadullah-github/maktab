import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressView } from '../components/dashboard/ProgressView';

describe('ProgressView', () => {
  it('renders determinate progress with server phase text', () => {
    render(
      <ProgressView
        strategy="balanced"
        elapsedTime={90}
        isGenerating={true}
        phaseText="در حال حل (مرحله ۲)..."
        percentComplete={85}
        estimatedSecondsRemaining={12}
        canCancel={true}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('در حال حل (مرحله ۲)...')).toBeInTheDocument();
    expect(screen.getByText('85% تکمیل شده')).toBeInTheDocument();
    expect(screen.getByText('12 ثانیه باقی مانده')).toBeInTheDocument();
  });

  it('renders indeterminate progress when percentage is unavailable', () => {
    render(
      <ProgressView
        strategy="balanced"
        elapsedTime={15}
        isGenerating={true}
        phaseText="در حال تحلیل پیش از تولید..."
        canCancel={true}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('در حال تحلیل پیش از تولید...')).toBeInTheDocument();
    expect(screen.queryByText(/تکمیل شده/)).not.toBeInTheDocument();
  });
});
