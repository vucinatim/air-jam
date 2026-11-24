import type { SeatId, SeatView } from "../room-protocol";

/** The room's seats as its `welcome`, `seat` and `left` frames describe them. */
export class Roster {
  private readonly seats = new Map<SeatId, SeatView>();

  reset(seats: readonly SeatView[]): void {
    this.seats.clear();
    for (const seat of seats) this.seats.set(seat.id, seat);
  }

  upsert(seat: SeatView): void {
    this.seats.set(seat.id, seat);
  }

  remove(seat: SeatId): void {
    this.seats.delete(seat);
  }

  list(): readonly SeatView[] {
    return [...this.seats.values()];
  }
}
