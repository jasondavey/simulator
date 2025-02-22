import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  state: string;
  event: string;
  input?: any;
  output?: any;
  error?: any;
  duration?: number;
}

export class WorkflowLogger {
  private logEntries: LogEntry[] = [];
  private startTime: number;
  private reportPath: string;

  constructor(clientId: string) {
    this.startTime = Date.now();
    const timestamp = new Date().toISOString().split('T')[0];
    const reportDir = path.join(process.cwd(), 'flow-reports');
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    this.reportPath = path.join(
      reportDir,
      `onboarding-flow-${clientId}-${timestamp}.md`
    );
  }

  logStateTransition(state: string, event: string, input?: any, output?: any, error?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      state,
      event,
      input: this.sanitizeData(input),
      output: this.sanitizeData(output),
      error: error ? this.sanitizeError(error) : undefined,
      duration: Date.now() - this.startTime
    };
    
    this.logEntries.push(entry);
    this.writeReport();
  }

  private sanitizeData(data: any): any {
    if (!data) return undefined;
    
    // Deep clone to avoid modifying original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitizeObj = (obj: any) => {
      if (typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObj(obj[key]);
        }
      });
    };
    
    sanitizeObj(sanitized);
    return sanitized;
  }

  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  private writeReport() {
    let report = `# Onboarding Workflow Diagnostic Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += `## Summary\n`;
    report += `- Total Duration: ${this.formatDuration(Date.now() - this.startTime)}\n`;
    report += `- Total Steps: ${this.logEntries.length}\n`;
    report += `- Errors: ${this.logEntries.filter(e => e.error).length}\n\n`;
    
    report += `## Detailed Flow\n\n`;
    
    this.logEntries.forEach((entry, index) => {
      report += `### Step ${index + 1}: ${entry.state}\n`;
      report += `- Timestamp: ${entry.timestamp}\n`;
      report += `- Event: ${entry.event}\n`;
      report += `- Duration: ${this.formatDuration(entry.duration || 0)}\n`;
      
      if (entry.input) {
        report += `\n**Input:**\n\`\`\`json\n${JSON.stringify(entry.input, null, 2)}\n\`\`\`\n`;
      }
      
      if (entry.output) {
        report += `\n**Output:**\n\`\`\`json\n${JSON.stringify(entry.output, null, 2)}\n\`\`\`\n`;
      }
      
      if (entry.error) {
        report += `\n**Error:**\n\`\`\`\n${JSON.stringify(entry.error, null, 2)}\n\`\`\`\n`;
      }
      
      report += `\n---\n\n`;
    });
    
    fs.writeFileSync(this.reportPath, report);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
}
