# Dockerfile for Go Data Engine
FROM golang:1.22-alpine AS builder

# Set working directory
WORKDIR /app

# Install git (needed for Go modules)
RUN apk add --no-cache git

# Copy go mod files
COPY go_Stream/go.mod go_Stream/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY go_Stream/ ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o p9_intel_engine ./cmd/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/p9_intel_engine .

# Copy config files
COPY --from=builder /app/cmd/configs ./configs

# Expose the internal WebSocket port
EXPOSE 8899

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8899/health || exit 1

# Run the binary
CMD ["./p9_intel_engine"]