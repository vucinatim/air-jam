import { roomCodeSchema } from '../protocol'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const generateRoomCode = (): string => {
  const array = new Uint32Array(4)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * alphabet.length)
    }
  }

  const code = Array.from(array, (value) => alphabet[value % alphabet.length]).join('')
  return roomCodeSchema.parse(code)
}

export const generateControllerId = (): string => {
  const stamp = Math.floor(Date.now() % 100000).toString().padStart(5, '0')
  const random = alphabet[Math.floor(Math.random() * alphabet.length)]
  return `C${random}${stamp}`
}
