#!/bin/bash
# Elasticsearch index setup — equivalent of the old Solr run.sh
# Run once after starting the Elasticsearch cluster.

ES_HOST="${ES_HOST:-http://localhost:9200}"

echo "Waiting for Elasticsearch..."
until curl -s "$ES_HOST/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
  sleep 2
done
echo "Elasticsearch is ready."

echo ""
echo "=== Creating bigdata index ==="

curl -s -X PUT "$ES_HOST/bigdata" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 4,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "index.mapping.total_fields.limit": 200,
    "analysis": {
      "normalizer": {
        "lowercase": {
          "type": "custom",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "firstName":     { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "lastName":      { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "middleName":    { "type": "text" },
      "emails":        { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "usernames":     { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "passwords":     { "type": "keyword" },
      "phoneNumbers":  { "type": "keyword" },
      "address":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "city":          { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "state":         { "type": "keyword" },
      "zipCode":       { "type": "keyword" },
      "country":       { "type": "keyword" },
      "continent":     { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "latLong":       { "type": "geo_point" },
      "gender":        { "type": "keyword" },
      "birthYear":     { "type": "keyword" },
      "birthMonth":    { "type": "keyword" },
      "birthday":      { "type": "keyword" },
      "dob":           { "type": "text" },
      "ethnicity":     { "type": "keyword" },
      "income":        { "type": "keyword" },
      "domain":        { "type": "text", "fields": { "keyword": { "type": "keyword", "normalizer": "lowercase" } } },
      "ips":           { "type": "ip" },
      "asn":           { "type": "integer" },
      "asnOrg":        { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "source":        { "type": "keyword" },
      "vin":           { "type": "keyword", "normalizer": "lowercase" },
      "autoMake":      { "type": "keyword" },
      "autoModel":     { "type": "keyword" },
      "autoYear":      { "type": "keyword" },
      "autoBody":      { "type": "keyword" },
      "autoClass":     { "type": "keyword" },
      "VRN":           { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "photographs":   { "type": "keyword", "index": false },
      "photos":        { "type": "keyword", "index": false },
      "links":         { "type": "keyword", "index": false },
      "notes":         { "type": "text", "index": false },
      "party":         { "type": "keyword", "index": false },
      "line":          { "type": "keyword", "index": false },
      "location":      { "type": "text" },
      "accuracy_radius": { "type": "integer" }
    }
  }
}'

echo ""
echo ""
echo "=== Creating wallets index ==="

curl -s -X PUT "$ES_HOST/wallets" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "credits": { "type": "float" }
    }
  }
}'

echo ""
echo ""
echo "=== Creating exports index ==="

curl -s -X PUT "$ES_HOST/exports" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "wallet":  { "type": "keyword" },
      "query":   { "type": "text" },
      "status":  { "type": "keyword" },
      "cost":    { "type": "float" },
      "count":   { "type": "integer" },
      "link":    { "type": "keyword", "index": false }
    }
  }
}'

echo ""
echo ""
echo "=== Setup complete ==="
echo "Indices created: bigdata, wallets, exports"
