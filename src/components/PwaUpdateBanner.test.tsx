import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PWA_UPDATE_EVENT,
  PWA_UPDATE_REQUEST_EVENT,
  PwaUpdateBanner,
  type ApplyPwaUpdate,
} from './PwaUpdateBanner';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PwaUpdateBanner', () => {
  it('マウント時に保留中の更新を要求し、受け取った更新を適用する', async () => {
    const user = userEvent.setup();
    const requestListener = vi.fn();
    const applyUpdate = vi.fn<ApplyPwaUpdate>().mockResolvedValue(undefined);
    window.addEventListener(PWA_UPDATE_REQUEST_EVENT, requestListener);

    render(<PwaUpdateBanner />);

    expect(requestListener).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(
        new CustomEvent<ApplyPwaUpdate>(PWA_UPDATE_EVENT, { detail: applyUpdate }),
      );
    });

    await user.click(screen.getByRole('button', { name: '更新' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);

    window.removeEventListener(PWA_UPDATE_REQUEST_EVENT, requestListener);
  });
});
