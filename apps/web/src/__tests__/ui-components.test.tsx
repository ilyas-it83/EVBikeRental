import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { ToastProvider, useToast } from '../components/ui/Toast';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-green-600');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-gray-200');
  });

  it('applies ghost variant styles', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-transparent');
  });

  it('applies size sm', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('text-sm');
  });

  it('applies size lg', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('text-lg');
  });

  it('shows loading state with spinner', () => {
    render(<Button isLoading>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Loading…');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes extra className', () => {
    render(<Button className="w-full">Full</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });
});

describe('Input', () => {
  it('renders label and input', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('generates id from label', () => {
    render(<Input label="First Name" />);
    expect(screen.getByLabelText('First Name')).toHaveAttribute('id', 'first-name');
  });

  it('uses provided id', () => {
    render(<Input label="Email" id="custom-id" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'custom-id');
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-describedby when error is present', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('applies error styling', () => {
    render(<Input label="Email" error="Nope" />);
    expect(screen.getByLabelText('Email').className).toContain('border-red-500');
  });

  it('applies normal styling when no error', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email').className).toContain('border-gray-300');
  });

  it('passes through extra props', () => {
    render(<Input label="Email" placeholder="you@example.com" type="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('placeholder', 'you@example.com');
    expect(input).toHaveAttribute('type', 'email');
  });
});

describe('Spinner', () => {
  it('renders with default size', () => {
    render(<Spinner />);
    const svg = screen.getByRole('status');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Loading');
    expect(svg.getAttribute('class')).toContain('h-8 w-8');
  });

  it('accepts custom className', () => {
    render(<Spinner className="h-12 w-12" />);
    expect(screen.getByRole('status').getAttribute('class')).toContain('h-12 w-12');
  });
});

describe('Toast', () => {
  function ToastTrigger({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
    const { toast } = useToast();
    return <button onClick={() => toast(message, type)}>Show Toast</button>;
  }

  it('shows toast message', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Hello!" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('shows success toast with green background', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Success!" type="success" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    const toast = screen.getByText('Success!');
    expect(toast.className).toContain('bg-green-600');
  });

  it('shows error toast with red background', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Error!" type="error" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    const toast = screen.getByText('Error!');
    expect(toast.className).toContain('bg-red-600');
  });

  it('shows info toast with gray background', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Info!" type="info" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    const toast = screen.getByText('Info!');
    expect(toast.className).toContain('bg-gray-800');
  });

  it('defaults to info type', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Default" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Default').className).toContain('bg-gray-800');
  });

  it('dismisses toast on click', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Dismiss me" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();
    await user.click(screen.getByText('Dismiss me'));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('auto-dismisses after timeout', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Auto dismiss" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('throws if useToast is used outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastTrigger message="fail" />)).toThrow(
      'useToast must be used within ToastProvider',
    );
    spy.mockRestore();
  });
});
