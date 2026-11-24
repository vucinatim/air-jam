import { z } from "zod";

/**
 * Seats are numbered by the room from 1 and never reused while it lives; the
 * id players and games see is that number after a "p". Binary input records
 * carry the number in two bytes.
 */
export const MAXIMUM_SEAT_NUMBER = 0xffff;

export const seatIdSchema = z.string().regex(/^p[1-9][0-9]{0,4}$/);
export type SeatId = z.infer<typeof seatIdSchema>;

export const seatIdFromNumber = (seatNumber: number): SeatId => {
  if (
    !Number.isInteger(seatNumber) ||
    seatNumber < 1 ||
    seatNumber > MAXIMUM_SEAT_NUMBER
  )
    throw new Error(`Seat number ${seatNumber} is out of range.`);
  return `p${seatNumber}`;
};

export const seatNumberFromId = (seatId: SeatId): number => {
  const seatNumber = Number(seatId.slice(1));
  if (
    !seatIdSchema.safeParse(seatId).success ||
    seatNumber > MAXIMUM_SEAT_NUMBER
  )
    throw new Error(`"${seatId}" is not a seat id.`);
  return seatNumber;
};
