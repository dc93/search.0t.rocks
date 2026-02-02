<script setup lang="ts">
import { ref } from 'vue'
import { useWallet } from '~/composables/useWallet'

const { walletId, credits, isLoading, updateWalletId, copyWalletId, fetchBalance } = useWallet()

const showWallet = ref(false)
const walletFill = ref(0)
const snackbar = ref(false)
const snackbarText = ref('')

function handleCopy() {
  copyWalletId()
  snackbarText.value = 'Wallet ID copied!'
  snackbar.value = true
}

function handleUpdateWalletId(newId: string) {
  updateWalletId(newId)
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
  window.location.href = `/fillWallet/${walletId.value}/${amount}`
}
</script>

<template>
  <div>
    <v-btn @click="showWallet = true" variant="text" class="text-white">
      <span v-if="isLoading">Loading...</span>
      <span v-else>{{ credits }} Credits</span>
      <v-icon end>mdi-wallet</v-icon>
    </v-btn>

    <v-dialog v-model="showWallet" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center">
          <span>Wallet Management</span>
          <v-spacer />
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn icon v-bind="props" size="small">
                <v-icon>mdi-information</v-icon>
              </v-btn>
            </template>
            <div style="max-width: 300px">
              <p>Credits can be used for:</p>
              <ul class="ml-4">
                <li>Bulk data exports</li>
                <li>Data enrichment via CSV upload</li>
                <li>Visualization exports</li>
              </ul>
              <p class="mt-2">Regular search is always free.</p>
            </div>
          </v-tooltip>
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="walletId"
            label="Wallet ID"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="handleCopy"
            @change="handleUpdateWalletId(($event.target as HTMLInputElement).value)"
            class="mb-2"
          />
          <v-alert type="warning" variant="outlined" density="compact" class="mb-4">
            Your wallet ID is the key to your credits. Do not share it.
          </v-alert>

          <v-row>
            <v-col cols="9">
              <v-text-field
                v-model.number="walletFill"
                label="Fill Wallet (1 USD = 100 credits)"
                prepend-inner-icon="mdi-currency-usd"
                type="number"
              />
            </v-col>
            <v-col cols="3" class="d-flex align-center">
              <v-btn color="primary" block @click="doFillWallet">Fill</v-btn>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showWallet = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2000" location="bottom">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>
