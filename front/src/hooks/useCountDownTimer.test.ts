import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCountdownTimer from './useCountDownTimer';

/*
 * The deadline is captured once, before rendering. `renderHook`'s callback runs
 * again on every render, so computing it inline would mint a fresh deadline on
 * each tick and the countdown would never move.
 */
const inMs = (ms: number) => Date.now() + ms;

describe('useCountdownTimer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts at the right number without waiting for a tick', () => {
        const deadline = inMs(30_000);
        const { result } = renderHook(() => useCountdownTimer(deadline));

        expect(result.current).toBe(30);
    });

    it('counts down as time passes', () => {
        const deadline = inMs(10_000);
        const { result } = renderHook(() => useCountdownTimer(deadline));

        act(() => void vi.advanceTimersByTime(3000));
        expect(result.current).toBe(7);

        act(() => void vi.advanceTimersByTime(6000));
        expect(result.current).toBe(1);
    });

    it('stops at zero rather than going negative', () => {
        const deadline = inMs(2000);
        const { result } = renderHook(() => useCountdownTimer(deadline));

        act(() => void vi.advanceTimersByTime(20_000));
        expect(result.current).toBe(0);
    });

    it('reads zero as no phase running, not as a deadline in 1970', () => {
        const { result } = renderHook(() => useCountdownTimer(0));

        expect(result.current).toBe(0);

        act(() => void vi.advanceTimersByTime(5000));
        expect(result.current).toBe(0);
    });

    /*
     * Each phase change hands down a fresh deadline. Re-anchoring rather than
     * decrementing is what keeps the countdown from accumulating drift across a
     * game, and what lets a phase restart cleanly at its full duration.
     */
    it('re-anchors when the server issues a new deadline', () => {
        const { result, rerender } = renderHook(
            ({ deadline }) => useCountdownTimer(deadline),
            { initialProps: { deadline: inMs(10_000) } },
        );

        act(() => void vi.advanceTimersByTime(8000));
        expect(result.current).toBe(2);

        act(() => rerender({ deadline: inMs(90_000) }));
        expect(result.current).toBe(90);
    });

    /*
     * A background tab has its intervals throttled, so the count is stale when
     * it comes back. Reading the clock on every tick rather than decrementing a
     * counter means the first tick after the tab wakes shows the true time left.
     */
    it('recovers the right number after a throttled gap', () => {
        const deadline = inMs(60_000);
        const { result } = renderHook(() => useCountdownTimer(deadline));

        // A single very late tick, as a throttled tab would deliver.
        act(() => void vi.advanceTimersByTime(45_000));

        expect(result.current).toBe(15);
    });

    it('stops ticking once unmounted', () => {
        const deadline = inMs(60_000);
        const { result, unmount } = renderHook(() =>
            useCountdownTimer(deadline),
        );

        const lastValue = result.current;
        unmount();
        act(() => void vi.advanceTimersByTime(30_000));

        expect(result.current).toBe(lastValue);
        expect(vi.getTimerCount()).toBe(0);
    });
});
