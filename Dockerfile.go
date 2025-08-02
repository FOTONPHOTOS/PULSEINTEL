# Dockerfile for PulseIntel Go Stream Engine
FROM golang:1.22-alpine AS builder

# Set working directory
WORKDIR /app

# Install git and build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go mod files
COPY go_Stream/go.mod go_Stream/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY go_Stream/ ./

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o pulseintel_engine ./cmd/main.go

# Final stage - minimal runtime image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user
RUN adduser -D -s /bin/sh pulseintel

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/pulseintel_engine .
COPY --from=builder /app/configs ./configs

# Set ownership
RUN chown -R pulseintel:pulseintel /app

# Switch to non-root user
USER pulseintel

# Expose the Go stream port
EXPOSE 8899

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --timeout=5 http://localhost:8899/health || exit 1

# Run the stream engine
CMD ["./pulseintel_engine"]