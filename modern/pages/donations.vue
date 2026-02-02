<script setup lang="ts">
interface Donation {
  name: string
  amount: number
  message?: string
}

const { data } = await useFetch<Donation[]>('/api/donations')
</script>

<template>
  <div>
    <h1 class="text-h5 mb-6">Donations</h1>
    <p class="text-grey mb-6">
      Thank you to everyone who has donated to support this project.
    </p>

    <v-alert v-if="!data || data.length === 0" type="info" variant="outlined">
      No donations yet.
    </v-alert>

    <v-table v-else density="compact">
      <thead>
        <tr>
          <th>Name</th>
          <th>Amount</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(donation, i) in data" :key="i">
          <td>{{ donation.name }}</td>
          <td>${{ donation.amount.toFixed(2) }}</td>
          <td class="text-grey">{{ donation.message || '—' }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
