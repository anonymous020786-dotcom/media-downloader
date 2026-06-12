import pkg from '../package.json'

export const BUILD_INFO = {
  version:     pkg.version ?? '1.0.0',
  name:        pkg.name ?? 'mediadl',
  nodeVersion: process.version,
  nextVersion: (pkg.dependencies?.next ?? '').replace('^','').replace('~',''),
  buildTime:   process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString(),
  env:         process.env.NODE_ENV ?? 'development',
  commitHash:  process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'local',
}
