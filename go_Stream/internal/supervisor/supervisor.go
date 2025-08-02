package supervisor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// WorkerFunc represents a function that can be supervised
type WorkerFunc func(ctx context.Context) error

// WorkerConfig holds configuration for individual workers
type WorkerConfig struct {
	Name           string
	Exchange       string
	Symbol         string
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	BackoffFactor  float64
}

// Worker represents a supervised worker
type Worker struct {
	config    WorkerConfig
	workerFunc WorkerFunc
	cancel    context.CancelFunc
	retries   int
	lastError error
	status    WorkerStatus
	startTime time.Time
	stopTime  time.Time
	mu        sync.RWMutex
}

// WorkerStatus represents the current status of a worker
type WorkerStatus string

const (
	StatusStopped  WorkerStatus = "stopped"
	StatusStarting WorkerStatus = "starting"
	StatusRunning  WorkerStatus = "running"
	StatusStopping WorkerStatus = "stopping"
	StatusFailed   WorkerStatus = "failed"
	StatusRetrying WorkerStatus = "retrying"
)

// Supervisor manages multiple workers with lifecycle management
type Supervisor struct {
	workers   map[string]*Worker
	logger    *zap.Logger
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	mu        sync.RWMutex
	started   bool
	startTime time.Time
}

// NewSupervisor creates a new supervisor instance
func NewSupervisor(logger *zap.Logger) *Supervisor {
	ctx, cancel := context.WithCancel(context.Background())
	return &Supervisor{
		workers: make(map[string]*Worker),
		logger:  logger,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// AddWorker adds a new worker to be supervised
func (s *Supervisor) AddWorker(config WorkerConfig, workerFunc WorkerFunc) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.started {
		return fmt.Errorf("cannot add worker while supervisor is running")
	}

	if _, exists := s.workers[config.Name]; exists {
		return fmt.Errorf("worker %s already exists", config.Name)
	}

	worker := &Worker{
		config:     config,
		workerFunc: workerFunc,
		status:     StatusStopped,
	}

	s.workers[config.Name] = worker
	s.logger.Info("Worker added",
		zap.String("name", config.Name),
		zap.String("exchange", config.Exchange),
		zap.String("symbol", config.Symbol),
	)

	return nil
}

// Start starts the supervisor and all workers
func (s *Supervisor) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.started {
		return fmt.Errorf("supervisor already started")
	}

	s.started = true
	s.startTime = time.Now()

	s.logger.Info("Starting supervisor", zap.Int("workers", len(s.workers)))

	// Start all workers
	for name, worker := range s.workers {
		s.wg.Add(1)
		go s.runWorker(name, worker)
	}

	// Start health check routine
	s.wg.Add(1)
	go s.healthCheckLoop()

	return nil
}

// Stop stops the supervisor and all workers gracefully
func (s *Supervisor) Stop() error {
	s.mu.Lock()
	if !s.started {
		s.mu.Unlock()
		return fmt.Errorf("supervisor not started")
	}
	s.mu.Unlock()

	s.logger.Info("Stopping supervisor")

	// Cancel context to signal all workers to stop
	s.cancel()

	// Wait for all workers to finish with timeout
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info("All workers stopped successfully")
	case <-time.After(30 * time.Second):
		s.logger.Warn("Timeout waiting for workers to stop")
	}

	s.mu.Lock()
	s.started = false
	s.mu.Unlock()

	return nil
}

// runWorker runs a single worker with retry logic
func (s *Supervisor) runWorker(name string, worker *Worker) {
	defer s.wg.Done()

	ctx, cancel := context.WithCancel(s.ctx)
	worker.cancel = cancel
	defer cancel()

	logger := s.logger.With(
		zap.String("worker", name),
		zap.String("exchange", worker.config.Exchange),
		zap.String("symbol", worker.config.Symbol),
	)

	for {
		select {
		case <-s.ctx.Done():
			worker.setStatus(StatusStopped)
			logger.Info("Worker stopped by supervisor")
			return
		default:
		}

		// Check if max retries exceeded
		if worker.config.MaxRetries > 0 && worker.retries >= worker.config.MaxRetries {
			worker.setStatus(StatusFailed)
			logger.Error("Worker failed after max retries",
				zap.Int("retries", worker.retries),
				zap.Error(worker.lastError),
			)
			return
		}

		// Start worker
		worker.setStatus(StatusStarting)
		worker.startTime = time.Now()
		logger.Info("Starting worker", zap.Int("retry", worker.retries))

		err := s.executeWorker(ctx, worker, logger)
		worker.stopTime = time.Now()

		if err != nil {
			worker.lastError = err
			worker.retries++
			
			if err == context.Canceled {
				worker.setStatus(StatusStopped)
				logger.Info("Worker cancelled")
				return
			}

			worker.setStatus(StatusRetrying)
			logger.Error("Worker failed",
				zap.Error(err),
				zap.Int("retries", worker.retries),
			)

			// Calculate backoff delay
			backoff := s.calculateBackoff(worker.retries, worker.config)
			logger.Info("Retrying worker after backoff",
				zap.Duration("backoff", backoff),
			)

			select {
			case <-time.After(backoff):
				continue
			case <-s.ctx.Done():
				worker.setStatus(StatusStopped)
				return
			}
		} else {
			// Worker completed successfully (unexpected for long-running workers)
			worker.setStatus(StatusStopped)
			logger.Info("Worker completed successfully")
			return
		}
	}
}

// executeWorker executes the worker function with proper error handling
func (s *Supervisor) executeWorker(ctx context.Context, worker *Worker, logger *zap.Logger) error {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("Worker panicked", zap.Any("panic", r))
		}
	}()

	worker.setStatus(StatusRunning)
	logger.Info("Worker running")

	return worker.workerFunc(ctx)
}

// calculateBackoff calculates exponential backoff delay
func (s *Supervisor) calculateBackoff(retries int, config WorkerConfig) time.Duration {
	backoff := config.InitialBackoff
	
	for i := 0; i < retries-1; i++ {
		backoff = time.Duration(float64(backoff) * config.BackoffFactor)
		if backoff > config.MaxBackoff {
			backoff = config.MaxBackoff
			break
		}
	}
	
	return backoff
}

// healthCheckLoop periodically checks worker health
func (s *Supervisor) healthCheckLoop() {
	defer s.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.performHealthCheck()
		}
	}
}

// performHealthCheck checks health of all workers
func (s *Supervisor) performHealthCheck() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	unhealthyWorkers := 0

	for name, worker := range s.workers {
		worker.mu.RLock()
		status := worker.status
		startTime := worker.startTime
		lastError := worker.lastError
		retries := worker.retries
		worker.mu.RUnlock()

		// Check for stuck workers (running for too long without progress)
		if status == StatusRunning {
			runtime := now.Sub(startTime)
			if runtime > 5*time.Minute {
				s.logger.Warn("Worker running for extended time",
					zap.String("worker", name),
					zap.Duration("runtime", runtime),
				)
			}
		}

		// Count unhealthy workers
		if status == StatusFailed || status == StatusRetrying {
			unhealthyWorkers++
		}

		// Log worker status
		s.logger.Debug("Worker health check",
			zap.String("worker", name),
			zap.String("status", string(status)),
			zap.Int("retries", retries),
			zap.Error(lastError),
		)
	}

	// Log overall health
	s.logger.Info("Health check completed",
		zap.Int("total_workers", len(s.workers)),
		zap.Int("unhealthy_workers", unhealthyWorkers),
	)
}

// GetWorkerStatus returns the status of a specific worker
func (s *Supervisor) GetWorkerStatus(name string) (WorkerStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	worker, exists := s.workers[name]
	if !exists {
		return "", fmt.Errorf("worker %s not found", name)
	}

	worker.mu.RLock()
	status := worker.status
	worker.mu.RUnlock()

	return status, nil
}

// GetAllWorkerStatus returns status of all workers
func (s *Supervisor) GetAllWorkerStatus() map[string]WorkerStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := make(map[string]WorkerStatus)
	for name, worker := range s.workers {
		worker.mu.RLock()
		status[name] = worker.status
		worker.mu.RUnlock()
	}

	return status
}

// RestartWorker manually restarts a specific worker
func (s *Supervisor) RestartWorker(name string) error {
	s.mu.RLock()
	worker, exists := s.workers[name]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("worker %s not found", name)
	}

	s.logger.Info("Manually restarting worker", zap.String("worker", name))

	// Cancel current worker context
	if worker.cancel != nil {
		worker.cancel()
	}

	// Reset retry count
	worker.mu.Lock()
	worker.retries = 0
	worker.lastError = nil
	worker.mu.Unlock()

	return nil
}

// GetSupervisorStats returns supervisor statistics
func (s *Supervisor) GetSupervisorStats() SupervisorStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := SupervisorStats{
		TotalWorkers: len(s.workers),
		Started:      s.started,
		StartTime:    s.startTime,
		Workers:      make(map[string]WorkerStats),
	}

	for name, worker := range s.workers {
		worker.mu.RLock()
		stats.Workers[name] = WorkerStats{
			Name:      name,
			Exchange:  worker.config.Exchange,
			Symbol:    worker.config.Symbol,
			Status:    worker.status,
			Retries:   worker.retries,
			StartTime: worker.startTime,
			StopTime:  worker.stopTime,
			LastError: worker.lastError,
		}
		worker.mu.RUnlock()

		// Count statuses
		switch worker.status {
		case StatusRunning:
			stats.RunningWorkers++
		case StatusFailed:
			stats.FailedWorkers++
		case StatusRetrying:
			stats.RetryingWorkers++
		case StatusStopped:
			stats.StoppedWorkers++
		}
	}

	return stats
}

// setStatus safely sets worker status
func (w *Worker) setStatus(status WorkerStatus) {
	w.mu.Lock()
	w.status = status
	w.mu.Unlock()
}

// SupervisorStats holds supervisor statistics
type SupervisorStats struct {
	TotalWorkers   int                    `json:"total_workers"`
	RunningWorkers int                    `json:"running_workers"`
	FailedWorkers  int                    `json:"failed_workers"`
	RetryingWorkers int                   `json:"retrying_workers"`
	StoppedWorkers int                    `json:"stopped_workers"`
	Started        bool                   `json:"started"`
	StartTime      time.Time              `json:"start_time"`
	Workers        map[string]WorkerStats `json:"workers"`
}

// WorkerStats holds individual worker statistics
type WorkerStats struct {
	Name      string       `json:"name"`
	Exchange  string       `json:"exchange"`
	Symbol    string       `json:"symbol"`
	Status    WorkerStatus `json:"status"`
	Retries   int          `json:"retries"`
	StartTime time.Time    `json:"start_time"`
	StopTime  time.Time    `json:"stop_time"`
	LastError error        `json:"last_error,omitempty"`
} 