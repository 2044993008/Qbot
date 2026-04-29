import { spawn } from 'child_process';
import net from 'net';

type Mode = 'dev' | 'build' | 'start';

const mode = process.argv[2] as Mode | undefined;
const workspacePath = process.env.COZE_WORKSPACE_PATH || process.cwd();
const port = process.env.PORT || '5000';
const deployRunPort = process.env.DEPLOY_RUN_PORT || port;

if (!mode || !['dev', 'build', 'start'].includes(mode)) {
  console.error('Usage: tsx scripts/run.ts <dev|build|start>');
  process.exit(1);
}

function runCommand(command: string, args: string[], env: Record<string, string | undefined> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspacePath,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function tryConnect(targetPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(targetPort, '127.0.0.1');
  });
}

async function killPortIfListening(targetPort: number): Promise<void> {
  const isBusy = await tryConnect(targetPort);
  if (!isBusy) {
    console.log(`Port ${targetPort} is free.`);
    return;
  }

  if (process.platform === 'win32') {
    console.log(`Port ${targetPort} is busy. Attempting to clear it on Windows...`);
    await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`,
    ]);
  } else {
    console.log(`Port ${targetPort} is busy. Attempting to clear it...`);
    await runCommand('sh', ['-c', `lsof -ti tcp:${targetPort} | xargs -r kill -9`]);
  }
}

async function runDev(): Promise<void> {
  const devPort = parseInt(deployRunPort, 10);
  console.log(`Clearing port ${devPort} before start.`);
  await killPortIfListening(devPort);
  console.log(`Starting HTTP service on port ${devPort} for dev...`);
  await runCommand('pnpm', ['tsx', 'watch', 'src/server.ts'], { PORT: String(devPort) });
}

async function runBuild(): Promise<void> {
  console.log('Installing dependencies...');
  await runCommand('pnpm', ['install', '--prefer-frozen-lockfile', '--prefer-offline', '--loglevel', 'debug', '--reporter', 'append-only']);

  console.log('Building the Next.js project...');
  await runCommand('pnpm', ['next', 'build']);

  console.log('Bundling server with tsup...');
  await runCommand('pnpm', ['tsup', 'src/server.ts', '--format', 'cjs', '--platform', 'node', '--target', 'node20', '--outDir', 'dist', '--no-splitting', '--no-minify']);

  console.log('Build completed successfully!');
}

async function runStart(): Promise<void> {
  console.log(`Starting HTTP service on port ${deployRunPort} for deploy...`);
  await runCommand('node', ['dist/server.js'], { PORT: String(deployRunPort) });
}

async function main(): Promise<void> {
  if (mode === 'dev') {
    await runDev();
    return;
  }

  if (mode === 'build') {
    await runBuild();
    return;
  }

  await runStart();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
