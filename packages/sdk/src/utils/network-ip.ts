/**
 * Checks if an IP is from a virtual network interface (Docker, VMs, etc.)
 */
const isVirtualNetwork = (ip: string): boolean => {
  // Docker Desktop on Mac uses 192.168.64.x and 192.168.65.x
  if (ip.startsWith('192.168.64.') || ip.startsWith('192.168.65.')) {
    return true
  }
  // Docker default bridge network
  if (ip.startsWith('172.17.')) {
    return true
  }
  // Other common virtual network ranges
  if (ip.startsWith('172.18.') || ip.startsWith('172.19.')) {
    return true
  }
  // Link-local addresses
  if (ip.startsWith('169.254.')) {
    return true
  }
  return false
}

/**
 * Scores an IP address to determine preference.
 * Higher score = more preferred.
 */
const scoreIp = (ip: string): number => {
  // Prefer 192.168.0.x - 192.168.63.x (common home network ranges, excluding virtual networks)
  if (ip.startsWith('192.168.')) {
    const parts = ip.split('.')
    const thirdOctet = parseInt(parts[2] || '0', 10)
    // Prefer lower third octets (0-63) as they're more likely to be real networks
    if (thirdOctet < 64) {
      return 100 - thirdOctet // Higher score for lower numbers
    }
    // 64+ are often virtual, but we'll still consider them if nothing else
    return 10
  }
  // Prefer 10.x.x.x networks
  if (ip.startsWith('10.')) {
    return 50
  }
  // 172.16-31.x.x networks (but not 172.17.x.x which is Docker)
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) {
    return 30
  }
  return 0
}

/**
 * Gets the local network IP address using WebRTC.
 * Filters out virtual network interfaces and prefers real network IPs.
 * Returns null if unable to determine the IP.
 */
export const getLocalNetworkIp = (): Promise<string | null> => {
  return new Promise((resolve) => {
    // If not in browser, return null
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      resolve(null)
      return
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const candidates: Array<{ ip: string; score: number }> = []
    let candidateGatheringComplete = false

    const resolveOnce = (ip: string | null) => {
      pc.close()
      resolve(ip)
    }

    // Timeout after 3 seconds
    const timeout = setTimeout(() => {
      if (candidateGatheringComplete) {
        pickBestCandidate()
      } else {
        // Wait a bit more for candidates to arrive
        setTimeout(() => {
          pickBestCandidate()
        }, 500)
      }
    }, 3000)

    const pickBestCandidate = () => {
      if (candidates.length === 0) {
        resolveOnce(null)
        return
      }

      // Sort by score (highest first), then pick the best one
      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      clearTimeout(timeout)
      resolveOnce(best.ip)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate
        const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/)
        if (match) {
          const ip = match[1]
          // Filter out localhost
          if (ip === '127.0.0.1') {
            return
          }

          // Check if it's a private network IP
          const isPrivate =
            ip.startsWith('192.168.') ||
            ip.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)

          if (isPrivate && !isVirtualNetwork(ip)) {
            const score = scoreIp(ip)
            candidates.push({ ip, score })
          }
        }
      } else {
        // No more candidates - gathering is complete
        candidateGatheringComplete = true
        // Give it a moment for any last candidates to arrive, then pick the best
        setTimeout(() => {
          pickBestCandidate()
        }, 200)
      }
    }

    // Create a data channel to trigger candidate gathering
    pc.createDataChannel('')
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timeout)
        resolveOnce(null)
      })
  })
}

