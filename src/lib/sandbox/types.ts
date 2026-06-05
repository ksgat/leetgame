export type LogType = 'log' | 'info' | 'warn' | 'error';

export type SandboxStatus = 'idle' | 'booting' | 'running' | 'error' | 'stopped';

export type SandboxMessage =
	| {
			type: 'ready';
	  }
	| {
			type: 'started';
	  }
	| {
			type: 'console';
			level: LogType;
			values: string[];
	  }
	| {
			type: 'error';
			message: string;
			stack?: string;
	  };

export type LogEntry = {
	id: number;
	type: LogType | 'runtime';
	text: string;
};

export type ActiveSandboxTab = 'code' | 'prompt';
