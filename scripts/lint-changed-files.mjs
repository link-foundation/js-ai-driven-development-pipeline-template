import path from 'node:path';

const LINT_CONFIG_FILE =
  /^(?:eslint\.config\.[^/]+|eslint-rules\/.+|package(?:-lock)?\.json)$/;

export function changesLintConfig(changedFiles) {
  return [...changedFiles].some((file) => LINT_CONFIG_FILE.test(file));
}

export function filterWarningsToChangedFiles(results, changedFiles, cwd) {
  return results.map((result) => {
    const relativePath = path
      .relative(cwd, result.filePath)
      .split(path.sep)
      .join('/');
    if (changedFiles.has(relativePath)) {
      return result;
    }

    return {
      ...result,
      messages: result.messages.filter((message) => message.severity !== 1),
      warningCount: 0,
      fixableWarningCount: 0,
    };
  });
}

/**
 * Exit code for the reported results: any error or any reported warning
 * fails. The pre-commit hook runs ESLint with --max-warnings 0, so CI rejects
 * what a skipped hook would have rejected.
 *
 * @param {Array<object>} reported ESLint results after filtering
 * @returns {0 | 1}
 */
export function lintExitCode(reported) {
  return reported.some((result) => result.errorCount + result.warningCount > 0)
    ? 1
    : 0;
}
