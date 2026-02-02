<script setup lang="ts">
import { ref } from 'vue'
import { useWallet } from '~/composables/useWallet'

const { walletId, credits, isLoading, updateWalletId, copyWalletId, fetchBalance } = useWallet()

const showWallet = ref(false)
const walletFill = ref(0)
const walletInput = ref('')
const snackbar = ref(false)
const snackbarText = ref('')

function handleCopy() {
  copyWalletId()
  snackbarText.value = 'Wallet ID copied!'
  snackbar.value = true
}

function handleUpdateWalletId() {
  if (walletInput.value && walletInput.value.length === 36) {
    updateWalletId(walletInput.value)
    snackbarText.value = 'Wallet ID updated.'
    snackbar.value = true
  } else {
    snackbarText.value = 'Invalid wallet ID (must be 36 characters).'
    snackbar.value = true
  }
}

function doFillWallet() {
  const amount = walletFill.value * 100
  if (amount < 100) {
    snackbarText.value = 'Minimum $1'
    snackbar.value = true
    return
  }
  if (walletId.value.length !== 36) {
    snackbarText.value = 'Invalid wallet ID'
    snackbar.value = true
    return
  }
  snackbarText.value = 'Payment integration not yet configured.'
  snackbar.value = true
}

function onDialogOpen() {
  walletInput.value = walletId.value
  showWallet.value = true
}
</script>

<template>
  <div>
    <v-btn
      @click="onDialogOpen"
      variant="tonal"
      color="primary"
      size="small"
      class="mr-2"
    >
      <v-icon start size="16">mdi-wallet-outline</v-icon>
      <span v-if="isLoading" style="font-size: 0.8rem">...</span>
      <span v-else class="mono" style="font-size: 0.8rem">{{ credits }}</span>
    </v-btn>

    <v-dialog v-model="showWallet" max-width="460">
      <v-card style="border: 1px solid rgba(59,130,246,0.15)">
        <div class="pa-4 d-flex align-center" style="border-bottom: 1px solid rgba(255,255,255,0.04)">
          <v-icon color="primary" class="mr-2">mdi-wallet-outline</v-icon>
          <span style="font-weight: 500">Wallet</span>
          <v-spacer />
          <v-chip size="x-small" color="primary" variant="tonal" class="mono">
            {{ credits }} credits
          </v-chip>
        </div>

        <v-card-text class="pt-4">
          <v-text-field
            v-model="walletInput"
            label="Wallet ID"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="handleCopy"
            class="mb-2 mono"
            style="font-size: 0.85rem"
          />
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            class="mb-4"
            @click="handleUpdateWalletId"
            :disabled="walletInput === walletId"
          >
            Update ID
          </v-btn>

          <v-alert variant="tonal" color="warning" density="compact" class="mb-4" style="font-size: 0.8rem">
            <v-icon start size="14">mdi-alert-outline</v-icon>
            Your wallet ID is the key to your credits. Do not share it.
          </v-alert>

          <v-row>
            <v-col cols="8">
              <v-text-field
                v-model.number="walletFill"
                label="Add Credits (1 USD = 100)"
                prepend-inner-icon="mdi-currency-usd"
                type="number"
              />
            </v-col>
            <v-col cols="4" class="d-flex align-center">
              <v-btn color="primary" block @click="doFillWallet" size="small">
                <v-icon start size="16">mdi-plus</v-icon>
                Fill
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="pa-4" style="border-top: 1px solid rgba(255,255,255,0.04)">
          <v-spacer />
          <v-btn variant="text" @click="showWallet = false" style="color: #64748b">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2000">{{ snackbarText }}</v-snackbar>
  </div>
</template>
