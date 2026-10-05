import { useState } from 'react';
import {
  BID_FACES,
  bidWords,
  smallestCountFor,
  smallestRaise,
  type Bid,
} from '../../../shared/liars-dice';
import type { BidPickerProps, DieFace } from '../ui';

/**
 * The picker's choice, kept to a raise: picking a face lifts the count to the
 * smallest that face allows, and Fewer stops there. It opens on the smallest
 * raise, and starts over whenever the bid in front of you changes.
 */
export function useBidChoice(
  previous: Bid | null,
  diceOnTable: number,
  onBid: (bid: Bid) => void,
): Omit<BidPickerProps, 'onCall' | 'className'> | null {
  const key = previous ? `${previous.count}×${previous.face}` : 'open';
  const opening = smallestRaise(previous, diceOnTable);
  const [choice, setChoice] = useState({ key, bid: opening });
  let bid = choice.bid;
  if (choice.key !== key) {
    bid = opening;
    setChoice({ key, bid: opening });
  }
  if (bid === null) return null;
  const chosen = bid;
  return {
    ...pickerFor(chosen, previous, diceOnTable, (next) =>
      setChoice({ key, bid: next }),
    ),
    onBid: () => onBid(chosen),
  };
}

/** The picker's props for `bid`, given the bid it must raise. */
export function pickerFor(
  bid: Bid,
  previous: Bid | null,
  diceOnTable: number,
  choose: (bid: Bid) => void,
): Omit<BidPickerProps, 'onCall' | 'onBid' | 'className'> {
  const lowest = smallestCountFor(bid.face, previous);
  return {
    count: bid.count,
    face: bid.face as DieFace,
    openFaces: BID_FACES.filter(
      (face) => smallestCountFor(face, previous) <= diceOnTable,
    ),
    canFewer: bid.count - 1 >= Math.max(1, lowest),
    canMore: bid.count + 1 <= diceOnTable,
    bidLabel: `Bid ${bidWords(bid)}`,
    onCountChange: (count) =>
      choose({
        ...bid,
        count: Math.min(diceOnTable, Math.max(lowest, count)),
      }),
    onFaceChange: (face) =>
      choose({
        face,
        count: Math.max(bid.count, smallestCountFor(face, previous)),
      }),
  };
}
