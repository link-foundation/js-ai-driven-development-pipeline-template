import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { parse } from 'yaml';

const WRAPPER = /(?:^|\/)run-with-budget-warning\.sh$/;
const DOWNLOAD_SCRIPTS =
  /(?:^|\/)(install-lychee\.sh|setup-preview-gh\.sh|setup-npm\.mjs|npm-audit-report\.mjs|check-deprecated-packages\.mjs)$/;
const OFFLINE = /^(?:--no-index|--offline|--no-install|--no)$/;

function* shellCommands(run) {
  // Keep quoted paths, labels and arguments together. Split shell lists and
  // pipelines so a wrapper for one command cannot cover a following command.
  const source = run.replace(/\\\r?\n/g, '');
  const tokens = source.matchAll(
    /#[^\n]*|[;&|()\n]+|(?:"(?:\\.|[^"\\])*"|'[^']*'|\\.|[^\s"';&|()\\])+/g
  );
  let words = [];
  for (const [token] of tokens) {
    if (token.startsWith('#')) {
      continue;
    }
    if (/^[;&|()\n]/.test(token)) {
      if (words.length) {
        yield words;
      }
      words = [];
      continue;
    }
    words.push(token.replace(/^(["'])(.*)\1$/, '$2'));
  }
  if (words.length) {
    yield words;
  }
}

function commandWords(words) {
  const prefix = /^(?:if|then|else|do|!|env|sudo|command|[A-Za-z_]\w*=.*)$/;
  const start = words.findIndex((word) => !prefix.test(word));
  return start === -1 ? [] : words.slice(start);
}

function afterInterpreter(words) {
  return /^(?:bash|sh|node)$/.test(posix.basename(words[0] ?? ''))
    ? words.slice(1)
    : words;
}

const NETWORK_SUBCOMMANDS = {
  apt: /^(?:install|update)$/,
  'apt-get': /^(?:install|update)$/,
  brew: /^(?:install|update)$/,
  bun: /^(?:install|add|i)$/,
  deno: /^(?:install|cache)$/,
  npm: /^(?:ci|i|in|install|add|exec|x)$/,
  pip: /^install$/,
  pipx: /^(?:install|run)$/,
  pnpm: /^(?:install|add|i|dlx)$/,
  yarn: /^(?:install|add|dlx)$/,
};

function isNetworkInstall(words) {
  const tool = posix.basename(words[0] ?? '');
  if (
    /^(?:curl|wget)$/.test(tool) ||
    DOWNLOAD_SCRIPTS.test(afterInterpreter(words)[0] ?? '')
  ) {
    return true;
  }
  return (
    !words.some((word) => OFFLINE.test(word)) && isPackageInstall(tool, words)
  );
}

function isPackageInstall(tool, words) {
  const [, subcommand = '', ...args] = words;
  if (/^(?:npx|bunx)$/.test(tool)) {
    return true;
  }
  if (/^(?:uv|python[0-9.]*)$/.test(tool)) {
    return words.includes('pip') && words.includes('install');
  }
  if (tool === 'deno' && subcommand === 'test') {
    return args.includes('--no-run');
  }
  tool = tool.replace(/^pip[0-9.]+$/, 'pip');
  const command =
    tool === 'npm' && subcommand === '--prefix' ? args[1] : subcommand;
  return (
    Object.hasOwn(NETWORK_SUBCOMMANDS, tool) &&
    NETWORK_SUBCOMMANDS[tool].test(command)
  );
}

function budgetSeconds(raw, env) {
  const variable = raw?.match(/^\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))$/);
  const value = variable ? env[variable[1] ?? variable[2]] : raw;
  return /^\d+$/.test(value ?? '') ? Number(value) : NaN;
}

function actionBudgets(step, context) {
  const action = posix.normalize(step.uses ?? '');
  if (!step.uses?.startsWith('./')) {
    return [];
  }
  if (!context.actions.has(action)) {
    throw new Error(`Missing local action ${action}`);
  }
  if (context.stack.includes(action)) {
    throw new Error(`Recursive composite action ${action}`);
  }

  const composite = context.actions.get(action);
  return collectStepBudgets(composite.runs?.steps ?? [], {
    ...context,
    stack: [...context.stack, action],
  });
}

export function collectStepBudgets(steps, context) {
  const budgets = [];
  for (const step of steps) {
    const conditions = [...context.conditions, step.if].filter(Boolean);
    const env = { ...context.env, ...step.env };
    for (const command of shellCommands(step.run ?? '')) {
      const words = commandWords(command);
      const [script, raw, label, ...wrapped] = afterInterpreter(words);
      if (WRAPPER.test(script ?? '')) {
        budgets.push({
          label: label ?? step.name,
          seconds: label && wrapped.length ? budgetSeconds(raw, env) : NaN,
          conditions,
          source: JSON.stringify(raw) ?? 'missing budget',
        });
      } else if (isNetworkInstall(words)) {
        context.unbudgeted.push(
          `${context.stack.join(' → ')}: "${step.name ?? script}" runs ${words.join(' ')}`
        );
      }
    }

    if (step['timeout-minutes'] !== undefined) {
      budgets.push({
        label: step.name ?? step.uses ?? 'step timeout-minutes',
        seconds: Number(step['timeout-minutes']) * 60,
        conditions,
        source: String(step['timeout-minutes']),
      });
    }
    budgets.push(...actionBudgets(step, { ...context, conditions, env }));
  }
  return budgets;
}

export function getConcurrentBudgetSeconds(budgets) {
  // Distinct equality values on the same matrix axis are mutually exclusive.
  // Count other expressions as potentially simultaneous, even if they differ.
  const axes = new Map();
  let total = 0;
  for (const { conditions, seconds } of budgets) {
    const equality = conditions
      .map((guard) =>
        String(guard)
          .replaceAll(/\$\{\{|\}\}/g, '')
          .trim()
      )
      .map((guard) => guard.match(/^(matrix\.[\w-]+)\s*==\s*'([^']+)'$/))
      .find(Boolean);
    if (!equality) {
      total += seconds;
      continue;
    }

    const [, axis, value] = equality;
    if (!axes.has(axis)) {
      axes.set(axis, new Map());
    }
    const values = axes.get(axis);
    values.set(value, (values.get(value) ?? 0) + seconds);
  }
  for (const values of axes.values()) {
    total += Math.max(...values.values());
  }
  return total;
}

export function readWorkflows() {
  return readdirSync('.github/workflows')
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => {
      const path = `.github/workflows/${file}`;
      return [path, parse(readFileSync(path, 'utf8'))];
    });
}

export function readActions(
  directory = '.github/actions',
  actions = new Map()
) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      readActions(`${directory}/${entry.name}`, actions);
    } else if (/^action\.ya?ml$/.test(entry.name)) {
      actions.set(
        directory,
        parse(readFileSync(`${directory}/${entry.name}`, 'utf8'))
      );
    }
  }
  return actions;
}

export function getJobBudgets(workflow, job, actions, unbudgeted, location) {
  return collectStepBudgets(job.steps ?? [], {
    actions,
    unbudgeted,
    stack: [location],
    env: { ...workflow.env, ...job.env },
    conditions: [],
  });
}
