/**
 * Tests for ChatPanel component
 * Verifies frontend integration with chatbot API
 * 
 * Run with: npm test -- components/ChatPanel.tsx
 * Or with coverage: npm test -- --coverage components/ChatPanel.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@/components/ChatPanel';
import * as api from '@/lib/api';

// Mock the API
jest.mock('@/lib/api', () => ({
  chatWithBot: jest.fn(),
  getVoice: jest.fn(),
}));

// Mock shadcn components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, onClick, ...props }: any) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(({ disabled, ...props }: any, ref: any) => (
    <input ref={ref} disabled={disabled} {...props} />
  )),
}));

// Mock lucide icons
jest.mock('lucide-react', () => ({
  Send: () => <span>Send</span>,
  Loader: () => <span>Loading</span>,
  Volume2: () => <span>Volume</span>,
  Mic: () => <span>Mic</span>,
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('ChatPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders with correct title', () => {
      render(<ChatPanel isActive={true} />);
      expect(screen.getByText('Emergency Assistant')).toBeInTheDocument();
    });

    test('renders with empty chat message', () => {
      render(<ChatPanel isActive={true} />);
      expect(
        screen.getByText(/Ask me anything about the emergency response/i)
      ).toBeInTheDocument();
    });

    test('renders input field', () => {
      render(<ChatPanel isActive={true} />);
      expect(screen.getByPlaceholderText(/Ask for guidance/i)).toBeInTheDocument();
    });

    test('renders send button', () => {
      render(<ChatPanel isActive={true} />);
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    test('renders microphone button', () => {
      render(<ChatPanel isActive={true} />);
      expect(screen.getByRole('button', { name: /mic/i })).toBeInTheDocument();
    });

    test('shows inactive state when isActive is false', () => {
      render(<ChatPanel isActive={false} />);
      expect(screen.getByText(/Generate a response plan first/i)).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    test('sends message on send button click', async () => {
      const mockResponse = {
        message: 'You should evacuate immediately.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'What should I do?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.chatWithBot).toHaveBeenCalledWith(
          'What should I do?',
          undefined,
          undefined,
          []
        );
      });
    });

    test('sends message on Enter key press', async () => {
      const mockResponse = {
        message: 'Evacuate to a safe location.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Help!');
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(api.chatWithBot).toHaveBeenCalled();
      });
    });

    test('clears input after sending', async () => {
      const mockResponse = {
        message: 'Stay calm.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i) as HTMLInputElement;
      await userEvent.type(input, 'Test message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    test('does not send empty messages', async () => {
      render(<ChatPanel isActive={true} />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.chatWithBot).not.toHaveBeenCalled();
      });
    });

    test('disables send button while loading', async () => {
      const mockResponse = {
        message: 'Response text.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 1000))
      );
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Question?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      expect(sendButton).toBeDisabled();
    });
  });

  describe('Message Display', () => {
    test('displays user and assistant messages', async () => {
      const mockResponse = {
        message: 'Follow evacuation routes.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'What now?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('What now?')).toBeInTheDocument();
        expect(screen.getByText('Follow evacuation routes.')).toBeInTheDocument();
      });
    });
  });

  describe('Voice Integration', () => {
    test('voice response is played after message sent', async () => {
      const mockResponse = {
        message: 'Move to safety.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'dGVzdGF1ZGlv', // base64 "testaudio"
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Help?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.getVoice).toHaveBeenCalledWith('Move to safety.');
      });
    });

    test('play button is available on assistant messages', async () => {
      const mockResponse = {
        message: 'Evacuate the area.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Question?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /play/i });
        expect(playButton).toBeInTheDocument();
      });
    });
  });

  describe('Context Passing', () => {
    test('passes quakeId to API', async () => {
      const mockResponse = {
        message: 'Response.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel quakeId="us7000abc123" isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Test?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(api.chatWithBot).toHaveBeenCalledWith(
          'Test?',
          'us7000abc123',
          undefined,
          []
        );
      });
    });

    test('passes plan data to API', async () => {
      const mockPlan = {
        summary: 'M6.5 earthquake',
        riskZones: [{ level: 'high', radiusKm: 10 }],
        stations: [],
        routes: [],
        priorityActions: ['Evacuate'],
      };

      const mockResponse = {
        message: 'Evacuate.',
        error: null,
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel plan={mockPlan} isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'What?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        const callArgs = (api.chatWithBot as jest.Mock).mock.calls[0];
        expect(callArgs[2]).toEqual(expect.objectContaining({
          summary: 'M6.5 earthquake',
        }));
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when chat fails', async () => {
      const mockResponse = {
        message: 'Unable to respond.',
        error: 'API Error',
        quick_actions: null,
      };
      (api.chatWithBot as jest.Mock).mockResolvedValue(mockResponse);
      (api.getVoice as jest.Mock).mockResolvedValue({
        audio_base64: 'base64data',
        content_type: 'audio/mpeg',
      });

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Unable to respond/i)).toBeInTheDocument();
      });
    });

    test('handles network errors gracefully', async () => {
      (api.chatWithBot as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<ChatPanel isActive={true} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i);
      await userEvent.type(input, 'Test');

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });
  });

  describe('Inactive State', () => {
    test('disables input when inactive', () => {
      render(<ChatPanel isActive={false} />);

      const input = screen.getByPlaceholderText(/Ask for guidance/i) as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    test('disables send button when inactive', () => {
      render(<ChatPanel isActive={false} />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });
  });
});
