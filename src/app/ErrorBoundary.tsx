import { Component, type ErrorInfo, type ReactNode } from 'react';
import { audio } from '@/audio/AudioService';
import { RedoIcon } from '@/ui/icons';

interface Props {
  mode: string;
  onError: (mode: string, error: Error) => void;
  onRestart: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * One boundary per mode (spec §13): a calm "Let's start again" screen, the
 * error recorded locally for the parent, and never a stack trace for the
 * learner. React only supports error boundaries as class components, so this
 * is the one class in the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const detail = info.componentStack
      ? `${error.stack ?? ''}\n${info.componentStack}`
      : error.stack;
    const logged = new Error(error.message);
    if (detail) logged.stack = detail;
    this.props.onError(this.props.mode, logged);
    void audio.playPrompt('pr_start_again');
  }

  private readonly restart = () => {
    this.setState({ failed: false });
    this.props.onRestart();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen kid-screen" data-testid="error-screen">
        <div className="screen__body">
          <button
            type="button"
            className="icon-button icon-button--huge icon-button--accent"
            aria-label="Start again"
            onClick={this.restart}
          >
            <RedoIcon />
          </button>
        </div>
      </main>
    );
  }
}
