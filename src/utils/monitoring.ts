/**
 * Monitoring and metrics utilities
 */

interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  totalDuration: number;
  avgDuration: number;
}

interface ErrorMetrics {
  [errorType: string]: number;
}

interface FileMetrics {
  generated: number;
  uploaded: number;
  failed: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  metrics: {
    requests: RequestMetrics;
    errors: ErrorMetrics;
    files: FileMetrics;
  };
}

class MetricsCollector {
  private startTime: number;
  private requestMetrics: RequestMetrics;
  private errorMetrics: ErrorMetrics;
  private fileMetrics: FileMetrics;
  private requestDurations: number[];
  private nextIndex: number;
  private maxSize: number;

  constructor() {
    this.startTime = Date.now();
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      totalDuration: 0,
      avgDuration: 0,
    };
    this.errorMetrics = {};
    this.fileMetrics = {
      generated: 0,
      uploaded: 0,
      failed: 0,
    };
    this.requestDurations = [];
    this.nextIndex = 0;
    this.maxSize = 100;
  }

  recordRequest(success: boolean, duration: number): void {
    this.requestMetrics.total++;

    if (success) {
      this.requestMetrics.successful++;
    } else {
      this.requestMetrics.failed++;
    }

    this.requestMetrics.totalDuration += duration;

    // Use circular buffer: overwrite at nextIndex and increment with modulo
    this.requestDurations[this.nextIndex] = duration;
    this.nextIndex = (this.nextIndex + 1) % this.maxSize;

    // Calculate average from actual entries in buffer
    const count = Math.min(this.requestDurations.length, this.maxSize);
    this.requestMetrics.avgDuration =
      this.requestDurations.reduce((sum, d) => sum + d, 0) / count;
  }

  recordError(errorType: string): void {
    this.errorMetrics[errorType] = (this.errorMetrics[errorType] || 0) + 1;
  }

  recordFileGenerated(): void {
    this.fileMetrics.generated++;
  }

  recordFileUploaded(): void {
    this.fileMetrics.uploaded++;
  }

  recordFileUploadFailed(): void {
    this.fileMetrics.failed++;
  }

  getMetrics(): {
    requests: RequestMetrics;
    errors: ErrorMetrics;
    files: FileMetrics;
  } {
    return {
      requests: { ...this.requestMetrics },
      errors: { ...this.errorMetrics },
      files: { ...this.fileMetrics },
    };
  }

  getHealth(): HealthStatus {
    const uptime = Date.now() - this.startTime;
    const metrics = this.getMetrics();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const errorRate =
      metrics.requests.total > 0
        ? metrics.requests.failed / metrics.requests.total
        : 0;

    if (errorRate > 0.5) {
      status = 'unhealthy';
    } else if (errorRate > 0.2) {
      status = 'degraded';
    }

    const fileUploadRate =
      metrics.files.generated > 0
        ? metrics.files.uploaded / metrics.files.generated
        : 1;

    if (fileUploadRate < 0.5 && metrics.files.generated > 10) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      timestamp: new Date().toISOString(),
      metrics,
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      totalDuration: 0,
      avgDuration: 0,
    };
    this.errorMetrics = {};
    this.fileMetrics = {
      generated: 0,
      uploaded: 0,
      failed: 0,
    };
    this.requestDurations = [];
    this.nextIndex = 0;
  }
}

export const metrics = new MetricsCollector();

export function getUptimeString(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
