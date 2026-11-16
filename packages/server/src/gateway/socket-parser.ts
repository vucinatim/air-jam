import { Decoder, Encoder, PacketType } from "socket.io-parser";

class JsonSocketDecoder extends Decoder {
  override add(packet: unknown): void {
    // Air Jam has no binary wire payloads. Reject before attachment reconstruction.
    if (
      typeof packet !== "string" ||
      packet.startsWith(String(PacketType.BINARY_EVENT)) ||
      packet.startsWith(String(PacketType.BINARY_ACK))
    ) {
      throw new Error("Binary Socket.IO packets are not supported.");
    }
    super.add(packet);
  }
}

export const socketParser = { Encoder, Decoder: JsonSocketDecoder };
