curl -X POST "http://localhost:8081/generate-font" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@$HOME/Downloads/NBMetadataCache.jpeg" \
  --output CustomFont.ttf
