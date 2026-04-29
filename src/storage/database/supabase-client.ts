import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { join } from 'path';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

type FetchLike = typeof fetch;

function getEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function loadEnv(): void {
  if (envLoaded || getEnvValue('LOCAL_SUPABASE_URL', 'COZE_SUPABASE_URL') && getEnvValue('LOCAL_SUPABASE_ANON_KEY', 'COZE_SUPABASE_ANON_KEY')) {
    return;
  }

  try {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dotenv = require('dotenv');
      dotenv.config({ path: join(process.cwd(), '.env.local') });
      dotenv.config();
      if (getEnvValue('LOCAL_SUPABASE_URL', 'COZE_SUPABASE_URL') && getEnvValue('LOCAL_SUPABASE_ANON_KEY', 'COZE_SUPABASE_ANON_KEY')) {
        envLoaded = true;
        return;
      }
    } catch {
      // dotenv not available
    }

    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = getEnvValue('LOCAL_SUPABASE_URL', 'COZE_SUPABASE_URL');
  const anonKey = getEnvValue('LOCAL_SUPABASE_ANON_KEY', 'COZE_SUPABASE_ANON_KEY');

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  loadEnv();
  return getEnvValue('LOCAL_SUPABASE_SERVICE_ROLE_KEY', 'COZE_SUPABASE_SERVICE_ROLE_KEY', 'LOCAL_SUPABASE_ANON_KEY', 'COZE_SUPABASE_ANON_KEY');
}

function shouldRewriteLocalRestUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url);
}

function createLocalPostgrestFetch(baseFetch: FetchLike): FetchLike {
  return (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const rewrittenUrl = requestUrl.replace('/rest/v1/', '/');

    if (typeof input === 'string' || input instanceof URL) {
      return baseFetch(rewrittenUrl, init);
    }

    return baseFetch(new Request(rewrittenUrl, input), init);
  };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  let key: string;
  if (token) {
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  if (shouldRewriteLocalRestUrl(url)) {
    globalOptions.fetch = createLocalPostgrestFetch(fetch);
  }

  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
