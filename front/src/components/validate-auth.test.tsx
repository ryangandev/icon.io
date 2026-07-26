import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import ValidateAuth from './validate-auth';

/**
 * Mounts the gate the way the router does, with a distinguishable page beneath
 * it and another at `/Landing`, so both "was it rendered" and "where did it
 * send me" are visible rather than inferred.
 */
const renderGate = () => {
  if (!document.getElementById('app')) {
    const appRoot = document.createElement('div');
    appRoot.id = 'app';
    document.body.appendChild(appRoot);
  }

  return render(
    <MemoryRouter initialEntries={['/Gamehub']}>
      <Routes>
        <Route element={<ValidateAuth />}>
          <Route path="/Gamehub" element={<div>the game hub</div>} />
        </Route>
        <Route path="/Landing" element={<div>the landing page</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('the username gate', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('lets a named player straight through', () => {
    sessionStorage.setItem('username', 'Ada');
    renderGate();

    expect(screen.getByText('the game hub')).toBeInTheDocument();
    expect(screen.queryByText('Enter Username')).not.toBeInTheDocument();
  });

  /*
   * The page below used to render immediately and be reloaded out from under
   * itself once a name arrived. A deep link into a room therefore joined it
   * with no name at all, and the retry never came.
   */
  it('holds the page back until there is a name to play under', async () => {
    renderGate();

    expect(screen.queryByText('the game hub')).not.toBeInTheDocument();
    expect(screen.getByText('Enter Username')).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText('Enter your username'),
      'Ada',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(screen.getByText('the game hub')).toBeInTheDocument(),
    );
    expect(sessionStorage.getItem('username')).toBe('Ada');
  });

  it('refuses a name that is only whitespace', async () => {
    renderGate();

    await userEvent.type(
      screen.getByPlaceholderText('Enter your username'),
      '   ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.queryByText('the game hub')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('username')).toBeNull();
  });

  it('sends a player who will not name themselves back to the landing page', async () => {
    renderGate();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByText('the landing page')).toBeInTheDocument(),
    );
  });
});
