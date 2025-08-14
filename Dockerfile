# tmux-claude-bridge Dockerfile
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o tmux-claude-bridge .

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tmux \
    bash \
    curl \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup

# Create necessary directories
RUN mkdir -p /app/logs /app/data

# Copy the binary from builder
COPY --from=builder /app/tmux-claude-bridge /app/tmux-claude-bridge

# Copy static files if they exist
COPY --from=builder /app/client.html /app/client.html

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set default environment variables
ENV PORT=8080
ENV TMUX_SESSION=claude-bridge
ENV TMUX_PANE=1
ENV LOG_LEVEL=info

# Run the application
CMD ["./tmux-claude-bridge"]