export interface BuildEnvironment {
  githubActions?: string | undefined;
  repository?: string | undefined;
}

export function resolveBasePath(environment: BuildEnvironment): string {
  if (environment.githubActions !== 'true') {
    return '/';
  }

  const repositoryName = environment.repository?.split('/').at(-1)?.trim();
  return repositoryName ? `/${repositoryName}/` : '/';
}
