import { ref, onMounted } from 'vue'

function generateUUID(): string {
  return crypto.randomUUID()
}

const walletId = ref('')
const credits = ref(0)
const isLoading = ref(true)

let initialized = false

export function useWallet() {
  async function fetchBalance() {
    if (!walletId.value) return
    try {
      const data = await $fetch<{ credits: number }>(`/api/wallet/${walletId.value}`)
      credits.value = data.credits
    } catch {
      credits.value = 0
    } finally {
      isLoading.value = false
    }
  }

  function initWallet() {
    if (initialized) return
    initialized = true

    const stored = localStorage.getItem('walletId')
    if (stored) {
      walletId.value = stored
    } else {
      walletId.value = generateUUID()
      localStorage.setItem('walletId', walletId.value)
    }
    fetchBalance()
  }

  function updateWalletId(newId: string) {
    walletId.value = newId
    localStorage.setItem('walletId', newId)
    fetchBalance()
  }

  async function copyWalletId() {
    try {
      await navigator.clipboard.writeText(walletId.value)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = walletId.value
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  onMounted(() => {
    initWallet()
  })

  return {
    walletId,
    credits,
    isLoading,
    fetchBalance,
    updateWalletId,
    copyWalletId,
  }
}
